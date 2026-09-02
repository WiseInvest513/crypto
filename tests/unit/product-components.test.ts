import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductDetailPage } from "../../src/components/products/product-detail-page";
import { ProductDirectory } from "../../src/components/products/product-directory";
import type { ResolvedProduct } from "../../src/lib/products/product-catalog";

function verifiedProduct(
  changes: Partial<ResolvedProduct> = {},
): ResolvedProduct {
  return {
    id: "verified-product",
    partnerId: "verified-partner",
    name: "已核验测试产品",
    slug: "verified-product",
    type: "exchange",
    logo: null,
    summary: "只用于验证产品页面展示结构的测试摘要。",
    website: "https://product.example.com",
    referralUrl: "https://partner.example.com/join?ref=VERIFIED",
    referralCode: "VERIFIED-CODE",
    bestFor: "只用于验证适用场景文案的测试用户。",
    pros: ["已核验测试优点。", "第二项已核验测试优点。"],
    cons: ["已核验测试限制。"],
    feeDescription: "测试费用说明；实际费用以官方条款为准。",
    tutorialUrl: "https://product.example.com/tutorial",
    wiseBenefit: "已核验的测试权益说明。",
    availability: {
      status: "restricted",
      description: "仅限测试地区，资格条件以官方页面为准。",
    },
    enabled: true,
    disclaimer: "测试免责声明，不构成投资或产品建议。",
    sources: [
      {
        id: "official-facts",
        label: "官方产品事实页",
        url: "https://product.example.com/facts",
      },
    ],
    lastVerifiedAt: "2026-08-30T12:00:00.000Z",
    termsUrl: "https://product.example.com/terms",
    promotionStartsAt: "2026-08-01T00:00:00.000Z",
    promotionEndsAt: "2026-09-30T23:59:59.000Z",
    publicationStatus: "published",
    contentVersion: "phase6.1",
    partner: {
      id: "verified-partner",
      name: "已核验测试合作方",
      website: "https://partner.example.com",
      allowedReferralHosts: ["partner.example.com"],
      logo: null,
      enabled: true,
    },
    ...changes,
  };
}

describe("Phase 6 product presentation", () => {
  it("server-renders an honest Chinese empty state without placeholder offers", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDirectory, {
        products: [],
        unpublishedCount: 2,
      }),
    );

    expect(html).toContain("加密产品指南");
    expect(html).toContain("暂无可用的产品指南");
    expect(html).toContain("2 个待核验");
    expect(html).toContain("不展示示例优惠或虚构权益");
    expect(html).toContain("客观 Pros / Cons");
    expect(html).not.toContain("限时优惠");
    expect(html).not.toContain("立即领取");
  });

  it("server-renders only verified directory facts and a shareable detail URL", () => {
    const product = verifiedProduct();
    const html = renderToStaticMarkup(
      createElement(ProductDirectory, {
        products: [product],
        unpublishedCount: 0,
      }),
    );

    expect(html).toContain(product.name);
    expect(html).toContain(product.summary);
    expect(html).toContain(product.bestFor);
    expect(html).toContain(product.cons[0]);
    expect(html).toContain('href="/products/verified-product"');
    expect(html).toContain("含已披露合作链接");
    expect(html).toContain("不是广告榜单");
    expect(html).not.toContain(product.referralUrl as string);
  });

  it("server-renders balanced facts, verification sources and referral disclosure", () => {
    const product = verifiedProduct();
    const html = renderToStaticMarkup(
      createElement(ProductDetailPage, { product }),
    );

    expect(html).toContain("Pros · 已核验优点");
    expect(html).toContain("已核验测试优点。");
    expect(html).toContain("Cons · 已核验限制");
    expect(html).toContain("已核验测试限制。");
    expect(html).toContain(product.feeDescription);
    expect(html).toContain(product.availability.description);
    expect(html).toContain("官方产品事实页");
    expect(html).toContain(product.sources[0].url);
    expect(html).toContain("官方条款与条件");
    expect(html).toContain(product.termsUrl);
    expect(html).toContain("合作链接披露");
    expect(html).toContain("访问合作方");
    expect(html).toContain("Referral Code");
    expect(html).toContain("VERIFIED-CODE");
    expect(html).toContain('rel="sponsored nofollow noopener noreferrer"');
    expect(
      html.match(/rel="sponsored nofollow noopener noreferrer"/g),
    ).toHaveLength(1);
  });

  it("does not render a partner CTA, code or disclosure without a referral relationship", () => {
    const product = verifiedProduct({
      referralUrl: null,
      referralCode: null,
      wiseBenefit: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
    });
    const html = renderToStaticMarkup(
      createElement(ProductDetailPage, { product }),
    );

    expect(html).not.toContain("访问合作方");
    expect(html).not.toContain("合作链接披露");
    expect(html).not.toContain("Referral Code");
    expect(html).not.toContain("VERIFIED-CODE");
    expect(html).not.toContain("sponsored nofollow noopener noreferrer");
    expect(html).toContain("官方网站");
    expect(html).toContain("Pros · 已核验优点");
    expect(html).toContain("Cons · 已核验限制");
  });
});
