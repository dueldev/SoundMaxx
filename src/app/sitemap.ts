import type { MetadataRoute } from "next";
import { TOOL_CONFIGS } from "@/lib/tool-config";
import { SEO_GUIDES } from "@/lib/seo-guides";
import { absoluteUrl } from "@/lib/seo";

const STATIC_PUBLIC_ROUTES = ["/", "/learn", "/about", "/contact", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));

  const toolEntries: MetadataRoute.Sitemap = TOOL_CONFIGS.map((tool) => ({
    url: absoluteUrl(tool.href),
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guideEntries: MetadataRoute.Sitemap = SEO_GUIDES.map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [...staticEntries, ...toolEntries, ...guideEntries];
}
