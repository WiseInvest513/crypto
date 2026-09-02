import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/config/site";

export const revalidate = 300;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, SITE_URL).toString(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));

  return staticRoutes;
}
