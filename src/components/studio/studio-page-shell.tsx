import type { ReactNode } from "react";
import Link from "next/link";
import { TOOL_CONFIGS } from "@/lib/tool-config";

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

const BREADCRUMB_STEPS = [
  { num: "01", label: "Upload" },
  { num: "02", label: "Configure" },
  { num: "03", label: "Process" },
  { num: "04", label: "Export" },
] as const;

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
}: StudioPageShellProps) {
  const toolNum = getToolIndex(title);

  return (
    <div className="pb-20">
      <div className="accent-bar" />

      <div className="smx-shell">

        {/* ── Document header ───────────────────────────────────────────── */}
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
            {BREADCRUMB_STEPS.map(({ num, label }, i) => (
              <span key={num} className="flex items-center">
                <span
                  className="font-mono text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {num} {label}
                </span>
                {i < BREADCRUMB_STEPS.length - 1 && (
                  <span
                    className="mx-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </span>
            ))}
          </nav>
        </section>

        <hr className="section-rule" />

        {/* ── Tool selector row ─────────────────────────────────────────── */}
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

        {/* ── Panels ────────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {uploadPanel}
          {processPanel}
        </div>

        <div className="mt-5">
          {resultsPanel}
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
