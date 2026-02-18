import type { ReactNode } from "react";

export function ValueCard({
  eyebrow,
  title,
  description,
  icon,
  index,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  index: number;
}) {
  return (
    <article className="feature-card signal-spine-y hover-lift rounded-md p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="metric-chip">{String(index).padStart(2, "0")}</span>
        <span className="icon-pill">{icon}</span>
      </div>
      <p className="data-kicker">{eyebrow}</p>
      <h3 className="display-title mt-2 text-[1.22rem] leading-[0.98]">{title}</h3>
      <p className="text-muted mt-2 text-[0.76rem] leading-relaxed">{description}</p>
    </article>
  );
}
