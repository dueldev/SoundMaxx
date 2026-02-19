import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { modelRollouts, trainingRuns } from "@/lib/db/schema";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { hasOpsApiAccess } from "@/lib/ops-access";
import type { OpsTrainingSummaryResponse } from "@/types/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasOpsApiAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  try {
    const db = getDb();
    const [latestRuns, latestRollouts] = await Promise.all([
      db.query.trainingRuns.findMany({
        orderBy: [desc(trainingRuns.startedAt)],
        limit: 12,
      }),
      db.query.modelRollouts.findMany({
        orderBy: [desc(modelRollouts.startedAt)],
        limit: 20,
      }),
    ]);

    const response: OpsTrainingSummaryResponse = {
      latestRuns: latestRuns.map((run) => ({
        id: run.id,
        status: run.status,
        backend: run.backend,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      latestRollouts: latestRollouts.map((rollout) => ({
        id: rollout.id,
        toolType: rollout.toolType,
        stage: rollout.stage,
        trafficPct: rollout.trafficPct,
        status: rollout.status,
        rollbackReason: rollout.rollbackReason,
      })),
    };

    return NextResponse.json(response, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Unable to load training ops summary", error);
    return NextResponse.json<OpsTrainingSummaryResponse>(
      {
        latestRuns: [],
        latestRollouts: [],
      },
      { headers: noStoreHeaders() },
    );
  }
}
