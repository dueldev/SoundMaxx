import type {
  ArtifactRecord,
  JobRecord,
  JobStatus,
  ToolParamsMap,
  ToolType,
} from "@/types/domain";

export type UploadInitRequest = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  rightsConfirmed: boolean;
  trainingConsent: boolean;
};

export type UploadInitResponse = {
  uploadUrl: string;
  blobKey: string;
  assetId: string;
  sessionToken: string;
  expiresAt: string;
};

export type CreateJobRequest = {
  assetId: string;
  toolType: ToolType;
  params: ToolParamsMap[ToolType];
};

export type CreateJobResponse = {
  jobId: string;
  status: JobStatus;
};

export type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  etaSec: number | null;
  error?: string;
  artifactIds: string[];
};

export type ArtifactResponse = {
  downloadUrl: string;
  expiresAt: string;
};

export type ProviderWebhookPayload = {
  externalJobId: string;
  status: "succeeded" | "failed";
  progressPct?: number;
  errorCode?: string;
  artifacts?: Array<{
    blobUrl: string;
    blobKey: string;
    format: string;
    sizeBytes: number;
  }>;
  metrics?: Record<string, number | string>;
};

export type CleanupSummary = {
  removedAssets: number;
  removedArtifacts: number;
  expiredJobs: number;
};

export type JobWithArtifacts = {
  job: JobRecord;
  artifacts: ArtifactRecord[];
};
