import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { analyticsDailyAggregates, jobs } from "@/lib/db/schema";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import type { ToolType } from "@/types/domain";

export const runtime = "nodejs";

const qualityFeedbackSchema = z.object({
  usable: z.boolean(),
  reason: z.string().min(1).max(64),
  toolType: z.string().min(1).max(64),
});

function dayUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const reqContext = await resolveRequestContext(request);
  if (reqContext instanceof NextResponse) {
    return reqContext;
  }

  const { jobId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = qualityFeedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.flatten());
  }

  const db = getDb();
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.sessionId, reqContext.sessionId)),
  });
  if (!job) {
    return jsonError(404, "Job not found");
  }

  const now = new Date();
  const outcome = parsed.data.usable ? "usable" : "needs_rerun";
  const dimensionValue = `${parsed.data.toolType}:${outcome}`;

  await db
    .insert(analyticsDailyAggregates)
    .values({
      dayUtc: dayUtc(now),
      metricKey: "job_quality_feedback",
      dimension: "tool_outcome",
      dimensionValue,
      eventsCount: 1,
      valueNum: parsed.data.usable ? 1 : 0,
      payloadJson: {
        reason: parsed.data.reason,
        toolType: parsed.data.toolType as ToolType,
        usable: parsed.data.usable,
      },
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        analyticsDailyAggregates.dayUtc,
        analyticsDailyAggregates.metricKey,
        analyticsDailyAggregates.dimension,
        analyticsDailyAggregates.dimensionValue,
      ],
      set: {
        eventsCount: sql`${analyticsDailyAggregates.eventsCount} + 1`,
        valueNum: sql`coalesce(${analyticsDailyAggregates.valueNum}, 0) + ${parsed.data.usable ? 1 : 0}`,
        createdAt: now,
      },
    });

  const response = NextResponse.json(
    {
      ok: true,
      recordedAt: now.toISOString(),
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
