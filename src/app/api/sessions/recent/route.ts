import { NextRequest, NextResponse } from "next/server";
import { privateSWRHeaders } from "@/lib/http";
import { getToolConfigByType } from "@/lib/tool-config";
import { resolveRequestContext, withSessionCookie, type RequestContext } from "@/lib/request-context";
import { store } from "@/lib/store";
import type { RecentSessionsResponse } from "@/types/api";

export const runtime = "nodejs";

function parseLimit(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : 8;
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(1, Math.min(parsed, 20));
}

function degradedPayload(message: string): RecentSessionsResponse {
  return {
    sessions: [],
    degraded: {
      reason: "storage_unavailable",
      message,
    },
  };
}

function isMissingDatabaseConfig(error: unknown) {
  return error instanceof Error && /DATABASE_URL is not configured/i.test(error.message);
}

function logRecentSessionsFailure(context: string, error: unknown) {
  if (isMissingDatabaseConfig(error)) {
    return;
  }
  console.error(context, error);
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request);
  let context: RequestContext;

  try {
    const resolved = await resolveRequestContext(request);
    if (resolved instanceof NextResponse) {
      return resolved;
    }
    context = resolved;
  } catch (error) {
    logRecentSessionsFailure("Unable to resolve session for recent runs", error);
    return NextResponse.json<RecentSessionsResponse>(
      degradedPayload("Recent sessions are temporarily unavailable."),
      { headers: privateSWRHeaders() },
    );
  }

  try {
    const runs = await store.listRecentSessionRuns(context.sessionId, limit);
    const sessions = runs.map((run) => ({
      jobId: run.jobId,
      toolType: run.toolType,
      toolLabel: getToolConfigByType(run.toolType)?.label ?? run.toolType,
      status: run.status,
      createdAt: run.createdAt,
      artifactCount: run.artifactCount,
      expiresAt: run.expiresAt,
    }));

    const response = NextResponse.json<RecentSessionsResponse>(
      {
        sessions,
      },
      { headers: privateSWRHeaders() },
    );

    return withSessionCookie(response, context);
  } catch (error) {
    logRecentSessionsFailure("Unable to load recent sessions", error);
    const response = NextResponse.json<RecentSessionsResponse>(
      degradedPayload("Recent sessions are temporarily unavailable."),
      { headers: privateSWRHeaders() },
    );

    return withSessionCookie(response, context);
  }
}
