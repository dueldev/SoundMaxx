import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy",
  description: "Review the SoundMaxx privacy summary, including retention windows and consent behavior.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const policyVersion = "2026-02-19";

  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            Privacy
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            This page summarizes default data handling behavior in SoundMaxx deployments. It is an informational summary
            and should be reviewed alongside your full legal policy text if your deployment requires one.
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
            Policy version {policyVersion}
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 space-y-5">
          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Retention window</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Uploaded sources and generated artifacts are retained for 24 hours by default and then removed by automated
              cleanup processes.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Consent handling</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Model-training use is implied by service use. By uploading or processing audio, users agree that uploaded
              inputs and generated outputs may be used for internal model training and quality improvement.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Operational logs</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Operational telemetry is used for service reliability, queue health monitoring, and incident response.
            </p>
          </article>

          <article className="brutal-card-flat p-6">
            <h2 className="text-xl font-bold">Analytics and monetization</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              SoundMaxx may use de-identified and aggregated usage analytics for sponsorship reporting and analytics
              partnerships. Aggregates are cohort-limited and exclude raw session identifiers and raw audio files.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
