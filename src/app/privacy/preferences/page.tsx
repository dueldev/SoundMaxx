"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Preferences = {
  adPersonalizationOptIn: boolean;
  doNotSellOrShare: boolean;
};

const DEFAULT_PREFS: Preferences = {
  adPersonalizationOptIn: false,
  doNotSellOrShare: true,
};

export default function PrivacyPreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/privacy/preferences", { cache: "no-store" });
        const payload = (await response.json()) as Preferences;
        if (!active) return;
        if (!response.ok) {
          throw new Error("Unable to load privacy preferences");
        }
        setPrefs(payload);
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Unable to load preferences");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/privacy/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prefs),
      });

      const payload = (await response.json()) as Preferences | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to save privacy preferences");
      }

      setPrefs(payload as Preferences);
      setStatus("Preferences saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save preferences");
    } finally {
      setSaving(false);
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
            Privacy Preferences
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Choose whether to allow ad personalization. Contextual ads remain enabled regardless of this setting.
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 space-y-4">
          <label className="flex cursor-pointer gap-3.5 border p-4" style={{ borderColor: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={prefs.adPersonalizationOptIn}
              disabled={loading || saving}
              onChange={(e) => {
                const nextAdPersonalization = e.target.checked;
                setPrefs((prev) => ({
                  ...prev,
                  adPersonalizationOptIn: nextAdPersonalization,
                  doNotSellOrShare: nextAdPersonalization ? prev.doNotSellOrShare : true,
                }));
              }}
            />
            <span>
              <span className="text-sm font-semibold">Allow personalized ads</span>
              <span className="mt-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                If disabled, SoundMaxx serves contextual ads only.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer gap-3.5 border p-4" style={{ borderColor: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={prefs.doNotSellOrShare}
              disabled={loading || saving || !prefs.adPersonalizationOptIn}
              onChange={(e) => setPrefs((prev) => ({ ...prev, doNotSellOrShare: e.target.checked }))}
            />
            <span>
              <span className="text-sm font-semibold">Do not sell or share my personal data</span>
              <span className="mt-1 block text-xs" style={{ color: "var(--muted-foreground)" }}>
                This applies to ad-related sharing controls for this session.
              </span>
            </span>
          </label>

          <div className="pt-2">
            <Button onClick={() => void save()} disabled={loading || saving} className="brutal-button-primary text-xs">
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>

          {status ? (
            <p className="font-mono text-xs uppercase tracking-[0.08em]" style={{ color: "var(--muted-foreground)" }}>
              {status}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
