import Link from "next/link";
import {
  ActivityIcon,
  ArrowUpRightIcon,
  AudioLinesIcon,
  Clock3Icon,
  GaugeIcon,
  Layers3Icon,
  Music3Icon,
  ShieldCheckIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { TOOL_CONFIGS } from "@/lib/tool-config";

const readinessByTool: Record<string, number> = {
  "stem-isolation": 96,
  mastering: 93,
  "key-bpm": 92,
  "loudness-report": 91,
  "midi-extract": 88,
};

const iconBySlug: Record<string, typeof AudioLinesIcon> = {
  "stem-isolation": AudioLinesIcon,
  mastering: WandSparklesIcon,
  "key-bpm": Clock3Icon,
  "loudness-report": GaugeIcon,
  "midi-extract": Music3Icon,
};

export default function Home() {
  return (
    <div className="relative overflow-x-hidden pb-14">
      <div className="smx-shell flex flex-col gap-6 pt-4 md:pt-8">
        <section className="smx-dark-frame smx-hero animate-rise p-5 md:p-8">
          <div className="grid gap-7 xl:grid-cols-[1.12fr_0.88fr]">
            <div>
              <p className="smx-kicker text-white/70">
                <SparklesIcon className="size-3.5" />
                Why SoundMaxx
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[0.92] tracking-[0.01em] text-[#f6f8ff] md:text-6xl">
                Release-ready audio workflows without hidden states.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/72 md:text-base">
                SoundMaxx keeps upload, processing, and export explicit so creators can move fast and operators can trust every state change.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/tools/stem-isolation" className="smx-button-primary px-4 py-2 text-[11px]">
                  Open Tool
                  <ArrowUpRightIcon className="size-3.5" />
                </Link>
                <Link href="/ops" className="smx-button-secondary border-white/20 bg-white/8 px-4 py-2 text-[11px] text-white">
                  View Ops
                </Link>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Tool Routes", value: String(TOOL_CONFIGS.length), icon: Layers3Icon },
                  { label: "Session Retention", value: "24h", icon: ShieldCheckIcon },
                  { label: "Queue Target", value: "< 12s", icon: ActivityIcon },
                ].map((metric) => (
                  <article key={metric.label} className="rounded-xl border border-white/16 bg-white/[0.03] px-3 py-3">
                    <p className="smx-kicker text-white/62">
                      <metric.icon className="size-3.5" />
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-[#f6f8ff]">{metric.value}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-white/16 bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="smx-kicker text-white/70">Decision Loop</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f6f8ff]">First screen: why. Second: risk. Third: action.</h2>
              <div className="mt-4 grid gap-2">
                {[
                  ["01", "Upload", "Rights check and file prep before processing."],
                  ["02", "Process", "Live state, progress, and ETA with clear status."],
                  ["03", "Export", "A/B compare with artifact expiry timing."],
                ].map(([step, title, description]) => (
                  <article key={step} className="rounded-xl border border-white/14 bg-white/[0.02] px-3 py-2.5">
                    <p className="smx-kicker text-white/65">{step}</p>
                    <p className="mt-1 text-sm font-semibold text-[#f6f8ff]">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/63">{description}</p>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="smx-frame p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="smx-kicker">What You See Instantly</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">A control surface built for speed and trust.</h2>
            </div>
            <Link href="/ops" className="smx-button-secondary px-3 py-2 text-[11px]">
              Ops Posture
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "State-first workflow",
                description: "Upload, running, succeeded, and failed states stay visible without guesswork.",
                icon: ActivityIcon,
              },
              {
                title: "Evidence-ready outputs",
                description: "Compare original and processed tracks before export and expiry.",
                icon: Music3Icon,
              },
              {
                title: "Operator runway",
                description: "Queue depth, failed runs, and intervention guidance live on one route.",
                icon: GaugeIcon,
              },
              {
                title: "Fast routing",
                description: "One upload fans out into five tool workflows with direct next action.",
                icon: Layers3Icon,
              },
            ].map((card) => (
              <article key={card.title} className="smx-subframe hover-lift p-4">
                <span className="icon-pill size-9 rounded-lg">
                  <card.icon className="size-4" />
                </span>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="smx-frame p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="smx-kicker">Tool Matrix</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Pick a workflow and start processing now.</h2>
            </div>
            <span className="smx-chip">
              <Clock3Icon className="size-3.5" />
              Updated live
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TOOL_CONFIGS.map((tool) => {
              const Icon = iconBySlug[tool.slug] ?? AudioLinesIcon;
              const readiness = readinessByTool[tool.slug] ?? 86;

              return (
                <article key={tool.slug} className="smx-subframe hover-lift flex min-h-[13rem] flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="smx-chip">
                      <Icon className="size-3.5" />
                      {tool.navLabel}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{readiness}% ready</span>
                  </div>

                  <h3 className="mt-3 text-2xl font-semibold tracking-tight">{tool.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.marketingBlurb}</p>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-border/70 bg-background/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-coral),var(--brand-cobalt),var(--brand-mint))]"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>

                  <div className="mt-4 action-rail">
                    <Link href={tool.href} className="smx-button-primary px-3 py-2 text-[11px]">
                      Launch
                      <ArrowUpRightIcon className="size-3.5" />
                    </Link>
                    <span className="smx-chip">Audio In • Artifact Out</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
