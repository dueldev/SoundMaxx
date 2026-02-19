"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slotId: string;
  label?: string;
  className?: string;
};

export function AdSlot({ slotId, label = "Advertisement", className }: AdSlotProps) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const enabled = Boolean(clientId);

  useEffect(() => {
    if (!enabled) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense can throw when script has not loaded yet.
    }
  }, [enabled, slotId]);

  return (
    <aside className={className} aria-label={label}>
      <div className="brutal-card-flat p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </p>
        {enabled ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", minHeight: 90 }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            Ad slot reserved.
          </p>
        )}
      </div>
    </aside>
  );
}
