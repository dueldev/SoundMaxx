"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  FlameIcon,
  Layers3Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpsSummary } from "@/types/domain";

const EMPTY_SUMMARY: OpsSummary = {
  totalSessions: 0,
  activeJobs: 0,
  failedJobsLast24h: 0,
  queueDepth: 0,
};

type OpsHealth = {
  label: string;
  description: string;
  badgeClassName: string;
};

function deriveHealth(summary: OpsSummary, error: string | null, loading: boolean): OpsHealth {
  if (loading) {
    return {
      label: "Syncing",
      description: "Refreshing telemetry from queue and job services.",
      badgeClassName: "border-border bg-background/72 text-muted-foreground",
    };
  }

  if (error || summary.degraded) {
    return {
      label: "Degraded",
      description: summary.degraded?.message ?? error ?? "Some telemetry sources are unavailable.",
      badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (summary.activeJobs > 0 || summary.queueDepth > 0) {
    return {
      label: "Processing",
      description: "Jobs are actively moving through the pipeline.",
      badgeClassName: "border-[color-mix(in_srgb,var(--brand-cobalt)_52%,transparent)] bg-accent/10 text-accent",
    };
  }

  return {
    label: "Healthy",
    description: "No queue pressure and no elevated failure signals.",
    badgeClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
}

export default function OpsPage() {
  const [summary, setSummary] = useState<OpsSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchSummary = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/ops/summary", { cache: "no-store" });
      const payload = (await response.json()) as OpsSummary | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to load summary");
      }

      setSummary(payload as OpsSummary);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load summary");
      setSummary(EMPTY_SUMMARY);
      setUpdatedAt(new Date().toISOString());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const timer = setInterval(() => {
      void fetchSummary();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchSummary]);

  const health = useMemo(() => deriveHealth(summary, error, loading), [summary, error, loading]);

  return (
    <div className="relative overflow-x-hidden pb-12">
      <div className="smx-shell flex flex-col gap-5 pt-4 md:pt-8">
        <section className="smx-dark-frame p-5 md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
            <div>
              <p className="smx-kicker text-white/70">
                <ShieldCheckIcon className="size-3.5" />
                Ops Control
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#f6f8ff] md:text-6xl">Operational signal, with explicit next action.</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                Queue pressure, failures, and active jobs are tracked in one place so operators can triage quickly without opening multiple surfaces.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`smx-chip ${health.badgeClassName}`}>
                  {health.label === "Degraded" ? <AlertTriangleIcon className="size-3.5" /> : <CheckCircle2Icon className="size-3.5" />}
                  {health.label}
                </span>
                {updatedAt ? (
                  <span className="smx-chip border-white/20 bg-white/[0.06] text-white/72">
                    <Clock3Icon className="size-3.5" />
                    Updated {new Date(updatedAt).toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
            </div>

            <aside className="rounded-2xl border border-white/16 bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="smx-kicker text-white/70">Operator playbook</p>
              <p className="mt-2 text-sm text-white/72">{health.description}</p>
              <ol className="mt-4 grid gap-2 text-sm text-[#f6f8ff]">
                <li className="rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2">1. Confirm queue and worker status.</li>
                <li className="rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2">2. Prioritize failed jobs from the last 24h.</li>
                <li className="rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2">3. Route users to a stable workflow if needed.</li>
              </ol>

              <Link href="/tools/stem-isolation" className="smx-button-primary mt-4 inline-flex px-4 py-2 text-[11px]">
                Open Studio
                <ArrowUpRightIcon className="size-3.5" />
              </Link>
            </aside>
          </div>
        </section>

        <section className="smx-frame p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="smx-kicker">System posture</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">What is happening right now.</h2>
            </div>
            <button
              type="button"
              onClick={() => void fetchSummary(true)}
              className="smx-button-secondary px-3 py-2 text-[11px]"
            >
              <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing" : "Refresh now"}
            </button>
          </div>

          {error ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive">{error}</p> : null}
          {summary.degraded ? (
            <p className="state-warning mt-3 text-xs font-semibold uppercase tracking-[0.08em]">{summary.degraded.message}</p>
          ) : null}

          <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="smx-subframe p-4">
              <dt className="smx-kicker inline-flex items-center gap-2">
                <UsersIcon className="size-3.5" />
                Total sessions
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">{summary.totalSessions}</dd>
              <p className="mt-2 text-xs text-muted-foreground">Active product usage footprint.</p>
            </div>

            <div className="smx-subframe p-4">
              <dt className="smx-kicker inline-flex items-center gap-2">
                <Layers3Icon className="size-3.5" />
                Active jobs
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">{summary.activeJobs}</dd>
              <p className="mt-2 text-xs text-muted-foreground">Jobs currently being processed.</p>
            </div>

            <div className="smx-subframe p-4">
              <dt className="smx-kicker inline-flex items-center gap-2">
                <FlameIcon className="size-3.5" />
                Failed jobs (24h)
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">{summary.failedJobsLast24h}</dd>
              <p className="mt-2 text-xs text-muted-foreground">Failure load that requires triage.</p>
            </div>

            <div className="smx-subframe p-4">
              <dt className="smx-kicker inline-flex items-center gap-2">
                <Clock3Icon className="size-3.5" />
                Queue depth
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">{summary.queueDepth}</dd>
              <p className="mt-2 text-xs text-muted-foreground">Backlog waiting for workers.</p>
            </div>
          </dl>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="smx-subframe p-4">
            <p className="smx-kicker">Intervention guide</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Next best operator move</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.failedJobsLast24h > 0
                ? "Investigate failed runs first, then re-queue affected assets."
                : summary.queueDepth > 0
                  ? "Monitor queue latency and confirm worker throughput."
                  : "System is stable. Keep sampling telemetry while usage rises."}
            </p>
          </article>

          <article className="smx-subframe p-4">
            <p className="smx-kicker">Decision thresholds</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Signal interpretation</h3>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <p className="inline-flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>Queue depth</span>
                <span className="font-semibold text-foreground">{summary.queueDepth > 20 ? "High pressure" : "Within range"}</span>
              </p>
              <p className="inline-flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>Failed jobs (24h)</span>
                <span className="font-semibold text-foreground">{summary.failedJobsLast24h > 0 ? "Requires review" : "No active failures"}</span>
              </p>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
