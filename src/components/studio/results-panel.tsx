"use client";

import { DownloadIcon, ExternalLinkIcon, MusicIcon } from "lucide-react";
import type { ArtifactView } from "@/components/studio/types";
import { Button } from "@/components/ui/button";

type ResultsPanelProps = {
  filePreviewUrl: string | null;
  artifacts: ArtifactView[];
};

function isExpired(expiresAt: string) {
  return Date.now() > Date.parse(expiresAt);
}

export function ResultsPanel({ filePreviewUrl, artifacts }: ResultsPanelProps) {
  const hasContent = filePreviewUrl || artifacts.length > 0;

  return (
    <section className="brutal-card p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="step-num">STEP 03</span>
          <h3 className="mt-1 text-2xl font-bold">Results + A/B Compare</h3>
        </div>
        {artifacts.length > 0 && (
          <span className="tag tag-ok">{artifacts.length} ARTIFACT{artifacts.length !== 1 ? "S" : ""}</span>
        )}
      </div>

      <hr className="section-rule mt-4 mb-4" />

      {!hasContent ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <MusicIcon className="size-8" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
          <p className="text-base font-semibold" style={{ color: "var(--muted-foreground)" }}>—</p>
          <p className="max-w-xs text-sm" style={{ color: "var(--muted-foreground)" }}>
            Upload and run a tool to generate output artifacts.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* A/B playback */}
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
                <audio
                  controls
                  className="w-full"
                  src={filePreviewUrl}
                />
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  No source audio available.
                </p>
              )}
            </div>

            {/* B — Processed */}
            <div
              className="brutal-card-flat p-4"
              style={artifacts[0]?.downloadUrl ? { borderColor: "var(--accent)" } : undefined}
            >
              <p
                className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: artifacts[0]?.downloadUrl ? "var(--accent)" : "var(--muted-foreground)" }}
              >
                B / Processed
              </p>
              {artifacts[0]?.downloadUrl ? (
                <audio
                  controls
                  className="w-full"
                  src={artifacts[0].downloadUrl}
                />
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Processing output will appear here.
                </p>
              )}
            </div>
          </div>

          {/* Artifact list */}
          {artifacts.length > 0 && (
            <div>
              <p
                className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Artifacts
              </p>
              <div className="flex flex-col">
                {artifacts.map((artifact, index) => {
                  const expired = isExpired(artifact.expiresAt);

                  return (
                    <div
                      key={artifact.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-t-0"
                      style={{ borderColor: "var(--muted)" }}
                    >
                      <div>
                        <p className="text-sm font-bold">Output {index + 1}</p>
                        <p
                          className="mt-0.5 font-mono text-xs"
                          style={{ color: expired ? "var(--destructive)" : "var(--muted-foreground)" }}
                        >
                          {expired
                            ? `[EXPIRED] ${new Date(artifact.expiresAt).toLocaleString()}`
                            : `Expires ${new Date(artifact.expiresAt).toLocaleString()}`}
                        </p>
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
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="brutal-button-ghost px-3 py-2 text-[11px]"
                          >
                            <a href={artifact.downloadUrl} download>
                              <DownloadIcon className="size-3.5" />
                              Download
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
