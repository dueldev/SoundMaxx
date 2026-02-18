import type { Metadata } from "next";
import { env } from "@/lib/config";

export const BRAND_NAME = "SoundMaxx";
export const CANONICAL_SITE_URL = "https://www.soundmaxx.net";
export const DEFAULT_SITE_DESCRIPTION =
  "Command-deck audio workflows for stem isolation, mastering, key/BPM detection, loudness analysis, and MIDI extraction.";

function isValidUrl(value: string) {
  try {
    // Validate absolute URLs for metadata usage.
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function getSiteUrl() {
  return CANONICAL_SITE_URL;
}

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function getSameAs() {
  const sameAs = env.SEO_SAME_AS;
  if (!sameAs) {
    return [] as string[];
  }

  return sameAs
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && isValidUrl(value));
}

export function isIndexableEnvironment() {
  return env.VERCEL_ENV === "production";
}

export function getRobotsPolicy(): Metadata["robots"] {
  if (isIndexableEnvironment()) {
    return {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    };
  }

  return {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-video-preview": 0,
      "max-snippet": 0,
    },
  };
}

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function buildPageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const brandedTitle = `${title} | ${BRAND_NAME}`;
  const pageUrl = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    robots: getRobotsPolicy(),
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: BRAND_NAME,
      title: brandedTitle,
      description,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${BRAND_NAME} audio tools`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: brandedTitle,
      description,
      images: [absoluteUrl("/twitter-image")],
    },
  };
}
