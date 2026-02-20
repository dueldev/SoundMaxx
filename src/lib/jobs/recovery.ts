import { eq, or } from "drizzle-orm";
import { env } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { getProviderAdapterByName } from "@/lib/providers/registry";
import { dequeueJob, queueJob } from "@/lib/redis";
import { store } from "@/lib/store";
import type { JobRecord, JobRecoveryState, JobStatus, ToolType } from "@/types/domain";

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const QUEUED_STALE_MS = envInt("JOB_QUEUED_STALE_TIMEOUT_SEC", 5 * 60) * 1000;
const RUNNING_STALE_MS = envInt("JOB_RUNNING_STALE_TIMEOUT_SEC", 15 * 60) * 1000;
const CUSTOM_STEM_STALE_MS = envInt("CUSTOM_STEM_STALE_TIMEOUT_SEC", 4 * 60) * 1000;
const MAX_ATTEMPTS = 2;

function normalizeJobStatus(status: "queued" | "running" | "succeeded" | "failed"): JobStatus {
  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "succeeded") return "succeeded";
  return "failed";
}

function appendQualityFlags(existing: string[], ...flags: string[]) {
  const next = new Set(existing);
  for (const flag of flags) {
    if (!flag) continue;
    next.add(flag);
  }
  return [...next];
}

function webhookSecret(provider: string) {
  if (provider === "replicate") {
    return env.REPLICATE_WEBHOOK_SECRET ?? env.INFERENCE_WEBHOOK_SECRET ?? "";
  }

  return env.INFERENCE_WEBHOOK_SECRET ?? "";
}

function callbackBase(explicitBaseUrl?: string) {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL.replace(/\/$/, "");
  }

  throw new Error("Unable to compute callback URL. Set APP_BASE_URL.");
}

function toDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function staleAgeThresholdMs(job: JobRecord) {
  if (job.status === "queued") return QUEUED_STALE_MS;
  if (job.status === "running") {
    if (job.provider === "custom" && job.toolType === "stem_isolation") {
      return CUSTOM_STEM_STALE_MS;
    }
    return RUNNING_STALE_MS;
  }
  return Number.POSITIVE_INFINITY;
}

function isStale(job: JobRecord, now = new Date()) {
  if (job.status !== "queued" && job.status !== "running") return false;

  const threshold = staleAgeThresholdMs(job);
  if (!Number.isFinite(threshold)) return false;

  const reference = toDate(job.lastRecoveryAt) ?? toDate(job.createdAt);
  if (!reference) return false;

  return now.getTime() - reference.getTime() >= threshold;
}

function parseParams(paramsJson: string) {
  try {
    return JSON.parse(paramsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asJobRecord(row: typeof jobs.$inferSelect): JobRecord {
  const qualityFlags = Array.isArray(row.qualityFlags) ? row.qualityFlags.filter((value): value is string => typeof value === "string") : [];
  return {
    id: row.id,
    sessionId: row.sessionId,
    assetId: row.assetId,
    toolType: row.toolType as ToolType,
    provider: row.provider,
    model: row.model,
    status: row.status as JobStatus,
    progressPct: row.progressPct,
    etaSec: row.etaSec,
    paramsJson: JSON.stringify(row.paramsJson),
    errorCode: row.errorCode,
    externalJobId: row.externalJobId,
    recoveryState: (row.recoveryState as JobRecoveryState) ?? "none",
    attemptCount: row.attemptCount ?? 1,
    qualityFlags,
    lastRecoveryAt: row.lastRecoveryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

async function markFailedAfterRetry(job: JobRecord, reason: string) {
  const failed = await store.updateJob({
    jobId: job.id,
    status: "failed",
    progressPct: 100,
    etaSec: 0,
    recoveryState: "failed_after_retry",
    qualityFlags: appendQualityFlags(job.qualityFlags, "stale_failed_after_retry"),
    errorCode: reason.slice(0, 120),
    finishedAt: new Date().toISOString(),
  });
  await dequeueJob(job.id);
  return failed ?? job;
}

async function retryJob(job: JobRecord, options?: { callbackBaseUrl?: string }) {
  const asset = await store.getSessionAsset(job.assetId, job.sessionId);
  if (!asset?.blobUrl) {
    return markFailedAfterRetry(job, "retry_asset_missing_blob");
  }

  const secret = webhookSecret(job.provider);
  if (!secret) {
    return markFailedAfterRetry(job, "retry_webhook_secret_missing");
  }

  const nextAttemptCount = Math.max(1, job.attemptCount) + 1;
  const recoveredAt = new Date().toISOString();
  await store.updateJob({
    jobId: job.id,
    status: "queued",
    progressPct: 5,
    etaSec: 180,
    recoveryState: "retrying",
    attemptCount: nextAttemptCount,
    qualityFlags: appendQualityFlags(job.qualityFlags, "stale_retry_triggered"),
    errorCode: null,
    finishedAt: null,
    lastRecoveryAt: recoveredAt,
  });
  await queueJob(job.id);

  const adapter = getProviderAdapterByName(job.provider);
  const callbackUrl = `${callbackBase(options?.callbackBaseUrl)}/api/provider/webhook/${job.provider}`;

  try {
    const submit = await adapter.submitJob({
      jobId: job.id,
      toolType: job.toolType,
      params: parseParams(job.paramsJson),
      sourceAsset: asset,
      callback: {
        webhookUrl: callbackUrl,
        webhookSecret: secret,
      },
      dataset: {
        captureMode: "implied_use",
        policyVersion: asset.policyVersion,
      },
    });

    const status = normalizeJobStatus(submit.status);
    const recoveryState: JobRecoveryState =
      status === "failed" ? "failed_after_retry" : status === "succeeded" ? "none" : "retrying";

    const next = await store.updateJob({
      jobId: job.id,
      model: submit.model,
      status,
      externalJobId: submit.externalJobId,
      progressPct: submit.progressPct,
      etaSec: submit.etaSec,
      recoveryState,
      errorCode: submit.errorCode ?? null,
      finishedAt: status === "failed" || status === "succeeded" ? new Date().toISOString() : null,
    });

    if (status === "failed" || status === "succeeded") {
      await dequeueJob(job.id);
    }

    return next ?? job;
  } catch (error) {
    return markFailedAfterRetry(
      job,
      error instanceof Error ? `retry_submission_failed:${error.message}` : "retry_submission_failed",
    );
  }
}

export async function recoverStaleJob(job: JobRecord, options?: { callbackBaseUrl?: string }) {
  if (!isStale(job)) return { action: "noop" as const, job };

  if ((job.attemptCount ?? 1) < MAX_ATTEMPTS) {
    const recovered = await retryJob(job, options);
    return { action: "retried" as const, job: recovered };
  }

  const failed = await markFailedAfterRetry(job, "stale_job_failed_after_retry");
  return { action: "failed" as const, job: failed };
}

export async function recoverStaleJobs(options?: { callbackBaseUrl?: string }) {
  const rows = await getDb().query.jobs.findMany({
    where: or(eq(jobs.status, "queued"), eq(jobs.status, "running")),
  });

  const staleJobs = rows.map(asJobRecord).filter((job) => isStale(job));
  const summary = {
    scanned: rows.length,
    stale: staleJobs.length,
    retried: 0,
    fallback: 0,
    failed: 0,
  };

  for (const job of staleJobs) {
    const result = await recoverStaleJob(job, options);
    if (result.action === "retried") summary.retried += 1;
    if (result.action === "failed") summary.failed += 1;
  }

  return summary;
}
