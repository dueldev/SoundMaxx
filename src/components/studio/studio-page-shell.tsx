"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { AdSlot } from "@/components/ads/ad-slot";
import { SponsorSlot } from "@/components/ads/sponsor-slot";
import { TOOL_CONFIGS } from "@/lib/tool-config";
import type { WorkflowPhase } from "@/components/studio/types";
import { cn } from "@/lib/utils";

type StudioPageShellProps = {
  title: string;
  description: string;
  workflowTitle: string;
  workflowDescription: string;
  workflowPhase?: WorkflowPhase;
  uploadPanel: ReactNode;
  processPanel: ReactNode;
  resultsPanel: ReactNode;
  footer: ReactNode;
};

const BREADCRUMB_STEPS = [
  { num: "01", label: "Upload", phase: "upload" as WorkflowPhase },
  { num: "02", label: "Configure", phase: "configure" as WorkflowPhase },
  { num: "03", label: "Process", phase: "process" as WorkflowPhase },
  { num: "04", label: "Export", phase: "export" as WorkflowPhase },
] as const;

const PHASE_ORDER: WorkflowPhase[] = ["upload", "configure", "process", "export"];

function getToolIndex(title: string): string {
  const idx = TOOL_CONFIGS.findIndex((t) => t.label === title);
  return idx >= 0 ? String(idx + 1).padStart(2, "0") : "—";
}

export function StudioPageShell({
  title,
  description,
  uploadPanel,
  processPanel,
  resultsPanel,
  footer,
  workflowPhase = "upload",
}: StudioPageShellProps) {
  const toolNum = getToolIndex(title);
  const activePhaseIdx = PHASE_ORDER.indexOf(workflowPhase);

  return (
    <div className="pb-20">
      <div className="accent-bar" />

      <div className="smx-shell">

        {/* Document header */}
        <section className="animate-rise pt-10 pb-8">
          <div className="flex flex-wrap items-baseline gap-4">
            <span
              className="font-mono text-4xl font-bold leading-none"
              style={{ color: "var(--accent)" }}
            >
              {toolNum}
            </span>
            <h1
              className="font-bold leading-tight"
              style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
            >
              {title}
            </h1>
          </div>
          <p
            className="mt-3 max-w-2xl text-base leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </p>

          {/* Breadcrumb */}
          <nav
            className="mt-6 flex flex-wrap items-center gap-0"
            aria-label="Workflow steps"
          >
            {BREADCRUMB_STEPS.map(({ num, label, phase }, i) => {
              const stepIdx = PHASE_ORDER.indexOf(phase);
              const isCompleted = stepIdx < activePhaseIdx;
              const isActive = stepIdx === activePhaseIdx;

              return (
                <span key={num} className="flex items-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-300",
                      isActive && "font-bold",
                    )}
                    style={{
                      color: isActive
                        ? "var(--accent)"
                        : isCompleted
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    {isCompleted ? (
                      <span
                        className="inline-flex size-4 items-center justify-center border"
                        style={{ borderColor: "var(--foreground)", background: "var(--foreground)" }}
                      >
                        <CheckIcon className="size-2.5 text-background" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex size-4 items-center justify-center border font-mono text-[9px] font-bold transition-colors duration-300",
                          isActive && "border-[var(--accent)] text-[var(--accent)]",
                        )}
                        style={{
                          borderColor: isActive ? "var(--accent)" : "var(--muted-foreground)",
                        }}
                      >
                        {num}
                      </span>
                    )}
                    {label}
                  </span>
                  {i < BREADCRUMB_STEPS.length - 1 && (
                    <span
                      className="mx-3 text-xs transition-colors duration-300"
                      style={{
                        color: stepIdx < activePhaseIdx
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                      }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        </section>

        <hr className="section-rule" />

        {/* Tool selector row */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TOOL_CONFIGS.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.href}
              className={
                tool.label === title
                  ? "brutal-button-primary px-3 py-2 text-[11px]"
                  : "brutal-button-ghost px-3 py-2 text-[11px]"
              }
            >
              {tool.navLabel}
            </Link>
          ))}
        </div>

        {/* Panels */}
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {uploadPanel}
          {processPanel}
        </div>

        <div className="mt-5">
          {resultsPanel}
        </div>

        <div className="mt-5 space-y-4">
          <AdSlot slotId="2002001" label="Advertisement" />
          <SponsorSlot placement="tool_inline" />
        </div>

        <footer
          className="mt-6 font-mono text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          {footer}
        </footer>
      </div>
    </div>
  );
}
