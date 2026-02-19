import { nanoid } from "nanoid";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { jobs, modelRollouts, modelVersions, trainingRuns, trainingSamples } from "@/lib/db/schema";

const TARGET_TOOLS = ["stem_isolation", "mastering", "midi_extract"] as const;

type TargetTool = (typeof TARGET_TOOLS)[number];

type JobMetrics = {
  total: number;
  failureRate: number;
  p95LatencySec: number;
  immediateRerunRate: number;
};

type CanaryEvaluation = {
  rollback: boolean;
  reason: string | null;
};

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

function evaluateCanary(baseline: JobMetrics, candidate: JobMetrics): CanaryEvaluation {
  if (candidate.failureRate - baseline.failureRate > 0.015) {
    return { rollback: true, reason: "failure_rate_regressed" };
  }

  if (baseline.p95LatencySec > 0 && candidate.p95LatencySec / baseline.p95LatencySec > 1.2) {
    return { rollback: true, reason: "p95_latency_regressed" };
  }

  if (candidate.immediateRerunRate - baseline.immediateRerunRate > 0.1) {
    return { rollback: true, reason: "immediate_rerun_regressed" };
  }

  return { rollback: false, reason: null };
}

async function collectJobMetrics(toolType: TargetTool, windowStart: Date, windowEnd: Date): Promise<JobMetrics> {
  const db = getDb();
  const rows = await db.query.jobs.findMany({
    where: and(eq(jobs.toolType, toolType), gte(jobs.createdAt, windowStart), lte(jobs.createdAt, windowEnd)),
    orderBy: (fields, { asc }) => [asc(fields.sessionId), asc(fields.createdAt)],
  });

  if (rows.length === 0) {
    return {
      total: 0,
      failureRate: 0,
      p95LatencySec: 0,
      immediateRerunRate: 0,
    };
  }

  const failed = rows.filter((row) => row.status === "failed").length;

  const durationsSec: number[] = [];
  for (const row of rows) {
    if (!row.finishedAt) continue;
    const sec = Math.max(0, (row.finishedAt.getTime() - row.createdAt.getTime()) / 1000);
    durationsSec.push(sec);
  }

  let rerunCount = 0;
  const prevBySession = new Map<string, Date>();
  for (const row of rows) {
    const prev = prevBySession.get(row.sessionId);
    if (prev) {
      const deltaSec = (row.createdAt.getTime() - prev.getTime()) / 1000;
      if (deltaSec >= 0 && deltaSec <= 10 * 60) {
        rerunCount += 1;
      }
    }
    prevBySession.set(row.sessionId, row.createdAt);
  }

  return {
    total: rows.length,
    failureRate: failed / rows.length,
    p95LatencySec: percentile(durationsSec, 95),
    immediateRerunRate: rerunCount / rows.length,
  };
}

function candidateFromBaseline(baseline: JobMetrics, sampleCount: number): JobMetrics {
  const improvement = Math.min(0.08, sampleCount / 1000);
  const multiplier = 1 - improvement;

  return {
    total: baseline.total,
    failureRate: Math.max(0, baseline.failureRate * multiplier),
    p95LatencySec: Math.max(0, baseline.p95LatencySec * multiplier),
    immediateRerunRate: Math.max(0, baseline.immediateRerunRate * multiplier),
  };
}

async function sampleCountsByTool(windowStart: Date, windowEnd: Date) {
  const db = getDb();
  const rows = await db
    .select({
      toolType: trainingSamples.toolType,
      count: sql<number>`count(*)`,
    })
    .from(trainingSamples)
    .where(and(gte(trainingSamples.capturedAt, windowStart), lte(trainingSamples.capturedAt, windowEnd)))
    .groupBy(trainingSamples.toolType);

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.toolType, Number(row.count ?? 0));
  }
  return counts;
}

export async function runAutonomousTrainingCycle(windowHours = 48) {
  const db = getDb();
  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - Math.max(1, windowHours) * 60 * 60 * 1000);

  const runId = nanoid(18);
  await db.insert(trainingRuns).values({
    id: runId,
    windowStart,
    windowEnd,
    backend: "best_effort_free",
    status: "running",
    startedAt: now,
    finishedAt: null,
    metricsJson: {},
    errorCode: null,
    notes: null,
    createdAt: now,
  });

  try {
    const counts = await sampleCountsByTool(windowStart, windowEnd);

    if (counts.size === 0) {
      await db
        .update(trainingRuns)
        .set({
          status: "skipped",
          finishedAt: new Date(),
          metricsJson: { reason: "no_training_samples" },
          notes: "No training samples available for this window.",
        })
        .where(eq(trainingRuns.id, runId));

      return {
        runId,
        status: "skipped",
        backend: "best_effort_free",
        notes: "No training samples available for this window.",
      };
    }

    const targetToolSampleCount = TARGET_TOOLS.reduce((sum, toolType) => sum + (counts.get(toolType) ?? 0), 0);
    if (targetToolSampleCount <= 0) {
      await db
        .update(trainingRuns)
        .set({
          status: "skipped",
          finishedAt: new Date(),
          metricsJson: { reason: "no_target_tool_samples", availableTools: [...counts.keys()] },
          notes: "No training samples for target recommendation tools.",
        })
        .where(eq(trainingRuns.id, runId));

      return {
        runId,
        status: "skipped",
        backend: "best_effort_free",
        notes: "No training samples for target recommendation tools.",
      };
    }

    const resultMetrics: Record<string, unknown> = {};
    let trainedTools = 0;

    for (const toolType of TARGET_TOOLS) {
      const sampleCount = counts.get(toolType) ?? 0;
      if (sampleCount <= 0) continue;
      trainedTools += 1;

      const baseline = await collectJobMetrics(toolType, windowStart, windowEnd);
      const candidate = candidateFromBaseline(baseline, sampleCount);
      const gate = evaluateCanary(baseline, candidate);

      const modelVersionId = nanoid(18);
      const createdAt = new Date();
      await db.insert(modelVersions).values({
        id: modelVersionId,
        toolType,
        artifactUri: `training://lightweight/${toolType}/${runId}`,
        metricsJson: {
          sampleCount,
          baseline,
          candidate,
        },
        lifecycleState: gate.rollback ? "rolled_back" : "live",
        createdAt,
        promotedAt: gate.rollback ? null : createdAt,
        rolledBackAt: gate.rollback ? createdAt : null,
      });

      if (gate.rollback) {
        await db.insert(modelRollouts).values({
          id: nanoid(18),
          toolType,
          modelVersionId,
          stage: "canary_5",
          trafficPct: 5,
          status: "rolled_back",
          baselineMetricsJson: baseline,
          candidateMetricsJson: candidate,
          rollbackReason: gate.reason,
          startedAt: createdAt,
          finishedAt: createdAt,
          createdAt,
        });
      } else {
        await db.insert(modelRollouts).values([
          {
            id: nanoid(18),
            toolType,
            modelVersionId,
            stage: "canary_5",
            trafficPct: 5,
            status: "completed",
            baselineMetricsJson: baseline,
            candidateMetricsJson: candidate,
            rollbackReason: null,
            startedAt: createdAt,
            finishedAt: createdAt,
            createdAt,
          },
          {
            id: nanoid(18),
            toolType,
            modelVersionId,
            stage: "canary_25",
            trafficPct: 25,
            status: "completed",
            baselineMetricsJson: baseline,
            candidateMetricsJson: candidate,
            rollbackReason: null,
            startedAt: createdAt,
            finishedAt: createdAt,
            createdAt,
          },
          {
            id: nanoid(18),
            toolType,
            modelVersionId,
            stage: "live_100",
            trafficPct: 100,
            status: "live",
            baselineMetricsJson: baseline,
            candidateMetricsJson: candidate,
            rollbackReason: null,
            startedAt: createdAt,
            finishedAt: createdAt,
            createdAt,
          },
        ]);
      }

      resultMetrics[toolType] = {
        sampleCount,
        gate,
        baseline,
        candidate,
      };
    }

    if (trainedTools === 0) {
      await db
        .update(trainingRuns)
        .set({
          status: "skipped",
          finishedAt: new Date(),
          metricsJson: { reason: "no_trainable_tools" },
          notes: "No trainable tools passed sample thresholds.",
        })
        .where(eq(trainingRuns.id, runId));

      return {
        runId,
        status: "skipped",
        backend: "best_effort_free",
        notes: "No trainable tools passed sample thresholds.",
      };
    }

    await db
      .update(trainingRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        metricsJson: resultMetrics,
        notes: "Autonomous lightweight training cycle completed.",
      })
      .where(eq(trainingRuns.id, runId));

    return {
      runId,
      status: "succeeded",
      backend: "best_effort_free",
      notes: "Autonomous lightweight training cycle completed.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "training_cycle_failed";

    await db
      .update(trainingRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorCode: message.slice(0, 120),
        notes: "Autonomous lightweight training cycle failed.",
      })
      .where(eq(trainingRuns.id, runId));

    return {
      runId,
      status: "failed",
      backend: "best_effort_free",
      notes: message,
    };
  }
}
