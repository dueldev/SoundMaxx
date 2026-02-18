import process from "node:process";
import { SEO_GUIDES } from "../src/lib/seo-guides";

type CliOptions = {
  baseUrl: string;
  canonicalBaseUrl: string;
  expectIndexable: boolean;
};

type FetchResult = {
  status: number;
  text: string;
  url: string;
};

type PageCheck = {
  path: string;
  requireStructuredData?: boolean;
};

const CORE_REQUIRED_PAGES: PageCheck[] = [
  { path: "/", requireStructuredData: true },
  { path: "/learn" },
  { path: "/about" },
  { path: "/contact" },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/tools/stem-isolation" },
  { path: "/tools/mastering" },
  { path: "/tools/key-bpm" },
  { path: "/tools/loudness-report" },
  { path: "/tools/midi-extract" },
];

const REQUIRED_PAGES: PageCheck[] = [
  ...CORE_REQUIRED_PAGES,
  ...SEO_GUIDES.map((guide) => ({
    path: `/guides/${guide.slug}`,
  })),
];

function usage() {
  return [
    "Usage:",
    "  tsx scripts/seo-smoke.ts [--base-url <url>] [--canonical-base-url <url>] [--expect-indexable <true|false>]",
    "",
    "Flags:",
    "  --base-url            URL to test (default https://www.soundmaxx.net)",
    "  --canonical-base-url  Canonical host expected in rel=canonical (default https://www.soundmaxx.net)",
    "  --expect-indexable    Whether pages should be indexable (default true)",
  ].join("\n");
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: "https://www.soundmaxx.net",
    canonicalBaseUrl: "https://www.soundmaxx.net",
    expectIndexable: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    const next = argv[index + 1];
    if ((arg === "--base-url" || arg === "--canonical-base-url" || arg === "--expect-indexable") && !next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--base-url") {
      options.baseUrl = normalizeBaseUrl(String(next));
      index += 1;
      continue;
    }
    if (arg === "--canonical-base-url") {
      options.canonicalBaseUrl = normalizeBaseUrl(String(next));
      index += 1;
      continue;
    }
    if (arg === "--expect-indexable") {
      options.expectIndexable = parseBoolean(String(next));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function fetchText(url: string): Promise<FetchResult> {
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  return {
    status: response.status,
    text,
    url: response.url,
  };
}

function normalizeCanonicalUrl(value: string) {
  const parsed = new URL(value);
  const normalizedPathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPathname}`;
}

function expectedCanonical(canonicalBaseUrl: string, path: string) {
  if (path === "/") {
    return `${canonicalBaseUrl}/`;
  }
  return `${canonicalBaseUrl}${path}`;
}

function extractCanonicalHrefs(html: string) {
  const canonicalTags = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi) ?? [];
  return canonicalTags
    .map((tag) => {
      const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
      return hrefMatch?.[1] ?? "";
    })
    .filter((href) => href.length > 0);
}

function hasNoindexMeta(html: string) {
  const robotsTags = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi) ?? [];
  return robotsTags.some((tag) => {
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    return content.includes("noindex");
  });
}

function extractJsonLdBlocks(html: string) {
  const blocks: string[] = [];
  const regex = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match = regex.exec(html);
  while (match) {
    blocks.push(match[1] ?? "");
    match = regex.exec(html);
  }

  return blocks;
}

function extractJsonLdTypes(html: string) {
  const blocks = extractJsonLdBlocks(html);
  const types = new Set<string>();

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const typeValue = (node as { "@type"?: unknown })["@type"];
        if (typeof typeValue === "string") {
          types.add(typeValue);
        } else if (Array.isArray(typeValue)) {
          for (const entry of typeValue) {
            if (typeof entry === "string") {
              types.add(entry);
            }
          }
        }
      }
    } catch {
      // Ignore malformed blocks, assertion step will fail if required data is missing.
    }
  }

  return types;
}

function extractSitemapLocs(xml: string) {
  const locs = new Set<string>();
  const regex = /<loc>([^<]+)<\/loc>/gi;

  let match = regex.exec(xml);
  while (match) {
    const value = match[1]?.trim();
    if (value) {
      locs.add(normalizeCanonicalUrl(value));
    }
    match = regex.exec(xml);
  }

  return locs;
}

function assertOrThrow(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  const robotsUrl = `${options.baseUrl}/robots.txt`;
  const sitemapUrl = `${options.baseUrl}/sitemap.xml`;

  const robots = await fetchText(robotsUrl);
  assertOrThrow(robots.status === 200, `Expected 200 for ${robotsUrl}, received ${robots.status}`);
  const robotsText = robots.text.toLowerCase();
  assertOrThrow(robotsText.includes("user-agent: *"), "robots.txt missing `User-agent: *`");
  assertOrThrow(robotsText.includes("allow: /"), "robots.txt missing `Allow: /`");
  assertOrThrow(robotsText.includes("disallow: /api/"), "robots.txt missing `Disallow: /api/`");
  assertOrThrow(robotsText.includes("disallow: /ops"), "robots.txt missing `Disallow: /ops`");
  assertOrThrow(
    robots.text.includes(`Sitemap: ${options.canonicalBaseUrl}/sitemap.xml`),
    "robots.txt missing canonical sitemap declaration",
  );

  const sitemap = await fetchText(sitemapUrl);
  assertOrThrow(sitemap.status === 200, `Expected 200 for ${sitemapUrl}, received ${sitemap.status}`);
  assertOrThrow(/<urlset\b/i.test(sitemap.text), "sitemap.xml missing `<urlset>` root");

  const locs = extractSitemapLocs(sitemap.text);
  for (const page of REQUIRED_PAGES) {
    const expected = normalizeCanonicalUrl(expectedCanonical(options.canonicalBaseUrl, page.path));
    assertOrThrow(locs.has(expected), `sitemap.xml missing URL: ${expected}`);
  }

  for (const page of REQUIRED_PAGES) {
    const pageUrl = `${options.baseUrl}${page.path}`;
    const fetched = await fetchText(pageUrl);
    assertOrThrow(fetched.status === 200, `Expected 200 for ${pageUrl}, received ${fetched.status}`);

    const canonicals = extractCanonicalHrefs(fetched.text);
    assertOrThrow(canonicals.length === 1, `${page.path} should have exactly one canonical link`);

    const canonicalActual = normalizeCanonicalUrl(canonicals[0]);
    const canonicalExpected = normalizeCanonicalUrl(expectedCanonical(options.canonicalBaseUrl, page.path));
    assertOrThrow(
      canonicalActual === canonicalExpected,
      `${page.path} canonical mismatch: expected ${canonicalExpected}, got ${canonicalActual}`,
    );

    const hasNoindex = hasNoindexMeta(fetched.text);
    if (options.expectIndexable) {
      assertOrThrow(!hasNoindex, `${page.path} unexpectedly contains noindex`);
    } else {
      assertOrThrow(hasNoindex, `${page.path} should contain noindex in non-indexable environments`);
    }

    if (page.requireStructuredData) {
      const jsonLdTypes = extractJsonLdTypes(fetched.text);
      assertOrThrow(jsonLdTypes.has("Organization"), "Homepage missing Organization JSON-LD");
      assertOrThrow(jsonLdTypes.has("WebSite"), "Homepage missing WebSite JSON-LD");
    }
  }

  console.log("SEO smoke check passed.");
  console.log(`Base URL: ${options.baseUrl}`);
  console.log(`Canonical URL: ${options.canonicalBaseUrl}`);
  console.log(`Indexable expected: ${options.expectIndexable}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SEO smoke check failed: ${message}`);
  process.exit(1);
});
