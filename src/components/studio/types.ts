export type UploadState = "idle" | "preparing" | "uploading" | "uploaded" | "failed";
export type JobState = "idle" | "queued" | "running" | "succeeded" | "failed";
export type RecoveryState = "none" | "retrying" | "degraded_fallback" | "failed_after_retry";
export type WorkflowPhase = "upload" | "configure" | "process" | "export";

export type ArtifactView = {
  id: string;
  blobKey: string;
  downloadUrl: string;
  expiresAt: string;
  format: string;
};
