"use client";

import { useDropzone } from "react-dropzone";
import { CheckCircle2Icon, CloudUploadIcon, FileAudioIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
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
  if (state === "preparing") return "Preparing";
  if (state === "uploading") return "Uploading";
  if (state === "uploaded") return "Uploaded";
  if (state === "failed") return "Failed";
  return "Waiting";
}

function uploadNextStep(args: { file: File | null; rightsConfirmed: boolean; uploadState: UploadState }) {
  if (args.uploadState === "preparing" || args.uploadState === "uploading") {
    return "Upload in progress. Keep this tab open until completion.";
  }
  if (args.uploadState === "uploaded") {
    return "Upload complete. Configure process settings and run the tool.";
  }
  if (!args.file) {
    return "Select one audio file to start.";
  }
  if (!args.rightsConfirmed) {
    return "Confirm rights to enable upload.";
  }
  return "Ready to upload.";
}

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
    accept: {
      "audio/*": [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      onFileSelected(acceptedFiles[0] ?? null);
    },
  });

  return (
    <section className="smx-frame p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">1. Upload</h2>
          <p className="smx-kicker mt-2">Stage source, confirm rights, then upload.</p>
        </div>
        <span className="smx-chip">
          {uploadState === "uploaded" ? <CheckCircle2Icon className="size-3.5 text-primary" /> : null}
          {uploadStateLabel(uploadState)}
        </span>
      </header>

      <div
        {...getRootProps()}
        className={cn(
          "smx-subframe mt-4 cursor-pointer border-2 border-dashed p-5 transition",
          "border-border bg-background/72 hover:border-[color-mix(in_srgb,var(--brand-cobalt)_42%,var(--border))]",
          isDragActive && "border-[color-mix(in_srgb,var(--brand-cobalt)_62%,var(--border))] bg-accent/10",
        )}
      >
        <input {...getInputProps()} />
        <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <CloudUploadIcon className="size-4" />
          {isDragActive ? "Drop file to stage upload" : "Drag and drop audio or click to browse"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">WAV, MP3, FLAC, AAC, OGG, M4A. Max 100MB and 15 minutes.</p>

        {file ? (
          <p className="smx-chip mt-3">
            <FileAudioIcon className="size-3.5 text-primary" />
            {file.name} • {readableSize(file.size)}
          </p>
        ) : null}
      </div>

      {filePreviewUrl ? (
        <div className="mt-4">
          <WaveformPlayer src={filePreviewUrl} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        <label className="smx-subframe flex gap-3 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={rightsConfirmed}
            onChange={(event) => onRightsConfirmedChange(event.target.checked)}
          />
          <span>
            <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <ShieldCheckIcon className="size-4 text-primary" />
              Rights confirmation
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">I own rights or have permission to process this audio.</span>
          </span>
        </label>

        <label className="smx-subframe flex gap-3 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={trainingConsent}
            onChange={(event) => onTrainingConsentChange(event.target.checked)}
          />
          <span>
            <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <SparklesIcon className="size-4 text-primary" />
              Optional dataset consent
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Allow this track and outputs in a consented dataset for future model tuning.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={onUpload} disabled={!canUpload} className="smx-button-primary rounded-md px-4 py-2 text-[11px]">
          {uploadState === "preparing" ? "Preparing..." : uploadState === "uploading" ? "Uploading..." : "Upload Audio"}
        </Button>
        {uploadExpiry ? <span className="smx-chip">Expires {new Date(uploadExpiry).toLocaleString()}</span> : null}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{uploadNextStep({ file, rightsConfirmed, uploadState })}</p>

      {uploadError ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive">{uploadError}</p> : null}
    </section>
  );
}
