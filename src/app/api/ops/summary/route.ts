import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { queueDepth } from "@/lib/redis";
import { store } from "@/lib/store";
import type { OpsSummary } from "@/types/domain";

export const runtime = "nodejs";

function hasAccess(request: NextRequest) {
  if (!env.OPS_SECRET) return true;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.OPS_SECRET}`;
}

function isMissingDatabaseConfig(error: unknown) {
  return error instanceof Error && /DATABASE_URL is not configured/i.test(error.message);
}

export async function GET(request: NextRequest) {
  if (!hasAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  let summary: OpsSummary = {
    totalSessions: 0,
    activeJobs: 0,
    failedJobsLast24h: 0,
    queueDepth: 0,
  };

  const degradedReasons: string[] = [];

  try {
    summary = await store.getOpsSummary(new Date().toISOString());
  } catch (error) {
    if (!isMissingDatabaseConfig(error)) {
      console.error("Unable to load ops summary from store", error);
    }
    degradedReasons.push("store");
  }

  let queue = 0;
  try {
    queue = await queueDepth();
  } catch (error) {
    console.error("Unable to load queue depth", error);
    degradedReasons.push("queue");
  }

  const payload: OpsSummary = {
    ...summary,
    queueDepth: queue,
    ...(degradedReasons.length > 0
      ? {
          degraded: {
            reason: degradedReasons.join("_"),
            message: "Ops metrics are partially unavailable. Showing fallback values.",
          },
        }
      : {}),
  };

  return NextResponse.json(payload, { headers: noStoreHeaders() });
}
