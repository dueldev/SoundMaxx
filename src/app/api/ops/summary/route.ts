import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { queueDepth } from "@/lib/redis";
import { store } from "@/lib/store";
import type { OpsSummary } from "@/types/domain";

export const runtime = "nodejs";

function hasAccess(request: NextRequest) {
  if (!env.OPS_SECRET) return true;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.OPS_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!hasAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const [summary, queue] = await Promise.all([
    store.getOpsSummary(new Date().toISOString()),
    queueDepth(),
  ]);

  const payload: OpsSummary = {
    ...summary,
    queueDepth: queue,
  };

  return NextResponse.json(payload);
}
