import type { AssetRecord, ToolType } from "@/types/domain";

export type ProviderSubmitInput = {
  jobId: string;
  toolType: ToolType;
  params: unknown;
  sourceAsset: AssetRecord;
  callback: {
    webhookUrl: string;
    webhookSecret: string;
  };
  dataset: {
    captureConsent: boolean;
  };
};

export type ProviderArtifact = {
  blobKey: string;
  blobUrl: string;
  format: string;
  sizeBytes: number;
};

export type ProviderSubmitResult = {
  externalJobId: string;
  provider: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progressPct: number;
  etaSec: number | null;
  artifacts?: ProviderArtifact[];
  errorCode?: string;
};

export interface InferenceProviderAdapter {
  submitJob(input: ProviderSubmitInput): Promise<ProviderSubmitResult>;
}
