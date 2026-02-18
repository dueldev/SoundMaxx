import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms",
  description: "Read the SoundMaxx usage terms summary for rights, responsibilities, and service limits.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            Terms
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            This page provides a concise terms summary for SoundMaxx usage. It does not replace formal legal terms where
            required by your deployment.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 space-y-5">
          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Rights and permissions</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Users should only process audio they own or are authorized to process.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Service limits</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Upload size, duration, and quota limits can apply based on deployment settings and operational safeguards.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Availability and updates</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Platform behavior, tools, and processing backends may change as the service is maintained and improved.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
