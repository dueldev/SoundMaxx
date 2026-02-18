"use client";

import { useEffect, useState } from "react";
import { IconMoonStars, IconSunHigh } from "@tabler/icons-react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem("soundmaxx-theme");
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore storage access failures.
  }

  const current = document.documentElement.dataset.theme;
  return current === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("soundmaxx-theme", theme);
    } catch {
      // Ignore storage access failures.
    }
  }, [theme]);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="button-ghost h-9 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      {theme === "dark" ? <IconSunHigh size={14} /> : <IconMoonStars size={14} />}
      <span className="hidden md:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
