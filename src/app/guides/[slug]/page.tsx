import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { SEO_GUIDES, getSeoGuideBySlug } from "@/lib/seo-guides";
import { BRAND_NAME, absoluteUrl, buildPageMetadata } from "@/lib/seo";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getSeoGuideBySlug(slug);

  if (!guide) {
    return {
      title: "Guide Not Found",
    };
  }

  return buildPageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getSeoGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  const guideUrl = absoluteUrl(`/guides/${guide.slug}`);
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
        name: "Audio Production Guides",
        item: absoluteUrl("/learn"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: guideUrl,
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "en-US",
    mainEntityOfPage: guideUrl,
    datePublished: "2026-02-18",
    dateModified: new Date().toISOString().slice(0, 10),
    author: {
      "@type": "Organization",
      name: BRAND_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/favicon.ico"),
      },
    },
    keywords: [guide.focusKeyword, "audio tools", "music production workflow"],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="accent-bar" />
      <div className="smx-shell">
        <section className="pt-10 pb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            Guide
          </p>
          <h1 className="mt-3 font-bold leading-tight" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
            {guide.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {guide.intro}
          </p>
        </section>

        <hr className="section-rule" />

        <section className="py-10 space-y-5">
          {guide.sections.map((section) => (
            <article key={section.heading} className="brutal-card-flat p-6">
              <h2 className="text-xl font-bold">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-2 grid gap-5 md:grid-cols-2">
          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ready to run this workflow
            </p>
            <h2 className="mt-2 text-xl font-bold">Use the corresponding SoundMaxx tool</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Launch the tool to apply this workflow directly in browser.
            </p>
            <Link href={guide.toolHref} className="brutal-button-primary mt-5 inline-flex text-xs">
              Open Tool
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </article>

          <article className="brutal-card-flat p-6">
            <p
              className="font-mono text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              FAQ
            </p>
            <h2 className="mt-2 text-xl font-bold">Common questions</h2>
            <div className="mt-4 space-y-4">
              {guide.faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="text-base font-bold">{faq.question}</h3>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="py-8">
          <Link href="/learn" className="brutal-button-ghost inline-flex text-xs">
            Back to all guides
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
