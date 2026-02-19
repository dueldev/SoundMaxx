export const TOOL_TYPES = [
  "stem_isolation",
  "mastering",
  "key_bpm",
  "loudness_report",
  "midi_extract",
] as const;

export type ToolType = (typeof TOOL_TYPES)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "expired",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_RECOVERY_STATES = [
  "none",
  "retrying",
  "degraded_fallback",
  "failed_after_retry",
] as const;

export type JobRecoveryState = (typeof JOB_RECOVERY_STATES)[number];

export const MASTERING_PRESETS = [
  "streaming_clean",
  "club_loud",
  "warm_analog",
  "reference_match",
] as const;

export type MasteringPreset = (typeof MASTERING_PRESETS)[number];

export type StemIsolationParams = {
  stems: 2 | 4;
  fallbackModel?: "demucs_v4" | "mel_band_roformer";
};

export type MasteringParams = {
  preset: MasteringPreset;
  intensity: number;
  referenceAssetId?: string;
};

export type KeyBpmParams = {
  includeChordHints: boolean;
};

export type LoudnessReportParams = {
  targetLufs?: number;
};

export type MidiExtractParams = {
  sensitivity: number;
};

export const TRAINING_CAPTURE_MODES = ["implied_use"] as const;
export type TrainingCaptureMode = (typeof TRAINING_CAPTURE_MODES)[number];

export type ToolParamsMap = {
  stem_isolation: StemIsolationParams;
  mastering: MasteringParams;
  key_bpm: KeyBpmParams;
  loudness_report: LoudnessReportParams;
  midi_extract: MidiExtractParams;
};

export type ToolRequest<T extends ToolType = ToolType> = {
  toolType: T;
  params: ToolParamsMap[T];
};

export type SessionRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ipHash: string;
  userAgentHash: string;
  policyVersion: string;
  policySeenAt: string | null;
  adPersonalizationOptIn: boolean;
  doNotSellOrShare: boolean;
};

export type AssetRecord = {
  id: string;
  sessionId: string;
  blobKey: string;
  blobUrl: string | null;
  trainingConsent: boolean;
  policyVersion: string;
  ageConfirmed: boolean;
  rightsConfirmed: boolean;
  trainingCaptureMode: TrainingCaptureMode;
  durationSec: number;
  sampleRate: number | null;
  channels: number | null;
  expiresAt: string;
  createdAt: string;
};

export type JobRecord = {
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
  errorCode: string | null;
  externalJobId: string | null;
  recoveryState: JobRecoveryState;
  attemptCount: number;
  qualityFlags: string[];
  lastRecoveryAt: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type ArtifactRecord = {
  id: string;
  jobId: string;
  sessionId: string;
  blobKey: string;
  blobUrl: string;
  format: string;
  sizeBytes: number;
  expiresAt: string;
  createdAt: string;
};

export type QuotaUsageRecord = {
  sessionId: string;
  dayUtc: string;
  jobsCount: number;
  secondsProcessed: number;
  bytesUploaded: number;
};

export type JobProgressPayload = {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  etaSec: number | null;
  recoveryState: JobRecoveryState;
  attemptCount: number;
  qualityFlags: string[];
  error?: string;
  artifactIds: string[];
};

export type DegradedState = {
  reason: string;
  message: string;
};

export type RecentSessionRun = {
  jobId: string;
  toolType: ToolType;
  status: JobStatus;
  recoveryState: JobRecoveryState;
  attemptCount: number;
  qualityFlags: string[];
  paramsJson: string;
  errorCode: string | null;
  createdAt: string;
  artifactCount: number;
  expiresAt: string | null;
};

export type OpsSummary = {
  totalSessions: number;
  activeJobs: number;
  failedJobsLast24h: number;
  queueDepth: number;
  degraded?: DegradedState;
};

export type SessionPrivacyPreferences = {
  adPersonalizationOptIn: boolean;
  doNotSellOrShare: boolean;
};

export type TrainingSampleRecord = {
  id: string;
  sampleId: string;
  toolType: ToolType;
  captureMode: TrainingCaptureMode;
  policyVersion: string;
  sessionFingerprint: string | null;
  inputHash: string | null;
  outputHashes: string[];
  paramsJson: string;
  outcomeJson: string;
  featureJson: string;
  sourceDurationSec: number | null;
  status: string;
  capturedAt: string;
  expiresAt: string;
  derivedExpiresAt: string;
  createdAt: string;
};

export type TrainingRunRecord = {
  id: string;
  windowStart: string;
  windowEnd: string;
  backend: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  metricsJson: string;
  errorCode: string | null;
  notes: string | null;
  createdAt: string;
};

export type ModelVersionRecord = {
  id: string;
  toolType: ToolType;
  artifactUri: string;
  metricsJson: string;
  lifecycleState: string;
  createdAt: string;
  promotedAt: string | null;
  rolledBackAt: string | null;
};

export type ModelRolloutRecord = {
  id: string;
  toolType: ToolType;
  modelVersionId: string;
  stage: string;
  trafficPct: number;
  status: string;
  baselineMetricsJson: string;
  candidateMetricsJson: string;
  rollbackReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};

export type AnalyticsDailyAggregateRecord = {
  dayUtc: string;
  metricKey: string;
  dimension: string;
  dimensionValue: string;
  eventsCount: number;
  valueNum: number | null;
  payloadJson: string;
  createdAt: string;
};
