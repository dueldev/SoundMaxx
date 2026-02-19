import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexableEnvironment } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableEnvironment()) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      sitemap: absoluteUrl("/sitemap.xml"),
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/ops"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
