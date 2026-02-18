import Link from "next/link";
import { IconArrowRight, IconBolt } from "@tabler/icons-react";
import { ToolTypeIcon } from "@/components/ui/semantic-icons";
import type { ToolConfig } from "@/lib/tool-config";

export function ToolOverviewCard({
  tool,
  variant = "catalog",
}: {
  tool: ToolConfig;
  variant?: "featured" | "catalog";
}) {
  const featured = variant === "featured";

  return (
    <article className={`feature-card signal-spine-x hover-lift rounded-md p-4 ${featured ? "min-h-[12rem]" : "min-h-[10.5rem]"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="metric-chip inline-flex items-center gap-2">
          <ToolTypeIcon toolType={tool.toolType} size={14} />
          {tool.navLabel}
        </span>
        {featured ? (
          <span className="metric-chip">
            <IconBolt size={12} />
            Featured
          </span>
        ) : null}
      </div>

      <h3 className={`display-title mt-4 ${featured ? "text-[1.8rem]" : "text-[1.36rem]"}`}>{tool.label}</h3>
      <p className="text-muted mt-2 max-w-[48ch] text-[0.75rem] leading-relaxed">{tool.marketingBlurb}</p>

      <div className="action-rail mt-4">
        <Link href={tool.href} className="button-primary rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em]">
          Process Audio
        </Link>
        <Link href={tool.href} className="button-secondary rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.08em]">
          Learn More
          <IconArrowRight size={12} />
        </Link>
      </div>
    </article>
  );
}
