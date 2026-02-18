"use client";

import { PlayIcon } from "lucide-react";
import { MASTERING_PRESETS, type MasteringPreset, type ToolType } from "@/types/domain";
import type { JobState } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProcessPanelProps = {
  toolType: ToolType;
  toolLabel: string;
  toolDescription: string;
  jobState: JobState;
  jobProgress: number;
  jobEtaSec: number | null;
  jobError: string | null;
  canRunTool: boolean;
  onRunTool: () => void;
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

function statusText(state: JobState, progress: number, etaSec: number | null): string {
  if (state === "queued") return "QUEUED";
  if (state === "running") {
    const eta = etaSec !== null ? ` — ETA ${etaSec}s` : "";
    return `RUNNING ${progress}%${eta}`;
  }
  if (state === "succeeded") return "DONE";
  if (state === "failed") return "FAILED";
  return "IDLE";
}

function stateTagClass(state: JobState) {
  if (state === "succeeded") return "tag tag-ok";
  if (state === "failed") return "tag tag-error";
  if (state === "queued" || state === "running") return "tag tag-warn";
  return "tag";
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

export function ProcessPanel({
  toolType,
  toolLabel,
  toolDescription,
  jobState,
  jobProgress,
  jobEtaSec,
  jobError,
  canRunTool,
  onRunTool,
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

  return (
    <section className="brutal-card flex flex-col p-5 md:p-6">
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
        <Button
          onClick={onRunTool}
          disabled={!canRunTool || isWorking}
          className={cn(
            "brutal-button-primary w-full justify-center py-3.5 text-xs",
            isWorking && "opacity-80",
          )}
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            background: isWorking ? "var(--foreground)" : undefined,
            borderColor: isWorking ? "var(--foreground)" : undefined,
          }}
        >
          <PlayIcon className="size-3.5" />
          {isWorking ? `Running…` : `Run ${toolLabel}`}
        </Button>

        {!canRunTool && !isWorking ? (
          <p className="mt-2 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
            Upload audio first to enable processing.
          </p>
        ) : null}
      </div>

      {/* Pipeline status */}
      <div
        className="mt-5 border p-4"
        aria-live="polite"
        style={{ borderColor: "var(--muted)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Pipeline status
          </p>
          <span
            className="font-mono text-xs font-bold"
            style={{ color: isWorking ? "var(--accent)" : "var(--muted-foreground)" }}
          >
            {statusText(jobState, clampedProgress, jobEtaSec)}
          </span>
        </div>

        <div className="brutal-progress-track">
          <div
            className={cn("brutal-progress-fill", isWorking && "active")}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {jobError ? (
          <p
            className="mt-3 font-mono text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--destructive)" }}
          >
            ⚠ {jobError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
