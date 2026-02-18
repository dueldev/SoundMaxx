import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { TOOL_CONFIGS } from "@/lib/tool-config";

const readinessByTool: Record<string, number> = {
  "stem-isolation": 96,
  mastering: 93,
  "key-bpm": 92,
  "loudness-report": 91,
  "midi-extract": 88,
};

const TICKER_ITEMS = [
  "Stem Isolation",
  "Mastering",
  "Key + BPM Detection",
  "Loudness Report",
  "MIDI Extraction",
];
const TICKER_DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

export default function Home() {
  return (
    <div className="pb-24">
      {/* ── Orange accent bar ──────────────────────────────────────────── */}
      <div className="accent-bar" />

      <div className="smx-shell">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="animate-rise pt-12 pb-10 md:pt-20 md:pb-16">
          <p
            className="mb-6 font-mono text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            SoundMaxx · Audio Tool Studio · Est. 2025
          </p>

          <h1
            className="font-bold leading-[0.88] tracking-[-0.03em]"
            style={{ fontSize: "clamp(3.2rem, 11vw, 8rem)" }}
          >
            Professional
            <br />
            Audio Tools.
            <br />
            <span style={{ color: "var(--accent)" }}>Zero Hidden States.</span>
          </h1>

          <p
            className="mt-8 max-w-2xl text-base leading-relaxed md:text-lg"
            style={{ color: "var(--muted-foreground)" }}
          >
            Stem isolation, mastering, key detection, loudness analysis, and MIDI
            extraction — all with transparent upload, process, and export states.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/tools/stem-isolation" className="brutal-button-primary">
              Open Studio
              <ArrowRightIcon className="size-3.5" />
            </Link>
            <Link href="/ops" className="brutal-button-ghost">
              Ops Dashboard
            </Link>
          </div>
        </section>
      </div>

      {/* ── Ticker marquee ────────────────────────────────────────────── */}
      <div className="ticker-strip" aria-hidden="true">
        <div className="ticker-inner">
          {TICKER_DOUBLED.map((item, i) => (
            <span key={i} className="inline-flex items-center">
              <span className="ticker-item">{item}</span>
              <span className="ticker-sep">◆</span>
            </span>
          ))}
        </div>
      </div>

      <div className="smx-shell">
        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <section className="py-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { label: "Tools Available", value: String(TOOL_CONFIGS.length) },
              { label: "Session Retention", value: "24h" },
              { label: "Queue Target", value: "<12s" },
              { label: "Workflow States", value: "5" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-l-2 pl-4"
                style={{ borderColor: "var(--foreground)" }}
              >
                <span className="font-mono text-4xl font-bold leading-none md:text-5xl">
                  {stat.value}
                </span>
                <p
                  className="mt-1.5 font-mono text-xs uppercase tracking-[0.14em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Tool matrix ───────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <hr className="accent-rule mb-4" />
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
              >
                The Tools
              </h2>
            </div>
            <span className="tag">All {TOOL_CONFIGS.length} Available</span>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {TOOL_CONFIGS.map((tool, index) => {
              const readiness = readinessByTool[tool.slug] ?? 86;
              const num = String(index + 1).padStart(2, "0");

              return (
                <Link
                  key={tool.slug}
                  href={tool.href}
                  className="brutal-card-interactive group flex flex-col p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className="font-mono text-4xl font-bold leading-none"
                      style={{ color: "var(--accent)" }}
                    >
                      {num}
                    </span>
                    <span className="tag font-mono">{readiness}%</span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold leading-tight">{tool.label}</h3>
                  <p
                    className="mt-2 flex-1 text-base leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {tool.marketingBlurb}
                  </p>

                  <div className="mt-6 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.1em]">
                    Launch
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="mb-10">
            <hr className="accent-rule mb-4" />
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
            >
              How It Works
            </h2>
          </div>

          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Upload",
                body: "Drop your audio file, confirm rights, and stage it for processing. WAV, MP3, FLAC, AAC, OGG, and M4A supported. Files are retained for 24 hours.",
              },
              {
                num: "02",
                title: "Configure & Run",
                body: "Select tool parameters — stems, mastering preset, LUFS target — then submit. Track live queue position, progress, and ETA without leaving the page.",
              },
              {
                num: "03",
                title: "Compare & Export",
                body: "A/B listen to original and processed audio side-by-side. Download artifacts before they expire. Every state is visible and explicit.",
              },
            ].map(({ num, title, body }) => (
              <div
                key={num}
                className="relative border-l-2 pl-7"
                style={{ borderColor: "var(--foreground)" }}
              >
                <span
                  className="absolute -left-px top-0 h-10 w-[2px]"
                  style={{ background: "var(--accent)" }}
                />
                <span
                  className="font-mono text-5xl font-bold leading-none"
                  style={{ color: "var(--muted-foreground)", opacity: 0.35 }}
                >
                  {num}
                </span>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p
                  className="mt-3 text-base leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <section
          className="py-14 border-t-2"
          style={{ borderColor: "var(--foreground)" }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)" }}
              >
                Ready to process?
              </h2>
              <p
                className="mt-2 text-base"
                style={{ color: "var(--muted-foreground)" }}
              >
                No account required. Sessions last 24 hours.
              </p>
            </div>
            <Link href="/tools/stem-isolation" className="brutal-button-primary whitespace-nowrap">
              Start Now
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
