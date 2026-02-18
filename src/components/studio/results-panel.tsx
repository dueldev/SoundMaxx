"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileAudioIcon,
  FileJsonIcon,
  FileIcon,
  MusicIcon,
  SparklesIcon,
} from "lucide-react";
import type { ArtifactView } from "@/components/studio/types";
import type { ToolType } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResultsPanelProps = {
  toolType: ToolType;
  filePreviewUrl: string | null;
  artifacts: ArtifactView[];
  stemCount?: 2 | 4;
};

function isExpired(expiresAt: string) {
  return Date.now() > Date.parse(expiresAt);
}

function isAudioFormat(format: string) {
  return ["wav", "mp3", "flac", "ogg", "aac", "m4a"].includes(format);
}

const STEM_LABELS_4 = ["Vocals", "Drums", "Bass", "Other"] as const;
const STEM_LABELS_2 = ["Vocals", "Accompaniment"] as const;

function stemLabel(index: number, stemCount: 2 | 4): string {
  if (stemCount === 2) return STEM_LABELS_2[index] ?? `Stem ${index + 1}`;
  return STEM_LABELS_4[index] ?? `Stem ${index + 1}`;
}

function toolResultsTitle(toolType: ToolType): string {
  switch (toolType) {
    case "stem_isolation": return "Isolated Stems";
    case "mastering": return "Mastered Output";
    case "key_bpm": return "Analysis Results";
    case "loudness_report": return "Loudness Measurements";
    case "midi_extract": return "MIDI Output";
  }
}

function ArtifactDownloadRow({ artifact, label }: { artifact: ArtifactView; label: string }) {
  const expired = isExpired(artifact.expiresAt);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-t-0"
      style={{ borderColor: "var(--muted)" }}
    >
      <div className="flex items-center gap-2.5">
        {isAudioFormat(artifact.format) ? (
          <FileAudioIcon className="size-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
        ) : artifact.format === "json" ? (
          <FileJsonIcon className="size-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
        ) : (
          <FileIcon className="size-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
        )}
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p
            className="mt-0.5 font-mono text-xs"
            style={{ color: expired ? "var(--destructive)" : "var(--muted-foreground)" }}
          >
            {artifact.format.toUpperCase()}
            {expired
              ? ` · [EXPIRED] ${new Date(artifact.expiresAt).toLocaleString()}`
              : ` · Expires ${new Date(artifact.expiresAt).toLocaleString()}`}
          </p>
        </div>
      </div>

      {expired ? (
        <span className="tag tag-error">[EXPIRED]</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="brutal-button-primary px-3 py-2 text-[11px]">
            <a href={artifact.downloadUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="size-3.5" />
              Open
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="brutal-button-ghost px-3 py-2 text-[11px]">
            <a href={artifact.downloadUrl} download>
              <DownloadIcon className="size-3.5" />
              Download
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function StemIsolationResults({
  artifacts,
  filePreviewUrl,
  stemCount,
}: {
  artifacts: ArtifactView[];
  filePreviewUrl: string | null;
  stemCount: 2 | 4;
}) {
  const audioArtifacts = artifacts.filter((a) => isAudioFormat(a.format));

  return (
    <div className="flex flex-col gap-5">
      {/* Original */}
      {filePreviewUrl && (
        <div className="brutal-card-flat p-4">
          <p
            className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Original Mix
          </p>
          <audio controls className="w-full" src={filePreviewUrl} />
        </div>
      )}

      {/* Individual stems */}
      <div className={cn("grid gap-4", audioArtifacts.length > 2 ? "md:grid-cols-2" : "md:grid-cols-2")}>
        {audioArtifacts.map((artifact, i) => {
          const expired = isExpired(artifact.expiresAt);
          const label = stemLabel(i, stemCount);

          return (
            <motion.div
              key={artifact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
              className="brutal-card-flat p-4"
              style={!expired ? { borderColor: "var(--accent)" } : undefined}
            >
              <div className="mb-3 flex items-center justify-between">
                <p
                  className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: "var(--accent)" }}
                >
                  {label}
                </p>
                <span className="font-mono text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>
                  {artifact.format.toUpperCase()}
                </span>
              </div>
              {!expired ? (
                <>
                  <audio controls className="w-full mb-2" src={artifact.downloadUrl} />
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="brutal-button-ghost px-2.5 py-1.5 text-[10px]">
                      <a href={artifact.downloadUrl} download={`${label.toLowerCase()}.${artifact.format}`}>
                        <DownloadIcon className="size-3" />
                        Download
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs font-mono" style={{ color: "var(--destructive)" }}>[EXPIRED]</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Non-audio artifacts (zip bundle, etc.) */}
      {artifacts.filter((a) => !isAudioFormat(a.format)).map((artifact) => (
        <ArtifactDownloadRow
          key={artifact.id}
          artifact={artifact}
          label={artifact.format === "zip" ? "All stems (ZIP bundle)" : `Additional output (${artifact.format.toUpperCase()})`}
        />
      ))}
    </div>
  );
}

function MasteringResults({
  artifacts,
  filePreviewUrl,
}: {
  artifacts: ArtifactView[];
  filePreviewUrl: string | null;
}) {
  const audioArtifacts = artifacts.filter((a) => isAudioFormat(a.format));
  const jsonArtifact = artifacts.find((a) => a.format === "json");
  const mainOutput = audioArtifacts[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        {/* A — Original */}
        <div className="brutal-card-flat p-4">
          <p
            className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            A / Original
          </p>
          {filePreviewUrl ? (
            <audio controls className="w-full" src={filePreviewUrl} />
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No source audio available.</p>
          )}
        </div>

        {/* B — Mastered */}
        <div
          className="brutal-card-flat p-4"
          style={mainOutput && !isExpired(mainOutput.expiresAt) ? { borderColor: "var(--accent)" } : undefined}
        >
          <p
            className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: mainOutput ? "var(--accent)" : "var(--muted-foreground)" }}
          >
            B / Mastered
          </p>
          {mainOutput && !isExpired(mainOutput.expiresAt) ? (
            <audio controls className="w-full" src={mainOutput.downloadUrl} />
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Processing output will appear here.</p>
          )}
        </div>
      </div>

      {/* Mastering report */}
      {jsonArtifact && <JsonDataDisplay artifact={jsonArtifact} title="Mastering Report" />}

      {/* Download rows */}
      <div className="flex flex-col">
        {artifacts.map((artifact) => {
          let label: string;
          if (isAudioFormat(artifact.format)) {
            label = "Mastered audio";
          } else if (artifact.format === "json") {
            label = "Mastering report (JSON)";
          } else {
            label = `Output file (${artifact.format.toUpperCase()})`;
          }
          return <ArtifactDownloadRow key={artifact.id} artifact={artifact} label={label} />;
        })}
      </div>
    </div>
  );
}

const UNIT_MAP: Record<string, string> = {
  integratedlufs: "LUFS",
  integratedLufs: "LUFS",
  integrated_lufs: "LUFS",
  targetlufs: "LUFS",
  targetLufs: "LUFS",
  target_lufs: "LUFS",
  truepeakdbtp: "dBTP",
  truePeakDbtp: "dBTP",
  true_peak_dbtp: "dBTP",
  dynamicrange: "dB",
  dynamicRange: "dB",
  dynamic_range: "dB",
  bpm: "BPM",
  intensity: "%",
};

const HIDDEN_KEYS = new Set([
  "engine", "fallbackReason", "requestedEngine", "stdout",
  "fallback_reason", "requested_engine",
]);

function formatDataValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    const unit = UNIT_MAP[key] ?? "";
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) return `${value.length} items`;
    return JSON.stringify(value);
  }
  return String(value);
}

function JsonDataDisplay({ artifact, title }: { artifact: ArtifactView; title: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (artifact.format !== "json" || isExpired(artifact.expiresAt)) return;

    fetch(artifact.downloadUrl)
      .then((r) => r.json())
      .then((d) => setData(d as Record<string, unknown>))
      .catch(() => setError(true));
  }, [artifact.downloadUrl, artifact.format, artifact.expiresAt]);

  if (isExpired(artifact.expiresAt)) {
    return <p className="text-xs font-mono" style={{ color: "var(--destructive)" }}>[EXPIRED]</p>;
  }

  if (error) {
    return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Unable to load results data.</p>;
  }

  if (!data) {
    return <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Loading results...</p>;
  }

  const visibleEntries = Object.entries(data).filter(([key]) => !HIDDEN_KEYS.has(key));

  return (
    <div className="brutal-card-flat p-4">
      <p
        className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: "var(--accent)" }}
      >
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleEntries.map(([key, value]) => {
          const displayKey = key
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ");

          return (
            <div key={key} className="border p-3" style={{ borderColor: "var(--muted)" }}>
              <p
                className="font-mono text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                {displayKey}
              </p>
              <p className="mt-1 text-lg font-bold break-all">{formatDataValue(key, value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalysisResults({
  artifacts,
  filePreviewUrl,
  title,
}: {
  artifacts: ArtifactView[];
  filePreviewUrl: string | null;
  title: string;
}) {
  const jsonArtifact = artifacts.find((a) => a.format === "json");
  const audioArtifacts = artifacts.filter((a) => isAudioFormat(a.format));

  return (
    <div className="flex flex-col gap-5">
      {/* Original playback */}
      {filePreviewUrl && (
        <div className="brutal-card-flat p-4">
          <p
            className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Analyzed Track
          </p>
          <audio controls className="w-full" src={filePreviewUrl} />
        </div>
      )}

      {/* JSON data display */}
      {jsonArtifact && <JsonDataDisplay artifact={jsonArtifact} title={title} />}

      {/* Audio artifacts if any */}
      {audioArtifacts.map((artifact, i) => (
        <div key={artifact.id} className="brutal-card-flat p-4">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
            Audio Output {i + 1}
          </p>
          {!isExpired(artifact.expiresAt) ? (
            <audio controls className="w-full" src={artifact.downloadUrl} />
          ) : (
            <p className="text-xs font-mono" style={{ color: "var(--destructive)" }}>[EXPIRED]</p>
          )}
        </div>
      ))}

      {/* Download rows */}
      <div className="flex flex-col">
        {artifacts.map((artifact, i) => (
          <ArtifactDownloadRow
            key={artifact.id}
            artifact={artifact}
            label={artifact.format === "json" ? "Analysis data (JSON)" : `Output ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function MidiResults({
  artifacts,
  filePreviewUrl,
}: {
  artifacts: ArtifactView[];
  filePreviewUrl: string | null;
}) {
  const midiArtifacts = artifacts.filter((a) => a.format === "mid" || a.format === "midi");
  const jsonArtifact = artifacts.find((a) => a.format === "json");
  const otherArtifacts = artifacts.filter((a) => a.format !== "mid" && a.format !== "midi" && a.format !== "json");

  return (
    <div className="flex flex-col gap-5">
      {/* Original playback */}
      {filePreviewUrl && (
        <div className="brutal-card-flat p-4">
          <p
            className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Source Audio
          </p>
          <audio controls className="w-full" src={filePreviewUrl} />
        </div>
      )}

      {/* MIDI files */}
      {midiArtifacts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {midiArtifacts.map((artifact, i) => {
            const expired = isExpired(artifact.expiresAt);
            return (
              <motion.div
                key={artifact.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
                className="brutal-card-flat p-4"
                style={!expired ? { borderColor: "var(--accent)" } : undefined}
              >
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "var(--accent)" }}>
                  MIDI File{midiArtifacts.length > 1 ? ` ${i + 1}` : ""}
                </p>
                <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                  MIDI files can be imported into any DAW (Ableton, Logic, FL Studio, etc.)
                </p>
                {!expired ? (
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="brutal-button-primary px-3 py-2 text-[11px]">
                      <a href={artifact.downloadUrl} download={`midi-extract${midiArtifacts.length > 1 ? `-${i + 1}` : ""}.mid`}>
                        <DownloadIcon className="size-3.5" />
                        Download MIDI
                      </a>
                    </Button>
                  </div>
                ) : (
                  <span className="tag tag-error">[EXPIRED]</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* JSON metadata if present */}
      {jsonArtifact && <JsonDataDisplay artifact={jsonArtifact} title="Extraction Metadata" />}

      {/* Other artifacts */}
      {otherArtifacts.map((artifact, i) => (
        <ArtifactDownloadRow key={artifact.id} artifact={artifact} label={`Output ${i + 1}`} />
      ))}

      {/* Fallback for non-midi artifacts (audio-based extraction) */}
      {midiArtifacts.length === 0 && (
        <div className="flex flex-col">
          {artifacts.map((artifact, i) => (
            <ArtifactDownloadRow
              key={artifact.id}
              artifact={artifact}
              label={artifact.format === "json" ? "Extraction data (JSON)" : `Output ${i + 1} (${artifact.format.toUpperCase()})`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultsPanel({ toolType, filePreviewUrl, artifacts, stemCount = 4 }: ResultsPanelProps) {
  const hasContent = filePreviewUrl || artifacts.length > 0;
  const hasArtifacts = artifacts.length > 0;

  return (
    <section
      className={cn(
        "brutal-card p-5 md:p-6 transition-all duration-500",
        hasArtifacts && "border-[var(--accent)]",
      )}
      style={hasArtifacts ? { borderColor: "var(--accent)" } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="step-num">STEP 03</span>
          <h3 className="mt-1 text-2xl font-bold">
            {hasArtifacts ? toolResultsTitle(toolType) : "Results"}
          </h3>
        </div>
        <AnimatePresence mode="wait">
          {hasArtifacts && (
            <motion.span
              key="artifact-count"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="tag tag-ok"
            >
              {artifacts.length} ARTIFACT{artifacts.length !== 1 ? "S" : ""}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <hr className="section-rule mt-4 mb-4" />

      {!hasContent ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <MusicIcon className="size-8" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
          <p className="text-base font-semibold" style={{ color: "var(--muted-foreground)" }}>—</p>
          <p className="max-w-xs text-sm" style={{ color: "var(--muted-foreground)" }}>
            Upload and run a tool to generate output artifacts.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={hasArtifacts ? "results" : "empty"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Success banner */}
            {hasArtifacts && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 border p-3.5"
                  style={{ borderColor: "var(--accent)", background: "rgba(255, 59, 0, 0.04)" }}
                >
                  <SparklesIcon className="size-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                  <p className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                    Processing complete — {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} ready
                  </p>
                </div>
              </motion.div>
            )}

            {/* Tool-specific results */}
            {hasArtifacts && toolType === "stem_isolation" && (
              <StemIsolationResults artifacts={artifacts} filePreviewUrl={filePreviewUrl} stemCount={stemCount} />
            )}

            {hasArtifacts && toolType === "mastering" && (
              <MasteringResults artifacts={artifacts} filePreviewUrl={filePreviewUrl} />
            )}

            {hasArtifacts && toolType === "key_bpm" && (
              <AnalysisResults artifacts={artifacts} filePreviewUrl={filePreviewUrl} title="Key + BPM Analysis" />
            )}

            {hasArtifacts && toolType === "loudness_report" && (
              <AnalysisResults artifacts={artifacts} filePreviewUrl={filePreviewUrl} title="Loudness Measurements" />
            )}

            {hasArtifacts && toolType === "midi_extract" && (
              <MidiResults artifacts={artifacts} filePreviewUrl={filePreviewUrl} />
            )}

            {/* Fallback when no artifacts but has preview */}
            {!hasArtifacts && filePreviewUrl && (
              <div className="brutal-card-flat p-4">
                <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                  Source Audio
                </p>
                <audio controls className="w-full" src={filePreviewUrl} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
