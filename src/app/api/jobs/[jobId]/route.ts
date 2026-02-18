import { NextRequest, NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { store } from "@/lib/store";
import type { JobStatusResponse } from "@/types/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const reqContext = await resolveRequestContext(request);
  if (reqContext instanceof NextResponse) {
    return reqContext;
  }

  const { jobId } = await context.params;

  const job = await store.getSessionJob(jobId, reqContext.sessionId);
  if (!job) {
    return jsonError(404, "Job not found");
  }

  const artifacts = await store.listArtifactsForJob(job.id);
  const response = NextResponse.json<JobStatusResponse>(
    {
      jobId: job.id,
      status: job.status,
      progressPct: job.progressPct,
      etaSec: job.etaSec,
      ...(job.errorCode ? { error: job.errorCode } : {}),
      artifactIds: artifacts.map((artifact) => artifact.id),
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
