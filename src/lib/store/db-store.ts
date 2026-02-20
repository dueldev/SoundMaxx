import { and, asc, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import type {
  ArtifactRecord,
  AssetRecord,
  JobRecord,
  OpsSummary,
  QuotaUsageRecord,
  RecentSessionRun,
  SessionRecord,
} from "@/types/domain";
import { getDb } from "@/lib/db/client";
import { artifacts, assets, jobs, quotaUsage, sessions } from "@/lib/db/schema";
import type {
  CreateArtifactInput,
  CreateAssetInput,
  CreateJobInput,
  CreateSessionInput,
  ExpiredResources,
  QuotaUsageDelta,
  SoundmaxxStore,
  UpdateAssetBlobInput,
  UpdateJobInput,
} from "@/lib/store/types";

function mapSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    ipHash: row.ipHash,
    userAgentHash: row.userAgentHash,
    policyVersion: row.policyVersion,
    policySeenAt: row.policySeenAt?.toISOString() ?? null,
    adPersonalizationOptIn: row.adPersonalizationOptIn,
    doNotSellOrShare: row.doNotSellOrShare,
  };
}

function mapAsset(row: typeof assets.$inferSelect): AssetRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    blobKey: row.blobKey,
    blobUrl: row.blobUrl,
    trainingConsent: row.trainingConsent,
    policyVersion: row.policyVersion,
    ageConfirmed: row.ageConfirmed,
    rightsConfirmed: row.rightsConfirmed,
    trainingCaptureMode: row.trainingCaptureMode as AssetRecord["trainingCaptureMode"],
    durationSec: row.durationSec,
    sampleRate: row.sampleRate,
    channels: row.channels,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapJob(row: typeof jobs.$inferSelect): JobRecord {
  const qualityFlags = Array.isArray(row.qualityFlags) ? row.qualityFlags.filter((value): value is string => typeof value === "string") : [];
  return {
    id: row.id,
    sessionId: row.sessionId,
    assetId: row.assetId,
    toolType: row.toolType as JobRecord["toolType"],
    provider: row.provider,
    model: row.model,
    status: row.status as JobRecord["status"],
    progressPct: row.progressPct,
    etaSec: row.etaSec,
    paramsJson: JSON.stringify(row.paramsJson),
    errorCode: row.errorCode,
    externalJobId: row.externalJobId,
    recoveryState: (row.recoveryState as JobRecord["recoveryState"]) ?? "none",
    attemptCount: row.attemptCount ?? 1,
    qualityFlags,
    lastRecoveryAt: row.lastRecoveryAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function mapArtifact(row: typeof artifacts.$inferSelect): ArtifactRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    sessionId: row.sessionId,
    blobKey: row.blobKey,
    blobUrl: row.blobUrl,
    format: row.format,
    sizeBytes: row.sizeBytes,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapQuota(row: typeof quotaUsage.$inferSelect): QuotaUsageRecord {
  return {
    sessionId: row.sessionId,
    dayUtc: row.dayUtc,
    jobsCount: row.jobsCount,
    secondsProcessed: row.secondsProcessed,
    bytesUploaded: row.bytesUploaded,
  };
}

export class DbStore implements SoundmaxxStore {
  async createOrTouchSession(input: CreateSessionInput) {
    const db = getDb();
    const now = new Date();
    const updateSet: Partial<typeof sessions.$inferInsert> = {
      lastSeenAt: now,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    };

    if (input.policyVersion !== undefined) {
      updateSet.policyVersion = input.policyVersion;
    }
    if (input.policySeenAt !== undefined) {
      updateSet.policySeenAt = input.policySeenAt ? new Date(input.policySeenAt) : null;
    }
    if (input.adPersonalizationOptIn !== undefined) {
      updateSet.adPersonalizationOptIn = input.adPersonalizationOptIn;
    }
    if (input.doNotSellOrShare !== undefined) {
      updateSet.doNotSellOrShare = input.doNotSellOrShare;
    }

    const [upserted] = await db
      .insert(sessions)
      .values({
        id: input.id,
        createdAt: now,
        lastSeenAt: now,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        policyVersion: input.policyVersion ?? "2026-02-19",
        policySeenAt: input.policySeenAt ? new Date(input.policySeenAt) : null,
        adPersonalizationOptIn: input.adPersonalizationOptIn ?? false,
        doNotSellOrShare: input.doNotSellOrShare ?? true,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: updateSet,
      })
      .returning();

    return mapSession(upserted);
  }

  async getSession(sessionId: string) {
    const db = getDb();
    const row = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    return row ? mapSession(row) : null;
  }

  async createAsset(input: CreateAssetInput) {
    const db = getDb();
    const [row] = await db
      .insert(assets)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        blobKey: input.blobKey,
        blobUrl: null,
        trainingConsent: input.trainingConsent,
        policyVersion: input.policyVersion,
        ageConfirmed: input.ageConfirmed,
        rightsConfirmed: input.rightsConfirmed,
        trainingCaptureMode: input.trainingCaptureMode,
        durationSec: input.durationSec,
        sampleRate: null,
        channels: null,
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(),
      })
      .returning();

    return mapAsset(row);
  }

  async getAssetById(assetId: string) {
    const db = getDb();
    const row = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    return row ? mapAsset(row) : null;
  }

  async getSessionAsset(assetId: string, sessionId: string) {
    const db = getDb();
    const row = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.sessionId, sessionId)),
    });
    return row ? mapAsset(row) : null;
  }

  async updateAssetBlob(input: UpdateAssetBlobInput) {
    const db = getDb();
    const [row] = await db
      .update(assets)
      .set({
        blobUrl: input.blobUrl,
        sampleRate: input.sampleRate ?? null,
        channels: input.channels ?? null,
      })
      .where(eq(assets.id, input.assetId))
      .returning();

    return row ? mapAsset(row) : null;
  }

  async deleteAsset(assetId: string) {
    const db = getDb();
    await db.delete(assets).where(eq(assets.id, assetId));
  }

  async createJob(input: CreateJobInput) {
    const db = getDb();
    const [row] = await db
      .insert(jobs)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        assetId: input.assetId,
        toolType: input.toolType,
        provider: input.provider,
        model: input.model,
        status: input.status,
        progressPct: input.progressPct,
        etaSec: input.etaSec,
        paramsJson: JSON.parse(input.paramsJson),
        errorCode: null,
        externalJobId: input.externalJobId ?? null,
        recoveryState: input.recoveryState ?? "none",
        attemptCount: input.attemptCount ?? 1,
        qualityFlags: input.qualityFlags ?? [],
        lastRecoveryAt: input.lastRecoveryAt ? new Date(input.lastRecoveryAt) : null,
        createdAt: new Date(),
        finishedAt: null,
      })
      .returning();

    return mapJob(row);
  }

  async getSessionJob(jobId: string, sessionId: string) {
    const db = getDb();
    const row = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.sessionId, sessionId)),
    });
    return row ? mapJob(row) : null;
  }

  async getJobByExternalId(externalJobId: string) {
    const db = getDb();
    const row = await db.query.jobs.findFirst({
      where: eq(jobs.externalJobId, externalJobId),
    });
    return row ? mapJob(row) : null;
  }

  async updateJob(input: UpdateJobInput) {
    const db = getDb();
    const payload: Partial<typeof jobs.$inferInsert> = {};
    if (input.model !== undefined) payload.model = input.model;
    if (input.status !== undefined) payload.status = input.status;
    if (input.progressPct !== undefined) payload.progressPct = input.progressPct;
    if (input.etaSec !== undefined) payload.etaSec = input.etaSec;
    if (input.errorCode !== undefined) payload.errorCode = input.errorCode;
    if (input.externalJobId !== undefined) payload.externalJobId = input.externalJobId;
    if (input.recoveryState !== undefined) payload.recoveryState = input.recoveryState;
    if (input.attemptCount !== undefined) payload.attemptCount = input.attemptCount;
    if (input.qualityFlags !== undefined) payload.qualityFlags = input.qualityFlags;
    if (input.lastRecoveryAt !== undefined) payload.lastRecoveryAt = input.lastRecoveryAt ? new Date(input.lastRecoveryAt) : null;
    if (input.finishedAt !== undefined) payload.finishedAt = input.finishedAt ? new Date(input.finishedAt) : null;

    const [row] = await db.update(jobs).set(payload).where(eq(jobs.id, input.jobId)).returning();
    return row ? mapJob(row) : null;
  }

  async createArtifact(input: CreateArtifactInput) {
    const db = getDb();
    const [row] = await db
      .insert(artifacts)
      .values({
        id: input.id,
        jobId: input.jobId,
        sessionId: input.sessionId,
        blobKey: input.blobKey,
        blobUrl: input.blobUrl,
        format: input.format,
        sizeBytes: input.sizeBytes,
        expiresAt: new Date(input.expiresAt),
        createdAt: new Date(),
      })
      .returning();

    return mapArtifact(row);
  }

  async createArtifacts(inputs: CreateArtifactInput[]) {
    if (inputs.length === 0) return [];
    const db = getDb();
    const rows = await db
      .insert(artifacts)
      .values(
        inputs.map((input) => ({
          id: input.id,
          jobId: input.jobId,
          sessionId: input.sessionId,
          blobKey: input.blobKey,
          blobUrl: input.blobUrl,
          format: input.format,
          sizeBytes: input.sizeBytes,
          expiresAt: new Date(input.expiresAt),
          createdAt: new Date(),
        })),
      )
      .returning();

    return rows.map(mapArtifact);
  }

  async getSessionArtifact(artifactId: string, sessionId: string) {
    const db = getDb();
    const row = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.id, artifactId), eq(artifacts.sessionId, sessionId)),
    });
    return row ? mapArtifact(row) : null;
  }

  async listArtifactsForJob(jobId: string) {
    const db = getDb();
    const rows = await db.query.artifacts.findMany({
      where: eq(artifacts.jobId, jobId),
      orderBy: [asc(artifacts.createdAt), asc(artifacts.id)],
    });
    return rows.map(mapArtifact);
  }

  async deleteArtifact(artifactId: string) {
    const db = getDb();
    await db.delete(artifacts).where(eq(artifacts.id, artifactId));
  }

  async getQuotaUsage(sessionId: string, dayUtc: string) {
    const db = getDb();
    const row = await db.query.quotaUsage.findFirst({
      where: and(eq(quotaUsage.sessionId, sessionId), eq(quotaUsage.dayUtc, dayUtc)),
    });

    if (!row) {
      return {
        sessionId,
        dayUtc,
        jobsCount: 0,
        secondsProcessed: 0,
        bytesUploaded: 0,
      };
    }

    return mapQuota(row);
  }

  async bumpQuotaUsage(delta: QuotaUsageDelta) {
    const db = getDb();
    const jobAdd = delta.jobsCount ?? 0;
    const secAdd = delta.secondsProcessed ?? 0;
    const bytesAdd = delta.bytesUploaded ?? 0;

    const [row] = await db
      .insert(quotaUsage)
      .values({
        sessionId: delta.sessionId,
        dayUtc: delta.dayUtc,
        jobsCount: jobAdd,
        secondsProcessed: secAdd,
        bytesUploaded: bytesAdd,
      })
      .onConflictDoUpdate({
        target: [quotaUsage.sessionId, quotaUsage.dayUtc],
        set: {
          jobsCount: sql`${quotaUsage.jobsCount} + ${jobAdd}`,
          secondsProcessed: sql`${quotaUsage.secondsProcessed} + ${secAdd}`,
          bytesUploaded: sql`${quotaUsage.bytesUploaded} + ${bytesAdd}`,
        },
      })
      .returning();

    return mapQuota(row);
  }

  async listExpiredResources(now: string): Promise<ExpiredResources> {
    const db = getDb();
    const nowDate = new Date(now);
    const staleJobThreshold = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000);

    const [expiredAssetsRows, expiredArtifactsRows, jobsToExpireRows] = await Promise.all([
      db.query.assets.findMany({
        where: lte(assets.expiresAt, nowDate),
      }),
      db.query.artifacts.findMany({
        where: lte(artifacts.expiresAt, nowDate),
      }),
      db.query.jobs.findMany({
        where: and(
          or(eq(jobs.status, "queued"), eq(jobs.status, "running")),
          lte(jobs.createdAt, staleJobThreshold),
        ),
      }),
    ]);

    return {
      assets: expiredAssetsRows.map(mapAsset),
      artifacts: expiredArtifactsRows.map(mapArtifact),
      jobsToExpire: jobsToExpireRows.map(mapJob),
    };
  }

  async getOpsSummary(now: string): Promise<OpsSummary> {
    const db = getDb();
    const nowDate = new Date(now);
    const since = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000);

    const [sessionCountResult, activeJobsResult, failedJobsResult, queueDepthResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(sessions),
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(or(eq(jobs.status, "queued"), eq(jobs.status, "running"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(and(eq(jobs.status, "failed"), gte(jobs.createdAt, since))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(eq(jobs.status, "queued")),
    ]);

    const sessionCount = Number(sessionCountResult[0]?.count ?? 0);
    const activeJobs = Number(activeJobsResult[0]?.count ?? 0);
    const failedJobsLast24h = Number(failedJobsResult[0]?.count ?? 0);
    const queueDepth = Number(queueDepthResult[0]?.count ?? 0);

    return {
      totalSessions: sessionCount,
      activeJobs,
      failedJobsLast24h,
      queueDepth,
    };
  }

  async listRecentSessionRuns(sessionId: string, limit: number): Promise<RecentSessionRun[]> {
    const db = getDb();
    const boundedLimit = Math.max(1, Math.min(limit, 20));

    const rows = await db
      .select({
        jobId: jobs.id,
        toolType: jobs.toolType,
        status: jobs.status,
        recoveryState: jobs.recoveryState,
        attemptCount: jobs.attemptCount,
        qualityFlags: jobs.qualityFlags,
        paramsJson: jobs.paramsJson,
        errorCode: jobs.errorCode,
        createdAt: jobs.createdAt,
        artifactCount: sql<number>`count(${artifacts.id})`,
        expiresAt: sql<Date | null>`max(${artifacts.expiresAt})`,
      })
      .from(jobs)
      .leftJoin(artifacts, eq(artifacts.jobId, jobs.id))
      .where(eq(jobs.sessionId, sessionId))
      .groupBy(jobs.id)
      .orderBy(desc(jobs.createdAt))
      .limit(boundedLimit);

    return rows.map((row) => ({
      jobId: row.jobId,
      toolType: row.toolType as RecentSessionRun["toolType"],
      status: row.status as RecentSessionRun["status"],
      recoveryState: (row.recoveryState as RecentSessionRun["recoveryState"]) ?? "none",
      attemptCount: Number(row.attemptCount ?? 1),
      qualityFlags: Array.isArray(row.qualityFlags) ? row.qualityFlags.filter((value): value is string => typeof value === "string") : [],
      paramsJson: JSON.stringify(row.paramsJson ?? {}),
      errorCode: row.errorCode ?? null,
      createdAt: row.createdAt.toISOString(),
      artifactCount: Number(row.artifactCount ?? 0),
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    }));
  }
}
