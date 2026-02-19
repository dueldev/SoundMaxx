"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpsIntelligenceResponse, OpsSessionDataResponse } from "@/types/api";

const HOUR_MS = 60 * 60 * 1000;
const integerFormatter = new Intl.NumberFormat("en-US");

const EMPTY_INTELLIGENCE: OpsIntelligenceResponse = {
  generatedAt: new Date(0).toISOString(),
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

const EMPTY_SESSION_DATA: OpsSessionDataResponse | null = null;

type HealthState = {
  label: string;
  tagClass: string;
};

function formatCount(value: number) {
  return integerFormatter.format(Math.max(0, Math.round(value)));
}

function formatPercent(value: number, fractionDigits = 1) {
  return `${(Math.max(0, value) * 100).toFixed(fractionDigits)}%`;
}

function formatSignedPercent(value: number, fractionDigits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(fractionDigits)}%`;
}

function formatSignedCount(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${integerFormatter.format(rounded)}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || Number.isNaN(seconds) || !Number.isFinite(seconds)) {
    return "n/a";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)}m`;
  }

  return `${(seconds / 3600).toFixed(2)}h`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatToolLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatHourLabel(hourIso: string) {
  const parsed = new Date(hourIso);
  if (Number.isNaN(parsed.getTime())) return hourIso;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ellipsis(value: string, maxLen = 12) {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function integritySeverityClass(severity: "info" | "warn" | "critical") {
  if (severity === "critical") return "tag tag-error";
  if (severity === "warn") return "tag tag-warn";
  return "tag";
}

function deriveHealth(data: OpsIntelligenceResponse, error: string | null, loading: boolean): HealthState {
  if (loading) return { label: "SYNCING", tagClass: "tag" };
  if (error || data.degraded) return { label: "DEGRADED", tagClass: "tag tag-error" };

  if (data.overview.failedJobs24h > 0 || data.queue.stalledRunningOver15m > 0) {
    return { label: "AT RISK", tagClass: "tag tag-error" };
  }

  if (data.overview.queuedJobs > 15 || data.overview.activeJobs > 0) {
    return { label: "PROCESSING", tagClass: "tag tag-warn" };
  }

  return { label: "HEALTHY", tagClass: "tag tag-ok" };
}

function buildPlaybook(data: OpsIntelligenceResponse, error: string | null) {
  const actions: string[] = [];

  if (error || data.degraded) {
    actions.push("> validate database and redis connectivity for ops intelligence", "> confirm ops auth secrets are set in production env");
  }

  if (data.overview.failedJobs24h > 0) {
    actions.push("> inspect failed jobs by error code and requeue only after root cause is fixed");
  }

  if (data.queue.stalledRunningOver15m > 0) {
    actions.push("> investigate running jobs older than 15 minutes and restart affected workers");
  }

  if (data.integrity.staleQueuedOver15m > 0 || data.integrity.staleRunningOver30m > 0) {
    actions.push("> run recovery sweep to retry stale jobs and degrade/fail unrecoverable work");
  }

  if (data.overview.rerunRate24h > 0.2) {
    actions.push("> rerun rate is elevated: review tool defaults and recent model rollouts");
  }

  if (!data.product.trends24h.confidence.statisticallyStable) {
    actions.push("> trend confidence is low due to cohort size: treat day-over-day swings as directional only");
  }

  if (data.product.trends24h.sessionToAssetRateDelta < -0.05) {
    actions.push("> upload conversion is down vs yesterday: inspect acquisition traffic quality and upload UX changes");
  }

  if (data.product.trends24h.p95LatencyDeltaSec !== null && data.product.trends24h.p95LatencyDeltaSec > 45) {
    actions.push("> p95 latency is regressing day-over-day: drill into provider matrix and queue backlog immediately");
  }

  const readinessGaps = data.trainingData.readiness48h.filter((row) => !row.ready && row.jobCount >= 20);
  if (readinessGaps.length > 0) {
    actions.push("> training readiness is weak for active tools: increase capture quality before next autonomous cycle");
  }

  if (data.trainingData.rawExpiring7d > 500) {
    actions.push("> large raw sample expiry window detected: verify retraining cadence before purge");
  }

  if (actions.length === 0) {
    return [
      "> no active incidents detected", 
      "> monitor p95 latency and rerun rate for drift", 
      "> review rollout telemetry before each promotion",
    ];
  }

  return actions.slice(0, 5);
}

export default function OpsDashboardPage() {
  const router = useRouter();
  const [intelligence, setIntelligence] = useState<OpsIntelligenceResponse>(EMPTY_INTELLIGENCE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringTraining, setTriggeringTraining] = useState(false);
  const [triggeringRecovery, setTriggeringRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainingTriggerMessage, setTrainingTriggerMessage] = useState<string | null>(null);
  const [recoveryTriggerMessage, setRecoveryTriggerMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [opsPasswordInput, setOpsPasswordInput] = useState("");
  const [opsActionPassword, setOpsActionPassword] = useState("");
  const [opsPasswordError, setOpsPasswordError] = useState<string | null>(null);
  const [verifyingOpsPassword, setVerifyingOpsPassword] = useState(false);
  const [sessionInput, setSessionInput] = useState("");
  const [sessionData, setSessionData] = useState<OpsSessionDataResponse | null>(EMPTY_SESSION_DATA);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(
    () => (typeof document === "undefined" ? true : document.visibilityState === "visible"),
  );
  const requestInFlightRef = useRef(false);

  const mintActionToken = useCallback(
    async (password: string, signal?: AbortSignal) => {
      const authResponse = await fetch("/api/ops/auth/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        signal,
      });

      const authPayload = (await authResponse.json()) as { error?: string; actionToken?: string };
      if (!authResponse.ok || !authPayload.actionToken) {
        throw new Error(authPayload.error ?? "Unable to authorize ops action");
      }

      return authPayload.actionToken;
    },
    [],
  );

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}, signal?: AbortSignal) => {
      if (!opsActionPassword) {
        throw new Error("Enter the Ops password to unlock API actions.");
      }

      let actionToken: string;
      try {
        actionToken = await mintActionToken(opsActionPassword, signal);
      } catch (authError) {
        if (authError instanceof Error && /invalid password/i.test(authError.message)) {
          setOpsActionPassword("");
          setOpsPasswordError("Ops password changed. Re-enter password to continue.");
        }
        throw authError;
      }
      const headers = new Headers(init.headers);
      headers.set("x-ops-action-token", actionToken);

      return fetch(path, {
        ...init,
        headers,
        signal,
      });
    },
    [mintActionToken, opsActionPassword],
  );

  const unlockOpsApi = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const password = opsPasswordInput.trim();
      if (!password) {
        setOpsPasswordError("Enter the Ops password.");
        return;
      }

      setVerifyingOpsPassword(true);
      try {
        await mintActionToken(password);
        setOpsActionPassword(password);
        setOpsPasswordError(null);
        setError(null);
        setLoading(true);
      } catch (unlockError) {
        setOpsPasswordError(unlockError instanceof Error ? unlockError.message : "Unable to unlock ops actions");
      } finally {
        setVerifyingOpsPassword(false);
      }
    },
    [mintActionToken, opsPasswordInput],
  );

  const fetchIntelligence = useCallback(async (options: { manual?: boolean; signal?: AbortSignal } = {}) => {
    const { manual = false, signal } = options;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (manual) setRefreshing(true);

    try {
      const response = await authFetch("/api/ops/intelligence", {}, signal);

      if (response.status === 401) {
        router.replace("/ops/login");
        router.refresh();
        return;
      }

      const payload = (await response.json()) as OpsIntelligenceResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to load ops intelligence");
      }

      setIntelligence(payload as OpsIntelligenceResponse);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return;
      }

      setError(fetchError instanceof Error ? fetchError.message : "Unable to load ops intelligence");
      setUpdatedAt(new Date().toISOString());
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [authFetch, router]);

  const fetchSessionData = useCallback(async (targetSessionId?: string) => {
    const sessionId = (targetSessionId ?? sessionInput).trim();
    if (!sessionId) {
      setSessionError("Enter a session ID first.");
      return;
    }

    setSessionLoading(true);

    try {
      const response = await authFetch(
        `/api/ops/session/${encodeURIComponent(sessionId)}?assets=24&jobs=48&artifacts=64&quota=45&training=80`,
        {},
      );

      if (response.status === 401) {
        router.replace("/ops/login");
        router.refresh();
        return;
      }

      const payload = (await response.json()) as OpsSessionDataResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to load session data");
      }

      setSessionData(payload as OpsSessionDataResponse);
      setSessionError(null);
      setLoadedSessionId(sessionId);
      setSessionInput(sessionId);
    } catch (sessionFetchError) {
      setSessionError(sessionFetchError instanceof Error ? sessionFetchError.message : "Unable to load session data");
    } finally {
      setSessionLoading(false);
    }
  }, [authFetch, router, sessionInput]);

  const triggerTrainingRun = useCallback(async () => {
    setTriggeringTraining(true);
    setTrainingTriggerMessage(null);

    try {
      const response = await authFetch("/api/cron/training/run", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        runId?: string;
        status?: string;
        notes?: string;
        error?: string;
      };

      if (response.status === 401) {
        router.replace("/ops/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? `Training trigger failed (${response.status})`);
      }

      const status = payload.status ?? "queued";
      const runId = payload.runId ?? "unknown";
      setTrainingTriggerMessage(`Training run ${status}: ${runId}`);

      await fetchIntelligence({ manual: true });
    } catch (triggerError) {
      setTrainingTriggerMessage(triggerError instanceof Error ? triggerError.message : "Training trigger failed");
    } finally {
      setTriggeringTraining(false);
    }
  }, [authFetch, fetchIntelligence, router]);

  const triggerRecoverySweep = useCallback(async () => {
    setTriggeringRecovery(true);
    setRecoveryTriggerMessage(null);

    try {
      const response = await authFetch("/api/ops/recovery", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        scanned?: number;
        stale?: number;
        retried?: number;
        fallback?: number;
        failed?: number;
        error?: string;
      };

      if (response.status === 401) {
        router.replace("/ops/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? `Recovery sweep failed (${response.status})`);
      }

      setRecoveryTriggerMessage(
        `Recovery sweep: scanned ${payload.scanned ?? 0}, stale ${payload.stale ?? 0}, retried ${
          payload.retried ?? 0
        }, fallback ${payload.fallback ?? 0}, failed ${payload.failed ?? 0}`,
      );

      await fetchIntelligence({ manual: true });
    } catch (triggerError) {
      setRecoveryTriggerMessage(triggerError instanceof Error ? triggerError.message : "Recovery sweep failed");
    } finally {
      setTriggeringRecovery(false);
    }
  }, [authFetch, fetchIntelligence, router]);

  const signOutOps = useCallback(async () => {
    try {
      await fetch("/api/ops/auth/logout", {
        method: "POST",
      });
    } catch {
      // best-effort logout
    } finally {
      setOpsActionPassword("");
      setOpsPasswordInput("");
      setOpsPasswordError(null);
      router.replace("/ops/login");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isPageVisible || !opsActionPassword) {
      if (!opsActionPassword) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollAbort: AbortController | null = null;

    const clearPollTimer = () => {
      if (!pollTimer) return;
      clearTimeout(pollTimer);
      pollTimer = null;
    };

    const poll = async () => {
      if (cancelled) return;
      pollAbort = new AbortController();
      await fetchIntelligence({ signal: pollAbort.signal });
      pollAbort = null;
      if (cancelled) return;
      clearPollTimer();
      pollTimer = setTimeout(() => {
        void poll();
      }, 5000);
    };

    void poll();

    return () => {
      cancelled = true;
      clearPollTimer();
      pollAbort?.abort();
    };
  }, [fetchIntelligence, isPageVisible, opsActionPassword]);

  useEffect(() => {
    if (sessionInput || loadedSessionId) return;
    const recent = intelligence.recentSessions[0];
    if (!recent) return;
    setSessionInput(recent.sessionId);
  }, [intelligence.recentSessions, loadedSessionId, sessionInput]);

  const health = useMemo(() => {
    if (!opsActionPassword) {
      return {
        label: "LOCKED",
        tagClass: "tag tag-warn",
      };
    }
    return deriveHealth(intelligence, error, loading);
  }, [intelligence, error, loading, opsActionPassword]);
  const playbook = useMemo(() => buildPlaybook(intelligence, error), [intelligence, error]);
  const degradedSections = useMemo(() => new Set(intelligence.degraded?.sections ?? []), [intelligence.degraded]);
  const isInitialSync = loading && !updatedAt;
  const isSectionUnavailable = useCallback(
    (sectionKey: string) => degradedSections.has("database") || degradedSections.has(sectionKey),
    [degradedSections],
  );
  const displayValue = useCallback(
    (value: string) => (isInitialSync ? "..." : value),
    [isInitialSync],
  );

  const maxHourlyTotal = useMemo(
    () => Math.max(1, ...intelligence.timelines.hourlyJobs.map((point) => point.total)),
    [intelligence.timelines.hourlyJobs],
  );

  const maxFailureCount = useMemo(
    () => Math.max(1, ...intelligence.timelines.hourlyJobs.map((point) => point.failed)),
    [intelligence.timelines.hourlyJobs],
  );

  const kpis = [
    {
      label: "Total Sessions",
      value: displayValue(formatCount(intelligence.overview.totalSessions)),
      note: "all-time footprint",
      alert: false,
    },
    {
      label: "Sessions (24h)",
      value: displayValue(formatCount(intelligence.overview.sessions24h)),
      note: "fresh traffic",
      alert: false,
    },
    {
      label: "Jobs (1h)",
      value: displayValue(formatCount(intelligence.overview.jobs1h)),
      note: "near real-time load",
      alert: false,
    },
    {
      label: "Jobs (24h)",
      value: displayValue(formatCount(intelligence.overview.jobs24h)),
      note: "daily throughput",
      alert: false,
    },
    {
      label: "Success (24h)",
      value: displayValue(formatPercent(intelligence.overview.successRate24h)),
      note: "pipeline quality",
      alert: !isInitialSync && intelligence.overview.successRate24h < 0.9,
    },
    {
      label: "Failed (24h)",
      value: displayValue(formatCount(intelligence.overview.failedJobs24h)),
      note: "triage if non-zero",
      alert: !isInitialSync && intelligence.overview.failedJobs24h > 0,
    },
    {
      label: "p95 Latency",
      value: displayValue(formatDuration(intelligence.overview.p95LatencySec24h)),
      note: "job completion delay",
      alert: !isInitialSync && (intelligence.overview.p95LatencySec24h ?? 0) > 300,
    },
    {
      label: "Rerun Rate",
      value: displayValue(formatPercent(intelligence.overview.rerunRate24h)),
      note: "repeat job pressure",
      alert: !isInitialSync && intelligence.overview.rerunRate24h > 0.2,
    },
    {
      label: "Active Jobs",
      value: displayValue(formatCount(intelligence.overview.activeJobs)),
      note: "queued + running",
      alert: !isInitialSync && intelligence.overview.activeJobs > 25,
    },
    {
      label: "Queue Depth",
      value: displayValue(intelligence.queue.redisDepth === null ? "n/a" : formatCount(intelligence.queue.redisDepth)),
      note: "redis-backed backlog",
      alert: !isInitialSync && (intelligence.queue.redisDepth ?? 0) > 20,
    },
    {
      label: "Stalled Jobs",
      value: displayValue(formatCount(intelligence.queue.stalledRunningOver15m)),
      note: "running > 15m",
      alert: !isInitialSync && intelligence.queue.stalledRunningOver15m > 0,
    },
    {
      label: "Output (24h)",
      value: displayValue(formatBytes(intelligence.overview.outputBytes24h)),
      note: isInitialSync ? "loading..." : `${formatCount(intelligence.overview.outputArtifacts24h)} artifacts`,
      alert: false,
    },
  ];

  return (
    <div className="pb-20">
      <div className="accent-bar" />

      <div className="smx-shell">
        <section className="animate-rise pt-10 pb-8">
          <p
            className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            SoundMaxx · Operations Intelligence
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-5">
              <h1
                className="font-bold leading-tight"
                style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)" }}
              >
                Ops
              </h1>
              <span className={health.tagClass}>{health.label}</span>
            </div>

            <div className="flex items-center gap-4">
              {updatedAt ? (
                <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Updated {new Date(updatedAt).toLocaleTimeString()}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void fetchIntelligence({ manual: true })}
                disabled={!opsActionPassword || refreshing}
                className="brutal-button-ghost px-3 py-2 text-xs"
              >
                <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
                {refreshing ? "Refreshing" : opsActionPassword ? "Refresh" : "Unlock Required"}
              </button>
              <button
                type="button"
                onClick={() => void triggerRecoverySweep()}
                disabled={!opsActionPassword || triggeringRecovery}
                className="brutal-button-ghost px-3 py-2 text-xs"
              >
                {triggeringRecovery ? "Recovering..." : opsActionPassword ? "Run Recovery Sweep" : "Unlock Required"}
              </button>
              <button
                type="button"
                onClick={() => void signOutOps()}
                className="brutal-button-ghost px-3 py-2 text-xs"
              >
                Sign out
              </button>
            </div>
          </div>

          <form className="mt-5 flex flex-wrap items-center gap-3" onSubmit={(event) => void unlockOpsApi(event)}>
            <input
              type="password"
              value={opsPasswordInput}
              onChange={(event) => {
                setOpsPasswordInput(event.target.value);
                if (opsPasswordError) {
                  setOpsPasswordError(null);
                }
              }}
              placeholder="Ops password for API actions"
              className="min-w-[280px] border bg-[var(--background)] px-3 py-2 font-mono text-xs"
              style={{ borderColor: "var(--foreground)" }}
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={verifyingOpsPassword}
              className="brutal-button-primary px-3 py-2 text-xs"
            >
              {verifyingOpsPassword ? "Verifying..." : "Unlock API Actions"}
            </button>
            {opsActionPassword ? (
              <button
                type="button"
                className="brutal-button-ghost px-3 py-2 text-xs"
                onClick={() => {
                  setOpsActionPassword("");
                  setOpsPasswordError(null);
                }}
              >
                Lock API
              </button>
            ) : null}
            <span className={cn("tag", opsActionPassword ? "tag-ok" : "tag-warn")}>
              {opsActionPassword ? "Ops API unlocked" : "Ops API locked"}
            </span>
          </form>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--muted-foreground)" }}>
            Every Ops API request requires a fresh short-lived token derived from this password.
          </p>

          {error ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--destructive)" }}>
              Warning: {error}
            </p>
          ) : null}
          {opsPasswordError ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--destructive)" }}>
              Auth: {opsPasswordError}
            </p>
          ) : null}
          {intelligence.degraded ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--destructive)" }}>
              Warning: {intelligence.degraded.message}
              {intelligence.degraded.sections.length > 0 ? ` (${intelligence.degraded.sections.join(", ")})` : ""}
            </p>
          ) : null}
          {trainingTriggerMessage ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {trainingTriggerMessage}
            </p>
          ) : null}
          {recoveryTriggerMessage ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {recoveryTriggerMessage}
            </p>
          ) : null}
        </section>

        <hr className="section-rule" />

        <section className="py-10">
          <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-4">
            {kpis.map(({ label, value, note, alert }) => (
              <article
                key={label}
                className="brutal-card-flat p-5"
                style={{ borderColor: alert ? "var(--destructive)" : undefined }}
              >
                <p
                  className="font-mono text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {label}
                </p>
                <p className="mt-3 font-mono text-3xl font-bold leading-none" style={alert ? { color: "var(--destructive)" } : undefined}>
                  {value}
                </p>
                <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {note}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-1 grid gap-5 xl:grid-cols-[1.5fr_1fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Growth Funnel (24h)
            </p>
            <h2 className="mt-2 text-xl font-bold">Where users drop off before value</h2>
            {isSectionUnavailable("product") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Product conversion telemetry is currently unavailable.
              </p>
            ) : null}

            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Sessions",
                  value: intelligence.product.funnel24h.sessions,
                  rate: 1,
                },
                {
                  label: "Uploads",
                  value: intelligence.product.funnel24h.assets,
                  rate: intelligence.product.funnel24h.sessionToAssetRate,
                },
                {
                  label: "Jobs",
                  value: intelligence.product.funnel24h.jobs,
                  rate: intelligence.product.funnel24h.assetToJobRate,
                },
                {
                  label: "Succeeded jobs",
                  value: intelligence.product.funnel24h.succeededJobs,
                  rate: intelligence.product.funnel24h.jobToSuccessRate,
                },
                {
                  label: "Artifacts",
                  value: intelligence.product.funnel24h.artifacts,
                  rate: intelligence.product.funnel24h.successToArtifactRate,
                },
              ].map((stage, index) => (
                <div key={stage.label} className="grid grid-cols-[120px_1fr_120px] items-center gap-3">
                  <span className="font-mono text-xs uppercase tracking-[0.08em]" style={{ color: "var(--muted-foreground)" }}>
                    {stage.label}
                  </span>
                  <div className="h-3 border bg-[var(--background)]" style={{ borderColor: "var(--muted)" }}>
                    <div
                      className="h-full bg-[var(--foreground)]/30"
                      style={{
                        width:
                          stage.rate <= 0 ? "0%" : `${Math.max(6, Math.min(100, stage.rate * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-xs">
                    {formatCount(stage.value)}
                    {index === 0 ? "" : ` · ${formatPercent(stage.rate)}`}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Activation + Retention
            </p>
            <h2 className="mt-2 text-xl font-bold">How fast users get value and return</h2>
            {isSectionUnavailable("product") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Activation telemetry is currently unavailable.
              </p>
            ) : null}
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Median time to first job",
                  value: formatDuration(intelligence.product.activation.medianTimeToFirstJobSec24h),
                },
                {
                  label: "Median time to first success",
                  value: formatDuration(intelligence.product.activation.medianTimeToFirstSuccessSec24h),
                },
                {
                  label: "Returning sessions (7d)",
                  value: `${formatCount(intelligence.product.retention.returningSessions7d)} / ${formatCount(intelligence.product.retention.activeSessions7d)}`,
                },
                {
                  label: "Returning rate (7d)",
                  value: formatPercent(intelligence.product.retention.returningRate7d),
                },
                {
                  label: "Jobs per active session",
                  value: intelligence.product.engagement.jobsPerActiveSession24h.toFixed(2),
                },
                {
                  label: "Assets per new session",
                  value: intelligence.product.engagement.assetsPerSession24h.toFixed(2),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Opportunity Radar
            </p>
            <h2 className="mt-2 text-xl font-bold">Highest-leverage website improvements</h2>
            {isSectionUnavailable("product") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Opportunity scoring is currently unavailable.
              </p>
            ) : intelligence.product.opportunities.length === 0 ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No product opportunities are currently flagged.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {intelligence.product.opportunities.map((item) => (
                  <div key={item.key} className="border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={integritySeverityClass(item.severity)}>{item.severity}</span>
                      <span className="font-mono text-xs">{item.metric}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.08em]">{item.headline}</p>
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      {item.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Conversion Leaks (24h)
            </p>
            <h2 className="mt-2 text-xl font-bold">Sessions lost at each stage</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "No upload",
                  value: intelligence.product.conversionLeaks24h.sessionsWithoutUpload,
                },
                {
                  label: "No job",
                  value: intelligence.product.conversionLeaks24h.sessionsWithoutJob,
                },
                {
                  label: "No success",
                  value: intelligence.product.conversionLeaks24h.sessionsWithoutSuccess,
                },
                {
                  label: "No artifact",
                  value: intelligence.product.conversionLeaks24h.sessionsWithoutArtifact,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold">{formatCount(item.value)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              First Tool Adoption
            </p>
            <h2 className="mt-2 text-xl font-bold">What users choose first</h2>
            {intelligence.product.firstToolDistribution24h.length === 0 ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No first-tool data in the last 24h.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {intelligence.product.firstToolDistribution24h.map((item) => (
                  <div key={item.toolType} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(item.toolType)}</p>
                      <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                        {formatCount(item.sessions)} sessions
                      </p>
                    </div>
                    <span className="font-mono text-xs">{formatPercent(item.share)}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Success Latency Mix
            </p>
            <h2 className="mt-2 text-xl font-bold">How fast successful jobs complete</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "< 30s",
                  value: intelligence.product.latencyDistribution24h.under30Sec,
                },
                {
                  label: "30-120s",
                  value: intelligence.product.latencyDistribution24h.between30And120Sec,
                },
                {
                  label: "120-300s",
                  value: intelligence.product.latencyDistribution24h.between120And300Sec,
                },
                {
                  label: "> 300s",
                  value: intelligence.product.latencyDistribution24h.over300Sec,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold">{formatCount(item.value)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Daily Trend Delta
            </p>
            <h2 className="mt-2 text-xl font-bold">Current 24h vs previous 24h</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Sessions",
                  value: formatSignedCount(intelligence.product.trends24h.sessionsDelta),
                  bad: intelligence.product.trends24h.sessionsDelta < 0,
                },
                {
                  label: "Jobs",
                  value: formatSignedCount(intelligence.product.trends24h.jobsDelta),
                  bad: intelligence.product.trends24h.jobsDelta < 0,
                },
                {
                  label: "Success rate",
                  value: formatSignedPercent(intelligence.product.trends24h.successRateDelta),
                  bad: intelligence.product.trends24h.successRateDelta < 0,
                },
                {
                  label: "Rerun rate",
                  value: formatSignedPercent(intelligence.product.trends24h.rerunRateDelta),
                  bad: intelligence.product.trends24h.rerunRateDelta > 0,
                },
                {
                  label: "Session->upload",
                  value: formatSignedPercent(intelligence.product.trends24h.sessionToAssetRateDelta),
                  bad: intelligence.product.trends24h.sessionToAssetRateDelta < 0,
                },
                {
                  label: "Asset->job",
                  value: formatSignedPercent(intelligence.product.trends24h.assetToJobRateDelta),
                  bad: intelligence.product.trends24h.assetToJobRateDelta < 0,
                },
                {
                  label: "p95 latency",
                  value:
                    intelligence.product.trends24h.p95LatencyDeltaSec === null
                      ? "n/a"
                      : `${intelligence.product.trends24h.p95LatencyDeltaSec > 0 ? "+" : ""}${Math.round(
                          intelligence.product.trends24h.p95LatencyDeltaSec,
                        )}s`,
                  bad: (intelligence.product.trends24h.p95LatencyDeltaSec ?? 0) > 0,
                },
                {
                  label: "Trend confidence",
                  value: `${intelligence.product.trends24h.confidence.level} (${formatCount(
                    intelligence.product.trends24h.confidence.sessions24h,
                  )} sessions, ${formatCount(intelligence.product.trends24h.confidence.jobs24h)} jobs)`,
                  bad: !intelligence.product.trends24h.confidence.statisticallyStable,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold" style={item.bad ? { color: "var(--destructive)" } : undefined}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Rerun Diagnostics (24h)
            </p>
            <h2 className="mt-2 text-xl font-bold">Behavior vs quality rerun pressure</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Immediate same tool+asset",
                  value: formatPercent(intelligence.product.rerunMetrics24h.immediateSameToolSameAssetRate),
                },
                {
                  label: "Cross-tool chain",
                  value: formatPercent(intelligence.product.rerunMetrics24h.crossToolChainRate),
                },
                {
                  label: "Post-failure retry",
                  value: formatPercent(intelligence.product.rerunMetrics24h.postFailureRetryRate),
                },
                {
                  label: "Sample size",
                  value: formatCount(intelligence.product.rerunMetrics24h.sampleSize),
                },
                {
                  label: "Confidence",
                  value: intelligence.product.rerunMetrics24h.confidence,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Value Economics (24h)
            </p>
            <h2 className="mt-2 text-xl font-bold">Output efficiency and session value</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Artifacts per success",
                  value: intelligence.product.economics24h.artifactsPerSucceededJob.toFixed(2),
                },
                {
                  label: "Bytes per success",
                  value: formatBytes(intelligence.product.economics24h.bytesPerSucceededJob),
                },
                {
                  label: "Bytes per session",
                  value: formatBytes(intelligence.product.economics24h.bytesPerSession),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-2 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Session Data Explorer
            </p>
            <h2 className="mt-2 text-xl font-bold">Inspect exactly what we collected for one session</h2>

            <form
              className="mt-5 flex flex-wrap items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void fetchSessionData();
              }}
            >
              <input
                type="text"
                value={sessionInput}
                onChange={(event) => setSessionInput(event.target.value)}
                placeholder="Paste session ID"
                className="min-w-[260px] flex-1 border bg-[var(--background)] px-3 py-2 font-mono text-sm"
                style={{ borderColor: "var(--foreground)" }}
              />
              <button
                type="submit"
                disabled={sessionLoading || !opsActionPassword}
                className="brutal-button-primary px-3 py-2 text-xs"
              >
                {sessionLoading ? "Loading..." : "Load Session"}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {intelligence.recentSessions.map((session) => (
                <button
                  key={session.sessionId}
                  type="button"
                  className={cn("tag", loadedSessionId === session.sessionId && "tag-accent")}
                  onClick={() => {
                    setSessionInput(session.sessionId);
                    void fetchSessionData(session.sessionId);
                  }}
                >
                  {ellipsis(session.sessionId, 10)}
                </button>
              ))}
            </div>

            {sessionError ? (
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.08em]" style={{ color: "var(--destructive)" }}>
                {sessionError}
              </p>
            ) : null}

            {sessionData ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Session ID</p>
                  <p className="mt-1 font-mono text-xs">{sessionData.session.id}</p>
                </div>
                <div className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Policy accepted</p>
                  <p className="mt-1 font-mono text-xs">{sessionData.session.policyVersion}</p>
                </div>
                <div className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Created</p>
                  <p className="mt-1 font-mono text-xs">{new Date(sessionData.session.createdAt).toLocaleString()}</p>
                </div>
                <div className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Last seen</p>
                  <p className="mt-1 font-mono text-xs">{new Date(sessionData.session.lastSeenAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                Choose a session to load collected records.
              </p>
            )}
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Session Summary
            </p>
            <h2 className="mt-2 text-xl font-bold">Collected footprint</h2>

            {sessionData ? (
              <div className="mt-5 space-y-2">
                {[
                  { label: "Assets", value: formatCount(sessionData.stats.assetsCount) },
                  { label: "Jobs", value: formatCount(sessionData.stats.jobsCount) },
                  { label: "Failed jobs", value: formatCount(sessionData.stats.failedJobsCount) },
                  { label: "Artifacts", value: formatCount(sessionData.stats.artifactsCount) },
                  { label: "Uploaded bytes", value: formatBytes(sessionData.stats.uploadedBytesTotal) },
                  { label: "Output bytes", value: formatBytes(sessionData.stats.outputBytesTotal) },
                  { label: "Avg asset duration", value: formatDuration(sessionData.stats.avgAssetDurationSec) },
                  { label: "Training rows linked", value: formatCount(sessionData.stats.trainingSamplesLinked) },
                  {
                    label: "Ad personalization",
                    value: sessionData.session.adPersonalizationOptIn ? "enabled" : "off",
                  },
                  {
                    label: "Do not sell/share",
                    value: sessionData.session.doNotSellOrShare ? "enabled" : "off",
                  },
                  {
                    label: "Job failure rate",
                    value: formatPercent(
                      sessionData.stats.jobsCount > 0
                        ? sessionData.stats.failedJobsCount / sessionData.stats.jobsCount
                        : 0,
                    ),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                    <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                      {item.label}
                    </span>
                    <span className="font-mono text-sm font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                Session-level metrics will appear here after you load one session.
              </p>
            )}
          </article>
        </section>

        {sessionData ? (
          <>
            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
              <article className="brutal-card-flat overflow-x-auto p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Session Assets
                </p>
                <h2 className="mt-2 text-xl font-bold">Uploaded asset records</h2>
                <table className="mt-5 min-w-[840px] w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                      {["Asset", "Duration", "Policy", "Mode", "Jobs", "Artifacts", "Created"].map((header) => (
                        <th
                          key={header}
                          className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.assets.map((asset) => (
                      <tr key={asset.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                        <td className="py-3 font-mono text-xs">{ellipsis(asset.id, 14)}</td>
                        <td className="py-3 font-mono text-xs">{formatDuration(asset.durationSec)}</td>
                        <td className="py-3 font-mono text-xs">{asset.policyVersion}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{asset.trainingCaptureMode}</td>
                        <td className="py-3 font-mono text-xs">{formatCount(asset.jobsCount)}</td>
                        <td className="py-3 font-mono text-xs">{formatCount(asset.artifactsCount)}</td>
                        <td className="py-3 font-mono text-xs">{new Date(asset.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="brutal-card-flat overflow-x-auto p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Session Jobs
                </p>
                <h2 className="mt-2 text-xl font-bold">Processing timeline</h2>
                <table className="mt-5 min-w-[940px] w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                      {["Job", "Tool", "Status", "Provider", "Model", "Artifacts", "Bytes", "Created"].map((header) => (
                        <th
                          key={header}
                          className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.jobs.map((job) => (
                      <tr key={job.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                        <td className="py-3 font-mono text-xs">{ellipsis(job.id, 14)}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(job.toolType)}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]" style={job.status === "failed" ? { color: "var(--destructive)" } : undefined}>
                          {job.status}
                        </td>
                        <td className="py-3 font-mono text-xs">{job.provider}</td>
                        <td className="py-3 font-mono text-xs">{job.model}</td>
                        <td className="py-3 font-mono text-xs">{formatCount(job.artifactsCount)}</td>
                        <td className="py-3 font-mono text-xs">{formatBytes(job.artifactsBytes)}</td>
                        <td className="py-3 font-mono text-xs">{new Date(job.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
              <article className="brutal-card-flat overflow-x-auto p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Session Artifacts
                </p>
                <h2 className="mt-2 text-xl font-bold">Output files retained</h2>
                <table className="mt-5 min-w-[760px] w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                      {["Artifact", "Job", "Format", "Size", "Created", "Expires"].map((header) => (
                        <th
                          key={header}
                          className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.artifacts.map((artifact) => (
                      <tr key={artifact.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                        <td className="py-3 font-mono text-xs">{ellipsis(artifact.id, 14)}</td>
                        <td className="py-3 font-mono text-xs">{ellipsis(artifact.jobId, 14)}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{artifact.format}</td>
                        <td className="py-3 font-mono text-xs">{formatBytes(artifact.sizeBytes)}</td>
                        <td className="py-3 font-mono text-xs">{new Date(artifact.createdAt).toLocaleString()}</td>
                        <td className="py-3 font-mono text-xs">{new Date(artifact.expiresAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="brutal-card-flat overflow-x-auto p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Training Linkage
                </p>
                <h2 className="mt-2 text-xl font-bold">De-identified samples tied to this session</h2>
                <table className="mt-5 min-w-[760px] w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                      {["Sample", "Tool", "Status", "Capture", "Output hashes", "Captured"].map((header) => (
                        <th
                          key={header}
                          className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.trainingSamples.map((sample) => (
                      <tr key={sample.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                        <td className="py-3 font-mono text-xs">{ellipsis(sample.sampleId, 14)}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(sample.toolType)}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{sample.status}</td>
                        <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{sample.captureMode}</td>
                        <td className="py-3 font-mono text-xs">{formatCount(sample.outputHashCount)}</td>
                        <td className="py-3 font-mono text-xs">{new Date(sample.capturedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </section>

            <section className="mt-5">
              <article className="brutal-card-flat overflow-x-auto p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Session Quota Usage
                </p>
                <h2 className="mt-2 text-xl font-bold">Daily metering captured for this session</h2>
                <table className="mt-5 min-w-[680px] w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                      {["Day (UTC)", "Jobs", "Seconds processed", "Bytes uploaded"].map((header) => (
                        <th
                          key={header}
                          className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.quotaUsage.map((row) => (
                      <tr key={row.dayUtc} style={{ borderBottom: "1px solid var(--muted)" }}>
                        <td className="py-3 font-mono text-xs">{row.dayUtc}</td>
                        <td className="py-3 font-mono text-xs">{formatCount(row.jobsCount)}</td>
                        <td className="py-3 font-mono text-xs">{formatDuration(row.secondsProcessed)}</td>
                        <td className="py-3 font-mono text-xs">{formatBytes(row.bytesUploaded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </section>
          </>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Throughput Timeline
            </p>
            <h2 className="mt-2 text-xl font-bold">Jobs and failures by hour (24h)</h2>

            {isSectionUnavailable("timeline") ? (
              <p className="mt-6 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Timeline telemetry is currently unavailable.
              </p>
            ) : intelligence.timelines.hourlyJobs.length === 0 ? (
              <p className="mt-6 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No timeline data available.
              </p>
            ) : (
              <div className="mt-5 max-h-[460px] space-y-2 overflow-y-auto pr-2">
                {intelligence.timelines.hourlyJobs.map((point) => {
                  const loadWidth = `${(point.total / maxHourlyTotal) * 100}%`;
                  const failedWidth = `${(point.failed / maxFailureCount) * 100}%`;
                  return (
                    <div key={point.hour} className="grid grid-cols-[72px_1fr_64px] items-center gap-3">
                      <p className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {formatHourLabel(point.hour)}
                      </p>
                      <div className="relative h-5 overflow-hidden rounded-none border border-[var(--muted)] bg-[var(--background)]">
                        <div className="absolute inset-y-0 left-0 bg-[var(--foreground)]/20" style={{ width: loadWidth }} />
                        <div className="absolute inset-y-0 left-0 bg-[var(--destructive)]/30" style={{ width: failedWidth }} />
                      </div>
                      <p className="text-right font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {formatCount(point.total)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Success (1h)</p>
                <p className="mt-1 font-mono text-lg font-bold">{formatPercent(intelligence.overview.successRate1h)}</p>
              </div>
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Success (7d)</p>
                <p className="mt-1 font-mono text-lg font-bold">{formatPercent(intelligence.overview.successRate7d)}</p>
              </div>
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Median latency</p>
                <p className="mt-1 font-mono text-lg font-bold">{formatDuration(intelligence.overview.p50LatencySec24h)}</p>
              </div>
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Queue Pressure
            </p>
            <h2 className="mt-2 text-xl font-bold">Runtime backlog and aging</h2>
            <div className="mt-5 grid gap-3">
              {[
                {
                  label: "Queued jobs",
                  value: formatCount(intelligence.overview.queuedJobs),
                  alert: intelligence.overview.queuedJobs > 15,
                },
                {
                  label: "Running jobs",
                  value: formatCount(intelligence.overview.runningJobs),
                  alert: false,
                },
                {
                  label: "Oldest queued",
                  value: formatDuration(intelligence.queue.oldestQueuedSec),
                  alert: intelligence.queue.oldestQueuedSec > 300,
                },
                {
                  label: "Oldest running",
                  value: formatDuration(intelligence.queue.oldestRunningSec),
                  alert: intelligence.queue.oldestRunningSec > 900,
                },
                {
                  label: "Stalled > 15m",
                  value: formatCount(intelligence.queue.stalledRunningOver15m),
                  alert: intelligence.queue.stalledRunningOver15m > 0,
                },
                {
                  label: "Redis depth",
                  value: intelligence.queue.redisDepth === null ? "n/a" : formatCount(intelligence.queue.redisDepth),
                  alert: (intelligence.queue.redisDepth ?? 0) > 20,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </span>
                  <span className="font-mono text-sm font-bold" style={item.alert ? { color: "var(--destructive)" } : undefined}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Data Integrity
            </p>
            <h2 className="mt-2 text-xl font-bold">Queue and storage consistency checks</h2>
            {isSectionUnavailable("integrity") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Integrity telemetry is currently unavailable.
              </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Queued jobs (DB)",
                  value: formatCount(intelligence.integrity.dbQueuedJobs),
                },
                {
                  label: "Queue depth (Redis)",
                  value: intelligence.integrity.redisQueueDepth === null ? "n/a" : formatCount(intelligence.integrity.redisQueueDepth),
                },
                {
                  label: "Queue drift",
                  value: intelligence.integrity.queueVsDbDrift === null ? "n/a" : formatCount(intelligence.integrity.queueVsDbDrift),
                },
                {
                  label: "Stale queued > 15m",
                  value: formatCount(intelligence.integrity.staleQueuedOver15m),
                },
                {
                  label: "Stale running > 30m",
                  value: formatCount(intelligence.integrity.staleRunningOver30m),
                },
                {
                  label: "Orphan artifacts",
                  value: formatCount(intelligence.integrity.orphanArtifacts),
                },
                {
                  label: "Orphan jobs",
                  value: formatCount(intelligence.integrity.orphanJobs),
                },
                {
                  label: "Dup external IDs",
                  value: formatCount(intelligence.integrity.duplicateExternalJobIds),
                },
                {
                  label: "Assets missing blob > 15m",
                  value: formatCount(intelligence.integrity.assetsMissingBlobUrlOver15m),
                },
                {
                  label: "Failed no error code (24h)",
                  value: formatCount(intelligence.integrity.failedWithoutErrorCode24h),
                },
                {
                  label: "Training no output hashes",
                  value: formatCount(intelligence.integrity.trainingSamplesMissingOutputHashes),
                },
                {
                  label: "Training no input hash",
                  value: formatCount(intelligence.integrity.trainingSamplesMissingInputHash),
                },
              ].map((item) => (
                <div key={item.label} className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Integrity Alerts
            </p>
            <h2 className="mt-2 text-xl font-bold">Actionable anomalies</h2>
            {isSectionUnavailable("integrity") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Alert stream unavailable.
              </p>
            ) : intelligence.integrity.alerts.length === 0 ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No integrity anomalies detected.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {intelligence.integrity.alerts.map((alert) => (
                  <div key={alert.key} className="border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={integritySeverityClass(alert.severity)}>{alert.severity}</span>
                      <span className="font-mono text-xs">{formatCount(alert.count)}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.08em]">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Tool Diagnostics
            </p>
            <h2 className="mt-2 text-xl font-bold">Per-tool quality and speed (24h)</h2>

            <table className="mt-5 min-w-[780px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "Tool",
                    "Jobs",
                    "Success",
                    "Failed",
                    "P95",
                    "Rerun",
                    "Avg output",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.tools.map((tool) => (
                  <tr key={tool.toolType} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-sm uppercase tracking-[0.08em]">{formatToolLabel(tool.toolType)}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(tool.jobs24h)}</td>
                    <td className="py-3 font-mono text-sm" style={tool.successRate24h < 0.9 ? { color: "var(--destructive)" } : undefined}>
                      {formatPercent(tool.successRate24h)}
                    </td>
                    <td className="py-3 font-mono text-sm" style={tool.failed24h > 0 ? { color: "var(--destructive)" } : undefined}>
                      {formatCount(tool.failed24h)}
                    </td>
                    <td className="py-3 font-mono text-sm">{formatDuration(tool.p95LatencySec24h)}</td>
                    <td className="py-3 font-mono text-sm" style={tool.rerunRate24h > 0.2 ? { color: "var(--destructive)" } : undefined}>
                      {formatPercent(tool.rerunRate24h)}
                    </td>
                    <td className="py-3 font-mono text-sm">{tool.avgArtifactBytes24h === null ? "n/a" : formatBytes(tool.avgArtifactBytes24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {isSectionUnavailable("tooling") ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Tool diagnostics are currently unavailable.
              </p>
            ) : intelligence.tools.length === 0 ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No tool telemetry in the selected window.
              </p>
            ) : null}
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Operator Playbook
            </p>
            <h2 className="mt-2 text-xl font-bold">Next best action</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {playbook.map((line) => (
                <li key={line} className="font-mono text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/tools/stem-isolation" className="brutal-button-primary mt-6 inline-flex text-xs">
              Open Studio
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </article>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-2">
          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Provider Matrix
            </p>
            <h2 className="mt-2 text-xl font-bold">Provider and model reliability (24h)</h2>
            {isSectionUnavailable("tooling") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Provider telemetry is currently unavailable.
              </p>
            ) : null}

            <table className="mt-5 min-w-[560px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "Provider",
                    "Model",
                    "Jobs",
                    "Failure",
                    "P95",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.providers.map((provider) => (
                  <tr key={`${provider.provider}-${provider.model}`} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-sm">{provider.provider}</td>
                    <td className="py-3 font-mono text-sm">{provider.model}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(provider.jobs24h)}</td>
                    <td className="py-3 font-mono text-sm" style={provider.failureRate24h > 0.05 ? { color: "var(--destructive)" } : undefined}>
                      {formatPercent(provider.failureRate24h)}
                    </td>
                    <td className="py-3 font-mono text-sm">{formatDuration(provider.p95LatencySec24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Failure Taxonomy
            </p>
            <h2 className="mt-2 text-xl font-bold">Top error codes (7d)</h2>
            <div className="mt-5 space-y-2">
              {intelligence.errors.map((row) => (
                <div key={row.errorCode} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <p className="truncate font-mono text-xs uppercase tracking-[0.08em]">{row.errorCode}</p>
                  <p className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>24h: {formatCount(row.count24h)}</p>
                  <p className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>7d: {formatCount(row.count7d)}</p>
                </div>
              ))}
            </div>
            {isSectionUnavailable("tooling") ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Failure taxonomy is currently unavailable.
              </p>
            ) : intelligence.errors.length === 0 ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No failed error codes captured in the last 7 days.
              </p>
            ) : null}
          </article>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-3">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Privacy Signals
            </p>
            <h2 className="mt-2 text-xl font-bold">Consent-state metrics</h2>
            {isSectionUnavailable("privacy") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Privacy telemetry is currently unavailable.
              </p>
            ) : null}
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Ad personalization opt-in",
                  value: formatCount(intelligence.privacy.adPersonalizationOptInSessions),
                },
                {
                  label: "Do not sell/share",
                  value: formatCount(intelligence.privacy.doNotSellOrShareSessions),
                },
                {
                  label: "Age confirmed assets (24h)",
                  value: formatCount(intelligence.privacy.ageConfirmedAssets24h),
                },
                {
                  label: "Rights confirmed assets (24h)",
                  value: formatCount(intelligence.privacy.rightsConfirmedAssets24h),
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>{row.label}</p>
                  <p className="font-mono text-sm font-bold">{row.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Policy Version Adoption
            </p>
            <h2 className="mt-2 text-xl font-bold">Session and asset alignment</h2>

            <table className="mt-5 min-w-[360px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "Policy",
                    "Sessions",
                    "Assets",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.privacy.policyVersionBreakdown.map((row) => (
                  <tr key={row.policyVersion} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-sm">{row.policyVersion}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(row.sessions)}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(row.assets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Storage Footprint
            </p>
            <h2 className="mt-2 text-xl font-bold">Artifacts and retention</h2>
            <div className="mt-5 space-y-2">
              {[
                {
                  label: "Total artifacts",
                  value: formatCount(intelligence.storage.artifactCountTotal),
                },
                {
                  label: "Artifact bytes (total)",
                  value: formatBytes(intelligence.storage.artifactBytesTotal),
                },
                {
                  label: "Artifact bytes (24h)",
                  value: formatBytes(intelligence.storage.artifactBytes24h),
                },
                {
                  label: "Artifact bytes (7d)",
                  value: formatBytes(intelligence.storage.artifactBytes7d),
                },
                {
                  label: "Training rows retained",
                  value: formatCount(intelligence.storage.trainingSamplesRetained),
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>{row.label}</p>
                  <p className="font-mono text-sm font-bold">{row.value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Training Dataset
            </p>
            <h2 className="mt-2 text-xl font-bold">Capture and retention pressure</h2>
            {isSectionUnavailable("training") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Training dataset telemetry is currently unavailable.
              </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Samples (24h)",
                  value: formatCount(intelligence.trainingData.samples24h),
                },
                {
                  label: "Samples (7d)",
                  value: formatCount(intelligence.trainingData.samples7d),
                },
                {
                  label: "Raw expiring in 7d",
                  value: formatCount(intelligence.trainingData.rawExpiring7d),
                },
                {
                  label: "Derived expiring in 30d",
                  value: formatCount(intelligence.trainingData.derivedExpiring30d),
                },
              ].map((item) => (
                <div key={item.label} className="border-l-2 pl-3">
                  <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>{item.label}</p>
                  <p className="mt-1 font-mono text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>By tool (7d)</p>
                <div className="mt-2 space-y-1.5">
                  {intelligence.trainingData.byTool.map((item) => (
                    <div key={item.toolType} className="flex items-center justify-between border-b pb-1" style={{ borderColor: "var(--muted)" }}>
                      <span className="font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(item.toolType)}</span>
                      <span className="font-mono text-xs">{formatCount(item.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>By status / capture mode</p>
                <div className="mt-2 space-y-1.5">
                  {intelligence.trainingData.byStatus.map((item) => (
                    <div key={item.status} className="flex items-center justify-between border-b pb-1" style={{ borderColor: "var(--muted)" }}>
                      <span className="font-mono text-xs uppercase tracking-[0.08em]">{item.status}</span>
                      <span className="font-mono text-xs">{formatCount(item.count)}</span>
                    </div>
                  ))}
                  {intelligence.trainingData.byCaptureMode.map((item) => (
                    <div key={item.captureMode} className="flex items-center justify-between border-b pb-1" style={{ borderColor: "var(--muted)" }}>
                      <span className="font-mono text-xs uppercase tracking-[0.08em]">{item.captureMode}</span>
                      <span className="font-mono text-xs">{formatCount(item.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>
                Training readiness (48h)
              </p>
              <div className="mt-2 space-y-1.5">
                {intelligence.trainingData.readiness48h.map((item) => (
                  <div key={item.toolType} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b pb-1" style={{ borderColor: "var(--muted)" }}>
                    <span className="font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(item.toolType)}</span>
                    <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                      S: {formatCount(item.sampleCount)}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                      J: {formatCount(item.jobCount)}
                    </span>
                    <span className={cn("tag", item.ready ? "tag-ok" : "tag-warn")}>
                      {formatPercent(item.sampleToJobRatio, 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Autonomous Training
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Runs and rollout control</h2>
              <button
                type="button"
                onClick={() => void triggerTrainingRun()}
                disabled={triggeringTraining || !opsActionPassword}
                className="brutal-button-primary px-3 py-2 text-xs"
              >
                {triggeringTraining ? "Running..." : opsActionPassword ? "Run Training Now" : "Unlock Required"}
              </button>
            </div>
            {isSectionUnavailable("training") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Training run telemetry is currently unavailable.
              </p>
            ) : null}

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Runs (7d)</span>
                <span className="font-mono text-sm font-bold">{formatCount(intelligence.trainingOps.runs7d)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Last run status</span>
                <span className="font-mono text-sm font-bold uppercase tracking-[0.08em]" style={
                  intelligence.trainingOps.lastRun?.status === "failed" ? { color: "var(--destructive)" } : undefined
                }>
                  {intelligence.trainingOps.lastRun?.status ?? "none"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--muted)" }}>
                <span className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Last started</span>
                <span className="font-mono text-xs">{
                  intelligence.trainingOps.lastRun ? new Date(intelligence.trainingOps.lastRun.startedAt).toLocaleString() : "n/a"
                }</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {intelligence.trainingOps.runStatusBreakdown.map((status) => (
                <span key={status.status} className={cn("tag", status.status === "failed" && "tag-error", status.status === "succeeded" && "tag-ok")}>
                  {status.status}: {formatCount(status.count)}
                </span>
              ))}
            </div>

            {intelligence.trainingOps.lastRun?.notes ? (
              <p className="mt-4 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                {intelligence.trainingOps.lastRun.notes}
              </p>
            ) : null}
          </article>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Model Registry
            </p>
            <h2 className="mt-2 text-xl font-bold">Latest model versions</h2>

            <table className="mt-5 min-w-[640px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "ID",
                    "Tool",
                    "State",
                    "Created",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.trainingOps.latestModelVersions.map((version) => (
                  <tr key={version.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-xs">{version.id.slice(0, 10)}</td>
                    <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(version.toolType)}</td>
                    <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]" style={
                      version.lifecycleState === "rolled_back" ? { color: "var(--destructive)" } : undefined
                    }>
                      {version.lifecycleState}
                    </td>
                    <td className="py-3 font-mono text-xs">{new Date(version.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Rollout Stream
            </p>
            <h2 className="mt-2 text-xl font-bold">Canary and rollback events</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {intelligence.trainingOps.rolloutStatusBreakdown.map((status) => (
                <span key={status.status} className={cn("tag", status.status === "rolled_back" && "tag-error", status.status === "live" && "tag-ok")}>
                  {status.status}: {formatCount(status.count)}
                </span>
              ))}
            </div>

            <table className="mt-5 min-w-[640px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "Tool",
                    "Stage",
                    "Traffic",
                    "Status",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.trainingOps.latestRollouts.map((rollout) => (
                  <tr key={rollout.id} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]">{formatToolLabel(rollout.toolType)}</td>
                    <td className="py-3 font-mono text-xs">{rollout.stage}</td>
                    <td className="py-3 font-mono text-xs">{rollout.trafficPct}%</td>
                    <td className="py-3 font-mono text-xs uppercase tracking-[0.08em]" style={
                      rollout.status === "rolled_back" ? { color: "var(--destructive)" } : undefined
                    }>
                      {rollout.status}
                      {rollout.rollbackReason ? ` (${rollout.rollbackReason})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <section className="mt-10">
          <article className="brutal-card-flat overflow-x-auto p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Aggregated Analytics
            </p>
            <h2 className="mt-2 text-xl font-bold">Export-safe metric inventory (7d)</h2>
            {isSectionUnavailable("storage_analytics") ? (
              <p className="mt-3 font-mono text-sm" style={{ color: "var(--destructive)" }}>
                Aggregate analytics telemetry is currently unavailable.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="tag tag-accent">Rows: {formatCount(intelligence.analytics.aggregateRows7d)}</span>
              <span className="tag">Generated: {new Date(intelligence.generatedAt).toLocaleTimeString()}</span>
            </div>

            <table className="mt-5 min-w-[560px] w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  {[
                    "Metric key",
                    "Rows",
                    "Events",
                  ].map((header) => (
                    <th
                      key={header}
                      className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intelligence.analytics.metricKeys.map((metric) => (
                  <tr key={metric.metricKey} style={{ borderBottom: "1px solid var(--muted)" }}>
                    <td className="py-3 font-mono text-sm">{metric.metricKey}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(metric.rows)}</td>
                    <td className="py-3 font-mono text-sm">{formatCount(metric.events)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {intelligence.analytics.metricKeys.length === 0 ? (
              <p className="mt-4 font-mono text-sm" style={{ color: "var(--muted-foreground)" }}>
                No aggregate rows available in the last 7 days.
              </p>
            ) : null}
          </article>
        </section>

        <section className="mt-10">
          <article className="brutal-card-flat p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
              Polling Metadata
            </p>
            <h2 className="mt-2 text-xl font-bold">Client telemetry freshness</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Poll interval</p>
                <p className="mt-1 font-mono text-lg font-bold">{formatDuration(5)}</p>
              </div>
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Window resolution</p>
                <p className="mt-1 font-mono text-lg font-bold">24h / 7d</p>
              </div>
              <div className="border-l-2 pl-3">
                <p className="font-mono text-xs uppercase tracking-[0.1em]" style={{ color: "var(--muted-foreground)" }}>Current timeslice</p>
                <p className="mt-1 font-mono text-lg font-bold">{formatHourLabel(new Date(Date.now() - HOUR_MS).toISOString())}</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
