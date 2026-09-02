import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { metadata as rootMetadata } from "../../src/app/layout";
import { metadata as btcMetadata } from "../../src/app/btc/page";
import { metadata as ethMetadata } from "../../src/app/eth/page";
import { metadata as toolsMetadata } from "../../src/app/tools/page";
import { metadata as positionSizeMetadata } from "../../src/app/tools/position-size/page";
import { metadata as leverageMetadata } from "../../src/app/tools/leverage/page";
import { metadata as dcaMetadata } from "../../src/app/tools/dca/page";
import { metadata as riskRewardMetadata } from "../../src/app/tools/risk-reward/page";
import { metadata as productsMetadata } from "../../src/app/products/page";
import { metadata as notFoundMetadata } from "../../src/app/not-found";
import { metadata as productNotFoundMetadata } from "../../src/app/products/not-found";
import robots from "../../src/app/robots";
import { generateMetadata as generateProductMetadata } from "../../src/app/products/[slug]/page";
import {
  isPublicIndexingEnabled,
  PRODUCTION_SITE_URL,
  resolveSiteUrl,
} from "../../src/config/site";

const routeMetadata = [
  ["/btc", btcMetadata],
  ["/eth", ethMetadata],
  ["/tools", toolsMetadata],
  ["/tools/position-size", positionSizeMetadata],
  ["/tools/leverage", leverageMetadata],
  ["/tools/dca", dcaMetadata],
  ["/tools/risk-reward", riskRewardMetadata],
  ["/products", productsMetadata],
] as const;

describe("SEO foundation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("publishes complete and unique metadata for every static child route", () => {
    const titles = new Set<string>();

    for (const [path, metadata] of routeMetadata) {
      expect(metadata).toMatchObject({
        alternates: { canonical: path },
        openGraph: {
          type: "website",
          url: path,
          siteName: "Wise Crypto",
          locale: "zh_CN",
        },
        twitter: {
          description: expect.any(String),
        },
      });
      expect(metadata.description).toEqual(expect.any(String));
      expect(String(metadata.description).length).toBeGreaterThan(20);
      expect(typeof metadata.title).toBe("string");
      titles.add(String(metadata.title));
    }

    expect(titles.size).toBe(routeMetadata.length);
  });

  it("uses the shared image only for the site and section pages", () => {
    expect(rootMetadata.openGraph).toMatchObject({
      images: [expect.objectContaining({ url: "/og.png", width: 1200, height: 630 })],
    });
    expect(toRecord(toolsMetadata.openGraph).images).toHaveLength(1);
    expect(toRecord(productsMetadata.openGraph).images).toHaveLength(1);

    for (const metadata of [
      btcMetadata,
      ethMetadata,
      positionSizeMetadata,
      leverageMetadata,
      dcaMetadata,
      riskRewardMetadata,
    ]) {
      expect(toRecord(metadata.openGraph).images).toEqual([]);
      expect(toRecord(metadata.twitter).images).toEqual([]);
    }
  });

  it("ships an exact 1200 by 630 PNG social card", () => {
    const image = readFileSync(join(process.cwd(), "public/og.png"));

    expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
    expect(image.byteLength).toBeLessThan(2_000_000);
  });

  it("creates complete product metadata and fail-closed metadata for unknown slugs", async () => {
    const published = await generateProductMetadata(
      productMetadataProps("binance"),
    );
    const missing = await generateProductMetadata(
      productMetadataProps("not-published"),
    );

    expect(published).toMatchObject({
      title: "Binance",
      alternates: { canonical: "/products/binance" },
      openGraph: {
        url: "/products/binance",
        siteName: "Wise Crypto",
        images: [],
      },
      twitter: { images: [] },
    });
    expect(missing).toMatchObject({
      alternates: { canonical: null },
      robots: { index: false, follow: false },
      openGraph: { images: [] },
      twitter: { images: [] },
    });
    expect(notFoundMetadata).toMatchObject({
      alternates: { canonical: null },
      robots: { index: false, follow: false },
    });
    expect(productNotFoundMetadata).toMatchObject({
      alternates: { canonical: null },
      robots: { index: false, follow: false },
    });
  });

  it("keeps canonical origins HTTPS-only and fixed in production", () => {
    expect(resolveSiteUrl(undefined, "development")).toBe(PRODUCTION_SITE_URL);
    expect(resolveSiteUrl("https://preview.example/", "preview")).toBe(
      "https://preview.example",
    );
    expect(() => resolveSiteUrl("http://example.com", "preview")).toThrow();
    expect(() => resolveSiteUrl("https://example.com/path", "preview")).toThrow();
    expect(() => resolveSiteUrl("https://user@example.com", "preview")).toThrow();
    expect(() => resolveSiteUrl("https://example.com", "production")).toThrow(
      PRODUCTION_SITE_URL,
    );
    expect(isPublicIndexingEnabled("production", PRODUCTION_SITE_URL)).toBe(true);
    expect(isPublicIndexingEnabled("preview", PRODUCTION_SITE_URL)).toBe(false);
    expect(isPublicIndexingEnabled("production", "https://example.com")).toBe(false);
  });

  it("fails robots closed outside the exact production environment", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(robots()).toMatchObject({
      rules: { userAgent: "*", disallow: "/" },
      host: PRODUCTION_SITE_URL,
      sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    });

    vi.stubEnv("VERCEL_ENV", "production");
    expect(robots()).toMatchObject({
      rules: { userAgent: "*", allow: "/" },
      host: PRODUCTION_SITE_URL,
      sitemap: `${PRODUCTION_SITE_URL}/sitemap.xml`,
    });
  });
});

function toRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function productMetadataProps(slug: string) {
  return {
    params: Promise.resolve({ slug }),
  } as unknown as Parameters<typeof generateProductMetadata>[0];
}
