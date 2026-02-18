"use client";

import { ActivityIcon, GaugeIcon, Music2Icon, PlayIcon, SlidersHorizontalIcon, WandSparklesIcon } from "lucide-react";
import { MASTERING_PRESETS, type MasteringPreset, type ToolType } from "@/types/domain";
import type { JobState } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { PrismFluxLoader } from "@/components/ui/prism-flux-loader";
import { SegmentedProgress } from "@/components/ui/progress-bar";
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

function progressLabel(state: JobState, etaSec: number | null) {
  if (state === "queued") return "Queued and waiting for worker allocation.";
  if (state === "running") {
    return etaSec !== null ? `Estimated time remaining: ${etaSec}s` : "Processing in progress.";
  }
  if (state === "succeeded") return "Processing completed. Review outputs below.";
  if (state === "failed") return "Processing failed. Adjust settings and retry.";
  return "Awaiting processing telemetry.";
}

function runActionHint(args: { canRunTool: boolean; isWorking: boolean }) {
  if (args.isWorking) {
    return "A processing job is active. Wait for completion before starting another run.";
  }
  if (!args.canRunTool) {
    return "Upload audio first to enable processing.";
  }
  return "Ready to run with current settings.";
}

function statusBadge(state: JobState) {
  if (state === "succeeded") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (state === "failed") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  if (state === "queued" || state === "running") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-background/72 text-muted-foreground";
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

  return (
    <section className="smx-frame p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">2. Process</h2>
          <p className="smx-kicker mt-2">Configure parameters, submit job, track status.</p>
        </div>
        <span className={cn("smx-chip", statusBadge(jobState))}>
          <ActivityIcon className="size-3.5" />
          {jobState}
        </span>
      </header>

      <div className="smx-subframe mt-4 p-4">
        <p className="smx-kicker inline-flex items-center gap-2">
          <Music2Icon className="size-3.5" />
          Selected tool
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight">{toolLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">{toolDescription}</p>
      </div>

      <details className="smx-subframe mt-4 p-4" open>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Processing controls
        </summary>

        <div className="mt-3 grid gap-3">
          {toolType === "stem_isolation" ? (
            <label className="space-y-1.5 text-sm">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <SlidersHorizontalIcon className="size-3.5" />
                Stem count
              </span>
              <select
                value={stems}
                onChange={(event) => onStemsChange(Number(event.target.value) as 2 | 4)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value={2}>2 stems (faster)</option>
                <option value={4}>4 stems (full split)</option>
              </select>
            </label>
          ) : null}

          {toolType === "mastering" ? (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <SlidersHorizontalIcon className="size-3.5" />
                  Mastering profile
                </span>
                <select
                  value={masteringPreset}
                  onChange={(event) => onMasteringPresetChange(event.target.value as MasteringPreset)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {MASTERING_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <GaugeIcon className="size-3.5" />
                  Intensity ({masteringIntensity})
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masteringIntensity}
                  onChange={(event) => onMasteringIntensityChange(Number(event.target.value))}
                  className="w-full"
                />
              </label>
            </>
          ) : null}

          {toolType === "key_bpm" ? (
            <label className="smx-subframe flex items-center gap-3 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={includeChordHints}
                onChange={(event) => onIncludeChordHintsChange(event.target.checked)}
              />
              Include chord hints
            </label>
          ) : null}

          {toolType === "loudness_report" ? (
            <label className="space-y-1.5 text-sm">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <GaugeIcon className="size-3.5" />
                Target LUFS
              </span>
              <input
                type="number"
                step={0.1}
                min={-24}
                max={-6}
                value={targetLufs}
                onChange={(event) => onTargetLufsChange(Number(event.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          {toolType === "midi_extract" ? (
            <label className="space-y-1.5 text-sm">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <SlidersHorizontalIcon className="size-3.5" />
                Sensitivity ({midiSensitivity.toFixed(2)})
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={midiSensitivity}
                onChange={(event) => onMidiSensitivityChange(Number(event.target.value))}
                className="w-full"
              />
            </label>
          ) : null}
        </div>
      </details>

      <Button onClick={onRunTool} disabled={!canRunTool || isWorking} className="smx-button-primary mt-4 w-full px-4 py-2 text-[11px]">
        <PlayIcon className="size-3.5" />
        {isWorking ? "Processing..." : `Run ${toolLabel}`}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">{runActionHint({ canRunTool, isWorking })}</p>

      <div className="smx-subframe mt-5 space-y-4 p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <p className="smx-kicker inline-flex items-center gap-2">
            <WandSparklesIcon className="size-3.5" />
            Pipeline status
          </p>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{jobState}</span>
        </div>

        {isWorking ? (
          <PrismFluxLoader
            size={40}
            speed={4}
            textSize={14}
            statuses={["Queueing", "Routing", "Processing", "Rendering", "Packaging", "Finalizing"]}
          />
        ) : null}

        <SegmentedProgress value={Math.max(0, Math.min(100, jobProgress))} label="Progress" showDemo={false} segments={20} />

        <p className="text-sm text-muted-foreground">{progressLabel(jobState, jobEtaSec)}</p>
        {jobError ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-destructive">{jobError}</p> : null}
      </div>
    </section>
  );
}
