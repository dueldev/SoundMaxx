import { NextRequest, NextResponse } from "next/server";
import { desc, gte } from "drizzle-orm";
import { env, featureFlags, trainingConfig } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { analyticsDailyAggregates } from "@/lib/db/schema";
import { jsonError, noStoreHeaders } from "@/lib/http";
import type { AnalyticsAggregateExportResponse } from "@/types/api";

export const runtime = "nodejs";

function hasExportAccess(request: NextRequest) {
  const key = env.ANALYTICS_EXPORT_API_KEY;
  if (!key) return false;

  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${key}`;
}

export async function GET(request: NextRequest) {
  if (!featureFlags.analyticsExport) {
    return jsonError(404, "Not found");
  }

  if (!hasExportAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const minCohort = trainingConfig.minCohortSize;

  const rows = await getDb().query.analyticsDailyAggregates.findMany({
    where: gte(analyticsDailyAggregates.eventsCount, minCohort),
    orderBy: [desc(analyticsDailyAggregates.dayUtc)],
    limit: 1000,
  });

  const payload: AnalyticsAggregateExportResponse = {
    rows: rows.map((row) => ({
      dayUtc: row.dayUtc,
      metricKey: row.metricKey,
      dimension: row.dimension,
      dimensionValue: row.dimensionValue,
      eventsCount: row.eventsCount,
      valueNum: row.valueNum,
      payload: row.payloadJson as Record<string, unknown>,
    })),
  };

  return NextResponse.json(payload, { headers: noStoreHeaders() });
}
