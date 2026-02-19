"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, LoaderIcon, PlayIcon, ZapIcon } from "lucide-react";
import { MASTERING_PRESETS, type MasteringPreset, type ToolType } from "@/types/domain";
import type { JobState, RecoveryState } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SmartRerunPreset = {
  id: string;
  label: string;
  description: string;
};

type ProcessPanelProps = {
  toolType: ToolType;
  toolLabel: string;
  toolDescription: string;
  jobState: JobState;
  recoveryState: RecoveryState;
  attemptCount: number;
  qualityFlags: string[];
  jobProgress: number;
  jobEtaSec: number | null;
  jobError: string | null;
  canRunTool: boolean;
  onRunTool: () => void;
  smartRerunPresets: SmartRerunPreset[];
  onApplySmartRerun: (presetId: string) => void;
  hasRecentRunRecall: boolean;
  onUseRecentRunRecall: () => void;
  stems: 2 | 4;
  masteringPreset: MasteringPreset;
  masteringIntensity: number;
  includeChordHints: boolean;
  targetLufs: number;
  midiSensitivity: number;
  onStemsChange: (value: 2 | 4) => void;
  onMasteringPresetChange: (value: MasteringPreset) => void;
  onMasteringIntensityChange: (value: number) => void;
  onIncludeChordHintsChange: (value: boolean) => void;
  onTargetLufsChange: (value: number) => void;
  onMidiSensitivityChange: (value: number) => void;
};

const PIPELINE_STAGES = ["Queued", "Processing", "Complete"] as const;

function getStageFromState(state: JobState): number {
  if (state === "queued") return 0;
  if (state === "running") return 1;
  if (state === "succeeded") return 2;
  return -1;
}

function getStatusMessage(state: JobState, toolLabel: string, progress: number, etaSec: number | null): string {
  if (state === "queued") return "Queued — waiting for a worker to pick up the job";
  if (state === "running") {
    const pct = progress > 0 ? ` — ${progress}% reported` : "";
    const eta = etaSec !== null ? ` · ETA ${etaSec}s` : "";
    return `Processing ${toolLabel.toLowerCase()}${pct}${eta}`;
  }
  if (state === "succeeded") return "Processing complete — artifacts ready";
  if (state === "failed") return "Processing failed";
  return "Ready to process";
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stateTagClass(state: JobState) {
  if (state === "succeeded") return "tag tag-ok";
  if (state === "failed") return "tag tag-error";
  if (state === "queued" || state === "running") return "tag tag-warn";
  return "tag";
}

function trustRibbon(recoveryState: RecoveryState, qualityFlags: string[], attemptCount: number, jobState: JobState) {
  if (recoveryState === "retrying") {
    return {
      label: "Recovering",
      tone: "tag tag-warn",
      message: `Automatic retry in progress (attempt ${attemptCount}).`,
    };
  }

  if (recoveryState === "degraded_fallback" || qualityFlags.includes("fallback_passthrough_output")) {
    return {
      label: "Fallback Output",
      tone: "tag tag-error",
      message: "Output may be degraded. Use a smart rerun preset for better first-pass quality.",
    };
  }

  if (recoveryState === "failed_after_retry") {
    return {
      label: "Failed After Retry",
      tone: "tag tag-error",
      message: "Automatic retry was attempted and failed. Try a guided rerun preset.",
    };
  }

  if (jobState === "failed") {
    return {
      label: "Failed",
      tone: "tag tag-error",
      message: "This run failed. Apply a guided rerun preset before retrying.",
    };
  }

  return {
    label: "Healthy",
    tone: "tag tag-ok",
    message: "Pipeline is healthy for this run.",
  };
}

function ControlLabel({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{ color: "var(--muted-foreground)" }}
    >
      {label}
    </label>
  );
}

function ProcessingWaveform() {
  const bars = 12;
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 24 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="processing-waveform-bar"
          style={{
            height: `${40 + Math.sin(i * 0.8) * 40 + 20}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

function PipelineTimeline({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {PIPELINE_STAGES.map((stage, i) => {
        const isCompleted = activeIndex >= 0 && i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={stage} className="flex items-center" style={{ flex: i < PIPELINE_STAGES.length - 1 ? 1 : 0 }}>
            <div
              className={cn(
                "pipeline-stage",
                isCompleted && "completed",
                isActive && "active",
              )}
            >
              <div className="pipeline-stage-dot">
                {isCompleted && (
                  <CheckIcon className="size-[6px] text-background" style={{ margin: "auto", display: "block", marginTop: 0.5 }} />
                )}
              </div>
              <span className="whitespace-nowrap">{stage}</span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div
                className={cn(
                  "pipeline-connector",
                  isCompleted && "filled",
                  isActive && "filling",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProcessPanel({
  toolType,
  toolLabel,
  toolDescription,
  jobState,
  recoveryState,
  attemptCount,
  qualityFlags,
  jobProgress,
  jobEtaSec,
  jobError,
  canRunTool,
  onRunTool,
  smartRerunPresets,
  onApplySmartRerun,
  hasRecentRunRecall,
  onUseRecentRunRecall,
  stems,
  masteringPreset,
  masteringIntensity,
  includeChordHints,
  targetLufs,
  midiSensitivity,
  onStemsChange,
  onMasteringPresetChange,
  onMasteringIntensityChange,
  onIncludeChordHintsChange,
  onTargetLufsChange,
  onMidiSensitivityChange,
}: ProcessPanelProps) {
  const isWorking = jobState === "queued" || jobState === "running";
  const clampedProgress = Math.max(0, Math.min(100, jobProgress));
  const activeStageIndex = getStageFromState(jobState);
  const statusMessage = getStatusMessage(jobState, toolLabel, clampedProgress, jobEtaSec);
  const trust = trustRibbon(recoveryState, qualityFlags, attemptCount, jobState);

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isWorking) {
      startTimeRef.current = null;
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isWorking]);

  const showStatus = isWorking || jobState === "succeeded" || jobState === "failed";

  return (
    <section
      className={cn(
        "brutal-card flex flex-col p-5 md:p-6 transition-all duration-500",
        isWorking && "processing-pulse",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="step-num">STEP 02</span>
          <h2 className="mt-1 text-2xl font-bold">Configure + Run</h2>
        </div>
        <span className={stateTagClass(jobState)}>
          {jobState.toUpperCase()}
        </span>
      </div>

      <hr className="section-rule mt-4 mb-4" />

      {/* Tool info */}
      <div className="mb-5">
        <p className="text-base font-bold">{toolLabel}</p>
        <p className="mt-1 text-base" style={{ color: "var(--muted-foreground)" }}>
          {toolDescription}
        </p>
      </div>

      <div className="mb-4 border p-3" style={{ borderColor: "var(--muted)" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Runtime Trust</p>
          <span className={trust.tone}>{trust.label}</span>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {trust.message}
        </p>
        <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          Attempt {attemptCount} · Flags {qualityFlags.length > 0 ? qualityFlags.join(", ") : "none"}
        </p>
      </div>

      {hasRecentRunRecall ? (
        <div className="mb-4">
          <Button
            onClick={onUseRecentRunRecall}
            variant="outline"
            className="brutal-button-ghost w-full justify-center py-3 text-[11px]"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            Use Recent Run Settings
          </Button>
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex flex-col gap-5 flex-1">
        {toolType === "stem_isolation" && (
          <div>
            <ControlLabel htmlFor="stem-count" label="Stem Count" />
            <select
              id="stem-count"
              value={stems}
              onChange={(e) => onStemsChange(Number(e.target.value) as 2 | 4)}
              className="brutal-input"
              aria-label="Stem count"
            >
              <option value={2}>2 stems (faster)</option>
              <option value={4}>4 stems (full split)</option>
            </select>
          </div>
        )}

        {toolType === "mastering" && (
          <>
            <div>
              <ControlLabel htmlFor="mastering-preset" label="Mastering Profile" />
              <select
                id="mastering-preset"
                value={masteringPreset}
                onChange={(e) => onMasteringPresetChange(e.target.value as MasteringPreset)}
                className="brutal-input"
                aria-label="Mastering profile"
              >
                {MASTERING_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <ControlLabel htmlFor="mastering-intensity" label="Intensity" />
                <span className="font-mono text-sm font-bold">{masteringIntensity}%</span>
              </div>
              <input
                id="mastering-intensity"
                type="range"
                min={0}
                max={100}
                value={masteringIntensity}
                onChange={(e) => onMasteringIntensityChange(Number(e.target.value))}
                aria-label="Mastering intensity"
              />
            </div>
          </>
        )}

        {toolType === "key_bpm" && (
          <label className="flex cursor-pointer items-center gap-3 border p-3.5 hover:bg-[var(--muted)] transition-colors" style={{ borderColor: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={includeChordHints}
              onChange={(e) => onIncludeChordHintsChange(e.target.checked)}
              aria-label="Include chord hints"
            />
            <span className="text-sm font-semibold">Include chord hints</span>
          </label>
        )}

        {toolType === "loudness_report" && (
          <div>
            <ControlLabel htmlFor="target-lufs" label="Target LUFS" />
            <input
              id="target-lufs"
              type="number"
              step={0.1}
              min={-24}
              max={-6}
              value={targetLufs}
              onChange={(e) => onTargetLufsChange(Number(e.target.value))}
              className="brutal-input"
              aria-label="Target LUFS"
            />
          </div>
        )}

        {toolType === "midi_extract" && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <ControlLabel htmlFor="midi-sensitivity" label="Sensitivity" />
              <span className="font-mono text-sm font-bold">{midiSensitivity.toFixed(2)}</span>
            </div>
            <input
              id="midi-sensitivity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={midiSensitivity}
              onChange={(e) => onMidiSensitivityChange(Number(e.target.value))}
              aria-label="MIDI sensitivity"
            />
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="mt-6">
        {smartRerunPresets.length > 0 && (jobState === "failed" || recoveryState === "degraded_fallback" || jobState === "succeeded") ? (
          <div className="mb-3 grid gap-2">
            {smartRerunPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplySmartRerun(preset.id)}
                className="w-full border px-3 py-2 text-left transition-colors hover:bg-[var(--muted)]"
                style={{ borderColor: "var(--muted)" }}
              >
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">{preset.label}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {isWorking ? (
            <motion.div
              key="working"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <Button
                disabled
                className={cn(
                  "brutal-button-primary w-full justify-center py-4 text-xs",
                )}
                style={{
                  display: "flex",
                  gap: "0.625rem",
                  alignItems: "center",
                  background: "var(--foreground)",
                  borderColor: "var(--foreground)",
                }}
              >
                <LoaderIcon className="size-3.5 animate-spin" />
                Processing...
              </Button>
            </motion.div>
          ) : jobState === "succeeded" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <Button
                onClick={onRunTool}
                disabled={!canRunTool}
                className="brutal-button-primary w-full justify-center py-4 text-xs"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <CheckIcon className="size-3.5" />
                Done — Run Again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <Button
                onClick={onRunTool}
                disabled={!canRunTool}
                className="brutal-button-primary w-full justify-center py-4 text-xs"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <PlayIcon className="size-3.5" />
                Run {toolLabel}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {!canRunTool && !isWorking && jobState !== "succeeded" ? (
          <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
            Upload audio first to enable processing.
          </p>
        ) : null}
      </div>

      {/* Pipeline status */}
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 20 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn("border p-4 transition-colors duration-300")}
              style={{
                borderColor: isWorking
                  ? "var(--accent)"
                  : jobState === "succeeded"
                    ? "var(--foreground)"
                    : jobState === "failed"
                      ? "var(--destructive)"
                      : "var(--muted)",
              }}
              aria-live="polite"
            >
              {/* Pipeline stage timeline */}
              <div className="mb-4">
                <PipelineTimeline activeIndex={activeStageIndex} />
              </div>

              {/* Progress bar — actual backend value, CSS-transitioned */}
              <div className="brutal-progress-track">
                <div
                  className={cn(
                    "brutal-progress-fill",
                    isWorking && "active",
                  )}
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>

              {/* Status row */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isWorking && <ProcessingWaveform />}
                  {jobState === "succeeded" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <ZapIcon className="size-4" style={{ color: "var(--accent)" }} />
                    </motion.div>
                  )}
                  <div className="min-w-0">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={statusMessage}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="font-mono text-xs font-bold truncate"
                        style={{ color: isWorking ? "var(--accent)" : "var(--foreground)" }}
                      >
                        {statusMessage}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Elapsed timer */}
                {isWorking && (
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                      Elapsed
                    </p>
                    <p className="font-mono text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                      {formatElapsed(elapsed)}
                    </p>
                  </div>
                )}
              </div>

              {jobError ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 font-mono text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--destructive)" }}
                >
                  {jobError}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
