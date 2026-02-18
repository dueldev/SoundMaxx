"use client";

import { useDropzone } from "react-dropzone";
import { CheckIcon, FileAudioIcon, ShieldCheckIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { WaveformPlayer } from "@/components/waveform-player";
import { Button } from "@/components/ui/button";
import type { UploadState } from "@/components/studio/types";
import { cn } from "@/lib/utils";

type UploadPanelProps = {
  file: File | null;
  filePreviewUrl: string | null;
  rightsConfirmed: boolean;
  trainingConsent: boolean;
  uploadState: UploadState;
  uploadError: string | null;
  uploadExpiry: string | null;
  canUpload: boolean;
  onFileSelected: (file: File | null) => void;
  onRightsConfirmedChange: (value: boolean) => void;
  onTrainingConsentChange: (value: boolean) => void;
  onUpload: () => void;
};

function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadStateLabel(state: UploadState) {
  if (state === "preparing") return "PREPARING";
  if (state === "uploading") return "UPLOADING";
  if (state === "uploaded") return "UPLOADED";
  if (state === "failed") return "FAILED";
  return "IDLE";
}

function nextStep(args: { file: File | null; rightsConfirmed: boolean; uploadState: UploadState }) {
  if (args.uploadState === "preparing" || args.uploadState === "uploading") {
    return "Upload in progress — keep this tab open.";
  }
  if (args.uploadState === "uploaded") {
    return "Uploaded. Configure and run the tool.";
  }
  if (!args.file) return "Select an audio file to begin.";
  if (!args.rightsConfirmed) return "Confirm rights to enable upload.";
  return "Ready to upload.";
}

function stateTagClass(state: UploadState) {
  if (state === "uploaded") return "tag tag-ok";
  if (state === "failed") return "tag tag-error";
  if (state === "uploading" || state === "preparing") return "tag tag-warn";
  return "tag";
}

const isBusy = (s: UploadState) => s === "preparing" || s === "uploading";

export function UploadPanel({
  file,
  filePreviewUrl,
  rightsConfirmed,
  trainingConsent,
  uploadState,
  uploadError,
  uploadExpiry,
  canUpload,
  onFileSelected,
  onRightsConfirmedChange,
  onTrainingConsentChange,
  onUpload,
}: UploadPanelProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"] },
    maxFiles: 1,
    onDrop: (files) => onFileSelected(files[0] ?? null),
  });

  const busy = isBusy(uploadState);

  return (
    <section className="brutal-card p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="step-num">STEP 01</span>
          <h2 className="mt-1 text-2xl font-bold">Upload</h2>
        </div>
        <span className={stateTagClass(uploadState)}>
          {uploadStateLabel(uploadState)}
        </span>
      </div>

      <hr className="section-rule mt-4 mb-4" />

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer border-2 border-dashed p-8 text-center transition-colors duration-150",
          isDragActive
            ? "border-[var(--accent)] bg-[var(--muted)]"
            : "border-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--muted)]",
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon
          className="mx-auto mb-3 size-7"
          style={{ color: isDragActive ? "var(--accent)" : "var(--muted-foreground)" }}
        />
        <p className="text-sm font-semibold">
          {isDragActive ? "Drop to stage" : "Drop audio here or click to browse"}
        </p>
        <p className="mt-1.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
          WAV · MP3 · FLAC · AAC · OGG · M4A · Max 100 MB · 15 min
        </p>

        {file ? (
          <span
            className="mt-4 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs font-semibold"
            style={{ borderColor: "var(--foreground)" }}
          >
            <FileAudioIcon className="size-3.5" />
            {file.name} · {readableSize(file.size)}
          </span>
        ) : null}
      </div>

      {/* Waveform */}
      {filePreviewUrl ? (
        <div className="mt-4">
          <WaveformPlayer src={filePreviewUrl} />
        </div>
      ) : null}

      {/* Consent */}
      <div className="mt-4 flex flex-col gap-2">
        <label
          className="flex cursor-pointer gap-3.5 border p-4 transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--muted)" }}
        >
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={rightsConfirmed}
            onChange={(e) => onRightsConfirmedChange(e.target.checked)}
            aria-label="Rights confirmation"
          />
          <span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <ShieldCheckIcon className="size-4" style={{ color: "var(--accent)" }} />
              Rights confirmation
            </span>
            <span
              className="mt-1 block text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              I own rights or have permission to process this audio.
            </span>
          </span>
        </label>

        <label
          className="flex cursor-pointer gap-3.5 border p-4 transition-colors hover:bg-[var(--muted)]"
          style={{ borderColor: "var(--muted)" }}
        >
          <input
            type="checkbox"
            className="mt-0.5 shrink-0"
            checked={trainingConsent}
            onChange={(e) => onTrainingConsentChange(e.target.checked)}
            aria-label="Optional dataset consent"
          />
          <span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
              Optional dataset consent
            </span>
            <span
              className="mt-1 block text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              Allow this track in a consented dataset for future model tuning.
            </span>
          </span>
        </label>
      </div>

      {/* Upload button */}
      <div className="mt-5">
        <Button
          onClick={onUpload}
          disabled={!canUpload}
          className="brutal-button-primary w-full justify-center py-3.5 text-xs"
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          {busy ? (
            <>
              <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {uploadState === "preparing" ? "Preparing…" : "Uploading…"}
            </>
          ) : uploadState === "uploaded" ? (
            <>
              <CheckIcon className="size-3.5" />
              Uploaded
            </>
          ) : (
            <>
              <UploadIcon className="size-3.5" />
              Upload Audio
            </>
          )}
        </Button>
      </div>

      {uploadExpiry ? (
        <p className="mt-2.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
          Expires {new Date(uploadExpiry).toLocaleString()}
        </p>
      ) : null}

      <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
        {nextStep({ file, rightsConfirmed, uploadState })}
      </p>

      {uploadError ? (
        <p
          className="mt-3 font-mono text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--destructive)" }}
        >
          ⚠ {uploadError}
        </p>
      ) : null}
    </section>
  );
}
