"use client";

import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { WaveformPlayer } from "@/components/waveform-player";
import type { UploadInitResponse } from "@/types/api";
import type { MasteringPreset, ToolType } from "@/types/domain";

type UploadState = "idle" | "preparing" | "uploading" | "uploaded" | "failed";
type JobState = "idle" | "queued" | "running" | "succeeded" | "failed";

type ArtifactView = {
  id: string;
  downloadUrl: string;
  expiresAt: string;
};

const toolLabels: Record<ToolType, string> = {
  stem_isolation: "Stem Isolation",
  mastering: "Mastering",
  key_bpm: "Key + BPM Detection",
  loudness_report: "Loudness Report",
  midi_extract: "MIDI Extraction",
};

const toolDescriptions: Record<ToolType, string> = {
  stem_isolation: "Separate vocals, drums, bass, and accompaniment with high-quality source separation.",
  mastering: "Balance loudness, impact, and tonal shape for streaming and release-ready masters.",
  key_bpm: "Extract harmonic and tempo metadata for arrangement, remixing, and DAW prep.",
  loudness_report: "Measure LUFS, true peak, dynamic range, and clipping risk against target standards.",
  midi_extract: "Convert melodic and harmonic content into editable MIDI note sequences.",
};

const masteringPresets: MasteringPreset[] = [
  "streaming_clean",
  "club_loud",
  "warm_analog",
  "reference_match",
];

function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function jobTone(state: JobState) {
  if (state === "succeeded") return "text-emerald-700";
  if (state === "failed") return "text-rose-700";
  if (state === "queued" || state === "running") return "text-amber-700";
  return "text-slate-600";
}

export function SoundmaxxDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [uploadExpiry, setUploadExpiry] = useState<string | null>(null);

  const [toolType, setToolType] = useState<ToolType>("stem_isolation");
  const [stems, setStems] = useState<2 | 4>(4);
  const [masteringPreset, setMasteringPreset] = useState<MasteringPreset>("streaming_clean");
  const [masteringIntensity, setMasteringIntensity] = useState(70);
  const [includeChordHints, setIncludeChordHints] = useState(true);
  const [targetLufs, setTargetLufs] = useState(-14);
  const [midiSensitivity, setMidiSensitivity] = useState(0.5);

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const picked = acceptedFiles[0] ?? null;
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
    },
  });

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

      const initBodyRaw = (await initResponse.json()) as UploadInitResponse | { error: string; details?: unknown };
      if (!initResponse.ok) {
        throw new Error("error" in initBodyRaw ? initBodyRaw.error : "Upload init failed");
      }

      const initBody = initBodyRaw as UploadInitResponse;

      setUploadState("uploading");
      const form = new FormData();
      form.set("file", file);

      const contentResponse = await fetch(initBody.uploadUrl, {
        method: "PUT",
        body: form,
      });

      const contentBody = (await contentResponse.json()) as { error?: string };
      if (!contentResponse.ok) {
        throw new Error(contentBody.error ?? "Audio upload failed");
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
          toolType,
          params: toolParams({
            toolType,
            stems,
            masteringPreset,
            masteringIntensity,
            includeChordHints,
            targetLufs,
            midiSensitivity,
          }),
        }),
      });

      const payload = (await response.json()) as { jobId?: string; status?: JobState; error?: string };
      if (!response.ok || !payload.jobId || !payload.status) {
        throw new Error(payload.error ?? "Unable to create job");
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
      const payload = (await response.json()) as {
        status?: JobState;
        progressPct?: number;
        etaSec?: number;
        error?: string;
        artifactIds?: string[];
      };

      if (!response.ok || !payload.status) {
        setJobState("failed");
        setJobError(payload.error ?? "Polling failed");
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
              const artifactPayload = (await artifactResponse.json()) as {
                downloadUrl?: string;
                expiresAt?: string;
              };

              if (!artifactResponse.ok || !artifactPayload.downloadUrl || !artifactPayload.expiresAt) {
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 pb-20 pt-8 md:px-6">
      <section className="studio-shell animate-rise rounded-[28px] border border-white/50 px-6 py-8 shadow-[0_30px_120px_-55px_rgba(20,40,70,0.65)] md:px-8">
        <div className="grid gap-7 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <p className="inline-flex rounded-full border border-[#1f4f6f]/30 bg-white/70 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1f4f6f]">
              SoundMaxx Studio
            </p>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] text-[#112638] md:text-5xl">
              Production-grade audio tooling with your own open-source model stack.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-[#355064] md:text-base">
              Upload once, isolate stems, master with your chosen engine, run analysis, and keep ownership of inference infrastructure and training data collection.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#1e4d7f]/20 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#40637a]">Latency Mode</p>
                <p className="mt-1 text-sm font-semibold text-[#112638]">Quality-first async</p>
              </div>
              <div className="rounded-2xl border border-[#1e4d7f]/20 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#40637a]">Retention</p>
                <p className="mt-1 text-sm font-semibold text-[#112638]">24h auto-expiry</p>
              </div>
              <div className="rounded-2xl border border-[#1e4d7f]/20 bg-white/80 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#40637a]">Ownership</p>
                <p className="mt-1 text-sm font-semibold text-[#112638]">Self-hosted worker</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#1e4d7f]/20 bg-white/75 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[#48677c]">Workflow</p>
            <ol className="mt-3 grid gap-3">
              {[
                "Upload source audio",
                "Choose processing chain",
                "Track status + ETA",
                "A/B compare and export",
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3 rounded-xl border border-[#d0e3f1] bg-[#f5fbff] px-3 py-2 text-sm text-[#1d3d53]">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#155f91] text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="studio-panel animate-rise rounded-3xl border border-white/50 p-6">
          <header className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#132f44]">1. Upload</h2>
              <p className="mt-1 text-sm text-[#426076]">Audio ingest, rights validation, and consent controls.</p>
            </div>
            <span className="rounded-full border border-[#7db0ce]/40 bg-[#e6f6ff] px-3 py-1 text-xs font-semibold text-[#1f5878]">
              {uploadState.toUpperCase()}
            </span>
          </header>

          <div
            {...getRootProps()}
            className="mt-5 cursor-pointer rounded-2xl border-2 border-dashed border-[#7ab7db] bg-white/70 px-5 py-6 transition hover:border-[#348fc3] hover:bg-white"
          >
            <input {...getInputProps()} />
            <p className="text-sm font-semibold text-[#20445d]">
              {isDragActive ? "Drop your file to stage the upload" : "Drag and drop audio or click to browse"}
            </p>
            <p className="mt-2 text-xs text-[#516a7b]">WAV, MP3, FLAC, AAC, OGG, M4A. Max 100MB and 15 minutes.</p>
            {file ? (
              <p className="mt-4 inline-flex rounded-full border border-[#88bad7] bg-[#f4fbff] px-3 py-1 text-xs font-medium text-[#1d4f6f]">
                {file.name} · {readableSize(file.size)}
              </p>
            ) : null}
          </div>

          {filePreviewUrl ? <div className="mt-4"><WaveformPlayer src={filePreviewUrl} /></div> : null}

          <div className="mt-4 grid gap-3">
            <label className="flex gap-3 rounded-xl border border-[#cbe2f1] bg-white/70 p-3 text-sm text-[#26475e]">
              <input
                type="checkbox"
                className="mt-1"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
              />
              <span>I own rights or have permission to process this audio.</span>
            </label>
            <label className="flex gap-3 rounded-xl border border-[#cbe2f1] bg-white/70 p-3 text-sm text-[#26475e]">
              <input
                type="checkbox"
                className="mt-1"
                checked={trainingConsent}
                onChange={(event) => setTrainingConsent(event.target.checked)}
              />
              <span>Allow this track and outputs in a consented dataset for future model tuning.</span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
              className="rounded-xl bg-[#0f628f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b5377] disabled:cursor-not-allowed disabled:bg-[#9fc5da]"
            >
              {uploadState === "preparing"
                ? "Preparing…"
                : uploadState === "uploading"
                  ? "Uploading…"
                  : "Upload Audio"}
            </button>
            {uploadExpiry ? (
              <span className="rounded-full border border-[#b9d7ea] bg-[#f5fbff] px-3 py-1 text-xs text-[#2d5067]">
                Expires {new Date(uploadExpiry).toLocaleString()}
              </span>
            ) : null}
          </div>

          {uploadError ? <p className="mt-3 text-sm font-medium text-rose-700">{uploadError}</p> : null}
        </section>

        <section className="studio-panel animate-rise rounded-3xl border border-white/50 p-6">
          <header className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#132f44]">2. Process</h2>
              <p className="mt-1 text-sm text-[#426076]">Tool selection, parameters, and queued execution.</p>
            </div>
            <span className={`rounded-full border border-[#7db0ce]/40 bg-[#f4fbff] px-3 py-1 text-xs font-semibold ${jobTone(jobState)}`}>
              {jobState.toUpperCase()}
            </span>
          </header>

          <div className="mt-5 grid gap-4">
            <label className="text-sm font-semibold text-[#1e435b]" htmlFor="tool-type">
              Tool
            </label>
            <select
              id="tool-type"
              value={toolType}
              onChange={(event) => setToolType(event.target.value as ToolType)}
              className="rounded-xl border border-[#9ec4da] bg-white px-3 py-2 text-sm text-[#16354a]"
            >
              {Object.entries(toolLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="rounded-xl border border-[#d2e7f5] bg-white/80 px-3 py-2 text-xs text-[#45627b]">
              {toolDescriptions[toolType]}
            </p>

            {toolType === "stem_isolation" ? (
              <label className="text-sm text-[#1e435b]">
                Stem count
                <select
                  value={stems}
                  onChange={(event) => setStems(Number(event.target.value) as 2 | 4)}
                  className="mt-1 w-full rounded-xl border border-[#9ec4da] bg-white px-3 py-2"
                >
                  <option value={2}>2 stems (faster)</option>
                  <option value={4}>4 stems (full split)</option>
                </select>
              </label>
            ) : null}

            {toolType === "mastering" ? (
              <div className="grid gap-3">
                <label className="text-sm text-[#1e435b]">
                  Mastering profile
                  <select
                    value={masteringPreset}
                    onChange={(event) => setMasteringPreset(event.target.value as MasteringPreset)}
                    className="mt-1 w-full rounded-xl border border-[#9ec4da] bg-white px-3 py-2"
                  >
                    {masteringPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-[#1e435b]">
                  Intensity ({masteringIntensity})
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masteringIntensity}
                    onChange={(event) => setMasteringIntensity(Number(event.target.value))}
                    className="mt-2 w-full accent-[#0f628f]"
                  />
                </label>
              </div>
            ) : null}

            {toolType === "key_bpm" ? (
              <label className="flex items-center gap-2 rounded-xl border border-[#cce3f2] bg-white/70 px-3 py-2 text-sm text-[#1e435b]">
                <input
                  type="checkbox"
                  checked={includeChordHints}
                  onChange={(event) => setIncludeChordHints(event.target.checked)}
                />
                Include chord hints
              </label>
            ) : null}

            {toolType === "loudness_report" ? (
              <label className="text-sm text-[#1e435b]">
                Target LUFS
                <input
                  type="number"
                  step={0.1}
                  min={-24}
                  max={-6}
                  value={targetLufs}
                  onChange={(event) => setTargetLufs(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-[#9ec4da] bg-white px-3 py-2"
                />
              </label>
            ) : null}

            {toolType === "midi_extract" ? (
              <label className="text-sm text-[#1e435b]">
                Sensitivity ({midiSensitivity.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={midiSensitivity}
                  onChange={(event) => setMidiSensitivity(Number(event.target.value))}
                  className="mt-2 w-full accent-[#0f628f]"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={handleCreateJob}
              disabled={!canRunTool}
              className="rounded-xl bg-[#152838] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f1d2a] disabled:cursor-not-allowed disabled:bg-[#8ea8bb]"
            >
              {jobState === "queued" || jobState === "running" ? "Processing…" : `Run ${toolLabels[toolType]}`}
            </button>

            <div className="rounded-2xl border border-[#c8deee] bg-white/80 px-4 py-3" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#20465f]">Pipeline status</span>
                <span className={`font-semibold ${jobTone(jobState)}`}>{jobState}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#e2f1fa]">
                <div className="h-2 rounded-full bg-[#0f628f] transition-all duration-500" style={{ width: `${jobProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-[#4f6d82]">
                {jobEtaSec !== null ? `Estimated time remaining: ${jobEtaSec}s` : "Awaiting processing telemetry"}
              </p>
              {jobError ? <p className="mt-2 text-sm font-medium text-rose-700">{jobError}</p> : null}
            </div>
          </div>
        </section>
      </div>

      <section className="studio-shell animate-rise rounded-3xl border border-white/60 p-6">
        <h3 className="text-lg font-semibold text-[#132f44]">3. Results and A/B Compare</h3>
        <p className="mt-1 text-sm text-[#45627a]">Review artifacts, preview processed output, and export before auto-expiry.</p>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#c9dfef] bg-white/85 p-4">
            <p className="text-sm font-semibold text-[#1a3f57]">A/B Playback</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#d2e7f5] bg-[#f8fcff] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#4d6b81]">Original</p>
                <audio controls className="mt-2 w-full" src={filePreviewUrl ?? undefined} />
              </div>
              <div className="rounded-xl border border-[#d2e7f5] bg-[#f8fcff] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#4d6b81]">Processed</p>
                <audio controls className="mt-2 w-full" src={artifacts[0]?.downloadUrl} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#c9dfef] bg-white/85 p-4">
            <p className="text-sm font-semibold text-[#1a3f57]">Artifacts</p>
            {artifacts.length === 0 ? (
              <p className="mt-3 text-sm text-[#546f82]">No artifacts yet. Run a tool to generate outputs.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {artifacts.map((artifact, index) => (
                  <article key={artifact.id} className="rounded-xl border border-[#d5e8f5] bg-[#f8fcff] p-3">
                    <p className="text-sm font-semibold text-[#16384e]">Output {index + 1}</p>
                    <p className="mt-1 text-xs text-[#567286]">Expires {new Date(artifact.expiresAt).toLocaleString()}</p>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={artifact.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-[#0f628f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0b5377]"
                      >
                        Open
                      </a>
                      <a
                        href={artifact.downloadUrl}
                        download
                        className="rounded-lg border border-[#9fc0d6] bg-white px-3 py-2 text-xs font-semibold text-[#1c4762] hover:bg-[#eef7fd]"
                      >
                        Download
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="px-1 text-xs text-[#4e687c]">
        Job ID: <span className="font-mono">{jobId ?? "not started"}</span>
      </footer>
    </div>
  );
}
