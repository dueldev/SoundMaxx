export type UploadState = "idle" | "preparing" | "uploading" | "uploaded" | "failed";
export type JobState = "idle" | "queued" | "running" | "succeeded" | "failed";

export type ArtifactView = {
  id: string;
  downloadUrl: string;
  expiresAt: string;
};
