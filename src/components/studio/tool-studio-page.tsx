"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProcessPanel } from "@/components/studio/process-panel";
import { ResultsPanel } from "@/components/studio/results-panel";
import { StudioPageShell } from "@/components/studio/studio-page-shell";
import type { ArtifactView, JobState, RecoveryState, UploadState, WorkflowPhase } from "@/components/studio/types";
import { UploadPanel } from "@/components/studio/upload-panel";
import type { ToolConfig } from "@/lib/tool-config";
import type { RecentSessionItem, RecentSessionsResponse, UploadInitResponse } from "@/types/api";
import type { MasteringPreset, ToolType } from "@/types/domain";

const DEFAULT_POLICY_VERSION = "2026-02-19";

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

function resolveInitialPolicyVersion() {
  const envValue = process.env.NEXT_PUBLIC_POLICY_VERSION?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_POLICY_VERSION;
}

function getRequiredPolicyVersion(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("details" in payload)) return null;

  const details = (payload as { details?: unknown }).details;
  if (!details || typeof details !== "object" || !("requiredPolicyVersion" in details)) return null;

  const required = (details as { requiredPolicyVersion?: unknown }).requiredPolicyVersion;
  if (typeof required !== "string") return null;

  const normalized = required.trim();
  return normalized.length > 0 ? normalized : null;
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

function parseRecentParams(paramsJson: string) {
  try {
    const parsed = JSON.parse(paramsJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function ToolStudioPage({ toolConfig }: { toolConfig: ToolConfig }) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [uploadExpiry, setUploadExpiry] = useState<string | null>(null);
  const policyVersion = resolveInitialPolicyVersion();

  const [stems, setStems] = useState<2 | 4>(toolConfig.defaults.stems);
  const [masteringPreset, setMasteringPreset] = useState<MasteringPreset>(toolConfig.defaults.masteringPreset);
  const [masteringIntensity, setMasteringIntensity] = useState(toolConfig.defaults.masteringIntensity);
  const [includeChordHints, setIncludeChordHints] = useState(toolConfig.defaults.includeChordHints);
  const [targetLufs, setTargetLufs] = useState(toolConfig.defaults.targetLufs);
  const [midiSensitivity, setMidiSensitivity] = useState(toolConfig.defaults.midiSensitivity);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState>("idle");
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("none");
  const [attemptCount, setAttemptCount] = useState(1);
  const [qualityFlags, setQualityFlags] = useState<string[]>([]);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobEtaSec, setJobEtaSec] = useState<number | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactView[]>([]);
  const [recentRunPreset, setRecentRunPreset] = useState<RecentSessionItem | null>(null);

  const canUpload = useMemo(() => {
    return Boolean(file && rightsConfirmed && ageConfirmed && uploadState !== "uploading" && uploadState !== "preparing");
  }, [file, rightsConfirmed, ageConfirmed, uploadState]);

  const canRunTool = Boolean(assetId && jobState !== "queued" && jobState !== "running");
  const currentControls = useMemo(
    () => ({
      stems,
      masteringPreset,
      masteringIntensity,
      includeChordHints,
      targetLufs,
      midiSensitivity,
    }),
    [includeChordHints, masteringIntensity, masteringPreset, midiSensitivity, stems, targetLufs],
  );

  const applyParamsToControls = useCallback(
    (params: Record<string, unknown>) => {
      if (toolConfig.toolType === "stem_isolation") {
        setStems(Number(params.stems) >= 4 ? 4 : 2);
        return;
      }

      if (toolConfig.toolType === "mastering") {
        const preset = typeof params.preset === "string" ? (params.preset as MasteringPreset) : toolConfig.defaults.masteringPreset;
        setMasteringPreset(preset);
        setMasteringIntensity(
          typeof params.intensity === "number" && Number.isFinite(params.intensity)
            ? Math.max(0, Math.min(100, Math.round(params.intensity)))
            : toolConfig.defaults.masteringIntensity,
        );
        return;
      }

      if (toolConfig.toolType === "key_bpm") {
        setIncludeChordHints(typeof params.includeChordHints === "boolean" ? params.includeChordHints : toolConfig.defaults.includeChordHints);
        return;
      }

      if (toolConfig.toolType === "loudness_report") {
        const value = typeof params.targetLufs === "number" ? params.targetLufs : toolConfig.defaults.targetLufs;
        setTargetLufs(Math.max(-24, Math.min(-6, value)));
        return;
      }

      const sensitivity = typeof params.sensitivity === "number" ? params.sensitivity : toolConfig.defaults.midiSensitivity;
      setMidiSensitivity(Math.max(0, Math.min(1, sensitivity)));
    },
    [
      toolConfig.defaults.includeChordHints,
      toolConfig.defaults.masteringIntensity,
      toolConfig.defaults.masteringPreset,
      toolConfig.defaults.midiSensitivity,
      toolConfig.defaults.targetLufs,
      toolConfig.toolType,
    ],
  );

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

  useEffect(() => {
    let active = true;

    const loadRecentRunPreset = async () => {
      try {
        const response = await fetch("/api/sessions/recent?limit=12", { cache: "no-store" });
        const payload = await parseJsonResponse<RecentSessionsResponse>(response);
        if (!active || !response.ok || !payload) return;

        const recentForTool = payload.sessions.find((session) => session.toolType === toolConfig.toolType && Boolean(parseRecentParams(session.paramsJson)));
        setRecentRunPreset(recentForTool ?? null);
      } catch {
        if (!active) return;
        setRecentRunPreset(null);
      }
    };

    void loadRecentRunPreset();
    return () => {
      active = false;
    };
  }, [toolConfig.toolType]);

  const handleUseRecentRunRecall = useCallback(() => {
    if (!recentRunPreset) return;
    const params = parseRecentParams(recentRunPreset.paramsJson);
    if (!params) return;
    applyParamsToControls(params);
  }, [applyParamsToControls, recentRunPreset]);

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
    setRecoveryState("none");
    setAttemptCount(1);
    setQualityFlags([]);
    prevJobStateRef.current = "idle";
  }

  async function handleUpload() {
    if (!file) return;

    try {
      setUploadState("preparing");
      setUploadError(null);
      const durationSec = await readAudioDuration(file);

      const startUpload = async (policyVersionToSend: string) => {
        const response = await fetch("/api/upload/init", {
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
            ageConfirmed,
            policyVersion: policyVersionToSend,
          }),
        });

        const payload = await parseJsonResponse<UploadInitResponse | { error?: string; details?: unknown }>(response);
        return { response, payload };
      };

      let initResult = await startUpload(policyVersion);
      const requiredPolicyVersion = getRequiredPolicyVersion(initResult.payload);
      if (
        !initResult.response.ok &&
        initResult.response.status === 409 &&
        requiredPolicyVersion &&
        requiredPolicyVersion !== policyVersion
      ) {
        initResult = await startUpload(requiredPolicyVersion);
      }

      const initResponse = initResult.response;
      const initBodyRaw = initResult.payload;
      if (!initResponse.ok) {
        const message =
          initBodyRaw && "error" in initBodyRaw && typeof initBodyRaw.error === "string"
            ? initBodyRaw.error
            : "Upload init failed";
        throw new Error(message);
      }

      if (!isUploadInitResponse(initBodyRaw)) {
        throw new Error("Upload init failed");
      }

      const initBody = initBodyRaw;
      const { put: putBlob } = await import("@vercel/blob/client");

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

  async function handleCreateJob(controlOverrides?: Partial<typeof currentControls>) {
    if (!assetId) return;

    try {
      prevJobStateRef.current = "queued";
      setJobState("queued");
      setRecoveryState("none");
      setAttemptCount(1);
      setQualityFlags([]);
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
            ...currentControls,
            ...controlOverrides,
          }),
        }),
      });

      const payload = await parseJsonResponse<{
        jobId?: string;
        status?: JobState;
        recoveryState?: RecoveryState;
        attemptCount?: number;
        qualityFlags?: string[];
        error?: string;
      }>(response);
      if (!response.ok || !payload?.jobId || !payload.status) {
        throw new Error(payload?.error ?? "Unable to create job");
      }

      setJobId(payload.jobId);
      setJobState(payload.status);
      setRecoveryState(payload.recoveryState ?? "none");
      setAttemptCount(payload.attemptCount ?? 1);
      setQualityFlags(payload.qualityFlags ?? []);
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

    let cancelled = false;
    let shouldPoll = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let pollAbort: AbortController | null = null;

    const clearPollTimer = () => {
      if (!pollTimer) return;
      clearTimeout(pollTimer);
      pollTimer = null;
    };

    const scheduleNextPoll = () => {
      clearPollTimer();
      pollTimer = setTimeout(() => {
        void pollOnce();
      }, 2000);
    };

    const pollOnce = async () => {
      if (cancelled || !shouldPoll) return;

      pollAbort = new AbortController();

      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          cache: "no-store",
          signal: pollAbort.signal,
        });
        const payload = await parseJsonResponse<{
          status?: JobState;
          progressPct?: number;
          etaSec?: number;
          recoveryState?: RecoveryState;
          attemptCount?: number;
          qualityFlags?: string[];
          error?: string;
          artifactIds?: string[];
        }>(response);

        if (!response.ok || !payload?.status) {
          shouldPoll = false;
          prevJobStateRef.current = "failed";
          setJobState("failed");
          setRecoveryState(payload?.recoveryState ?? "none");
          setAttemptCount(payload?.attemptCount ?? 1);
          setQualityFlags(payload?.qualityFlags ?? []);
          setJobError(payload?.error ?? "Polling failed");
          return;
        }

        const backendStatus = payload.status;
        const wasQueued = prevJobStateRef.current === "queued";

        if (backendStatus === "failed") {
          shouldPoll = false;
          prevJobStateRef.current = "failed";
          setJobState("failed");
          setJobProgress(payload.progressPct ?? 0);
          setRecoveryState(payload.recoveryState ?? "none");
          setAttemptCount(payload.attemptCount ?? 1);
          setQualityFlags(payload.qualityFlags ?? []);
          setJobError(payload.error ?? "Processing failed");
          return;
        }

        if (backendStatus === "succeeded") {
          shouldPoll = false;

          if (wasQueued) {
            prevJobStateRef.current = "running";
            setJobState("running");
            setJobProgress(50);
            setJobEtaSec(null);

            bridgeTimerRef.current = setTimeout(async () => {
              if (cancelled) return;
              prevJobStateRef.current = "succeeded";
              setJobState("succeeded");
              setJobProgress(100);
              setRecoveryState(payload.recoveryState ?? "none");
              setAttemptCount(payload.attemptCount ?? 1);
              setQualityFlags(payload.qualityFlags ?? []);
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
            setRecoveryState(payload.recoveryState ?? "none");
            setAttemptCount(payload.attemptCount ?? 1);
            setQualityFlags(payload.qualityFlags ?? []);
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
        setRecoveryState(payload.recoveryState ?? "none");
        setAttemptCount(payload.attemptCount ?? 1);
        setQualityFlags(payload.qualityFlags ?? []);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        shouldPoll = false;
        prevJobStateRef.current = "failed";
        setJobState("failed");
        setRecoveryState("none");
        setJobError("Polling failed");
      } finally {
        pollAbort = null;
        if (!cancelled && shouldPoll) {
          scheduleNextPoll();
        }
      }
    };

    void pollOnce();

    return () => {
      cancelled = true;
      shouldPoll = false;
      clearPollTimer();
      pollAbort?.abort();
      if (bridgeTimerRef.current) clearTimeout(bridgeTimerRef.current);
    };
  }, [jobId, jobState, fetchArtifacts]);

  const smartRerunPresets = useMemo(() => {
    if (toolConfig.toolType === "stem_isolation") {
      return [
        { id: "stem_fast_retry", label: "Fast retry (2 stems)", description: "Reduces runtime pressure and queue risk." },
        { id: "stem_full_split", label: "Full split (4 stems)", description: "Retries with full separation for quality." },
      ];
    }

    if (toolConfig.toolType === "mastering") {
      return [
        { id: "mastering_clean", label: "Streaming clean", description: "Conservative mastering for reliability." },
        { id: "mastering_balanced", label: "Balanced intensity", description: "Caps intensity at 55% for safer first pass." },
      ];
    }

    if (toolConfig.toolType === "midi_extract") {
      return [
        { id: "midi_precise", label: "Precision mode", description: "Lower sensitivity to reduce false notes." },
        { id: "midi_dense", label: "Dense mode", description: "Higher sensitivity for note-rich passages." },
      ];
    }

    if (toolConfig.toolType === "loudness_report") {
      return [{ id: "loudness_safe", label: "Safe target", description: "Retry with -14 LUFS target baseline." }];
    }

    return [{ id: "keybpm_default", label: "Default analysis", description: "Retry with default chord hint behavior." }];
  }, [toolConfig.toolType]);

  const handleApplySmartRerun = useCallback(
    (presetId: string) => {
      let overrides: Partial<typeof currentControls> = {};

      if (presetId === "stem_fast_retry") {
        overrides = { stems: 2 };
        setStems(2);
      } else if (presetId === "stem_full_split") {
        overrides = { stems: 4 };
        setStems(4);
      } else if (presetId === "mastering_clean") {
        overrides = { masteringPreset: "streaming_clean", masteringIntensity: 45 };
        setMasteringPreset("streaming_clean");
        setMasteringIntensity(45);
      } else if (presetId === "mastering_balanced") {
        overrides = { masteringIntensity: 55 };
        setMasteringIntensity(55);
      } else if (presetId === "midi_precise") {
        overrides = { midiSensitivity: 0.35 };
        setMidiSensitivity(0.35);
      } else if (presetId === "midi_dense") {
        overrides = { midiSensitivity: 0.7 };
        setMidiSensitivity(0.7);
      } else if (presetId === "loudness_safe") {
        overrides = { targetLufs: -14 };
        setTargetLufs(-14);
      } else if (presetId === "keybpm_default") {
        overrides = { includeChordHints: true };
        setIncludeChordHints(true);
      }

      void handleCreateJob(overrides);
    },
    [currentControls, handleCreateJob],
  );

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
          ageConfirmed={ageConfirmed}
          uploadState={uploadState}
          uploadError={uploadError}
          uploadExpiry={uploadExpiry}
          canUpload={canUpload}
          onFileSelected={handleFileSelected}
          onRightsConfirmedChange={setRightsConfirmed}
          onAgeConfirmedChange={setAgeConfirmed}
          onUpload={handleUpload}
        />
      }
      processPanel={
        <ProcessPanel
          toolType={toolConfig.toolType}
          toolLabel={toolConfig.label}
          toolDescription={toolConfig.description}
          jobState={jobState}
          recoveryState={recoveryState}
          attemptCount={attemptCount}
          qualityFlags={qualityFlags}
          jobProgress={jobProgress}
          jobEtaSec={jobEtaSec}
          jobError={jobError}
          canRunTool={canRunTool}
          onRunTool={handleCreateJob}
          smartRerunPresets={smartRerunPresets}
          onApplySmartRerun={handleApplySmartRerun}
          hasRecentRunRecall={Boolean(recentRunPreset)}
          onUseRecentRunRecall={handleUseRecentRunRecall}
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
          jobId={jobId}
          recoveryState={recoveryState}
          qualityFlags={qualityFlags}
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
