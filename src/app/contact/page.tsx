import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact",
  description: "Contact SoundMaxx for product support, business inquiries, or legal requests.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            Contact
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            For support, business, or legal inquiries related to SoundMaxx, use the contact address configured for your
            deployment and include relevant session or job identifiers when reporting an issue.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 grid gap-5 md:grid-cols-2">
          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Support requests</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Include steps to reproduce, affected tool, timestamp, and any visible error text. This helps reduce
              turnaround time for triage.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Business and legal</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              For partnerships, licensing, and formal requests, include organization name, request scope, and a direct
              reply channel.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
