import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description: "Learn what SoundMaxx provides and how its producer-focused audio workflows are designed.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            About
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx is an audio tool studio built for producers who need practical, repeatable workflows. The platform
            focuses on real processing outcomes including stem isolation, mastering, key and BPM detection, loudness
            analysis, and MIDI extraction.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 space-y-6">
          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">What we optimize for</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Fast iteration, explicit workflow state, and clear output handling are core product goals. SoundMaxx keeps
              production tasks direct: upload audio, configure a tool, run processing, and compare exported results.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Platform scope</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              The current platform includes five production-oriented tools and a browser workflow that emphasizes
              transparency around queue state, processing status, and result availability.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
