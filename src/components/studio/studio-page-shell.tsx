import type { ReactNode } from "react";
import { ArrowUpRightIcon, AudioLinesIcon, Clock3Icon, ShieldCheckIcon, SparklesIcon } from "lucide-react";

type StudioPageShellProps = {
  title: string;
  description: string;
  workflowTitle: string;
  workflowDescription: string;
  uploadPanel: ReactNode;
  processPanel: ReactNode;
  resultsPanel: ReactNode;
  footer: ReactNode;
};

const WORKFLOW_STEPS = [
  ["01", "Upload source audio", "Single-file staging with rights confirmation."],
  ["02", "Set process controls", "Tool-specific options before job submit."],
  ["03", "Track run status", "Queue, progress, and ETA in one panel."],
  ["04", "Compare and export", "A/B preview plus artifact links before expiry."],
] as const;

export function StudioPageShell({
  title,
  description,
  workflowTitle,
  workflowDescription,
  uploadPanel,
  processPanel,
  resultsPanel,
  footer,
}: StudioPageShellProps) {
  return (
    <div className="relative overflow-x-hidden pb-12">
      <div className="smx-shell flex flex-col gap-5 pt-4 md:pt-8">
        <section className="smx-dark-frame p-5 md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div>
              <p className="smx-kicker text-white/70">
                <SparklesIcon className="size-3.5" />
                Tool Workspace
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[0.92] tracking-tight text-[#f6f8ff] md:text-6xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">{description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="smx-chip border-white/22 bg-white/[0.06] text-white/74">
                  <AudioLinesIcon className="size-3.5" />
                  Audio In • Artifact Out
                </span>
                <span className="smx-chip border-white/22 bg-white/[0.06] text-white/74">
                  <Clock3Icon className="size-3.5" />
                  Explicit Queue + ETA
                </span>
                <span className="smx-chip border-white/22 bg-white/[0.06] text-white/74">
                  <ShieldCheckIcon className="size-3.5" />
                  Rights & Retention Guardrails
                </span>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/16 bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="smx-kicker text-white/70">Workflow rail</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f6f8ff]">{workflowTitle}</h2>
              <p className="mt-2 text-sm text-white/65">{workflowDescription}</p>

              <ol className="mt-4 grid gap-2">
                {WORKFLOW_STEPS.map(([step, label, note]) => (
                  <li key={step} className="rounded-lg border border-white/14 bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#f6f8ff]">{label}</p>
                      <span className="smx-kicker text-white/62">
                        {step}
                        <ArrowUpRightIcon className="size-3" />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/60">{note}</p>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.03fr_0.97fr]">
          {uploadPanel}
          {processPanel}
        </div>

        {resultsPanel}

        <footer className="smx-kicker px-1 text-muted-foreground">{footer}</footer>
      </div>
    </div>
  );
}
