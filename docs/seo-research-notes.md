# SEO Research Notes (Implemented)

## Primary Guidance Sources
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google page titles guidance: https://developers.google.com/search/docs/appearance/title-link
- Google snippets guidance: https://developers.google.com/search/docs/appearance/snippet
- Google canonicalization guidance: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google robots meta tag reference: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google sitemaps overview: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Google structured data introduction: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Google Breadcrumb structured data: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google Organization structured data: https://developers.google.com/search/docs/appearance/structured-data/organization

## Query Targets Added
- `soundmaxx` (brand)
- `audio stem isolation`
- `free audio mastering`
- `key bpm detection`
- `loudness analysis`
- `audio to midi converter`

## Implementation Mapping
- Crawl/index foundation:
  - `src/app/robots.ts`
  - `src/app/sitemap.ts`
- Canonical + metadata consistency:
  - `src/lib/seo.ts`
  - `src/app/layout.tsx`
  - `src/app/tools/[slug]/page.tsx`
- Structured data:
  - Organization + WebSite in layout
  - WebApplication + BreadcrumbList on tool pages
  - Article + FAQPage + BreadcrumbList on guide pages
- Query-intent content (non-UI invasive):
  - `src/app/learn/page.tsx`
  - `src/app/guides/[slug]/page.tsx`
  - `src/lib/seo-guides.ts`
- Guardrails:
  - `scripts/seo-smoke.ts`

## Notes on Ranking Guarantees
- Search rankings cannot be guaranteed by any implementation.
- This project implements the strongest on-site technical and content signals possible without changing existing UI/UX flows.
