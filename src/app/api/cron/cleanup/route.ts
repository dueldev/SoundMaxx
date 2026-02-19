import { NextRequest, NextResponse } from "next/server";
import { deleteBlob } from "@/lib/blob";
import { env } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { store } from "@/lib/store";
import type { CleanupSummary } from "@/types/api";

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

  const expired = await store.listExpiredResources(new Date().toISOString());

  for (const artifact of expired.artifacts) {
    await deleteBlob(artifact.blobKey).catch(() => undefined);
    await store.deleteArtifact(artifact.id);
  }

  for (const asset of expired.assets) {
    await deleteBlob(asset.blobKey).catch(() => undefined);
    await store.deleteAsset(asset.id);
  }

  for (const staleJob of expired.jobsToExpire) {
    await store.updateJob({
      jobId: staleJob.id,
      status: "expired",
      progressPct: staleJob.progressPct,
      etaSec: 0,
      recoveryState: staleJob.recoveryState === "retrying" ? "failed_after_retry" : staleJob.recoveryState,
      finishedAt: new Date().toISOString(),
      errorCode: staleJob.errorCode ?? "job_timed_out",
    });
  }

  return NextResponse.json<CleanupSummary>({
    removedAssets: expired.assets.length,
    removedArtifacts: expired.artifacts.length,
    expiredJobs: expired.jobsToExpire.length,
  });
}
