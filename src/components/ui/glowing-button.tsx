import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

function withAlpha(input: string, alpha: number): string {
  if (input.startsWith("rgb")) {
    return input.replace(")", ` / ${alpha})`).replace("rgb(", "rgb(").replace("rgba(", "rgb(");
  }

  if (input.startsWith("#")) {
    let hex = input.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((value) => `${value}${value}`)
        .join("");
    }

    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return `color-mix(in srgb, var(--accent) ${Math.round(alpha * 100)}%, transparent)`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return `color-mix(in srgb, ${input} ${Math.round(alpha * 100)}%, transparent)`;
}

export function GlowingButton({
  children,
  className,
  glowColor = "var(--accent)",
  ...props
}: {
  children: ReactNode;
  className?: string;
  glowColor?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      style={
        {
          "--button-glow": withAlpha(glowColor, 0.38),
          "--button-glow-soft": withAlpha(glowColor, 0.16),
        } as CSSProperties
      }
      className={cn(
        "button-primary relative inline-flex min-h-10 overflow-hidden rounded-md border px-5 text-sm",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(125deg,var(--button-glow-soft),transparent_44%)]",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-[2px] after:bg-[var(--button-glow)]",
        className,
      )}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export { GlowingButton as Component };
