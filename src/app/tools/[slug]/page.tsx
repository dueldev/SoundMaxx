import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolStudioPage } from "@/components/studio/tool-studio-page";
import { TOOL_CONFIGS, getToolConfigBySlug } from "@/lib/tool-config";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return TOOL_CONFIGS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const toolConfig = getToolConfigBySlug(slug);

  if (!toolConfig) {
    return {
      title: "Tool Not Found | SoundMaxx",
    };
  }

  return {
    title: `${toolConfig.label} | SoundMaxx`,
    description: toolConfig.description,
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const toolConfig = getToolConfigBySlug(slug);

  if (!toolConfig) {
    notFound();
  }

  return <ToolStudioPage toolConfig={toolConfig} />;
}
