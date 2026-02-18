export type UploadState = "idle" | "preparing" | "uploading" | "uploaded" | "failed";
export type JobState = "idle" | "queued" | "running" | "succeeded" | "failed";
export type WorkflowPhase = "upload" | "configure" | "process" | "export";

export type ArtifactView = {
  id: string;
  downloadUrl: string;
  expiresAt: string;
  format: string;
};
