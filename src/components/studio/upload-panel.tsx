"use client";

import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, FileAudioIcon, ShieldCheckIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { WaveformPlayer } from "@/components/waveform-player";
import { Button } from "@/components/ui/button";
import type { UploadState } from "@/components/studio/types";
import { cn } from "@/lib/utils";

type UploadPanelProps = {
  file: File | null;
  filePreviewUrl: string | null;
  rightsConfirmed: boolean;
  ageConfirmed: boolean;
  uploadState: UploadState;
  uploadProgressPct: number;
  uploadError: string | null;
  uploadExpiry: string | null;
  canUpload: boolean;
  onFileSelected: (file: File | null) => void;
  onRightsConfirmedChange: (value: boolean) => void;
  onAgeConfirmedChange: (value: boolean) => void;
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

function nextStep(args: { file: File | null; rightsConfirmed: boolean; ageConfirmed: boolean; uploadState: UploadState }) {
  if (args.uploadState === "preparing" || args.uploadState === "uploading") {
    return "Upload in progress — keep this tab open.";
  }
  if (args.uploadState === "uploaded") {
    return "Uploaded. Configure and run the tool.";
  }
  if (!args.file) return "Select an audio file to begin.";
  if (!args.rightsConfirmed) return "Confirm rights to enable upload.";
  if (!args.ageConfirmed) return "Confirm 18+ eligibility to enable upload.";
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
  ageConfirmed,
  uploadState,
  uploadProgressPct,
  uploadError,
  uploadExpiry,
  canUpload,
  onFileSelected,
  onRightsConfirmedChange,
  onAgeConfirmedChange,
  onUpload,
}: UploadPanelProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"] },
    maxFiles: 1,
    onDrop: (files) => onFileSelected(files[0] ?? null),
  });

  const busy = isBusy(uploadState);
  const clampedUploadPct = Math.max(0, Math.min(100, uploadProgressPct));
  const progressCircumference = 2 * Math.PI * 20;
  const progressOffset = progressCircumference * (1 - clampedUploadPct / 100);

  return (
    <section className="brutal-card p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="step-num">STEP 01</span>
          <h2 className="mt-1 text-2xl font-bold">Upload</h2>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={uploadState}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className={stateTagClass(uploadState)}
          >
            {uploadStateLabel(uploadState)}
          </motion.span>
        </AnimatePresence>
      </div>

      <hr className="section-rule mt-4 mb-4" />

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer border-2 border-dashed p-8 text-center transition-all duration-200",
          isDragActive
            ? "border-[var(--accent)] bg-[var(--muted)]"
            : "border-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--muted)]",
          busy && "pointer-events-none",
        )}
      >
        <input {...getInputProps()} />

        {/* Upload progress overlay */}
        <AnimatePresence>
          {busy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--background)]/90 z-10"
            >
              <div className="relative size-12">
                <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
                  <circle
                    cx="24" cy="24" r="20"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="3"
                  />
                  {uploadState === "preparing" ? (
                    <circle
                      cx="24" cy="24" r="20"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="3"
                      strokeLinecap="square"
                      strokeDasharray={progressCircumference}
                      strokeDashoffset={progressCircumference * 0.25}
                      className="animate-spin origin-center"
                      style={{ animationDuration: "1.5s" }}
                    />
                  ) : (
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="3"
                      strokeLinecap="square"
                      strokeDasharray={progressCircumference}
                      strokeDashoffset={progressOffset}
                      style={{ transition: "stroke-dashoffset 180ms linear" }}
                    />
                  )}
                </svg>
              </div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                {uploadState === "preparing" ? "Preparing upload..." : `Uploading audio... ${Math.round(clampedUploadPct)}%`}
              </p>
              <span className="processing-dot" /><span className="processing-dot" /><span className="processing-dot" />
            </motion.div>
          )}
        </AnimatePresence>

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

        <AnimatePresence>
          {file && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-4 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs font-semibold"
              style={{ borderColor: "var(--foreground)" }}
            >
              <FileAudioIcon className="size-3.5" />
              {file.name} · {readableSize(file.size)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Waveform */}
      <AnimatePresence>
        {filePreviewUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 overflow-hidden"
          >
            <WaveformPlayer src={filePreviewUrl} group="upload-preview-waveform" />
          </motion.div>
        )}
      </AnimatePresence>

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
            checked={ageConfirmed}
            onChange={(e) => onAgeConfirmedChange(e.target.checked)}
            aria-label="Age confirmation"
          />
          <span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4" style={{ color: "var(--muted-foreground)" }} />
              Age confirmation (18+)
            </span>
            <span
              className="mt-1 block text-xs leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              I confirm I am 18+ and allowed to use this service.
            </span>
          </span>
        </label>
      </div>

      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        By using SoundMaxx, you agree to{" "}
        <a href="/terms" className="underline underline-offset-2">
          Terms
        </a>{" "}
        +{" "}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy
        </a>
        , including model training use of uploaded/produced audio and aggregated analytics use.
      </p>

      {/* Upload button */}
      <div className="mt-5">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="busy"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                disabled
                className="brutal-button-primary w-full justify-center py-3.5 text-xs"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "var(--foreground)", borderColor: "var(--foreground)" }}
              >
                <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {uploadState === "preparing" ? "Preparing..." : "Uploading..."}
              </Button>
            </motion.div>
          ) : uploadState === "uploaded" ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                disabled
                className="brutal-button-primary w-full justify-center py-3.5 text-xs"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.1 }}
                >
                  <CheckCircleIcon className="size-3.5" />
                </motion.div>
                Uploaded Successfully
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={onUpload}
                disabled={!canUpload}
                className="brutal-button-primary w-full justify-center py-3.5 text-xs"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <UploadIcon className="size-3.5" />
                Upload Audio
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {uploadExpiry ? (
        <p className="mt-2.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
          Expires {new Date(uploadExpiry).toLocaleString()}
        </p>
      ) : null}

      <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
        {nextStep({ file, rightsConfirmed, ageConfirmed, uploadState })}
      </p>

      <AnimatePresence>
        {uploadError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 font-mono text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--destructive)" }}
          >
            {uploadError}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
