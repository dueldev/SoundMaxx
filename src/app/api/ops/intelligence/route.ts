import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  analyticsDailyAggregates,
  artifacts,
  assets,
  jobs,
  modelRollouts,
  modelVersions,
  sessions,
  trainingRuns,
  trainingSamples,
} from "@/lib/db/schema";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { hasOpsApiAccess } from "@/lib/ops-access";
import { queueDepth } from "@/lib/redis";
import type { OpsIntelligenceResponse } from "@/types/api";

export const runtime = "nodejs";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "expired"]);
const TRAINING_TARGET_TOOLS = ["stem_isolation", "mastering", "midi_extract"] as const;

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function dayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function asPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildProductOpportunities(
  response: Pick<OpsIntelligenceResponse, "product" | "tools" | "errors" | "queue" | "overview">,
): OpsIntelligenceResponse["product"]["opportunities"] {
  const opportunities: OpsIntelligenceResponse["product"]["opportunities"] = [];

  const funnel = response.product.funnel24h;
  const leaks = response.product.conversionLeaks24h;
  const activation = response.product.activation;
  const retention = response.product.retention;
  const trends = response.product.trends24h;

  if (funnel.sessionToAssetRate < 0.4) {
    opportunities.push({
      key: "session_to_asset_dropoff",
      severity: funnel.sessionToAssetRate < 0.25 ? "critical" : "warn",
      headline: "Upload conversion is low",
      metric: `${asPercent(funnel.sessionToAssetRate)} of sessions created an upload in 24h`,
      recommendation: "Tighten above-the-fold copy, reduce upload friction, and A/B test CTA text on the home page.",
    });
  }

  if (funnel.assetToJobRate < 0.75) {
    opportunities.push({
      key: "asset_to_job_dropoff",
      severity: funnel.assetToJobRate < 0.5 ? "critical" : "warn",
      headline: "Uploaded audio is not progressing into jobs",
      metric: `${asPercent(funnel.assetToJobRate)} of uploaded assets reached job creation`,
      recommendation: "Instrument post-upload dropoff reasons and simplify tool selection defaults after upload.",
    });
  }

  if (leaks.sessionsWithoutJob >= 10) {
    opportunities.push({
      key: "session_without_job_leak",
      severity: leaks.sessionsWithoutJob >= 25 ? "critical" : "warn",
      headline: "Many sessions never start a processing job",
      metric: `${leaks.sessionsWithoutJob} recent sessions ended before first job`,
      recommendation: "Add a guided one-click 'best for this file' action immediately after upload.",
    });
  }

  if (funnel.jobToSuccessRate < 0.9) {
    opportunities.push({
      key: "job_success_gap",
      severity: funnel.jobToSuccessRate < 0.8 ? "critical" : "warn",
      headline: "Processing reliability is suppressing completion",
      metric: `Terminal success is ${asPercent(funnel.jobToSuccessRate)} in 24h`,
      recommendation: "Prioritize top failure modes, then canary model/provider changes against a fixed baseline.",
    });
  }

  if (activation.medianTimeToFirstJobSec24h !== null && activation.medianTimeToFirstJobSec24h > 180) {
    opportunities.push({
      key: "slow_time_to_first_job",
      severity: activation.medianTimeToFirstJobSec24h > 360 ? "critical" : "warn",
      headline: "Time-to-first-value is slow",
      metric: `Median time to first job is ${Math.round(activation.medianTimeToFirstJobSec24h)}s`,
      recommendation: "Preselect recommended tool presets and shorten the first-run configuration surface.",
    });
  }

  if (retention.returningRate7d < 0.25) {
    opportunities.push({
      key: "low_returning_sessions",
      severity: retention.returningRate7d < 0.15 ? "critical" : "warn",
      headline: "Returning-session rate is low",
      metric: `${asPercent(retention.returningRate7d)} of active sessions returned on multiple days`,
      recommendation: "Add re-engagement hooks: recent-run recall, faster rerun presets, and result-quality nudges.",
    });
  }

  if (trends.sessionsDelta > 0 && trends.sessionToAssetRateDelta < -0.05) {
    opportunities.push({
      key: "new_traffic_conversion_decline",
      severity: trends.sessionToAssetRateDelta < -0.1 ? "critical" : "warn",
      headline: "New traffic is converting worse than yesterday",
      metric: `Session->upload changed by ${asPercent(trends.sessionToAssetRateDelta)}`,
      recommendation:
        "Review acquisition channels, landing copy, and upload friction introduced in the last 24h before traffic quality degrades further.",
    });
  }

  if (trends.rerunRateDelta > 0.08 && trends.confidence.statisticallyStable) {
    opportunities.push({
      key: "rerun_rate_spike",
      severity: trends.rerunRateDelta > 0.15 ? "critical" : "warn",
      headline: "Rerun pressure is rising day-over-day",
      metric: `Rerun rate changed by ${asPercent(trends.rerunRateDelta)}`,
      recommendation:
        "Audit output quality regressions and inspect first-pass preset defaults for tools with the largest rerun volume.",
    });
  }

  if ((trends.p95LatencyDeltaSec ?? 0) > 45) {
    opportunities.push({
      key: "latency_regression_24h",
      severity: (trends.p95LatencyDeltaSec ?? 0) > 120 ? "critical" : "warn",
      headline: "Latency has regressed versus prior day",
      metric: `p95 latency increased by ${Math.round(trends.p95LatencyDeltaSec ?? 0)}s`,
      recommendation:
        "Inspect provider-level latency and queue backlog to prevent slower completions from reducing artifact conversion.",
    });
  }

  const highestRerunTool = response.tools
    .filter((tool) => tool.jobs24h >= 5)
    .sort((a, b) => b.rerunRate24h - a.rerunRate24h)[0];

  if (highestRerunTool && highestRerunTool.rerunRate24h > 0.25) {
    opportunities.push({
      key: "tool_rerun_pressure",
      severity: highestRerunTool.rerunRate24h > 0.4 ? "critical" : "warn",
      headline: "A tool is generating high rerun pressure",
      metric: `${highestRerunTool.toolType} rerun rate is ${asPercent(highestRerunTool.rerunRate24h)}`,
      recommendation: "Review output quality and defaults for this tool, then ship focused preset and UX experiments.",
    });
  }

  const dominantError = response.errors[0];
  if (dominantError && dominantError.count24h >= 5) {
    opportunities.push({
      key: "dominant_error_code",
      severity: dominantError.count24h > 20 ? "critical" : "warn",
      headline: "A single failure mode is recurring",
      metric: `${dominantError.errorCode} occurred ${dominantError.count24h} times in 24h`,
      recommendation: "Create a targeted recovery path for this error and expose user-facing remediation copy.",
    });
  }

  if (response.queue.stalledRunningOver15m > 0) {
    opportunities.push({
      key: "stalled_pipeline_jobs",
      severity: "critical",
      headline: "Stalled jobs are harming trust",
      metric: `${response.queue.stalledRunningOver15m} jobs have exceeded 15m runtime`,
      recommendation: "Auto-retry stale runs with backoff and show user-visible fallback ETA behavior.",
    });
  }

  const rank = {
    critical: 3,
    warn: 2,
    info: 1,
  } as const;

  opportunities.sort((a, b) => {
    const severityDelta = rank[b.severity] - rank[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.key.localeCompare(b.key);
  });

  return opportunities.slice(0, 8);
}

function buildIntegrityAlerts(
  integrity: Omit<OpsIntelligenceResponse["integrity"], "alerts">,
): OpsIntelligenceResponse["integrity"]["alerts"] {
  const alerts: OpsIntelligenceResponse["integrity"]["alerts"] = [];

  if (integrity.queueVsDbDrift !== null && integrity.queueVsDbDrift > 0) {
    alerts.push({
      key: "queue_vs_db_drift",
      severity: integrity.queueVsDbDrift > 10 ? "critical" : integrity.queueVsDbDrift > 2 ? "warn" : "info",
      count: integrity.queueVsDbDrift,
      message: "Redis queue depth differs from queued jobs in Postgres.",
    });
  }

  if (integrity.staleQueuedOver15m > 0) {
    alerts.push({
      key: "stale_queued_jobs",
      severity: integrity.staleQueuedOver15m > 20 ? "critical" : "warn",
      count: integrity.staleQueuedOver15m,
      message: "Queued jobs have not started for over 15 minutes.",
    });
  }

  if (integrity.staleRunningOver30m > 0) {
    alerts.push({
      key: "stale_running_jobs",
      severity: "critical",
      count: integrity.staleRunningOver30m,
      message: "Running jobs are stuck for over 30 minutes.",
    });
  }

  if (integrity.orphanArtifacts > 0) {
    alerts.push({
      key: "orphan_artifacts",
      severity: "critical",
      count: integrity.orphanArtifacts,
      message: "Artifacts exist without a corresponding job.",
    });
  }

  if (integrity.orphanJobs > 0) {
    alerts.push({
      key: "orphan_jobs",
      severity: "critical",
      count: integrity.orphanJobs,
      message: "Jobs exist without a corresponding asset.",
    });
  }

  if (integrity.assetsMissingBlobUrlOver15m > 0) {
    alerts.push({
      key: "assets_missing_blob_url",
      severity: "warn",
      count: integrity.assetsMissingBlobUrlOver15m,
      message: "Assets older than 15 minutes still have no blob URL.",
    });
  }

  if (integrity.duplicateExternalJobIds > 0) {
    alerts.push({
      key: "duplicate_external_job_ids",
      severity: "warn",
      count: integrity.duplicateExternalJobIds,
      message: "Duplicate external job IDs were detected.",
    });
  }

  if (integrity.failedWithoutErrorCode24h > 0) {
    alerts.push({
      key: "failed_without_error_code",
      severity: "warn",
      count: integrity.failedWithoutErrorCode24h,
      message: "Failed jobs are missing error codes in the last 24h.",
    });
  }

  if (integrity.trainingSamplesMissingOutputHashes > 0) {
    alerts.push({
      key: "training_missing_output_hashes",
      severity: integrity.trainingSamplesMissingOutputHashes > 50 ? "warn" : "info",
      count: integrity.trainingSamplesMissingOutputHashes,
      message: "Training samples missing output hashes were detected.",
    });
  }

  if (integrity.trainingSamplesMissingInputHash > 0) {
    alerts.push({
      key: "training_missing_input_hash",
      severity: integrity.trainingSamplesMissingInputHash > 100 ? "warn" : "info",
      count: integrity.trainingSamplesMissingInputHash,
      message: "Training samples missing input hash were detected.",
    });
  }

  const severityRank = {
    critical: 3,
    warn: 2,
    info: 1,
  } as const;

  alerts.sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return b.count - a.count;
  });

  return alerts;
}

function createEmptyResponse(generatedAt: string): OpsIntelligenceResponse {
  return {
    generatedAt,
    overview: {
      totalSessions: 0,
      sessions24h: 0,
      jobs1h: 0,
      jobs24h: 0,
      jobs7d: 0,
      activeJobs: 0,
      queuedJobs: 0,
      runningJobs: 0,
      stalledJobs: 0,
      failedJobs24h: 0,
      successRate1h: 0,
      successRate24h: 0,
      successRate7d: 0,
      rerunRate24h: 0,
      avgLatencySec24h: null,
      p50LatencySec24h: null,
      p95LatencySec24h: null,
      outputArtifacts24h: 0,
      outputBytes24h: 0,
    },
    queue: {
      redisDepth: null,
      oldestQueuedSec: 0,
      oldestRunningSec: 0,
      stalledRunningOver15m: 0,
    },
    product: {
      funnel24h: {
        sessions: 0,
        assets: 0,
        jobs: 0,
        succeededJobs: 0,
        artifacts: 0,
        sessionToAssetRate: 0,
        assetToJobRate: 0,
        jobToSuccessRate: 0,
        successToArtifactRate: 0,
      },
      conversionLeaks24h: {
        sessionsWithoutUpload: 0,
        sessionsWithoutJob: 0,
        sessionsWithoutSuccess: 0,
        sessionsWithoutArtifact: 0,
      },
      activation: {
        sessionsWithFirstJob24h: 0,
        sessionsWithFirstSuccess24h: 0,
        medianTimeToFirstJobSec24h: null,
        medianTimeToFirstSuccessSec24h: null,
      },
      firstToolDistribution24h: [],
      latencyDistribution24h: {
        under30Sec: 0,
        between30And120Sec: 0,
        between120And300Sec: 0,
        over300Sec: 0,
      },
      trends24h: {
        sessionsDelta: 0,
        jobsDelta: 0,
        successRateDelta: 0,
        rerunRateDelta: 0,
        p95LatencyDeltaSec: null,
        sessionToAssetRateDelta: 0,
        assetToJobRateDelta: 0,
        confidence: {
          level: "low",
          sessions24h: 0,
          jobs24h: 0,
          statisticallyStable: false,
        },
      },
      rerunMetrics24h: {
        immediateSameToolSameAssetRate: 0,
        crossToolChainRate: 0,
        postFailureRetryRate: 0,
        sampleSize: 0,
        confidence: "low",
      },
      economics24h: {
        artifactsPerSucceededJob: 0,
        bytesPerSucceededJob: 0,
        bytesPerSession: 0,
      },
      retention: {
        activeSessions7d: 0,
        returningSessions7d: 0,
        returningRate7d: 0,
      },
      engagement: {
        activeSessions24h: 0,
        jobsPerActiveSession24h: 0,
        assetsPerSession24h: 0,
        avgAssetDurationSec24h: null,
      },
      opportunities: [],
    },
    integrity: {
      dbQueuedJobs: 0,
      redisQueueDepth: null,
      queueVsDbDrift: null,
      staleQueuedOver15m: 0,
      staleRunningOver30m: 0,
      failedWithoutErrorCode24h: 0,
      assetsMissingBlobUrlOver15m: 0,
      orphanArtifacts: 0,
      orphanJobs: 0,
      duplicateExternalJobIds: 0,
      trainingSamplesMissingOutputHashes: 0,
      trainingSamplesMissingInputHash: 0,
      alerts: [],
    },
    recentSessions: [],
    timelines: {
      hourlyJobs: [],
    },
    tools: [],
    providers: [],
    errors: [],
    privacy: {
      adPersonalizationOptInSessions: 0,
      doNotSellOrShareSessions: 0,
      ageConfirmedAssets24h: 0,
      rightsConfirmedAssets24h: 0,
      policyVersionBreakdown: [],
    },
    trainingData: {
      samples24h: 0,
      samples7d: 0,
      rawExpiring7d: 0,
      derivedExpiring30d: 0,
      byTool: [],
      byStatus: [],
      byCaptureMode: [],
      readiness48h: [],
    },
    trainingOps: {
      runs7d: 0,
      lastRun: null,
      runStatusBreakdown: [],
      latestModelVersions: [],
      latestRollouts: [],
      rolloutStatusBreakdown: [],
    },
    storage: {
      artifactCountTotal: 0,
      artifactBytesTotal: 0,
      artifactBytes24h: 0,
      artifactBytes7d: 0,
      trainingSamplesRetained: 0,
    },
    analytics: {
      aggregateRows7d: 0,
      metricKeys: [],
    },
  };
}

function statusCountsToSuccessRate(rows: Array<{ status: string; count: number }>) {
  const total = rows.reduce((acc, row) => {
    if (!TERMINAL_JOB_STATUSES.has(row.status)) return acc;
    return acc + row.count;
  }, 0);
  if (total === 0) {
    return 0;
  }
  const succeeded = rows.find((row) => row.status === "succeeded")?.count ?? 0;
  return succeeded / total;
}

type RerunRow = {
  sessionId: string;
  toolType?: string;
  assetId?: string;
  status?: string;
  createdAt: Date;
};

function confidenceLevel(sessions24h: number, jobs24h: number): "low" | "medium" | "high" {
  if (sessions24h < 50 || jobs24h < 100) return "low";
  if (sessions24h < 100 || jobs24h < 250) return "medium";
  return "high";
}

function computeRerunRate(rows: RerunRow[]) {
  if (rows.length === 0) {
    return 0;
  }

  let reruns = 0;
  const lastBySession = new Map<string, RerunRow>();

  for (const row of rows) {
    const previous = lastBySession.get(row.sessionId);
    if (previous) {
      const deltaSec = (row.createdAt.getTime() - previous.createdAt.getTime()) / 1000;
      const sameTool = previous.toolType && row.toolType ? previous.toolType === row.toolType : true;
      const sameAsset = previous.assetId && row.assetId ? previous.assetId === row.assetId : true;
      if (deltaSec >= 0 && deltaSec <= 10 * 60 && sameTool && sameAsset) {
        reruns += 1;
      }
    }
    lastBySession.set(row.sessionId, row);
  }

  return reruns / rows.length;
}

function computeRerunMetrics(rows: RerunRow[], sessions24h: number, jobs24h: number) {
  if (rows.length === 0) {
    return {
      immediateSameToolSameAssetRate: 0,
      crossToolChainRate: 0,
      postFailureRetryRate: 0,
      sampleSize: 0,
      confidence: confidenceLevel(sessions24h, jobs24h),
    } satisfies OpsIntelligenceResponse["product"]["rerunMetrics24h"];
  }

  let sameToolSameAsset = 0;
  let crossToolChain = 0;
  let postFailureRetry = 0;
  const lastBySession = new Map<string, RerunRow>();

  for (const row of rows) {
    const previous = lastBySession.get(row.sessionId);
    if (previous) {
      const deltaSec = (row.createdAt.getTime() - previous.createdAt.getTime()) / 1000;
      if (deltaSec >= 0 && deltaSec <= 10 * 60) {
        const sameTool = previous.toolType && row.toolType ? previous.toolType === row.toolType : true;
        const sameAsset = previous.assetId && row.assetId ? previous.assetId === row.assetId : true;
        if (sameTool && sameAsset) sameToolSameAsset += 1;
        if (previous.toolType && row.toolType && previous.toolType !== row.toolType) crossToolChain += 1;
        if (previous.status === "failed" && previous.toolType && row.toolType && previous.toolType === row.toolType) {
          postFailureRetry += 1;
        }
      }
    }
    lastBySession.set(row.sessionId, row);
  }

  return {
    immediateSameToolSameAssetRate: sameToolSameAsset / rows.length,
    crossToolChainRate: crossToolChain / rows.length,
    postFailureRetryRate: postFailureRetry / rows.length,
    sampleSize: rows.length,
    confidence: confidenceLevel(sessions24h, jobs24h),
  } satisfies OpsIntelligenceResponse["product"]["rerunMetrics24h"];
}

function buildHourlyTimeline(
  timelineWindowStart: Date,
  rows: Array<{
    hourBucket: unknown;
    total: unknown;
    succeeded: unknown;
    failed: unknown;
    queued: unknown;
    running: unknown;
    avgLatencySec: unknown;
  }>,
): OpsIntelligenceResponse["timelines"]["hourlyJobs"] {
  const timelineByHour = new Map<string, OpsIntelligenceResponse["timelines"]["hourlyJobs"][number]>();

  for (const row of rows) {
    const hourIso = toIso(row.hourBucket);
    if (!hourIso) continue;

    timelineByHour.set(hourIso, {
      hour: hourIso,
      total: toNumber(row.total),
      succeeded: toNumber(row.succeeded),
      failed: toNumber(row.failed),
      queued: toNumber(row.queued),
      running: toNumber(row.running),
      avgLatencySec: toNullableNumber(row.avgLatencySec),
    });
  }

  const points: OpsIntelligenceResponse["timelines"]["hourlyJobs"] = [];

  for (let index = 0; index < 24; index += 1) {
    const hour = new Date(timelineWindowStart.getTime() + index * HOUR_MS).toISOString();
    const existing = timelineByHour.get(hour);
    points.push(
      existing ?? {
        hour,
        total: 0,
        succeeded: 0,
        failed: 0,
        queued: 0,
        running: 0,
        avgLatencySec: null,
      },
    );
  }

  return points;
}

export async function GET(request: NextRequest) {
  if (!hasOpsApiAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const now = new Date();
  const since1h = new Date(now.getTime() - HOUR_MS);
  const since24h = new Date(now.getTime() - DAY_MS);
  const since48h = new Date(now.getTime() - 2 * DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const timelineWindowStart = new Date(now);
  timelineWindowStart.setUTCMinutes(0, 0, 0);
  timelineWindowStart.setUTCHours(timelineWindowStart.getUTCHours() - 23);
  const expiresRawBefore = new Date(now.getTime() + 7 * DAY_MS);
  const expiresDerivedBefore = new Date(now.getTime() + 30 * DAY_MS);

  const payload = createEmptyResponse(now.toISOString());
  const degradedSections = new Set<string>();

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (error) {
    if (error instanceof Error) {
      degradedSections.add("database");
      payload.degraded = {
        reason: "database",
        message: "Ops intelligence is partially unavailable. Showing fallback values.",
        sections: ["database"],
      };
      return NextResponse.json(payload, { headers: noStoreHeaders() });
    }

    throw error;
  }

  const section = async <T>(key: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      console.error(`Unable to load ops intelligence section: ${key}`, error);
      degradedSections.add(key);
      return fallback;
    }
  };

  const overviewSection = section(
    "overview",
    async () => {
      const [
        sessionTotals,
        session24hTotals,
        status1hRows,
        status24hRows,
        status7dRows,
        activeJobRows,
        latency24hRows,
        artifact24hRows,
        rerunRows,
        redisDepth,
        recentSessionsRows,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(sessions),
        db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(gte(sessions.createdAt, since24h)),
        db
          .select({
            status: jobs.status,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since1h))
          .groupBy(jobs.status),
        db
          .select({
            status: jobs.status,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .groupBy(jobs.status),
        db
          .select({
            status: jobs.status,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since7d))
          .groupBy(jobs.status),
        db
          .select({
            status: jobs.status,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .where(or(eq(jobs.status, "queued"), eq(jobs.status, "running"))),
        db
          .select({
            avgLatencySec: sql<number | null>`avg(extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})))`,
            p50LatencySec: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})))`,
            p95LatencySec: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})))`,
          })
          .from(jobs)
          .where(and(gte(jobs.createdAt, since24h), isNotNull(jobs.finishedAt))),
        db
          .select({
            count: sql<number>`count(*)::int`,
            bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
          })
          .from(artifacts)
          .where(gte(artifacts.createdAt, since24h)),
        db
          .select({
            sessionId: jobs.sessionId,
            toolType: jobs.toolType,
            assetId: jobs.assetId,
            status: jobs.status,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .orderBy(asc(jobs.sessionId), asc(jobs.createdAt)),
        queueDepth(),
        db.query.sessions.findMany({
          orderBy: [desc(sessions.lastSeenAt)],
          limit: 12,
        }),
      ]);

      const activeJobs = activeJobRows.length;
      const queuedJobs = activeJobRows.filter((row) => row.status === "queued").length;
      const runningJobs = activeJobRows.filter((row) => row.status === "running").length;
      const oldestQueuedSec = Math.max(
        0,
        ...activeJobRows
          .filter((row) => row.status === "queued")
          .map((row) => (now.getTime() - row.createdAt.getTime()) / 1000),
      );
      const oldestRunningSec = Math.max(
        0,
        ...activeJobRows
          .filter((row) => row.status === "running")
          .map((row) => (now.getTime() - row.createdAt.getTime()) / 1000),
      );

      const stalledRunningOver15m = activeJobRows.filter(
        (row) => row.status === "running" && now.getTime() - row.createdAt.getTime() > 15 * 60 * 1000,
      ).length;

      const normalized1h = status1hRows.map((row) => ({ status: row.status, count: toNumber(row.count) }));
      const normalized24h = status24hRows.map((row) => ({ status: row.status, count: toNumber(row.count) }));
      const normalized7d = status7dRows.map((row) => ({ status: row.status, count: toNumber(row.count) }));

      const jobs1h = normalized1h.reduce((acc, row) => acc + row.count, 0);
      const jobs24h = normalized24h.reduce((acc, row) => acc + row.count, 0);
      const jobs7d = normalized7d.reduce((acc, row) => acc + row.count, 0);

      const failedJobs24h = normalized24h.find((row) => row.status === "failed")?.count ?? 0;

      const latencyRow = latency24hRows[0];
      const outputRow = artifact24hRows[0];

      return {
        overview: {
          totalSessions: toNumber(sessionTotals[0]?.count),
          sessions24h: toNumber(session24hTotals[0]?.count),
          jobs1h,
          jobs24h,
          jobs7d,
          activeJobs,
          queuedJobs,
          runningJobs,
          stalledJobs: stalledRunningOver15m,
          failedJobs24h,
          successRate1h: statusCountsToSuccessRate(normalized1h),
          successRate24h: statusCountsToSuccessRate(normalized24h),
          successRate7d: statusCountsToSuccessRate(normalized7d),
          rerunRate24h: computeRerunRate(rerunRows),
          avgLatencySec24h: toNullableNumber(latencyRow?.avgLatencySec),
          p50LatencySec24h: toNullableNumber(latencyRow?.p50LatencySec),
          p95LatencySec24h: toNullableNumber(latencyRow?.p95LatencySec),
          outputArtifacts24h: toNumber(outputRow?.count),
          outputBytes24h: toNumber(outputRow?.bytes),
        },
        queue: {
          redisDepth,
          oldestQueuedSec,
          oldestRunningSec,
          stalledRunningOver15m,
        },
        recentSessions: recentSessionsRows.map((session) => ({
          sessionId: session.id,
          createdAt: session.createdAt.toISOString(),
          lastSeenAt: session.lastSeenAt.toISOString(),
          policyVersion: session.policyVersion,
          adPersonalizationOptIn: session.adPersonalizationOptIn,
          doNotSellOrShare: session.doNotSellOrShare,
        })),
      };
    },
    {
      overview: payload.overview,
      queue: payload.queue,
      recentSessions: payload.recentSessions,
    },
  );

  const productSection = section(
    "product",
    async () => {
      const [
        sessions24hRows,
        sessionsPrev24hRows,
        assets24hRows,
        assetsPrev24hRows,
        sessionsWithUploadRows,
        sessionsWithUploadPrevRows,
        sessionsWithJobRows,
        sessionsWithSuccessRows,
        sessionsWithArtifactRows,
        assetsWithJobsRows,
        assetsWithJobsPrevRows,
        job24hRows,
        jobPrev24hRows,
        artifacts24hRows,
        artifactBytes24hRows,
        succeededJobsWithArtifactsRows,
        activeSessions24hRows,
        avgAssetDurationRows,
        firstToolRows,
        latencyDistributionRows,
        latencyCurrentRows,
        latencyPrevRows,
        rerun24hRows,
        rerunPrevRows,
        activationRows,
        retentionRows,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(gte(sessions.createdAt, since24h)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sessions)
          .where(and(gte(sessions.createdAt, since48h), lt(sessions.createdAt, since24h))),
        db.select({ count: sql<number>`count(*)::int` }).from(assets).where(gte(assets.createdAt, since24h)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(assets)
          .where(and(gte(assets.createdAt, since48h), lt(assets.createdAt, since24h))),
        db
          .select({
            count: sql<number>`count(distinct ${assets.sessionId})::int`,
          })
          .from(assets)
          .innerJoin(sessions, eq(sessions.id, assets.sessionId))
          .where(and(gte(assets.createdAt, since24h), gte(sessions.createdAt, since24h))),
        db
          .select({
            count: sql<number>`count(distinct ${assets.sessionId})::int`,
          })
          .from(assets)
          .innerJoin(sessions, eq(sessions.id, assets.sessionId))
          .where(and(gte(assets.createdAt, since48h), lt(assets.createdAt, since24h), gte(sessions.createdAt, since48h), lt(sessions.createdAt, since24h))),
        db
          .select({
            count: sql<number>`count(distinct ${sessions.id})::int`,
          })
          .from(sessions)
          .innerJoin(jobs, and(eq(jobs.sessionId, sessions.id), gte(jobs.createdAt, since24h)))
          .where(gte(sessions.createdAt, since24h)),
        db
          .select({
            count: sql<number>`count(distinct ${sessions.id})::int`,
          })
          .from(sessions)
          .innerJoin(jobs, and(eq(jobs.sessionId, sessions.id), gte(jobs.createdAt, since24h), eq(jobs.status, "succeeded")))
          .where(gte(sessions.createdAt, since24h)),
        db
          .select({
            count: sql<number>`count(distinct ${sessions.id})::int`,
          })
          .from(sessions)
          .innerJoin(jobs, and(eq(jobs.sessionId, sessions.id), gte(jobs.createdAt, since24h)))
          .innerJoin(artifacts, and(eq(artifacts.jobId, jobs.id), gte(artifacts.createdAt, since24h)))
          .where(gte(sessions.createdAt, since24h)),
        db
          .select({
            count: sql<number>`count(distinct ${assets.id})::int`,
          })
          .from(assets)
          .innerJoin(jobs, and(eq(jobs.assetId, assets.id), gte(jobs.createdAt, since24h)))
          .where(gte(assets.createdAt, since24h)),
        db
          .select({
            count: sql<number>`count(distinct ${assets.id})::int`,
          })
          .from(assets)
          .innerJoin(jobs, and(eq(jobs.assetId, assets.id), gte(jobs.createdAt, since48h), lt(jobs.createdAt, since24h)))
          .where(and(gte(assets.createdAt, since48h), lt(assets.createdAt, since24h))),
        db
          .select({
            jobs24h: sql<number>`count(*)::int`,
            succeededJobs24h: sql<number>`sum(case when ${jobs.status} = 'succeeded' then 1 else 0 end)::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h)),
        db
          .select({
            jobs24h: sql<number>`count(*)::int`,
            succeededJobs24h: sql<number>`sum(case when ${jobs.status} = 'succeeded' then 1 else 0 end)::int`,
          })
          .from(jobs)
          .where(and(gte(jobs.createdAt, since48h), lt(jobs.createdAt, since24h))),
        db.select({ count: sql<number>`count(*)::int` }).from(artifacts).where(gte(artifacts.createdAt, since24h)),
        db
          .select({
            bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
          })
          .from(artifacts)
          .where(gte(artifacts.createdAt, since24h)),
        db
          .select({
            count: sql<number>`count(distinct ${jobs.id})::int`,
          })
          .from(jobs)
          .innerJoin(artifacts, eq(artifacts.jobId, jobs.id))
          .where(and(gte(jobs.createdAt, since24h), eq(jobs.status, "succeeded"))),
        db
          .select({
            count: sql<number>`count(distinct ${jobs.sessionId})::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h)),
        db
          .select({
            avgDurationSec: sql<number | null>`avg(${assets.durationSec})`,
          })
          .from(assets)
          .where(gte(assets.createdAt, since24h)),
        db
          .select({
            sessionId: jobs.sessionId,
            toolType: jobs.toolType,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .innerJoin(sessions, eq(sessions.id, jobs.sessionId))
          .where(and(gte(jobs.createdAt, since24h), gte(sessions.createdAt, since24h)))
          .orderBy(asc(jobs.sessionId), asc(jobs.createdAt)),
        db
          .select({
            under30Sec: sql<number>`sum(case when extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) < 30 then 1 else 0 end)::int`,
            between30And120Sec: sql<number>`sum(case when extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) >= 30 and extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) < 120 then 1 else 0 end)::int`,
            between120And300Sec: sql<number>`sum(case when extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) >= 120 and extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) < 300 then 1 else 0 end)::int`,
            over300Sec: sql<number>`sum(case when extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) >= 300 then 1 else 0 end)::int`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "succeeded"), gte(jobs.createdAt, since24h), isNotNull(jobs.finishedAt))),
        db
          .select({
            p95LatencySec: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})))`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "succeeded"), gte(jobs.createdAt, since24h), isNotNull(jobs.finishedAt))),
        db
          .select({
            p95LatencySec: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})))`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "succeeded"), gte(jobs.createdAt, since48h), lt(jobs.createdAt, since24h), isNotNull(jobs.finishedAt))),
        db
          .select({
            sessionId: jobs.sessionId,
            toolType: jobs.toolType,
            assetId: jobs.assetId,
            status: jobs.status,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .orderBy(asc(jobs.sessionId), asc(jobs.createdAt)),
        db
          .select({
            sessionId: jobs.sessionId,
            toolType: jobs.toolType,
            assetId: jobs.assetId,
            status: jobs.status,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .where(and(gte(jobs.createdAt, since48h), lt(jobs.createdAt, since24h)))
          .orderBy(asc(jobs.sessionId), asc(jobs.createdAt)),
        db
          .select({
            sessionCreatedAt: sessions.createdAt,
            firstJobAt: sql<Date | null>`min(${jobs.createdAt})`,
            firstSuccessAt: sql<Date | null>`min(case when ${jobs.status} = 'succeeded' then ${jobs.createdAt} end)`,
          })
          .from(sessions)
          .leftJoin(jobs, eq(jobs.sessionId, sessions.id))
          .where(gte(sessions.createdAt, since24h))
          .groupBy(sessions.id, sessions.createdAt),
        db
          .select({
            sessionId: jobs.sessionId,
            activeDays: sql<number>`count(distinct date_trunc('day', ${jobs.createdAt}))::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since7d))
          .groupBy(jobs.sessionId),
      ]);

      const sessions24h = toNumber(sessions24hRows[0]?.count);
      const sessionsPrev24h = toNumber(sessionsPrev24hRows[0]?.count);
      const assets24h = toNumber(assets24hRows[0]?.count);
      const assetsPrev24h = toNumber(assetsPrev24hRows[0]?.count);
      const sessionsWithUpload24h = toNumber(sessionsWithUploadRows[0]?.count);
      const sessionsWithUploadPrev24h = toNumber(sessionsWithUploadPrevRows[0]?.count);
      const sessionsWithJob24h = toNumber(sessionsWithJobRows[0]?.count);
      const sessionsWithSuccess24h = toNumber(sessionsWithSuccessRows[0]?.count);
      const sessionsWithArtifact24h = toNumber(sessionsWithArtifactRows[0]?.count);
      const assetsWithJobs24h = toNumber(assetsWithJobsRows[0]?.count);
      const assetsWithJobsPrev24h = toNumber(assetsWithJobsPrevRows[0]?.count);
      const jobs24h = toNumber(job24hRows[0]?.jobs24h);
      const succeededJobs24h = toNumber(job24hRows[0]?.succeededJobs24h);
      const jobsPrev24h = toNumber(jobPrev24hRows[0]?.jobs24h);
      const succeededJobsPrev24h = toNumber(jobPrev24hRows[0]?.succeededJobs24h);
      const artifacts24h = toNumber(artifacts24hRows[0]?.count);
      const artifactBytes24h = toNumber(artifactBytes24hRows[0]?.bytes);
      const succeededJobsWithArtifacts24h = toNumber(succeededJobsWithArtifactsRows[0]?.count);
      const activeSessions24h = toNumber(activeSessions24hRows[0]?.count);
      const avgAssetDurationSec24h = toNullableNumber(avgAssetDurationRows[0]?.avgDurationSec);
      const latencyDistribution = latencyDistributionRows[0];
      const latencyCurrent = latencyCurrentRows[0];
      const latencyPrev = latencyPrevRows[0];
      const p95LatencyCurrent = toNullableNumber(latencyCurrent?.p95LatencySec);
      const p95LatencyPrev = toNullableNumber(latencyPrev?.p95LatencySec);
      const rerunRate24h = computeRerunRate(rerun24hRows);
      const rerunRatePrev24h = computeRerunRate(rerunPrevRows);
      const rerunMetrics24h = computeRerunMetrics(rerun24hRows, sessions24h, jobs24h);
      const sessionToAssetRate24h = safeRate(sessionsWithUpload24h, sessions24h);
      const assetToJobRate24h = safeRate(assetsWithJobs24h, assets24h);
      const sessionToAssetRatePrev24h = safeRate(sessionsWithUploadPrev24h, sessionsPrev24h);
      const assetToJobRatePrev24h = safeRate(assetsWithJobsPrev24h, assetsPrev24h);
      const successRate24h = safeRate(succeededJobs24h, jobs24h);
      const successRatePrev24h = safeRate(succeededJobsPrev24h, jobsPrev24h);

      const firstToolBySession = new Map<string, string>();
      for (const row of firstToolRows) {
        if (!firstToolBySession.has(row.sessionId)) {
          firstToolBySession.set(row.sessionId, row.toolType);
        }
      }

      const firstToolCounts = new Map<string, number>();
      for (const toolType of firstToolBySession.values()) {
        const current = firstToolCounts.get(toolType) ?? 0;
        firstToolCounts.set(toolType, current + 1);
      }
      const firstToolSessionCount = firstToolBySession.size;

      const firstJobLatenciesSec: number[] = [];
      const firstSuccessLatenciesSec: number[] = [];

      for (const row of activationRows) {
        const sessionCreatedAt = toDate(row.sessionCreatedAt);
        if (!sessionCreatedAt) continue;

        const firstJobAt = toDate(row.firstJobAt);
        if (firstJobAt) {
          firstJobLatenciesSec.push(Math.max(0, (firstJobAt.getTime() - sessionCreatedAt.getTime()) / 1000));
        }

        const firstSuccessAt = toDate(row.firstSuccessAt);
        if (firstSuccessAt) {
          firstSuccessLatenciesSec.push(Math.max(0, (firstSuccessAt.getTime() - sessionCreatedAt.getTime()) / 1000));
        }
      }

      const activeSessions7d = retentionRows.length;
      const returningSessions7d = retentionRows.filter((row) => toNumber(row.activeDays) >= 2).length;
      const trendConfidenceLevel = confidenceLevel(sessions24h, jobs24h);

      return {
        product: {
          funnel24h: {
            sessions: sessions24h,
            assets: assets24h,
            jobs: jobs24h,
            succeededJobs: succeededJobs24h,
            artifacts: artifacts24h,
            sessionToAssetRate: sessionToAssetRate24h,
            assetToJobRate: assetToJobRate24h,
            jobToSuccessRate: successRate24h,
            successToArtifactRate: safeRate(succeededJobsWithArtifacts24h, succeededJobs24h),
          },
          conversionLeaks24h: {
            sessionsWithoutUpload: Math.max(0, sessions24h - sessionsWithUpload24h),
            sessionsWithoutJob: Math.max(0, sessions24h - sessionsWithJob24h),
            sessionsWithoutSuccess: Math.max(0, sessions24h - sessionsWithSuccess24h),
            sessionsWithoutArtifact: Math.max(0, sessions24h - sessionsWithArtifact24h),
          },
          activation: {
            sessionsWithFirstJob24h: firstJobLatenciesSec.length,
            sessionsWithFirstSuccess24h: firstSuccessLatenciesSec.length,
            medianTimeToFirstJobSec24h: median(firstJobLatenciesSec),
            medianTimeToFirstSuccessSec24h: median(firstSuccessLatenciesSec),
          },
          firstToolDistribution24h: [...firstToolCounts.entries()]
            .map(([toolType, sessions]) => ({
              toolType,
              sessions,
              share: safeRate(sessions, firstToolSessionCount),
            }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 6),
          latencyDistribution24h: {
            under30Sec: toNumber(latencyDistribution?.under30Sec),
            between30And120Sec: toNumber(latencyDistribution?.between30And120Sec),
            between120And300Sec: toNumber(latencyDistribution?.between120And300Sec),
            over300Sec: toNumber(latencyDistribution?.over300Sec),
          },
          trends24h: {
            sessionsDelta: sessions24h - sessionsPrev24h,
            jobsDelta: jobs24h - jobsPrev24h,
            successRateDelta: successRate24h - successRatePrev24h,
            rerunRateDelta: rerunRate24h - rerunRatePrev24h,
            p95LatencyDeltaSec:
              p95LatencyCurrent === null || p95LatencyPrev === null ? null : p95LatencyCurrent - p95LatencyPrev,
            sessionToAssetRateDelta: sessionToAssetRate24h - sessionToAssetRatePrev24h,
            assetToJobRateDelta: assetToJobRate24h - assetToJobRatePrev24h,
            confidence: {
              level: trendConfidenceLevel,
              sessions24h,
              jobs24h,
              statisticallyStable: trendConfidenceLevel !== "low",
            },
          },
          rerunMetrics24h,
          economics24h: {
            artifactsPerSucceededJob: safeRate(artifacts24h, succeededJobs24h),
            bytesPerSucceededJob: safeRate(artifactBytes24h, succeededJobs24h),
            bytesPerSession: safeRate(artifactBytes24h, sessions24h),
          },
          retention: {
            activeSessions7d,
            returningSessions7d,
            returningRate7d: safeRate(returningSessions7d, activeSessions7d),
          },
          engagement: {
            activeSessions24h,
            jobsPerActiveSession24h: safeRate(jobs24h, activeSessions24h),
            assetsPerSession24h: safeRate(assets24h, sessions24h),
            avgAssetDurationSec24h,
          },
          opportunities: [],
        },
      };
    },
    {
      product: payload.product,
    },
  );

  const integritySection = section(
    "integrity",
    async () => {
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const [
        dbQueuedRows,
        redisQueueDepth,
        staleQueuedRows,
        staleRunningRows,
        failedWithoutErrorRows,
        assetsMissingBlobRows,
        orphanArtifactsRows,
        orphanJobsRows,
        duplicateExternalRows,
        trainingMissingOutputRows,
        trainingMissingInputRows,
      ] = await Promise.all([
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(eq(jobs.status, "queued")),
        queueDepth(),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "queued"), lte(jobs.createdAt, fifteenMinAgo))),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "running"), lte(jobs.createdAt, thirtyMinAgo))),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "failed"), gte(jobs.createdAt, since24h), isNull(jobs.errorCode))),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(assets)
          .where(and(isNull(assets.blobUrl), lte(assets.createdAt, fifteenMinAgo))),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(artifacts)
          .leftJoin(jobs, eq(artifacts.jobId, jobs.id))
          .where(isNull(jobs.id)),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .leftJoin(assets, eq(jobs.assetId, assets.id))
          .where(isNull(assets.id)),
        db
          .select({
            externalJobId: jobs.externalJobId,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(isNotNull(jobs.externalJobId))
          .groupBy(jobs.externalJobId)
          .having(sql`count(*) > 1`),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(
            sql`(case when jsonb_typeof(${trainingSamples.outputHashes}) = 'array' then jsonb_array_length(${trainingSamples.outputHashes}) else 0 end) = 0`,
          ),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(isNull(trainingSamples.inputHash)),
      ]);

      const dbQueuedJobs = toNumber(dbQueuedRows[0]?.count);
      const queueDrift = redisQueueDepth === null ? null : Math.abs(dbQueuedJobs - toNumber(redisQueueDepth));

      const integrity: Omit<OpsIntelligenceResponse["integrity"], "alerts"> = {
        dbQueuedJobs,
        redisQueueDepth,
        queueVsDbDrift: queueDrift,
        staleQueuedOver15m: toNumber(staleQueuedRows[0]?.count),
        staleRunningOver30m: toNumber(staleRunningRows[0]?.count),
        failedWithoutErrorCode24h: toNumber(failedWithoutErrorRows[0]?.count),
        assetsMissingBlobUrlOver15m: toNumber(assetsMissingBlobRows[0]?.count),
        orphanArtifacts: toNumber(orphanArtifactsRows[0]?.count),
        orphanJobs: toNumber(orphanJobsRows[0]?.count),
        duplicateExternalJobIds: duplicateExternalRows.length,
        trainingSamplesMissingOutputHashes: toNumber(trainingMissingOutputRows[0]?.count),
        trainingSamplesMissingInputHash: toNumber(trainingMissingInputRows[0]?.count),
      };

      return {
        integrity: {
          ...integrity,
          alerts: buildIntegrityAlerts(integrity),
        },
      };
    },
    {
      integrity: payload.integrity,
    },
  );

  const timelineSection = section(
    "timeline",
    async () => {
      const rows = await db
        .select({
          hourBucket: sql<Date>`date_trunc('hour', ${jobs.createdAt})`,
          total: sql<number>`count(*)::int`,
          succeeded: sql<number>`sum(case when ${jobs.status} = 'succeeded' then 1 else 0 end)::int`,
          failed: sql<number>`sum(case when ${jobs.status} = 'failed' then 1 else 0 end)::int`,
          queued: sql<number>`sum(case when ${jobs.status} = 'queued' then 1 else 0 end)::int`,
          running: sql<number>`sum(case when ${jobs.status} = 'running' then 1 else 0 end)::int`,
          avgLatencySec: sql<number | null>`avg(case when ${jobs.finishedAt} is not null then extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) end)`,
        })
        .from(jobs)
        .where(gte(jobs.createdAt, timelineWindowStart))
        .groupBy(sql`date_trunc('hour', ${jobs.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${jobs.createdAt}) asc`);

      return {
        timelines: {
          hourlyJobs: buildHourlyTimeline(timelineWindowStart, rows),
        },
      };
    },
    {
      timelines: payload.timelines,
    },
  );

  const toolSection = section(
    "tooling",
    async () => {
      const [toolRows, providerRows, artifactRowsByTool, failedRows24h, failedRows7d, rerunRowsByTool] = await Promise.all([
        db
          .select({
            toolType: jobs.toolType,
            jobs24h: sql<number>`count(*)::int`,
            succeeded24h: sql<number>`sum(case when ${jobs.status} = 'succeeded' then 1 else 0 end)::int`,
            failed24h: sql<number>`sum(case when ${jobs.status} = 'failed' then 1 else 0 end)::int`,
            avgLatencySec24h: sql<number | null>`avg(case when ${jobs.finishedAt} is not null then extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) end)`,
            p95LatencySec24h: sql<number | null>`percentile_cont(0.95) within group (order by case when ${jobs.finishedAt} is not null then extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) end)`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .groupBy(jobs.toolType)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            provider: jobs.provider,
            model: jobs.model,
            jobs24h: sql<number>`count(*)::int`,
            failed24h: sql<number>`sum(case when ${jobs.status} = 'failed' then 1 else 0 end)::int`,
            p95LatencySec24h: sql<number | null>`percentile_cont(0.95) within group (order by case when ${jobs.finishedAt} is not null then extract(epoch from (${jobs.finishedAt} - ${jobs.createdAt})) end)`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .groupBy(jobs.provider, jobs.model)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            toolType: jobs.toolType,
            avgArtifactBytes24h: sql<number | null>`avg(${artifacts.sizeBytes})`,
          })
          .from(artifacts)
          .innerJoin(jobs, eq(jobs.id, artifacts.jobId))
          .where(gte(artifacts.createdAt, since24h))
          .groupBy(jobs.toolType),
        db
          .select({
            errorCode: jobs.errorCode,
            count24h: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "failed"), isNotNull(jobs.errorCode), gte(jobs.createdAt, since24h)))
          .groupBy(jobs.errorCode),
        db
          .select({
            errorCode: jobs.errorCode,
            count7d: sql<number>`count(*)::int`,
            lastSeenAt: sql<Date | null>`max(${jobs.createdAt})`,
          })
          .from(jobs)
          .where(and(eq(jobs.status, "failed"), isNotNull(jobs.errorCode), gte(jobs.createdAt, since7d)))
          .groupBy(jobs.errorCode)
          .orderBy(desc(sql`count(*)`))
          .limit(12),
        db
          .select({
            toolType: jobs.toolType,
            sessionId: jobs.sessionId,
            assetId: jobs.assetId,
            status: jobs.status,
            createdAt: jobs.createdAt,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since24h))
          .orderBy(asc(jobs.toolType), asc(jobs.sessionId), asc(jobs.createdAt)),
      ]);

      const averageArtifactBytesByTool = new Map<string, number | null>();
      for (const row of artifactRowsByTool) {
        averageArtifactBytesByTool.set(row.toolType, toNullableNumber(row.avgArtifactBytes24h));
      }

      const rerunRowsPerTool = new Map<string, RerunRow[]>();
      for (const row of rerunRowsByTool) {
        const existing = rerunRowsPerTool.get(row.toolType) ?? [];
        existing.push({
          sessionId: row.sessionId,
          toolType: row.toolType,
          assetId: row.assetId,
          status: row.status,
          createdAt: row.createdAt,
        });
        rerunRowsPerTool.set(row.toolType, existing);
      }

      const failureCount24hByCode = new Map<string, number>();
      for (const row of failedRows24h) {
        failureCount24hByCode.set(row.errorCode ?? "unknown", toNumber(row.count24h));
      }

      return {
        tools: toolRows.map((row) => {
          const jobs24h = toNumber(row.jobs24h);
          const succeeded24h = toNumber(row.succeeded24h);
          const failed24h = toNumber(row.failed24h);

          return {
            toolType: row.toolType,
            jobs24h,
            succeeded24h,
            failed24h,
            successRate24h: jobs24h > 0 ? succeeded24h / jobs24h : 0,
            rerunRate24h: computeRerunRate(rerunRowsPerTool.get(row.toolType) ?? []),
            avgLatencySec24h: toNullableNumber(row.avgLatencySec24h),
            p95LatencySec24h: toNullableNumber(row.p95LatencySec24h),
            avgArtifactBytes24h: averageArtifactBytesByTool.get(row.toolType) ?? null,
          };
        }),
        providers: providerRows.map((row) => {
          const count = toNumber(row.jobs24h);
          const failed = toNumber(row.failed24h);
          return {
            provider: row.provider,
            model: row.model,
            jobs24h: count,
            failureRate24h: count > 0 ? failed / count : 0,
            p95LatencySec24h: toNullableNumber(row.p95LatencySec24h),
          };
        }),
        errors: failedRows7d.map((row) => ({
          errorCode: row.errorCode ?? "unknown",
          count24h: failureCount24hByCode.get(row.errorCode ?? "unknown") ?? 0,
          count7d: toNumber(row.count7d),
          lastSeenAt: toIso(row.lastSeenAt),
        })),
      };
    },
    {
      tools: payload.tools,
      providers: payload.providers,
      errors: payload.errors,
    },
  );

  const privacySection = section(
    "privacy",
    async () => {
      const [sessionsByPolicy, assetsByPolicy, sessionPrefRows, assetConfirmationRows] = await Promise.all([
        db
          .select({
            policyVersion: sessions.policyVersion,
            sessions: sql<number>`count(*)::int`,
          })
          .from(sessions)
          .groupBy(sessions.policyVersion),
        db
          .select({
            policyVersion: assets.policyVersion,
            assets: sql<number>`count(*)::int`,
          })
          .from(assets)
          .groupBy(assets.policyVersion),
        db
          .select({
            adPersonalizationOptInSessions: sql<number>`sum(case when ${sessions.adPersonalizationOptIn} then 1 else 0 end)::int`,
            doNotSellOrShareSessions: sql<number>`sum(case when ${sessions.doNotSellOrShare} then 1 else 0 end)::int`,
          })
          .from(sessions),
        db
          .select({
            ageConfirmedAssets24h: sql<number>`sum(case when ${assets.ageConfirmed} then 1 else 0 end)::int`,
            rightsConfirmedAssets24h: sql<number>`sum(case when ${assets.rightsConfirmed} then 1 else 0 end)::int`,
          })
          .from(assets)
          .where(gte(assets.createdAt, since24h)),
      ]);

      const mergedPolicies = new Map<string, { sessions: number; assets: number }>();

      for (const row of sessionsByPolicy) {
        mergedPolicies.set(row.policyVersion, {
          sessions: toNumber(row.sessions),
          assets: 0,
        });
      }

      for (const row of assetsByPolicy) {
        const existing = mergedPolicies.get(row.policyVersion) ?? { sessions: 0, assets: 0 };
        existing.assets = toNumber(row.assets);
        mergedPolicies.set(row.policyVersion, existing);
      }

      const preferenceRow = sessionPrefRows[0];
      const confirmationRow = assetConfirmationRows[0];

      return {
        privacy: {
          adPersonalizationOptInSessions: toNumber(preferenceRow?.adPersonalizationOptInSessions),
          doNotSellOrShareSessions: toNumber(preferenceRow?.doNotSellOrShareSessions),
          ageConfirmedAssets24h: toNumber(confirmationRow?.ageConfirmedAssets24h),
          rightsConfirmedAssets24h: toNumber(confirmationRow?.rightsConfirmedAssets24h),
          policyVersionBreakdown: [...mergedPolicies.entries()]
            .map(([policyVersion, counts]) => ({
              policyVersion,
              sessions: counts.sessions,
              assets: counts.assets,
            }))
            .sort((a, b) => (a.policyVersion < b.policyVersion ? 1 : -1)),
        },
      };
    },
    {
      privacy: payload.privacy,
    },
  );

  const trainingSection = section(
    "training",
    async () => {
      const [
        samples24hRows,
        samples7dRows,
        sampleByToolRows,
        sampleByStatusRows,
        sampleByCaptureRows,
        sampleReadinessRows,
        jobReadinessRows,
        rawExpiringRows,
        derivedExpiringRows,
        runs7dRows,
        runStatusRows,
        lastRun,
        latestModelVersions,
        latestRollouts,
        rolloutStatusRows,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(trainingSamples).where(gte(trainingSamples.capturedAt, since24h)),
        db.select({ count: sql<number>`count(*)::int` }).from(trainingSamples).where(gte(trainingSamples.capturedAt, since7d)),
        db
          .select({
            toolType: trainingSamples.toolType,
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(gte(trainingSamples.capturedAt, since7d))
          .groupBy(trainingSamples.toolType)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            status: trainingSamples.status,
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(gte(trainingSamples.capturedAt, since7d))
          .groupBy(trainingSamples.status)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            captureMode: trainingSamples.captureMode,
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(gte(trainingSamples.capturedAt, since7d))
          .groupBy(trainingSamples.captureMode)
          .orderBy(desc(sql`count(*)`)),
        db
          .select({
            toolType: trainingSamples.toolType,
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(gte(trainingSamples.capturedAt, since48h))
          .groupBy(trainingSamples.toolType),
        db
          .select({
            toolType: jobs.toolType,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(gte(jobs.createdAt, since48h))
          .groupBy(jobs.toolType),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(and(gte(trainingSamples.expiresAt, now), lte(trainingSamples.expiresAt, expiresRawBefore))),
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(trainingSamples)
          .where(and(gte(trainingSamples.derivedExpiresAt, now), lte(trainingSamples.derivedExpiresAt, expiresDerivedBefore))),
        db.select({ count: sql<number>`count(*)::int` }).from(trainingRuns).where(gte(trainingRuns.startedAt, since7d)),
        db
          .select({
            status: trainingRuns.status,
            count: sql<number>`count(*)::int`,
          })
          .from(trainingRuns)
          .where(gte(trainingRuns.startedAt, since7d))
          .groupBy(trainingRuns.status),
        db.query.trainingRuns.findFirst({
          orderBy: [desc(trainingRuns.startedAt)],
        }),
        db.query.modelVersions.findMany({
          orderBy: [desc(modelVersions.createdAt)],
          limit: 10,
        }),
        db.query.modelRollouts.findMany({
          orderBy: [desc(modelRollouts.startedAt)],
          limit: 12,
        }),
        db
          .select({
            status: modelRollouts.status,
            count: sql<number>`count(*)::int`,
          })
          .from(modelRollouts)
          .where(gte(modelRollouts.createdAt, since7d))
          .groupBy(modelRollouts.status),
      ]);

      const sampleReadinessByTool = new Map<string, number>();
      const jobReadinessByTool = new Map<string, number>();

      for (const row of sampleReadinessRows) {
        sampleReadinessByTool.set(row.toolType, toNumber(row.count));
      }
      for (const row of jobReadinessRows) {
        jobReadinessByTool.set(row.toolType, toNumber(row.count));
      }

      return {
        trainingData: {
          samples24h: toNumber(samples24hRows[0]?.count),
          samples7d: toNumber(samples7dRows[0]?.count),
          rawExpiring7d: toNumber(rawExpiringRows[0]?.count),
          derivedExpiring30d: toNumber(derivedExpiringRows[0]?.count),
          byTool: sampleByToolRows.map((row) => ({
            toolType: row.toolType,
            count: toNumber(row.count),
          })),
          byStatus: sampleByStatusRows.map((row) => ({
            status: row.status,
            count: toNumber(row.count),
          })),
          byCaptureMode: sampleByCaptureRows.map((row) => ({
            captureMode: row.captureMode,
            count: toNumber(row.count),
          })),
          readiness48h: TRAINING_TARGET_TOOLS.map((toolType) => {
            const sampleCount = sampleReadinessByTool.get(toolType) ?? 0;
            const jobCount = jobReadinessByTool.get(toolType) ?? 0;
            const sampleToJobRatio = safeRate(sampleCount, jobCount);
            const ready = sampleCount >= 50 && jobCount >= 20 && sampleToJobRatio >= 0.25;

            return {
              toolType,
              sampleCount,
              jobCount,
              sampleToJobRatio,
              ready,
            };
          }),
        },
        trainingOps: {
          runs7d: toNumber(runs7dRows[0]?.count),
          lastRun: lastRun
            ? {
                id: lastRun.id,
                status: lastRun.status,
                backend: lastRun.backend,
                startedAt: lastRun.startedAt.toISOString(),
                finishedAt: lastRun.finishedAt?.toISOString() ?? null,
                notes: lastRun.notes,
              }
            : null,
          runStatusBreakdown: runStatusRows.map((row) => ({
            status: row.status,
            count: toNumber(row.count),
          })),
          latestModelVersions: latestModelVersions.map((version) => ({
            id: version.id,
            toolType: version.toolType,
            lifecycleState: version.lifecycleState,
            createdAt: version.createdAt.toISOString(),
            promotedAt: version.promotedAt?.toISOString() ?? null,
            rolledBackAt: version.rolledBackAt?.toISOString() ?? null,
          })),
          latestRollouts: latestRollouts.map((rollout) => ({
            id: rollout.id,
            toolType: rollout.toolType,
            stage: rollout.stage,
            trafficPct: rollout.trafficPct,
            status: rollout.status,
            rollbackReason: rollout.rollbackReason,
            startedAt: rollout.startedAt.toISOString(),
            finishedAt: rollout.finishedAt?.toISOString() ?? null,
          })),
          rolloutStatusBreakdown: rolloutStatusRows.map((row) => ({
            status: row.status,
            count: toNumber(row.count),
          })),
        },
      };
    },
    {
      trainingData: payload.trainingData,
      trainingOps: payload.trainingOps,
    },
  );

  const storageAnalyticsSection = section(
    "storage_analytics",
    async () => {
      const since7dDay = dayUtc(new Date(now.getTime() - 6 * DAY_MS));

      const [artifactTotalsRows, artifact24hRows, artifact7dRows, retainedSamplesRows, aggregateRows7d, metricKeyRows] =
        await Promise.all([
          db
            .select({
              count: sql<number>`count(*)::int`,
              bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
            })
            .from(artifacts),
          db
            .select({
              bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
            })
            .from(artifacts)
            .where(gte(artifacts.createdAt, since24h)),
          db
            .select({
              bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
            })
            .from(artifacts)
            .where(gte(artifacts.createdAt, since7d)),
          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(trainingSamples)
            .where(or(gte(trainingSamples.expiresAt, now), gte(trainingSamples.derivedExpiresAt, now))),
          db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(analyticsDailyAggregates)
            .where(gte(analyticsDailyAggregates.dayUtc, since7dDay)),
          db
            .select({
              metricKey: analyticsDailyAggregates.metricKey,
              rows: sql<number>`count(*)::int`,
              events: sql<number>`coalesce(sum(${analyticsDailyAggregates.eventsCount}), 0)::bigint`,
            })
            .from(analyticsDailyAggregates)
            .where(gte(analyticsDailyAggregates.dayUtc, since7dDay))
            .groupBy(analyticsDailyAggregates.metricKey)
            .orderBy(desc(sql`count(*)`))
            .limit(10),
        ]);

      return {
        storage: {
          artifactCountTotal: toNumber(artifactTotalsRows[0]?.count),
          artifactBytesTotal: toNumber(artifactTotalsRows[0]?.bytes),
          artifactBytes24h: toNumber(artifact24hRows[0]?.bytes),
          artifactBytes7d: toNumber(artifact7dRows[0]?.bytes),
          trainingSamplesRetained: toNumber(retainedSamplesRows[0]?.count),
        },
        analytics: {
          aggregateRows7d: toNumber(aggregateRows7d[0]?.count),
          metricKeys: metricKeyRows.map((row) => ({
            metricKey: row.metricKey,
            rows: toNumber(row.rows),
            events: toNumber(row.events),
          })),
        },
      };
    },
    {
      storage: payload.storage,
      analytics: payload.analytics,
    },
  );

  const [overviewData, productData, integrityData, timelineData, toolData, privacyData, trainingData, storageData] = await Promise.all([
    overviewSection,
    productSection,
    integritySection,
    timelineSection,
    toolSection,
    privacySection,
    trainingSection,
    storageAnalyticsSection,
  ]);

  const response: OpsIntelligenceResponse = {
    ...payload,
    ...overviewData,
    ...productData,
    ...integrityData,
    ...timelineData,
    ...toolData,
    ...privacyData,
    ...trainingData,
    ...storageData,
    ...(degradedSections.size > 0
      ? {
          degraded: {
            reason: [...degradedSections].join("_"),
            message: "Ops intelligence is partially unavailable. Showing fallback values.",
            sections: [...degradedSections],
          },
        }
      : {}),
  };

  response.product.opportunities =
    degradedSections.has("database") || degradedSections.has("product") ? [] : buildProductOpportunities(response);

  return NextResponse.json(response, { headers: noStoreHeaders() });
}
