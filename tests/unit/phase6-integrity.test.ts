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

describe("Phase 6 products and referral integrity", () => {
  const publishedSlugs = [
    "binance",
    "coinbase",
    "kraken",
    "okx",
    "metamask",
    "ledger-hardware-wallet",
    "coingecko",
  ] as const;

  it("ships sourced production guides without inventing a referral relationship", () => {
    const source = readSource("src/content/products.ts");

    expect(productCatalogDraft.partners).toHaveLength(7);
    for (const partner of productCatalogDraft.partners) {
      expect(partner.allowedReferralHosts).toEqual([]);
    }
    expect(productCatalogDraft.products).toHaveLength(7);
    for (const product of productCatalogDraft.products) {
      expect(product.publicationStatus).toBe("published");
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

  it("uses async Next.js params and returns notFound for non-public product slugs", () => {
    const route = readSource("src/app/products/[slug]/page.tsx");

    expect(route).toContain("generateStaticParams");
    expect(route).toContain("listPublishedProductSlugs().map");
    expect(route).toContain("export async function generateMetadata");
    expect(route).toContain('PageProps<"/products/[slug]">');
    expect(route.match(/const \{ slug \} = await params/g)).toHaveLength(2);
    expect(route.match(/notFound\(\)/g)).toHaveLength(1);
    expect(route).toContain("dynamicParams = false");
    expect(route).not.toMatch(
      /\bsearchParams\b|\bredirect\s*\(|\bpermanentRedirect\s*\(|NextResponse\.redirect/,
    );
  });

  it("adds only published product-detail slugs to the sitemap", () => {
    const source = readSource("src/app/sitemap.ts");
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(listPublishedProductSlugs()).toEqual(publishedSlugs);
    expect(paths).toEqual([
      ...PUBLIC_ROUTES,
      ...publishedSlugs.map((slug) => `/products/${slug}`),
    ]);
    expect(source).toContain(
      'import { listPublishedProductSlugs } from "@/server/products/product-catalog-service"',
    );
    expect(source).toContain("listPublishedProductSlugs().map");
    expect(source).toContain("`/products/${slug}`");
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

  it("keeps the new public product experience in Simplified Chinese", () => {
    const publicUi = [
      "src/components/products/product-directory.tsx",
      "src/components/products/product-detail-page.tsx",
      "src/app/products/not-found.tsx",
      "src/app/products/loading.tsx",
    ]
      .map(readSource)
      .join("\n");

    for (const copy of [
      "加密产品指南",
      "暂无可用的产品指南",
      "客观对照",
      "来源与条款",
      "合作链接披露",
      "这份产品资料暂不可用",
      "尚未完成事实核验",
      "正在加载产品目录",
    ]) {
      expect(publicUi).toContain(copy);
    }
    expect(publicUi).not.toMatch(
      /No product guides|Product not found|Loading products|View partner|Referral disclosure/,
    );
  });
});
