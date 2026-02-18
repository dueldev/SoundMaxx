"use client";

import { DownloadIcon, EarIcon, ExternalLinkIcon, FileAudioIcon } from "lucide-react";
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
  return (
    <section className="smx-frame p-5 md:p-6">
      <h3 className="text-3xl font-semibold tracking-tight">3. Results + A/B Compare</h3>
      <p className="smx-kicker mt-2">Review outputs, compare playback, and export before expiry.</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="smx-subframe p-4">
          <p className="smx-kicker inline-flex items-center gap-2">
            <EarIcon className="size-3.5" />
            A/B Playback
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="smx-subframe p-3">
              <p className="smx-kicker">Original</p>
              <audio controls className="mt-2 w-full" src={filePreviewUrl ?? undefined} />
            </div>
            <div className="smx-subframe p-3">
              <p className="smx-kicker">Processed</p>
              <audio controls className="mt-2 w-full" src={artifacts[0]?.downloadUrl} />
            </div>
          </div>
        </div>

        <div className="smx-subframe p-4">
          <p className="smx-kicker inline-flex items-center gap-2">
            <FileAudioIcon className="size-3.5" />
            Artifacts
          </p>

          {artifacts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No artifacts yet. Run a tool to generate outputs.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {artifacts.map((artifact, index) => {
                const expired = isExpired(artifact.expiresAt);

                return (
                  <article key={artifact.id} className="smx-subframe p-3">
                    <p className="text-sm font-semibold tracking-tight">Output {index + 1}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {expired
                        ? `Expired ${new Date(artifact.expiresAt).toLocaleString()}`
                        : `Expires ${new Date(artifact.expiresAt).toLocaleString()}`}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {expired ? (
                        <span className="smx-chip">Expired</span>
                      ) : (
                        <>
                          <Button asChild size="sm" className="smx-button-primary px-3 py-2 text-[11px]">
                            <a href={artifact.downloadUrl} target="_blank" rel="noreferrer">
                              <ExternalLinkIcon className="size-3.5" />
                              Open
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="smx-button-secondary px-3 py-2 text-[11px]">
                            <a href={artifact.downloadUrl} download>
                              <DownloadIcon className="size-3.5" />
                              Download
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
