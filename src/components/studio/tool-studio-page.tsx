"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { put as putBlob } from "@vercel/blob/client";
import { ProcessPanel } from "@/components/studio/process-panel";
import { ResultsPanel } from "@/components/studio/results-panel";
import { StudioPageShell } from "@/components/studio/studio-page-shell";
import type { ArtifactView, JobState, UploadState, WorkflowPhase } from "@/components/studio/types";
import { UploadPanel } from "@/components/studio/upload-panel";
import type { ToolConfig } from "@/lib/tool-config";
import type { UploadInitResponse } from "@/types/api";
import type { MasteringPreset, ToolType } from "@/types/domain";

function deriveWorkflowPhase(uploadState: UploadState, jobState: JobState, hasArtifacts: boolean): WorkflowPhase {
  if (hasArtifacts && jobState === "succeeded") return "export";
  if (jobState === "queued" || jobState === "running") return "process";
  if (uploadState === "uploaded") return "configure";
  if (uploadState === "uploading" || uploadState === "preparing") return "upload";
  return "upload";
}

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
    typeof payload.expiresAt === "string" &&
    "clientUploadToken" in payload &&
    typeof payload.clientUploadToken === "string"
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
    prevJobStateRef.current = "idle";
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
      const uploaded = await putBlob(initBody.blobKey, file, {
        access: "public",
        token: initBody.clientUploadToken,
        contentType: file.type || "application/octet-stream",
        multipart: true,
      });

      const completeResponse = await fetch(`/api/upload/complete/${initBody.assetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blobUrl: uploaded.url,
          uploadedBytes: file.size,
        }),
      });

      const completeBody = await parseJsonResponse<{ error?: string }>(completeResponse);
      if (!completeResponse.ok) {
        throw new Error(completeBody?.error ?? "Audio upload failed");
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
      prevJobStateRef.current = "queued";
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

  const prevJobStateRef = useRef<JobState>("idle");
  const bridgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArtifacts = useCallback(async (artifactIds: string[]) => {
    const ids = artifactIds ?? [];
    const data = await Promise.all(
      ids.map(async (id) => {
        const artifactResponse = await fetch(`/api/artifacts/${id}`, { cache: "no-store" });
        const artifactPayload = await parseJsonResponse<{
          downloadUrl?: string;
          expiresAt?: string;
          format?: string;
        }>(artifactResponse);

        if (!artifactResponse.ok || !artifactPayload?.downloadUrl || !artifactPayload.expiresAt) {
          throw new Error(`Could not retrieve artifact ${id}`);
        }

        return {
          id,
          downloadUrl: artifactPayload.downloadUrl,
          expiresAt: artifactPayload.expiresAt,
          format: artifactPayload.format ?? "bin",
        } satisfies ArtifactView;
      }),
    );
    setArtifacts(data);
  }, []);

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

      const backendStatus = payload.status;
      const wasQueued = prevJobStateRef.current === "queued";

      if (backendStatus === "failed") {
        prevJobStateRef.current = "failed";
        setJobState("failed");
        setJobProgress(payload.progressPct ?? 0);
        setJobError(payload.error ?? "Processing failed");
        clearInterval(interval);
        return;
      }

      if (backendStatus === "succeeded") {
        clearInterval(interval);

        if (wasQueued) {
          prevJobStateRef.current = "running";
          setJobState("running");
          setJobProgress(50);
          setJobEtaSec(null);

          bridgeTimerRef.current = setTimeout(async () => {
            prevJobStateRef.current = "succeeded";
            setJobState("succeeded");
            setJobProgress(100);
            try {
              await fetchArtifacts(payload.artifactIds ?? []);
            } catch (error) {
              setJobError(error instanceof Error ? error.message : "Failed to load artifacts");
            }
          }, 1200);
        } else {
          prevJobStateRef.current = "succeeded";
          setJobState("succeeded");
          setJobProgress(100);
          try {
            await fetchArtifacts(payload.artifactIds ?? []);
          } catch (error) {
            setJobError(error instanceof Error ? error.message : "Failed to load artifacts");
          }
        }
        return;
      }

      prevJobStateRef.current = backendStatus;
      setJobState(backendStatus);
      setJobProgress(payload.progressPct ?? 0);
      setJobEtaSec(payload.etaSec ?? null);
    }, 2000);

    return () => {
      clearInterval(interval);
      if (bridgeTimerRef.current) clearTimeout(bridgeTimerRef.current);
    };
  }, [jobId, jobState, fetchArtifacts]);

  const workflowPhase = deriveWorkflowPhase(uploadState, jobState, artifacts.length > 0);

  return (
    <StudioPageShell
      title={toolConfig.label}
      description={toolConfig.description}
      workflowTitle={toolConfig.label}
      workflowDescription={toolConfig.marketingBlurb}
      workflowPhase={workflowPhase}
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
      resultsPanel={
        <ResultsPanel
          toolType={toolConfig.toolType}
          filePreviewUrl={filePreviewUrl}
          artifacts={artifacts}
          stemCount={stems}
        />
      }
      footer={
        <>
          Job ID: <span className="font-mono">{jobId ?? "not started"}</span>
        </>
      }
    />
  );
}
