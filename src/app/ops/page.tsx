"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpsSummary } from "@/types/domain";

const EMPTY_SUMMARY: OpsSummary = {
  totalSessions: 0,
  activeJobs: 0,
  failedJobsLast24h: 0,
  queueDepth: 0,
};

type HealthState = {
  label: string;
  tagClass: string;
};

function deriveHealth(summary: OpsSummary, error: string | null, loading: boolean): HealthState {
  if (loading) return { label: "SYNCING", tagClass: "tag" };
  if (error || summary.degraded) return { label: "DEGRADED", tagClass: "tag tag-error" };
  if (summary.activeJobs > 0 || summary.queueDepth > 0) return { label: "PROCESSING", tagClass: "tag tag-warn" };
  return { label: "HEALTHY", tagClass: "tag tag-ok" };
}

export default function OpsPage() {
  const [summary, setSummary] = useState<OpsSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(
    () => (typeof document === "undefined" ? true : document.visibilityState === "visible"),
  );
  const requestInFlightRef = useRef(false);

  const fetchSummary = useCallback(async (options: { manual?: boolean; signal?: AbortSignal } = {}) => {
    const { manual = false, signal } = options;
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/ops/summary", { signal });
      const payload = (await response.json()) as OpsSummary | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to load summary");
      }
      setSummary(payload as OpsSummary);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load summary");
      setSummary(EMPTY_SUMMARY);
      setUpdatedAt(new Date().toISOString());
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isPageVisible) return;

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
      await fetchSummary({ signal: pollAbort.signal });
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
  }, [fetchSummary, isPageVisible]);

  const health = useMemo(() => deriveHealth(summary, error, loading), [summary, error, loading]);

  const playbook = summary.failedJobsLast24h > 0
    ? [
        "> investigate failed runs in the last 24h",
        "> re-queue affected assets once root cause is clear",
        "> monitor failure rate after re-queue",
      ]
    : summary.queueDepth > 0
      ? [
          "> monitor queue latency against the <12s target",
          "> confirm worker throughput is keeping up",
          "> alert if depth exceeds 20 without draining",
        ]
      : [
          "> system is stable — no immediate action required",
          "> keep sampling telemetry as usage scales",
          "> review failed jobs trend weekly",
        ];

  return (
    <div className="pb-20">
      <div className="accent-bar" />

      <div className="smx-shell">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <section className="animate-rise pt-10 pb-8">
          <p
            className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            SoundMaxx · Operations Dashboard
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
                onClick={() => void fetchSummary({ manual: true })}
                className="brutal-button-ghost px-3 py-2 text-xs"
              >
                <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--destructive)" }}>
              ⚠ {error}
            </p>
          ) : null}
          {summary.degraded ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-wide" style={{ color: "var(--destructive)" }}>
              ⚠ {summary.degraded.message}
            </p>
          ) : null}
        </section>

        <hr className="section-rule" />

        {/* ── Metrics columns ──────────────────────────────────────────── */}
        <section className="py-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              {
                label: "Total Sessions",
                value: summary.totalSessions,
                note: "Active usage footprint",
                alert: false,
              },
              {
                label: "Active Jobs",
                value: summary.activeJobs,
                note: "Currently processing",
                alert: false,
              },
              {
                label: "Failed (24h)",
                value: summary.failedJobsLast24h,
                note: "Requires triage if > 0",
                alert: summary.failedJobsLast24h > 0,
              },
              {
                label: "Queue Depth",
                value: summary.queueDepth,
                note: "Backlog waiting for workers",
                alert: summary.queueDepth > 20,
              },
            ].map(({ label, value, note, alert }) => (
              <div
                key={label}
                className="border-l-2 pl-4"
                style={{ borderColor: alert ? "var(--destructive)" : "var(--foreground)" }}
              >
                <p
                  className="font-mono text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {label}
                </p>
                <p
                  className="mt-2 font-mono text-4xl font-bold leading-none md:text-5xl"
                  style={alert ? { color: "var(--destructive)" } : undefined}
                >
                  {value}
                </p>
                <p
                  className="mt-1.5 font-mono text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Playbook + Thresholds ─────────────────────────────────────── */}
        <section className="mt-10 grid gap-5 md:grid-cols-2">

          {/* Playbook */}
          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Operator Playbook
            </p>
            <h2 className="mt-2 text-xl font-bold">Next best action</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {playbook.map((line) => (
                <li
                  key={line}
                  className="font-mono text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {line}
                </li>
              ))}
            </ul>
            <Link
              href="/tools/stem-isolation"
              className="brutal-button-primary mt-6 inline-flex text-xs"
            >
              Open Studio
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </article>

          {/* Threshold table */}
          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Decision Thresholds
            </p>
            <h2 className="mt-2 text-xl font-bold">Signal interpretation</h2>

            <table className="mt-5 w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--foreground)" }}>
                  <th
                    className="pb-2 text-left font-mono text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Signal
                  </th>
                  <th
                    className="pb-2 text-right font-mono text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    signal: "Queue depth",
                    status: summary.queueDepth > 20 ? "HIGH PRESSURE" : "WITHIN RANGE",
                    ok: summary.queueDepth <= 20,
                  },
                  {
                    signal: "Failed jobs (24h)",
                    status: summary.failedJobsLast24h > 0 ? "REQUIRES REVIEW" : "NO FAILURES",
                    ok: summary.failedJobsLast24h === 0,
                  },
                  {
                    signal: "Active jobs",
                    status: summary.activeJobs > 0 ? "PROCESSING" : "IDLE",
                    ok: true,
                  },
                ].map(({ signal, status, ok }) => (
                  <tr
                    key={signal}
                    style={{ borderBottom: "1px solid var(--muted)" }}
                  >
                    <td className="py-3 font-mono text-sm">{signal}</td>
                    <td
                      className="py-3 text-right font-mono text-xs font-bold tracking-wider"
                      style={{ color: ok ? "var(--foreground)" : "var(--destructive)" }}
                    >
                      {status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

      </div>
    </div>
  );
}
