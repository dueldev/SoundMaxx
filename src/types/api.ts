import type {
  ArtifactRecord,
  DegradedState,
  JobRecord,
  JobRecoveryState,
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
  ageConfirmed: boolean;
  policyVersion: string;
};

export type UploadInitResponse = {
  uploadUrl: string;
  blobKey: string;
  assetId: string;
  sessionToken: string;
  expiresAt: string;
  clientUploadToken: string;
};

export type CreateJobRequest = {
  assetId: string;
  toolType: ToolType;
  params: ToolParamsMap[ToolType];
};

export type CreateJobResponse = {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  etaSec: number | null;
  recoveryState: JobRecoveryState;
  attemptCount: number;
  qualityFlags: string[];
};

export type JobStatusResponse = {
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

export type ArtifactResponse = {
  blobKey: string;
  downloadUrl: string;
  expiresAt: string;
  format: string;
};

export type RecentSessionItem = {
  jobId: string;
  toolType: ToolType;
  toolLabel: string;
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

export type RecentSessionsResponse = {
  sessions: RecentSessionItem[];
  degraded?: DegradedState;
};

export type ProviderWebhookPayload = {
  externalJobId: string;
  status: "succeeded" | "failed";
  progressPct?: number;
  etaSec?: number | null;
  errorCode?: string;
  model?: string;
  qualityFlags?: string[];
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

export type PrivacyPreferencesResponse = {
  adPersonalizationOptIn: boolean;
  doNotSellOrShare: boolean;
};

export type PrivacyPreferencesUpdateRequest = {
  adPersonalizationOptIn: boolean;
  doNotSellOrShare: boolean;
};

export type TrainingRunTriggerResponse = {
  runId: string;
  status: string;
  backend: string;
  notes?: string;
};

export type OpsTrainingSummaryResponse = {
  latestRuns: Array<{
    id: string;
    status: string;
    backend: string;
    startedAt: string;
    finishedAt: string | null;
  }>;
  latestRollouts: Array<{
    id: string;
    toolType: string;
    stage: string;
    trafficPct: number;
    status: string;
    rollbackReason: string | null;
  }>;
};

export type OpsIntelligenceResponse = {
  generatedAt: string;
  degraded?: {
    reason: string;
    message: string;
    sections: string[];
  };
  overview: {
    totalSessions: number;
    sessions24h: number;
    jobs1h: number;
    jobs24h: number;
    jobs7d: number;
    activeJobs: number;
    queuedJobs: number;
    runningJobs: number;
    stalledJobs: number;
    failedJobs24h: number;
    successRate1h: number;
    successRate24h: number;
    successRate7d: number;
    rerunRate24h: number;
    avgLatencySec24h: number | null;
    p50LatencySec24h: number | null;
    p95LatencySec24h: number | null;
    outputArtifacts24h: number;
    outputBytes24h: number;
  };
  queue: {
    redisDepth: number | null;
    oldestQueuedSec: number;
    oldestRunningSec: number;
    stalledRunningOver15m: number;
  };
  product: {
    funnel24h: {
      sessions: number;
      assets: number;
      jobs: number;
      succeededJobs: number;
      artifacts: number;
      sessionToAssetRate: number;
      assetToJobRate: number;
      jobToSuccessRate: number;
      successToArtifactRate: number;
    };
    conversionLeaks24h: {
      sessionsWithoutUpload: number;
      sessionsWithoutJob: number;
      sessionsWithoutSuccess: number;
      sessionsWithoutArtifact: number;
    };
    activation: {
      sessionsWithFirstJob24h: number;
      sessionsWithFirstSuccess24h: number;
      medianTimeToFirstJobSec24h: number | null;
      medianTimeToFirstSuccessSec24h: number | null;
    };
    firstToolDistribution24h: Array<{
      toolType: string;
      sessions: number;
      share: number;
    }>;
    latencyDistribution24h: {
      under30Sec: number;
      between30And120Sec: number;
      between120And300Sec: number;
      over300Sec: number;
    };
    trends24h: {
      sessionsDelta: number;
      jobsDelta: number;
      successRateDelta: number;
      rerunRateDelta: number;
      p95LatencyDeltaSec: number | null;
      sessionToAssetRateDelta: number;
      assetToJobRateDelta: number;
      confidence: {
        level: "low" | "medium" | "high";
        sessions24h: number;
        jobs24h: number;
        statisticallyStable: boolean;
      };
    };
    rerunMetrics24h: {
      immediateSameToolSameAssetRate: number;
      crossToolChainRate: number;
      postFailureRetryRate: number;
      sampleSize: number;
      confidence: "low" | "medium" | "high";
    };
    economics24h: {
      artifactsPerSucceededJob: number;
      bytesPerSucceededJob: number;
      bytesPerSession: number;
    };
    retention: {
      activeSessions7d: number;
      returningSessions7d: number;
      returningRate7d: number;
    };
    engagement: {
      activeSessions24h: number;
      jobsPerActiveSession24h: number;
      assetsPerSession24h: number;
      avgAssetDurationSec24h: number | null;
    };
    opportunities: Array<{
      key: string;
      severity: "info" | "warn" | "critical";
      headline: string;
      metric: string;
      recommendation: string;
    }>;
  };
  integrity: {
    dbQueuedJobs: number;
    redisQueueDepth: number | null;
    queueVsDbDrift: number | null;
    staleQueuedOver15m: number;
    staleRunningOver30m: number;
    failedWithoutErrorCode24h: number;
    assetsMissingBlobUrlOver15m: number;
    orphanArtifacts: number;
    orphanJobs: number;
    duplicateExternalJobIds: number;
    trainingSamplesMissingOutputHashes: number;
    trainingSamplesMissingInputHash: number;
    alerts: Array<{
      key: string;
      severity: "info" | "warn" | "critical";
      count: number;
      message: string;
    }>;
  };
  recentSessions: Array<{
    sessionId: string;
    createdAt: string;
    lastSeenAt: string;
    policyVersion: string;
    adPersonalizationOptIn: boolean;
    doNotSellOrShare: boolean;
  }>;
  timelines: {
    hourlyJobs: Array<{
      hour: string;
      total: number;
      succeeded: number;
      failed: number;
      queued: number;
      running: number;
      avgLatencySec: number | null;
    }>;
  };
  tools: Array<{
    toolType: string;
    jobs24h: number;
    succeeded24h: number;
    failed24h: number;
    successRate24h: number;
    rerunRate24h: number;
    avgLatencySec24h: number | null;
    p95LatencySec24h: number | null;
    avgArtifactBytes24h: number | null;
  }>;
  providers: Array<{
    provider: string;
    model: string;
    jobs24h: number;
    failureRate24h: number;
    p95LatencySec24h: number | null;
  }>;
  errors: Array<{
    errorCode: string;
    count24h: number;
    count7d: number;
    lastSeenAt: string | null;
  }>;
  privacy: {
    adPersonalizationOptInSessions: number;
    doNotSellOrShareSessions: number;
    ageConfirmedAssets24h: number;
    rightsConfirmedAssets24h: number;
    policyVersionBreakdown: Array<{
      policyVersion: string;
      sessions: number;
      assets: number;
    }>;
  };
  trainingData: {
    samples24h: number;
    samples7d: number;
    rawExpiring7d: number;
    derivedExpiring30d: number;
    byTool: Array<{
      toolType: string;
      count: number;
    }>;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byCaptureMode: Array<{
      captureMode: string;
      count: number;
    }>;
    readiness48h: Array<{
      toolType: string;
      sampleCount: number;
      jobCount: number;
      sampleToJobRatio: number;
      ready: boolean;
    }>;
  };
  trainingOps: {
    runs7d: number;
    lastRun: {
      id: string;
      status: string;
      backend: string;
      startedAt: string;
      finishedAt: string | null;
      notes: string | null;
    } | null;
    runStatusBreakdown: Array<{
      status: string;
      count: number;
    }>;
    latestModelVersions: Array<{
      id: string;
      toolType: string;
      lifecycleState: string;
      createdAt: string;
      promotedAt: string | null;
      rolledBackAt: string | null;
    }>;
    latestRollouts: Array<{
      id: string;
      toolType: string;
      stage: string;
      trafficPct: number;
      status: string;
      rollbackReason: string | null;
      startedAt: string;
      finishedAt: string | null;
    }>;
    rolloutStatusBreakdown: Array<{
      status: string;
      count: number;
    }>;
  };
  storage: {
    artifactCountTotal: number;
    artifactBytesTotal: number;
    artifactBytes24h: number;
    artifactBytes7d: number;
    trainingSamplesRetained: number;
  };
  analytics: {
    aggregateRows7d: number;
    metricKeys: Array<{
      metricKey: string;
      rows: number;
      events: number;
    }>;
  };
};

export type OpsSessionDataResponse = {
  session: {
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
  stats: {
    assetsCount: number;
    jobsCount: number;
    failedJobsCount: number;
    artifactsCount: number;
    uploadedBytesTotal: number;
    outputBytesTotal: number;
    avgAssetDurationSec: number | null;
    trainingSamplesLinked: number;
  };
  assets: Array<{
    id: string;
    blobKey: string;
    blobUrl: string | null;
    durationSec: number;
    sampleRate: number | null;
    channels: number | null;
    ageConfirmed: boolean;
    rightsConfirmed: boolean;
    policyVersion: string;
    trainingCaptureMode: string;
    expiresAt: string;
    createdAt: string;
    jobsCount: number;
    artifactsCount: number;
  }>;
  jobs: Array<{
    id: string;
    assetId: string;
    toolType: string;
    provider: string;
    model: string;
    status: string;
    progressPct: number;
    etaSec: number | null;
    errorCode: string | null;
    externalJobId: string | null;
    createdAt: string;
    finishedAt: string | null;
    artifactsCount: number;
    artifactsBytes: number;
  }>;
  artifacts: Array<{
    id: string;
    jobId: string;
    blobKey: string;
    blobUrl: string;
    format: string;
    sizeBytes: number;
    expiresAt: string;
    createdAt: string;
  }>;
  quotaUsage: Array<{
    dayUtc: string;
    jobsCount: number;
    secondsProcessed: number;
    bytesUploaded: number;
  }>;
  trainingSamples: Array<{
    id: string;
    sampleId: string;
    toolType: string;
    captureMode: string;
    policyVersion: string;
    status: string;
    inputHash: string | null;
    outputHashCount: number;
    sourceDurationSec: number | null;
    capturedAt: string;
    expiresAt: string;
    derivedExpiresAt: string;
  }>;
};

export type AnalyticsAggregateExportResponse = {
  rows: Array<{
    dayUtc: string;
    metricKey: string;
    dimension: string;
    dimensionValue: string;
    eventsCount: number;
    valueNum: number | null;
    payload: Record<string, unknown>;
  }>;
};

export type JobWithArtifacts = {
  job: JobRecord;
  artifacts: ArtifactRecord[];
};
