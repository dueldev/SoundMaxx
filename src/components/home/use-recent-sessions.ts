"use client";

import { useEffect, useState } from "react";
import type { RecentSessionItem, RecentSessionsResponse } from "@/types/api";

type RecentSessionsState = {
  loading: boolean;
  sessions: RecentSessionItem[];
  degradedMessage: string | null;
};

const INITIAL_STATE: RecentSessionsState = {
  loading: true,
  sessions: [],
  degradedMessage: null,
};

export function useRecentSessions(limit = 8): RecentSessionsState {
  const [state, setState] = useState<RecentSessionsState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/sessions/recent?limit=${limit}`);
        const payload = (await response.json()) as RecentSessionsResponse;

        if (!active) return;

        if (!response.ok) {
          setState({
            loading: false,
            sessions: [],
            degradedMessage: "Recent session history is unavailable right now.",
          });
          return;
        }

        setState({
          loading: false,
          sessions: payload.sessions,
          degradedMessage: payload.degraded?.message ?? null,
        });
      } catch {
        if (!active) return;
        setState({
          loading: false,
          sessions: [],
          degradedMessage: "Recent session history is unavailable right now.",
        });
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [limit]);

  return state;
}
