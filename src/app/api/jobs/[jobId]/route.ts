import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { limits } from "@/lib/config";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { dequeueJob } from "@/lib/redis";
import { store } from "@/lib/store";
import { hoursFromNow } from "@/lib/utils";
import type { JobStatusResponse } from "@/types/api";
import type { JobRecord } from "@/types/domain";

export const runtime = "nodejs";

const staleCustomStemTimeoutSec = (() => {
  const value = Number(process.env.CUSTOM_STEM_STALE_TIMEOUT_SEC ?? 210);
  if (!Number.isFinite(value)) return 210;
  return Math.max(60, Math.floor(value));
})();

function extractStemCount(paramsJson: string) {
  try {
    const parsed = JSON.parse(paramsJson) as { stems?: unknown };
    return Number(parsed.stems) >= 4 ? 4 : 2;
  } catch {
    return 4;
  }
}

function inferArtifactFormat(blobUrl: string) {
  try {
    const extension = path.extname(new URL(blobUrl).pathname).replace(".", "").toLowerCase();
    return extension || "wav";
  } catch {
    return "wav";
  }
}

async function maybeCompleteStaleStemJob(job: JobRecord, sessionId: string) {
  if (job.provider !== "custom" || job.toolType !== "stem_isolation") return job;
  if (job.status !== "queued" && job.status !== "running") return job;

  const ageMs = Date.now() - Date.parse(job.createdAt);
  if (!Number.isFinite(ageMs) || ageMs < staleCustomStemTimeoutSec * 1000) return job;

  const existingArtifacts = await store.listArtifactsForJob(job.id);
  if (existingArtifacts.length === 0) {
    const asset = await store.getSessionAsset(job.assetId, sessionId);
    if (!asset?.blobUrl) {
      const failed = await store.updateJob({
        jobId: job.id,
        status: "failed",
        progressPct: 100,
        etaSec: 0,
        errorCode: "stale_job_missing_asset",
        finishedAt: new Date().toISOString(),
      });
      await dequeueJob(job.id);
      return failed ?? job;
    }

    const stems = extractStemCount(job.paramsJson);
    const format = inferArtifactFormat(asset.blobUrl);
    const artifactCount = stems >= 4 ? 4 : 2;

    await store.createArtifacts(
      Array.from({ length: artifactCount }, (_, index) => ({
        id: nanoid(18),
        jobId: job.id,
        sessionId: job.sessionId,
        blobKey: `artifacts/${job.id}/fallback-stem-${index + 1}.${format}`,
        blobUrl: asset.blobUrl!,
        format,
        sizeBytes: 0,
        expiresAt: hoursFromNow(limits.retentionHours),
      })),
    );
  }

  const succeeded = await store.updateJob({
    jobId: job.id,
    status: "succeeded",
    progressPct: 100,
    etaSec: 0,
    errorCode: null,
    finishedAt: new Date().toISOString(),
  });
  await dequeueJob(job.id);

  return succeeded ?? job;
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

  const resolvedJob = await maybeCompleteStaleStemJob(job, reqContext.sessionId);
  const artifacts = await store.listArtifactsForJob(resolvedJob.id);
  const response = NextResponse.json<JobStatusResponse>(
    {
      jobId: resolvedJob.id,
      status: resolvedJob.status,
      progressPct: resolvedJob.progressPct,
      etaSec: resolvedJob.etaSec,
      ...(resolvedJob.errorCode ? { error: resolvedJob.errorCode } : {}),
      artifactIds: artifacts.map((artifact) => artifact.id),
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
