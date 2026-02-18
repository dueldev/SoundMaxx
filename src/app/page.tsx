import Link from "next/link";
import { ArrowRightIcon, ArrowDownIcon, ZapIcon, LayoutGridIcon, SlidersHorizontalIcon } from "lucide-react";
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


const MINI_WAVEFORM_HEIGHTS = [14, 28, 40, 20, 50, 32, 44, 22, 38, 26, 50, 18, 38, 30, 22, 44, 36, 26];

export default function Home() {
  return (
    <div>
      {/* ── Orange accent bar ──────────────────────────────────────────── */}
      <div className="accent-bar" />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="pt-12 pb-10 md:pt-20 md:pb-16 relative overflow-hidden"
        style={{ minHeight: "clamp(420px, 60vh, 640px)" }}
      >
        {/* Dot-grid background */}
        <div className="smx-hero-dot-grid" aria-hidden="true" />

        <div className="smx-shell">
          <div className="relative z-10">
            {/* Kicker */}
            <div className="flex items-center gap-3 mb-6 animate-hero-0">
              <span className="accent-rule-h" />
              <p
                className="font-mono text-xs font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                SoundMaxx · Audio Tool Studio · Est. 2025
              </p>
            </div>

            {/* Headline */}
            <h1
              className="font-bold leading-[0.9] tracking-[-0.03em]"
              style={{ fontSize: "clamp(2.4rem, 10vw, 7rem)" }}
            >
              <span className="block animate-hero-1">Professional</span>
              <span className="block animate-hero-2">Audio Tools.</span>
              <span className="block animate-hero-3" style={{ color: "var(--accent)" }}>
                All Signal. No Noise.
              </span>
            </h1>

            <p
              className="mt-8 max-w-2xl text-base leading-relaxed md:text-lg animate-hero-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Stem isolation, mastering, key detection, loudness analysis, and MIDI
              extraction — all in one place, with full visibility at every step.
            </p>

            <div className="mt-10 flex flex-wrap gap-3 animate-hero-5">
              <Link href="/tools/stem-isolation" className="brutal-button-primary">
                Open Studio
                <ArrowRightIcon className="size-3.5" />
              </Link>
              <a href="#tools" className="brutal-button-ghost">
                Explore Tools
                <ArrowDownIcon className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker marquee ────────────────────────────────────────────── */}
      <div className="ticker-strip mt-10 md:mt-16" aria-hidden="true">
        <div className="ticker-inner">
          {TICKER_DOUBLED.map((item, i) => (
            <span key={i} className="inline-flex items-center">
              <span className="ticker-item">{item}</span>
              <span className="ticker-sep">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Stats — dark inverted stripe ──────────────────────────────── */}
      <div className="smx-dark-stripe">
        <div className="smx-shell">
          <div className="pt-10 pb-2">
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "rgba(245,243,238,0.4)" }}>
                Platform at a Glance
              </span>
              <span className="flex-1 h-px" style={{ background: "rgba(245,243,238,0.12)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 pb-12 md:grid-cols-4">
            {[
              { label: "Tools Available", value: String(TOOL_CONFIGS.length) },
              { label: "Session Retention", value: "24h" },
              { label: "Queue Target", value: "<12s" },
              { label: "Workflow States", value: "5" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border-l-2 pl-4 smx-stat-reveal"
                style={{ borderColor: "var(--accent)" }}
              >
                <span
                  className="font-mono text-4xl font-bold leading-none md:text-5xl"
                  style={{ color: "var(--background)" }}
                >
                  {stat.value}
                </span>
                <p
                  className="mt-1.5 font-mono text-xs uppercase tracking-[0.14em]"
                  style={{ color: "rgba(245,243,238,0.45)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content shell ────────────────────────────────────────── */}
      <div className="smx-shell">

        {/* ── Feature highlights row ──────────────────────────────────── */}
        <section className="py-16">
          <div className="mb-10">
            <hr className="accent-rule mb-4" />
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}
            >
              Why SoundMaxx
            </h2>
          </div>
          <div className="smx-feature-highlights">
            {[
              {
                Icon: ZapIcon,
                title: "No Account Required",
                body: "Start processing immediately. Drop a file, pick a tool, get results — no sign-up, no friction.",
              },
              {
                Icon: LayoutGridIcon,
                title: "5 Pro-Grade Tools",
                body: "Stem isolation, mastering, key + BPM detection, loudness analysis, and MIDI extraction in one place.",
              },
              {
                Icon: SlidersHorizontalIcon,
                title: "A/B Comparison",
                body: "Side-by-side playback of original and processed audio on every job before you export.",
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="smx-feature-highlight-item">
                <Icon
                  className="size-5"
                  style={{ color: "var(--accent)" }}
                  strokeWidth={2}
                />
                <h3 className="mt-4 font-bold text-base leading-tight">{title}</h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Tool matrix — bento grid ────────────────────────────────── */}
        <section id="tools" className="py-16">
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

          <div className="smx-bento">
            {TOOL_CONFIGS.map((tool, index) => {
              const readiness = readinessByTool[tool.slug] ?? 86;
              const num = String(index + 1).padStart(2, "0");
              const isFeatured = index === 0;

              if (isFeatured) {
                return (
                  <Link
                    key={tool.slug}
                    href={tool.href}
                    className="group flex flex-col smx-bento-featured"
                    style={{
                      padding: "2rem",
                      background: "var(--foreground)",
                      color: "var(--background)",
                      border: "1.5px solid var(--foreground)",
                      boxShadow: "4px 4px 0 rgba(255,59,0,0.4)",
                      transition: "box-shadow 120ms ease, border-color 120ms ease",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="font-mono font-bold leading-none"
                        style={{ color: "var(--accent)", fontSize: "3.5rem" }}
                      >
                        {num}
                      </span>
                      <span
                        className="tag font-mono"
                        style={{ borderColor: "rgba(245,243,238,0.25)", color: "rgba(245,243,238,0.55)" }}
                      >
                        {readiness}%
                      </span>
                    </div>

                    <h3
                      className="font-bold leading-tight"
                      style={{ marginTop: "1.5rem", fontSize: "1.75rem", color: "var(--background)" }}
                    >
                      {tool.label}
                    </h3>
                    <p
                      className="mt-2 flex-1 text-base leading-relaxed"
                      style={{ color: "rgba(245,243,238,0.6)" }}
                    >
                      {tool.marketingBlurb}
                    </p>

                    <div className="smx-mini-waveform mt-6" aria-hidden="true">
                      {MINI_WAVEFORM_HEIGHTS.map((h, i) => (
                        <span
                          key={i}
                          className="smx-mini-waveform-bar smx-panel-bar"
                          style={{ height: `${h}px`, animationDelay: `${((i * 0.08) % 1.2).toFixed(2)}s` }}
                        />
                      ))}
                    </div>

                    <div
                      className="mt-6 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.1em]"
                      style={{ color: "rgba(245,243,238,0.75)" }}
                    >
                      Launch
                      <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={tool.slug}
                  href={tool.href}
                  className="brutal-card-interactive group flex flex-col"
                  style={{ padding: "1.5rem" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className="font-mono font-bold leading-none"
                      style={{ color: "var(--accent)", fontSize: "2.5rem" }}
                    >
                      {num}
                    </span>
                    <span className="tag font-mono">{readiness}%</span>
                  </div>

                  <h3
                    className="font-bold leading-tight"
                    style={{ marginTop: "1.25rem", fontSize: "1.2rem" }}
                  >
                    {tool.label}
                  </h3>
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

        {/* ── How it works ────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mb-10">
            <hr className="accent-rule mb-4" />
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}
            >
              How It Works
            </h2>
          </div>

          <div className="smx-steps">
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
              <div key={num} className="smx-step">
                <span className="smx-step-watermark" aria-hidden="true">{num}</span>
                <div className="smx-step-content">
                  <span
                    className="absolute -left-px top-0 h-10 w-[2px]"
                    style={{ background: "var(--accent)" }}
                  />
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p
                    className="mt-3 text-base leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* ── Footer CTA — dark stripe ──────────────────────────────────── */}
      <div className="smx-dark-footer-cta">
        <div className="smx-shell">
          <div className="flex flex-col gap-6 py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <p
                className="font-mono text-xs font-semibold uppercase tracking-[0.2em] mb-3"
                style={{ color: "rgba(245,243,238,0.45)" }}
              >
                Ready when you are
              </p>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)", color: "var(--background)" }}
              >
                Start processing today.
              </h2>
              <p
                className="mt-2 text-base"
                style={{ color: "rgba(245,243,238,0.55)" }}
              >
                No account required. Sessions last 24 hours.
              </p>
            </div>
            <Link href="/tools/stem-isolation" className="brutal-button-primary whitespace-nowrap">
              Open Studio
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
