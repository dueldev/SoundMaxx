"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function OpsLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/ops/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json()) as { error?: string; entryToken?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Login failed");
      }
      if (!payload.entryToken) {
        throw new Error("Login failed");
      }

      router.replace(`/ops?entry=${encodeURIComponent(payload.entryToken)}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-20">
      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            SoundMaxx
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            Ops Login
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Enter the ops password to access dashboard metrics and training telemetry. A fresh password check is required
            for each Ops page visit.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10">
          <form onSubmit={onSubmit} className="brutal-card-flat max-w-md p-6 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="brutal-input"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" disabled={submitting} className="brutal-button-primary text-xs">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            {error ? (
              <p className="font-mono text-xs uppercase tracking-[0.08em]" style={{ color: "var(--destructive)" }}>
                {error}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
