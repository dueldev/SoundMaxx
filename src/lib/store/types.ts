import type {
  ArtifactRecord,
  AssetRecord,
  JobRecord,
  JobRecoveryState,
  JobStatus,
  OpsSummary,
  QuotaUsageRecord,
  RecentSessionRun,
  SessionRecord,
  ToolType,
} from "@/types/domain";

export type CreateSessionInput = {
  id: string;
  ipHash: string;
  userAgentHash: string;
  policyVersion?: string;
  policySeenAt?: string | null;
  adPersonalizationOptIn?: boolean;
  doNotSellOrShare?: boolean;
};

export type CreateAssetInput = {
  id: string;
  sessionId: string;
  blobKey: string;
  trainingConsent: boolean;
  policyVersion: string;
  ageConfirmed: boolean;
  rightsConfirmed: boolean;
  trainingCaptureMode: "implied_use";
  durationSec: number;
  expiresAt: string;
};

export type UpdateAssetBlobInput = {
  assetId: string;
  blobUrl: string;
  sampleRate?: number | null;
  channels?: number | null;
};

export type CreateJobInput = {
  id: string;
  sessionId: string;
  assetId: string;
  toolType: ToolType;
  provider: string;
  model: string;
  status: JobStatus;
  progressPct: number;
  etaSec: number | null;
  paramsJson: string;
  externalJobId?: string | null;
  recoveryState?: JobRecoveryState;
  attemptCount?: number;
  qualityFlags?: string[];
  lastRecoveryAt?: string | null;
};

export type UpdateJobInput = {
  jobId: string;
  model?: string;
  status?: JobStatus;
  progressPct?: number;
  etaSec?: number | null;
  errorCode?: string | null;
  externalJobId?: string | null;
  recoveryState?: JobRecoveryState;
  attemptCount?: number;
  qualityFlags?: string[];
  lastRecoveryAt?: string | null;
  finishedAt?: string | null;
};

export type CreateArtifactInput = {
  id: string;
  jobId: string;
  sessionId: string;
  blobKey: string;
  blobUrl: string;
  format: string;
  sizeBytes: number;
  expiresAt: string;
};

export type QuotaUsageDelta = {
  sessionId: string;
  dayUtc: string;
  jobsCount?: number;
  secondsProcessed?: number;
  bytesUploaded?: number;
};

export type ExpiredResources = {
  assets: AssetRecord[];
  artifacts: ArtifactRecord[];
  jobsToExpire: JobRecord[];
};

export interface SoundmaxxStore {
  createOrTouchSession(input: CreateSessionInput): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;

  createAsset(input: CreateAssetInput): Promise<AssetRecord>;
  getAssetById(assetId: string): Promise<AssetRecord | null>;
  getSessionAsset(assetId: string, sessionId: string): Promise<AssetRecord | null>;
  updateAssetBlob(input: UpdateAssetBlobInput): Promise<AssetRecord | null>;
  deleteAsset(assetId: string): Promise<void>;

  createJob(input: CreateJobInput): Promise<JobRecord>;
  getSessionJob(jobId: string, sessionId: string): Promise<JobRecord | null>;
  getJobByExternalId(externalJobId: string): Promise<JobRecord | null>;
  updateJob(input: UpdateJobInput): Promise<JobRecord | null>;

  createArtifact(input: CreateArtifactInput): Promise<ArtifactRecord>;
  createArtifacts(inputs: CreateArtifactInput[]): Promise<ArtifactRecord[]>;
  getSessionArtifact(artifactId: string, sessionId: string): Promise<ArtifactRecord | null>;
  listArtifactsForJob(jobId: string): Promise<ArtifactRecord[]>;
  deleteArtifact(artifactId: string): Promise<void>;

  getQuotaUsage(sessionId: string, dayUtc: string): Promise<QuotaUsageRecord>;
  bumpQuotaUsage(delta: QuotaUsageDelta): Promise<QuotaUsageRecord>;

  listExpiredResources(nowIso: string): Promise<ExpiredResources>;
  getOpsSummary(nowIso: string): Promise<OpsSummary>;
  listRecentSessionRuns(sessionId: string, limit: number): Promise<RecentSessionRun[]>;
}
