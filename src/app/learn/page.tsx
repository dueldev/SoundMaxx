import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { SEO_GUIDES } from "@/lib/seo-guides";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Audio Production Guides",
  description:
    "Explore practical guides for audio stem isolation, free audio mastering, key/BPM detection, loudness analysis, and audio-to-MIDI workflows.",
  path: "/learn",
});

export default function LearnPage() {
  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            Audio Production Guides
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Practical workflows for core production tasks including audio stem isolation, free audio mastering, key and BPM
            detection, loudness analysis, and audio-to-MIDI conversion.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 grid gap-5 md:grid-cols-2">
          {SEO_GUIDES.map((guide) => (
            <article key={guide.slug} className="brutal-card-flat p-6">
              <p
                className="font-mono text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Keyword: {guide.focusKeyword}
              </p>
              <h2 className="mt-2 text-xl font-bold leading-tight">{guide.title}</h2>
              <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {guide.description}
              </p>
              <Link href={`/guides/${guide.slug}`} className="brutal-button-primary mt-5 inline-flex text-xs">
                Read Guide
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
