"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type AdProviderProps = {
  enabled: boolean;
  clientId?: string;
  children: ReactNode;
};

function scriptAlreadyInjected() {
  return Boolean(document.querySelector('script[data-soundmaxx-adsense="true"]'));
}

export function AdProvider({ enabled, clientId, children }: AdProviderProps) {
  useEffect(() => {
    if (!enabled || !clientId) return;
    if (scriptAlreadyInjected()) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-soundmaxx-adsense", "true");

    const timer = window.setTimeout(() => {
      document.head.appendChild(script);
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, clientId]);

  return <>{children}</>;
}
