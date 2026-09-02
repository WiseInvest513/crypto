import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/config/site";
import { listPublishedProductSlugs } from "@/server/products/product-catalog-service";

export const revalidate = 300;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, SITE_URL).toString(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = listPublishedProductSlugs().map(
    (slug) => ({
      url: new URL(`/products/${slug}`, SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...productRoutes];
}
