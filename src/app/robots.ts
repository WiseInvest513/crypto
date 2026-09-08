import type { MetadataRoute } from "next";
import { isPublicIndexingEnabled, SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = isPublicIndexingEnabled();

  return {
    rules: {
      userAgent: "*",
      allow: allowIndexing ? "/" : undefined,
      disallow: allowIndexing
        ? ["/account", "/btc", "/eth", "/studio/", "/tools"]
        : "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
