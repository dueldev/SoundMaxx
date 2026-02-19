import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { recoverStaleJobs } from "@/lib/jobs/recovery";

export const runtime = "nodejs";

function hasCronAccess(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return true;
  }

  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!hasCronAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const summary = await recoverStaleJobs();
  return NextResponse.json({
    ok: true,
    ...summary,
  });
}
