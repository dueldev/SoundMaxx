"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IconArrowRight, IconClockHour4 } from "@tabler/icons-react";
import { JobStatusIcon, ToolTypeIcon } from "@/components/ui/semantic-icons";
import { useRecentSessions } from "@/components/home/use-recent-sessions";
import { getToolConfigByType } from "@/lib/tool-config";
import type { RecentSessionItem } from "@/types/api";

function statusLabel(status: RecentSessionItem["status"]) {
  return status.replace(/_/g, " ").replace(/^./, (value) => value.toUpperCase());
}

function relativeTime(iso: string) {
  const now = Date.now();
  const target = Date.parse(iso);
  const diffMs = target - now;

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMs) < hour) {
    return rtf.format(Math.round(diffMs / minute), "minute");
  }

  if (Math.abs(diffMs) < day) {
    return rtf.format(Math.round(diffMs / hour), "hour");
  }

  return rtf.format(Math.round(diffMs / day), "day");
}

export function RecentSessionsPanel() {
  const { loading, sessions, degradedMessage } = useRecentSessions(8);
  const hasSessions = useMemo(() => sessions.length > 0, [sessions]);

  return (
    <section className="studio-panel signal-spine-x animate-rise rounded-md p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Recent Sessions</h2>
        <span className="metric-chip">
          <IconClockHour4 size={12} />
          Timeline
        </span>
      </div>

      {loading ? <p className="text-muted mt-3 text-xs uppercase tracking-[0.06em]">Loading recent sessions...</p> : null}
      {!loading && degradedMessage ? <p className="state-warning mt-3 text-xs uppercase tracking-[0.04em]">{degradedMessage}</p> : null}

      {!loading && !hasSessions ? (
        <div className="feature-card signal-spine-y mt-4 rounded-md p-4">
          <p className="display-title text-[1.2rem]">No recent sessions yet</p>
          <p className="text-muted mt-1 text-xs">Start with a tool and your runs will appear here with status and artifact history.</p>
          <div className="action-rail mt-4">
            <Link href="/tools/stem-isolation" className="button-primary rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em]">
              Start a Session
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && hasSessions ? (
        <div className="mt-4 grid gap-2">
          {sessions.map((session) => {
            const tool = getToolConfigByType(session.toolType);
            return (
              <article key={session.jobId} className="feature-card signal-spine-y hover-lift rounded-sm p-3">
                <div className="grid gap-3 md:grid-cols-[1.25fr_1fr_auto] md:items-center">
                  <div className="flex items-center gap-3">
                    <span className="icon-pill h-8 w-8">
                      <ToolTypeIcon toolType={session.toolType} size={14} />
                    </span>
                    <div>
                      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em]">{session.toolLabel}</p>
                      <p className="text-muted text-[0.7rem]">{new Date(session.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="metric-chip inline-flex items-center gap-1">
                      <JobStatusIcon status={session.status} size={12} />
                      {statusLabel(session.status)}
                    </span>
                    <span className="metric-chip">{relativeTime(session.createdAt)}</span>
                    <span className="metric-chip">Artifacts {session.artifactCount}</span>
                  </div>

                  <div className="justify-self-start md:justify-self-end">
                    <Link href={tool?.href ?? "/tools/stem-isolation"} className="button-secondary rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em]">
                      Open Tool
                      <IconArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
