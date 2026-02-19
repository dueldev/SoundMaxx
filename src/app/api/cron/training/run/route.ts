import { NextRequest, NextResponse } from "next/server";
import { featureFlags } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { hasTrainingCronAccess } from "@/lib/ops-access";
import { runAutonomousTrainingCycle } from "@/lib/training/orchestrator";
import type { TrainingRunTriggerResponse } from "@/types/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrainingCronAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  if (!featureFlags.autonomousTraining) {
    return NextResponse.json<TrainingRunTriggerResponse>(
      {
        runId: "disabled",
        status: "skipped",
        backend: "best_effort_free",
        notes: "FEATURE_AUTONOMOUS_TRAINING is disabled.",
      },
      { status: 202 },
    );
  }

  const result = await runAutonomousTrainingCycle(48);

  return NextResponse.json<TrainingRunTriggerResponse>(
    {
      runId: result.runId,
      status: result.status,
      backend: result.backend,
      notes: result.notes,
    },
    {
      status: result.status === "failed" ? 500 : 200,
    },
  );
}
