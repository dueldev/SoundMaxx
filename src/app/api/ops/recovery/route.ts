import { NextRequest, NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { recoverStaleJobs } from "@/lib/jobs/recovery";
import { hasOpsApiAccess } from "@/lib/ops-access";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasOpsApiAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const summary = await recoverStaleJobs();
  return NextResponse.json(
    {
      ok: true,
      ...summary,
    },
    {
      headers: noStoreHeaders(),
    },
  );
}
