"use client";

import { useEffect, useMemo, useState } from "react";
import { ProcessPanel } from "@/components/studio/process-panel";
import { ResultsPanel } from "@/components/studio/results-panel";
import { StudioPageShell } from "@/components/studio/studio-page-shell";
import type { ArtifactView, JobState, UploadState } from "@/components/studio/types";
import { UploadPanel } from "@/components/studio/upload-panel";
import type { ToolConfig } from "@/lib/tool-config";
import type { UploadInitResponse } from "@/types/api";
import type { MasteringPreset, ToolType } from "@/types/domain";

async function readAudioDuration(file: File) {
  const fileUrl = URL.createObjectURL(file);
  try {
    const audio = document.createElement("audio");
    audio.src = fileUrl;
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Unable to read audio metadata")), { once: true });
    });
    return Number.isFinite(audio.duration) ? audio.duration : 0;
  } finally {
    URL.revokeObjectURL(fileUrl);
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isUploadInitResponse(payload: unknown): payload is UploadInitResponse {
  if (!payload || typeof payload !== "object") return false;

  return (
    "uploadUrl" in payload &&
    typeof payload.uploadUrl === "string" &&
    "blobKey" in payload &&
    typeof payload.blobKey === "string" &&
    "assetId" in payload &&
    typeof payload.assetId === "string" &&
    "sessionToken" in payload &&
    typeof payload.sessionToken === "string" &&
    "expiresAt" in payload &&
    typeof payload.expiresAt === "string"
  );
}

function toolParams(args: {
  toolType: ToolType;
  stems: 2 | 4;
  masteringPreset: MasteringPreset;
  masteringIntensity: number;
  includeChordHints: boolean;
  targetLufs: number;
  midiSensitivity: number;
}) {
  if (args.toolType === "stem_isolation") {
    return { stems: args.stems };
  }
  if (args.toolType === "mastering") {
    return { preset: args.masteringPreset, intensity: args.masteringIntensity };
  }
  if (args.toolType === "key_bpm") {
    return { includeChordHints: args.includeChordHints };
  }
  if (args.toolType === "loudness_report") {
    return { targetLufs: args.targetLufs };
  }
  return { sensitivity: args.midiSensitivity };
}

export function ToolStudioPage({ toolConfig }: { toolConfig: ToolConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [uploadExpiry, setUploadExpiry] = useState<string | null>(null);

  const [stems, setStems] = useState<2 | 4>(toolConfig.defaults.stems);
  const [masteringPreset, setMasteringPreset] = useState<MasteringPreset>(toolConfig.defaults.masteringPreset);
  const [masteringIntensity, setMasteringIntensity] = useState(toolConfig.defaults.masteringIntensity);
  const [includeChordHints, setIncludeChordHints] = useState(toolConfig.defaults.includeChordHints);
  const [targetLufs, setTargetLufs] = useState(toolConfig.defaults.targetLufs);
  const [midiSensitivity, setMidiSensitivity] = useState(toolConfig.defaults.midiSensitivity);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState>("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobEtaSec, setJobEtaSec] = useState<number | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactView[]>([]);

  const canUpload = useMemo(() => {
    return Boolean(file && rightsConfirmed && uploadState !== "uploading" && uploadState !== "preparing");
  }, [file, rightsConfirmed, uploadState]);

  const canRunTool = Boolean(assetId && jobState !== "queued" && jobState !== "running");

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setFilePreviewUrl(localUrl);

    return () => {
      URL.revokeObjectURL(localUrl);
    };
  }, [file]);

  function handleFileSelected(picked: File | null) {
    setFile(picked);
    setAssetId(null);
    setUploadState("idle");
    setUploadError(null);
    setJobState("idle");
    setJobId(null);
    setArtifacts([]);
    setUploadExpiry(null);
    setJobProgress(0);
    setJobError(null);
    setJobEtaSec(null);
  }

  async function handleUpload() {
    if (!file) return;

    try {
      setUploadState("preparing");
      setUploadError(null);
      const durationSec = await readAudioDuration(file);

      const initResponse = await fetch("/api/upload/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          durationSec,
          rightsConfirmed,
          trainingConsent,
        }),
      });

      const initBodyRaw = await parseJsonResponse<UploadInitResponse | { error: string; details?: unknown }>(
        initResponse,
      );
      if (!initResponse.ok) {
        throw new Error(initBodyRaw && "error" in initBodyRaw ? initBodyRaw.error : "Upload init failed");
      }

      if (!isUploadInitResponse(initBodyRaw)) {
        throw new Error("Upload init failed");
      }

      const initBody = initBodyRaw;

      setUploadState("uploading");
      const form = new FormData();
      form.set("file", file);

      const contentResponse = await fetch(initBody.uploadUrl, {
        method: "PUT",
        body: form,
      });

      const contentBody = await parseJsonResponse<{ error?: string }>(contentResponse);
      if (!contentResponse.ok) {
        throw new Error(contentBody?.error ?? "Audio upload failed");
      }

      setAssetId(initBody.assetId);
      setUploadExpiry(initBody.expiresAt);
      setUploadState("uploaded");
    } catch (error) {
      setUploadState("failed");
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function handleCreateJob() {
    if (!assetId) return;

    try {
      setJobState("queued");
      setJobError(null);
      setJobProgress(5);
      setArtifacts([]);

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          toolType: toolConfig.toolType,
          params: toolParams({
            toolType: toolConfig.toolType,
            stems,
            masteringPreset,
            masteringIntensity,
            includeChordHints,
            targetLufs,
            midiSensitivity,
          }),
        }),
      });

      const payload = await parseJsonResponse<{ jobId?: string; status?: JobState; error?: string }>(response);
      if (!response.ok || !payload?.jobId || !payload.status) {
        throw new Error(payload?.error ?? "Unable to create job");
      }

      setJobId(payload.jobId);
      setJobState(payload.status);
      if (payload.status === "succeeded") {
        setJobProgress(100);
      }
    } catch (error) {
      setJobState("failed");
      setJobError(error instanceof Error ? error.message : "Unable to submit job");
    }
  }

  useEffect(() => {
    if (!jobId || (jobState !== "queued" && jobState !== "running")) return;

    const interval = setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      const payload = await parseJsonResponse<{
        status?: JobState;
        progressPct?: number;
        etaSec?: number;
        error?: string;
        artifactIds?: string[];
      }>(response);

      if (!response.ok || !payload?.status) {
        setJobState("failed");
        setJobError(payload?.error ?? "Polling failed");
        clearInterval(interval);
        return;
      }

      setJobState(payload.status);
      setJobProgress(payload.progressPct ?? 0);
      setJobEtaSec(payload.etaSec ?? null);

      if (payload.status === "failed") {
        setJobError(payload.error ?? "Processing failed");
        clearInterval(interval);
        return;
      }

      if (payload.status === "succeeded") {
        clearInterval(interval);

        try {
          const ids = payload.artifactIds ?? [];
          const artifactData = await Promise.all(
            ids.map(async (id) => {
              const artifactResponse = await fetch(`/api/artifacts/${id}`, { cache: "no-store" });
              const artifactPayload = await parseJsonResponse<{
                downloadUrl?: string;
                expiresAt?: string;
              }>(artifactResponse);

              if (!artifactResponse.ok || !artifactPayload?.downloadUrl || !artifactPayload.expiresAt) {
                throw new Error(`Could not retrieve artifact ${id}`);
              }

              return {
                id,
                downloadUrl: artifactPayload.downloadUrl,
                expiresAt: artifactPayload.expiresAt,
              } satisfies ArtifactView;
            }),
          );

          setArtifacts(artifactData);
        } catch (error) {
          setJobError(error instanceof Error ? error.message : "Failed to load artifacts");
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, jobState]);

  return (
    <StudioPageShell
      title={toolConfig.label}
      description={toolConfig.description}
      workflowTitle={toolConfig.label}
      workflowDescription={toolConfig.marketingBlurb}
      uploadPanel={
        <UploadPanel
          file={file}
          filePreviewUrl={filePreviewUrl}
          rightsConfirmed={rightsConfirmed}
          trainingConsent={trainingConsent}
          uploadState={uploadState}
          uploadError={uploadError}
          uploadExpiry={uploadExpiry}
          canUpload={canUpload}
          onFileSelected={handleFileSelected}
          onRightsConfirmedChange={setRightsConfirmed}
          onTrainingConsentChange={setTrainingConsent}
          onUpload={handleUpload}
        />
      }
      processPanel={
        <ProcessPanel
          toolType={toolConfig.toolType}
          toolLabel={toolConfig.label}
          toolDescription={toolConfig.description}
          jobState={jobState}
          jobProgress={jobProgress}
          jobEtaSec={jobEtaSec}
          jobError={jobError}
          canRunTool={canRunTool}
          onRunTool={handleCreateJob}
          stems={stems}
          masteringPreset={masteringPreset}
          masteringIntensity={masteringIntensity}
          includeChordHints={includeChordHints}
          targetLufs={targetLufs}
          midiSensitivity={midiSensitivity}
          onStemsChange={setStems}
          onMasteringPresetChange={setMasteringPreset}
          onMasteringIntensityChange={setMasteringIntensity}
          onIncludeChordHintsChange={setIncludeChordHints}
          onTargetLufsChange={setTargetLufs}
          onMidiSensitivityChange={setMidiSensitivity}
        />
      }
      resultsPanel={<ResultsPanel filePreviewUrl={filePreviewUrl} artifacts={artifacts} />}
      footer={
        <>
          Job ID: <span className="font-mono">{jobId ?? "not started"}</span>
        </>
      }
    />
  );
}
