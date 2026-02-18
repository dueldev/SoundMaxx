import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolStudioPage } from "@/components/studio/tool-studio-page";
import { TOOL_CONFIGS, getToolConfigBySlug } from "@/lib/tool-config";
import { BRAND_NAME, absoluteUrl, buildPageMetadata } from "@/lib/seo";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

const TOOL_METADATA_OVERRIDES: Record<
  string,
  {
    title: string;
    description: string;
    focusKeyword: string;
  }
> = {
  "stem-isolation": {
    title: "Audio Stem Isolation Online",
    description:
      "Audio stem isolation tool for separating vocals, drums, bass, and instrumentals in browser-based workflows.",
    focusKeyword: "audio stem isolation",
  },
  mastering: {
    title: "Free Audio Mastering Online",
    description:
      "Free audio mastering workflow to improve loudness, tone, and release readiness directly in your browser.",
    focusKeyword: "free audio mastering",
  },
  "key-bpm": {
    title: "Key and BPM Detection Online",
    description:
      "Detect musical key and BPM online for DJ prep, production metadata tagging, and faster workflow decisions.",
    focusKeyword: "key bpm detection",
  },
  "loudness-report": {
    title: "Loudness Analysis Tool Online",
    description:
      "Run loudness analysis with LUFS and true-peak checks before release to validate streaming and delivery targets.",
    focusKeyword: "loudness analysis",
  },
  "midi-extract": {
    title: "Audio to MIDI Converter Online",
    description:
      "Audio to MIDI converter for extracting editable note data from melodic audio for production and arrangement workflows.",
    focusKeyword: "audio to midi converter",
  },
};

export function generateStaticParams() {
  return TOOL_CONFIGS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const toolConfig = getToolConfigBySlug(slug);

  if (!toolConfig) {
    return {
      title: "Tool Not Found",
    };
  }

  const override = TOOL_METADATA_OVERRIDES[toolConfig.slug];

  return buildPageMetadata({
    title: override?.title ?? toolConfig.label,
    description: override?.description ?? toolConfig.description,
    path: `/tools/${toolConfig.slug}`,
  });
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const toolConfig = getToolConfigBySlug(slug);

  if (!toolConfig) {
    notFound();
  }

  const override = TOOL_METADATA_OVERRIDES[toolConfig.slug];
  const focusKeyword = override?.focusKeyword ?? toolConfig.label.toLowerCase();
  const toolUrl = absoluteUrl(toolConfig.href);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tools",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: toolConfig.label,
        item: toolUrl,
      },
    ],
  };

  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${toolConfig.label} | ${BRAND_NAME}`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: override?.description ?? toolConfig.description,
    url: toolUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    keywords: [focusKeyword, "audio processing", "music production tool"],
    provider: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: absoluteUrl("/"),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }} />
      <ToolStudioPage toolConfig={toolConfig} />
    </>
  );
}
