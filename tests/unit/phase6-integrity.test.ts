import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "../../src/app/sitemap";
import { PUBLIC_ROUTES } from "../../src/config/site";
import { productCatalogDraft } from "../../src/content/products";
import { listPublishedProductSlugs } from "../../src/server/products/product-catalog-service";

const PROJECT_ROOT = process.cwd();

function readSource(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("retired product-line integrity", () => {
  it("archives sourced historical guides without inventing a referral relationship", () => {
    const source = readSource("src/content/products.ts");

    expect(productCatalogDraft.partners).toHaveLength(7);
    for (const partner of productCatalogDraft.partners) {
      expect(partner.allowedReferralHosts).toEqual([]);
      expect(partner.enabled).toBe(false);
    }
    expect(productCatalogDraft.products).toHaveLength(7);
    for (const product of productCatalogDraft.products) {
      expect(product.publicationStatus).toBe("unpublished");
      expect(product.enabled).toBe(false);
      expect(product.sources.length).toBeGreaterThanOrEqual(3);
      expect(product.referralUrl).toBeNull();
      expect(product.referralCode).toBeNull();
      expect(product.wiseBenefit).toBeNull();
      expect(product.promotionStartsAt).toBeNull();
      expect(product.promotionEndsAt).toBeNull();
      expect(product.termsUrl).toMatch(/^https:\/\//);
      expect(product.lastVerifiedAt).toBe("2026-08-31T00:00:00.000Z");
    }
    expect(source).not.toMatch(/TODO|示例优惠|虚构权益/i);
    expect(source).not.toMatch(/[?&](?:ref|referral|affiliate|code)=/i);
  });

  it("permanently redirects legacy product URLs to the fixed main-site perks page", () => {
    const proxy = readSource("src/proxy.ts");
    const siteConfig = readSource("src/config/site.ts");

    expect(siteConfig).toContain(
      '"https://www.wise-invest.org/perk/crypto"',
    );
    expect(proxy).toContain('matcher: "/products/:path*"');
    expect(proxy).toContain(
      "NextResponse.redirect(WISE_INVEST_CRYPTO_PERKS_URL, 308)",
    );
    expect(proxy).not.toMatch(/\bsearchParams\b|\bparams\b|request\.nextUrl/);
  });

  it("removes retired product URLs from the public route list and sitemap", () => {
    const source = readSource("src/app/sitemap.ts");
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(listPublishedProductSlugs()).toEqual([]);
    expect(PUBLIC_ROUTES).not.toContain("/products");
    expect(paths).toEqual(PUBLIC_ROUTES);
    expect(paths.every((path) => !path.startsWith("/products"))).toBe(true);
    expect(source).not.toContain("listPublishedProductSlugs");
    expect(source).not.toMatch(/productCatalogDraft|publicationStatus/);
  });

  it("keeps referral destinations in validated data rather than route parameters", () => {
    const referralLink = readSource(
      "src/components/products/referral-link.tsx",
    );
    const detail = readSource(
      "src/components/products/product-detail-page.tsx",
    );
    const directory = readSource(
      "src/components/products/product-directory.tsx",
    );

    expect(referralLink).toContain("url.protocol === \"https:\"");
    expect(referralLink).toContain(
      'rel="sponsored nofollow noopener noreferrer"',
    );
    expect(detail).toContain("href={product.referralUrl}");
    expect(`${detail}\n${directory}`).not.toMatch(/href=["']https?:\/\//i);
    expect(`${referralLink}\n${detail}`).not.toMatch(
      /\bsearchParams\b|\bredirect\s*\(|\bpermanentRedirect\s*\(/,
    );
  });

  it("keeps the dormant validated catalog reusable without serving it publicly", () => {
    const proxy = readSource("src/proxy.ts");

    expect(productCatalogDraft.products).toHaveLength(7);
    expect(proxy).not.toMatch(
      /product-catalog-service|components\/products/,
    );
  });
});
