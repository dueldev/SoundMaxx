"use client";

import { useEffect, useState } from "react";
import type { OpsSummary } from "@/types/domain";

export default function OpsPage() {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/ops/summary", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to load summary");
        }

        const payload = (await response.json()) as OpsSummary;
        if (mounted) {
          setSummary(payload);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load summary");
        }
      }
    };

    fetchSummary();
    const timer = setInterval(fetchSummary, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-[#132f44]">SoundMaxx Ops</h1>
      <p className="mt-1 text-sm text-[#45627a]">Queue and failure telemetry for the worker pipeline.</p>

      <div className="mt-6 rounded-3xl border border-[#c7dff0] bg-white/90 p-6 shadow-[0_20px_70px_-50px_rgba(14,55,88,0.9)]">
        {error ? <p className="text-rose-700">{error}</p> : null}
        {!summary && !error ? <p className="text-[#45627a]">Loading...</p> : null}
        {summary ? (
          <dl className="grid gap-3 text-sm text-[#264a62] md:grid-cols-2">
            <div className="rounded-2xl border border-[#d0e4f2] bg-[#f8fcff] p-4">
              <dt>Total sessions</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#132f44]">{summary.totalSessions}</dd>
            </div>
            <div className="rounded-2xl border border-[#d0e4f2] bg-[#f8fcff] p-4">
              <dt>Active jobs</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#132f44]">{summary.activeJobs}</dd>
            </div>
            <div className="rounded-2xl border border-[#d0e4f2] bg-[#f8fcff] p-4">
              <dt>Failed jobs (24h)</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#132f44]">{summary.failedJobsLast24h}</dd>
            </div>
            <div className="rounded-2xl border border-[#d0e4f2] bg-[#f8fcff] p-4">
              <dt>Queue depth</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#132f44]">{summary.queueDepth}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </main>
  );
}
