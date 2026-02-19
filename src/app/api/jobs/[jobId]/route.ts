import { NextRequest, NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { recoverStaleJob } from "@/lib/jobs/recovery";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { store } from "@/lib/store";
import type { JobStatusResponse } from "@/types/api";

export const runtime = "nodejs";

function callbackBase(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return undefined;
  return `${proto}://${host}`;
}

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

  const { job: resolvedJob } = await recoverStaleJob(job, {
    callbackBaseUrl: callbackBase(request),
  });
  const artifacts = await store.listArtifactsForJob(resolvedJob.id);
  const response = NextResponse.json<JobStatusResponse>(
    {
      jobId: resolvedJob.id,
      status: resolvedJob.status,
      progressPct: resolvedJob.progressPct,
      etaSec: resolvedJob.etaSec,
      recoveryState: resolvedJob.recoveryState,
      attemptCount: resolvedJob.attemptCount,
      qualityFlags: resolvedJob.qualityFlags,
      ...(resolvedJob.errorCode ? { error: resolvedJob.errorCode } : {}),
      artifactIds: artifacts.map((artifact) => artifact.id),
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
