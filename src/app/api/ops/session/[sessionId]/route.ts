import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artifacts, assets, jobs, quotaUsage, sessions, trainingSamples } from "@/lib/db/schema";
import { sha256 } from "@/lib/hash";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { hasOpsApiAccess } from "@/lib/ops-access";
import type { OpsSessionDataResponse } from "@/types/api";

export const runtime = "nodejs";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

function parseLimit(request: NextRequest, key: string, defaultValue: number, maxValue: number) {
  const raw = request.nextUrl.searchParams.get(key);
  const parsed = raw ? Number.parseInt(raw, 10) : defaultValue;
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(1, Math.min(parsed, maxValue));
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  if (!hasOpsApiAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const { sessionId: rawSessionId } = await context.params;
  const sessionId = decodeURIComponent(rawSessionId).trim();

  if (!sessionId) {
    return jsonError(400, "Session ID is required");
  }

  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return jsonError(400, "Invalid session ID format");
  }

  const assetsLimit = parseLimit(request, "assets", 20, 200);
  const jobsLimit = parseLimit(request, "jobs", 40, 300);
  const artifactsLimit = parseLimit(request, "artifacts", 50, 500);
  const quotaLimit = parseLimit(request, "quota", 30, 180);
  const trainingLimit = parseLimit(request, "training", 50, 300);

  try {
    const db = getDb();

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return jsonError(404, "Session not found");
    }

    const sessionFingerprint = sha256(`session:${sessionId}`);

    const [
      assetStatsRows,
      jobStatsRows,
      artifactStatsRows,
      uploadStatsRows,
      trainingStatsRows,
      assetRows,
      jobRows,
      artifactRows,
      quotaRows,
      trainingRows,
    ] = await Promise.all([
    db
      .select({
        assetsCount: sql<number>`count(*)::int`,
        avgAssetDurationSec: sql<number | null>`avg(${assets.durationSec})`,
      })
      .from(assets)
      .where(eq(assets.sessionId, sessionId)),
    db
      .select({
        jobsCount: sql<number>`count(*)::int`,
        failedJobsCount: sql<number>`sum(case when ${jobs.status} = 'failed' then 1 else 0 end)::int`,
      })
      .from(jobs)
      .where(eq(jobs.sessionId, sessionId)),
    db
      .select({
        artifactsCount: sql<number>`count(*)::int`,
        outputBytesTotal: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
      })
      .from(artifacts)
      .where(eq(artifacts.sessionId, sessionId)),
    db
      .select({
        uploadedBytesTotal: sql<number>`coalesce(sum(${quotaUsage.bytesUploaded}), 0)::bigint`,
      })
      .from(quotaUsage)
      .where(eq(quotaUsage.sessionId, sessionId)),
    db
      .select({
        trainingSamplesLinked: sql<number>`count(*)::int`,
      })
      .from(trainingSamples)
      .where(eq(trainingSamples.sessionFingerprint, sessionFingerprint)),
    db
      .select({
        id: assets.id,
        blobKey: assets.blobKey,
        blobUrl: assets.blobUrl,
        durationSec: assets.durationSec,
        sampleRate: assets.sampleRate,
        channels: assets.channels,
        ageConfirmed: assets.ageConfirmed,
        rightsConfirmed: assets.rightsConfirmed,
        policyVersion: assets.policyVersion,
        trainingCaptureMode: assets.trainingCaptureMode,
        expiresAt: assets.expiresAt,
        createdAt: assets.createdAt,
        jobsCount: sql<number>`count(distinct ${jobs.id})::int`,
        artifactsCount: sql<number>`count(distinct ${artifacts.id})::int`,
      })
      .from(assets)
      .leftJoin(jobs, eq(jobs.assetId, assets.id))
      .leftJoin(artifacts, eq(artifacts.jobId, jobs.id))
      .where(eq(assets.sessionId, sessionId))
      .groupBy(
        assets.id,
        assets.blobKey,
        assets.blobUrl,
        assets.durationSec,
        assets.sampleRate,
        assets.channels,
        assets.ageConfirmed,
        assets.rightsConfirmed,
        assets.policyVersion,
        assets.trainingCaptureMode,
        assets.expiresAt,
        assets.createdAt,
      )
      .orderBy(desc(assets.createdAt))
      .limit(assetsLimit),
    db
      .select({
        id: jobs.id,
        assetId: jobs.assetId,
        toolType: jobs.toolType,
        provider: jobs.provider,
        model: jobs.model,
        status: jobs.status,
        progressPct: jobs.progressPct,
        etaSec: jobs.etaSec,
        errorCode: jobs.errorCode,
        externalJobId: jobs.externalJobId,
        createdAt: jobs.createdAt,
        finishedAt: jobs.finishedAt,
        artifactsCount: sql<number>`count(${artifacts.id})::int`,
        artifactsBytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)::bigint`,
      })
      .from(jobs)
      .leftJoin(artifacts, eq(artifacts.jobId, jobs.id))
      .where(eq(jobs.sessionId, sessionId))
      .groupBy(
        jobs.id,
        jobs.assetId,
        jobs.toolType,
        jobs.provider,
        jobs.model,
        jobs.status,
        jobs.progressPct,
        jobs.etaSec,
        jobs.errorCode,
        jobs.externalJobId,
        jobs.createdAt,
        jobs.finishedAt,
      )
      .orderBy(desc(jobs.createdAt))
      .limit(jobsLimit),
    db.query.artifacts.findMany({
      where: eq(artifacts.sessionId, sessionId),
      orderBy: [desc(artifacts.createdAt)],
      limit: artifactsLimit,
    }),
    db.query.quotaUsage.findMany({
      where: eq(quotaUsage.sessionId, sessionId),
      orderBy: [desc(quotaUsage.dayUtc)],
      limit: quotaLimit,
    }),
    db.query.trainingSamples.findMany({
      where: eq(trainingSamples.sessionFingerprint, sessionFingerprint),
      orderBy: [desc(trainingSamples.capturedAt)],
      limit: trainingLimit,
    }),
    ]);

    const assetStats = assetStatsRows[0];
    const jobStats = jobStatsRows[0];
    const artifactStats = artifactStatsRows[0];
    const uploadStats = uploadStatsRows[0];
    const trainingStats = trainingStatsRows[0];

    const response: OpsSessionDataResponse = {
      session: {
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        ipHash: session.ipHash,
        userAgentHash: session.userAgentHash,
        policyVersion: session.policyVersion,
        policySeenAt: session.policySeenAt?.toISOString() ?? null,
        adPersonalizationOptIn: session.adPersonalizationOptIn,
        doNotSellOrShare: session.doNotSellOrShare,
      },
      stats: {
        assetsCount: toNumber(assetStats?.assetsCount),
        jobsCount: toNumber(jobStats?.jobsCount),
        failedJobsCount: toNumber(jobStats?.failedJobsCount),
        artifactsCount: toNumber(artifactStats?.artifactsCount),
        uploadedBytesTotal: toNumber(uploadStats?.uploadedBytesTotal),
        outputBytesTotal: toNumber(artifactStats?.outputBytesTotal),
        avgAssetDurationSec: assetStats?.avgAssetDurationSec === null ? null : toNumber(assetStats?.avgAssetDurationSec),
        trainingSamplesLinked: toNumber(trainingStats?.trainingSamplesLinked),
      },
      assets: assetRows.map((row) => ({
        id: row.id,
        blobKey: row.blobKey,
        blobUrl: row.blobUrl,
        durationSec: row.durationSec,
        sampleRate: row.sampleRate,
        channels: row.channels,
        ageConfirmed: row.ageConfirmed,
        rightsConfirmed: row.rightsConfirmed,
        policyVersion: row.policyVersion,
        trainingCaptureMode: row.trainingCaptureMode,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        jobsCount: toNumber(row.jobsCount),
        artifactsCount: toNumber(row.artifactsCount),
      })),
      jobs: jobRows.map((row) => ({
        id: row.id,
        assetId: row.assetId,
        toolType: row.toolType,
        provider: row.provider,
        model: row.model,
        status: row.status,
        progressPct: row.progressPct,
        etaSec: row.etaSec,
        errorCode: row.errorCode,
        externalJobId: row.externalJobId,
        createdAt: row.createdAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        artifactsCount: toNumber(row.artifactsCount),
        artifactsBytes: toNumber(row.artifactsBytes),
      })),
      artifacts: artifactRows.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        blobKey: row.blobKey,
        blobUrl: row.blobUrl,
        format: row.format,
        sizeBytes: row.sizeBytes,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
      quotaUsage: quotaRows.map((row) => ({
        dayUtc: String(row.dayUtc),
        jobsCount: row.jobsCount,
        secondsProcessed: row.secondsProcessed,
        bytesUploaded: row.bytesUploaded,
      })),
      trainingSamples: trainingRows.map((row) => ({
        id: row.id,
        sampleId: row.sampleId,
        toolType: row.toolType,
        captureMode: row.captureMode,
        policyVersion: row.policyVersion,
        status: row.status,
        inputHash: row.inputHash,
        outputHashCount: Array.isArray(row.outputHashes) ? row.outputHashes.length : 0,
        sourceDurationSec: row.sourceDurationSec,
        capturedAt: row.capturedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        derivedExpiresAt: row.derivedExpiresAt.toISOString(),
      })),
    };

    return NextResponse.json(response, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Unable to load ops session data", error);
    return jsonError(500, "Unable to load session data");
  }
}
