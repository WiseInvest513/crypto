import { describe, expect, it } from "vitest";
import {
  parseProductCatalog,
  selectPublishedProductBySlug,
  selectPublishedProductSlugs,
  selectPublishedProducts,
  type Partner,
  type Product,
} from "../../src/lib/products/product-catalog";
import {
  getPublishedProductBySlug,
  listPublishedProducts,
  listPublishedProductSlugs,
  loadProductCatalog,
} from "../../src/server/products/product-catalog-service";

const NOW = Date.parse("2026-09-01T12:00:00.000Z");

function validPartner(): Partner {
  return {
    id: "verified-partner",
    name: "Verified Partner",
    website: "https://partner.example.com",
    allowedReferralHosts: ["partner.example.com"],
    logo: {
      src: "/partners/verified-partner.svg",
      alt: "Verified Partner 标志",
    },
    enabled: true,
  };
}

function validProduct(): Product {
  return {
    id: "verified-product",
    partnerId: "verified-partner",
    name: "Verified Product",
    slug: "verified-product",
    type: "exchange",
    logo: null,
    summary: "只用于验证产品目录 schema 的测试摘要。",
    website: "https://product.example.com",
    referralUrl: "https://partner.example.com/referral?code=test",
    referralCode: "TEST-CODE",
    bestFor: "只用于测试已核验的适用场景字段。",
    pros: ["测试优点事实。"],
    cons: ["测试限制事实。"],
    feeDescription: "测试费用说明，以官方条款为准。",
    tutorialUrl: "https://product.example.com/tutorial",
    wiseBenefit: "测试用途的 Wise 权益说明。",
    availability: {
      status: "restricted",
      description: "测试用途的地区限制说明。",
    },
    enabled: true,
    disclaimer: "测试免责声明，不构成投资建议。",
    sources: [
      {
        id: "official-product-page",
        label: "官方产品页",
        url: "https://product.example.com/facts",
      },
    ],
    lastVerifiedAt: "2026-08-30T12:00:00.000Z",
    termsUrl: "https://product.example.com/terms",
    promotionStartsAt: "2026-08-31T00:00:00.000Z",
    promotionEndsAt: "2026-09-30T23:59:59.000Z",
    publicationStatus: "published",
    contentVersion: "phase6.1",
  };
}

function validCatalog(): { partners: Partner[]; products: Product[] } {
  return {
    partners: [validPartner()],
    products: [validProduct()],
  };
}

describe("product catalog configuration", () => {
  it("accepts an empty draft while loading the verified production catalog", () => {
    expect(parseProductCatalog({ partners: [], products: [] })).toEqual({
      partners: [],
      products: [],
    });

    const production = loadProductCatalog(NOW);
    expect(production.publishedProducts).toHaveLength(7);
    expect(production.unpublishedCount).toBe(0);
    expect(listPublishedProducts(NOW)).toHaveLength(7);
    expect(listPublishedProductSlugs(NOW)).toEqual([
      "binance",
      "coinbase",
      "kraken",
      "okx",
      "metamask",
      "ledger-hardware-wallet",
      "coingecko",
    ]);
    expect(getPublishedProductBySlug("not-configured", NOW)).toBeNull();
  });

  it("resolves the partner and local logo for a complete active product", () => {
    const catalog = parseProductCatalog(validCatalog());
    const products = selectPublishedProducts(catalog, NOW);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "verified-product",
      slug: "verified-product",
      publicationStatus: "published",
      logo: {
        src: "/partners/verified-partner.svg",
        alt: "Verified Partner 标志",
      },
      partner: {
        id: "verified-partner",
        enabled: true,
      },
      availability: {
        status: "restricted",
        description: "测试用途的地区限制说明。",
      },
    });
    expect(selectPublishedProductSlugs(catalog, NOW)).toEqual([
      "verified-product",
    ]);
    expect(
      selectPublishedProductBySlug(catalog, "verified-product", NOW),
    ).toEqual(products[0]);
    expect(
      selectPublishedProductBySlug(catalog, "../verified-product", NOW),
    ).toBeNull();
  });

  it("strictly rejects unknown and missing fields", () => {
    const unknownTopLevel = {
      ...validCatalog(),
      generatedProducts: [],
    };
    expect(() => parseProductCatalog(unknownTopLevel)).toThrow(
      "contains unknown field generatedProducts",
    );

    const unknownProductField = validCatalog();
    Object.assign(unknownProductField.products[0], { fakeDiscount: "50%" });
    expect(() => parseProductCatalog(unknownProductField)).toThrow(
      "contains unknown field fakeDiscount",
    );

    const missingTerms = validCatalog();
    delete (missingTerms.products[0] as Partial<ReturnType<typeof validProduct>>)
      .termsUrl;
    expect(() => parseProductCatalog(missingTerms)).toThrow(
      "is missing required field termsUrl",
    );
  });

  it("requires safe HTTPS URLs without credentials", () => {
    const insecureReferral = validCatalog();
    insecureReferral.products[0].referralUrl = "http://partner.example.com/ref";
    expect(() => parseProductCatalog(insecureReferral)).toThrow(
      "referralUrl must use HTTPS",
    );

    const credentialedWebsite = validCatalog();
    credentialedWebsite.partners[0].website =
      "https://user:password@partner.example.com";
    expect(() => parseProductCatalog(credentialedWebsite)).toThrow(
      "must not contain URL credentials",
    );

    const invalidSource = validCatalog();
    invalidSource.products[0].sources[0].url = "javascript:alert(1)";
    expect(() => parseProductCatalog(invalidSource)).toThrow(
      "must use HTTPS",
    );
  });

  it("requires every referral destination to match an explicit partner hostname", () => {
    const emptyAllowlist = validCatalog();
    emptyAllowlist.partners[0].allowedReferralHosts = [];
    expect(() => parseProductCatalog(emptyAllowlist)).toThrow(
      "referralUrl hostname partner.example.com is not allowed",
    );

    for (const referralUrl of [
      "https://evil.example/join",
      "https://partner.example.com.evil.example/join",
      "https://offers.partner.example.com/join",
    ]) {
      const input = validCatalog();
      input.products[0].referralUrl = referralUrl;
      expect(() => parseProductCatalog(input)).toThrow(
        "referralUrl hostname",
      );
    }

    const explicitSubdomain = validCatalog();
    explicitSubdomain.partners[0].allowedReferralHosts = [
      "partner.example.com",
      "offers.partner.example.com",
    ];
    explicitSubdomain.products[0].referralUrl =
      "https://offers.partner.example.com/join?code=test";
    expect(() => parseProductCatalog(explicitSubdomain)).not.toThrow();

    const customPort = validCatalog();
    customPort.products[0].referralUrl =
      "https://partner.example.com:8443/join";
    expect(() => parseProductCatalog(customPort)).toThrow(
      "referralUrl must not use a custom port",
    );
  });

  it.each([
    "HTTPS://partner.example.com",
    "*.partner.example.com",
    "https://partner.example.com",
    "partner.example.com/path",
    "localhost",
    "127.0.0.1",
  ])("rejects an unsafe referral hostname entry %s", (hostname) => {
    const input = validCatalog();
    input.partners[0].allowedReferralHosts = [hostname];
    expect(() => parseProductCatalog(input)).toThrow();
  });

  it("rejects duplicate referral hostname entries", () => {
    const input = validCatalog();
    input.partners[0].allowedReferralHosts = [
      "partner.example.com",
      "partner.example.com",
    ];
    expect(() => parseProductCatalog(input)).toThrow(
      "must not contain duplicate hostnames",
    );
  });

  it("only accepts safe public-root paths for logos", () => {
    for (const src of [
      "https://partner.example.com/logo.svg",
      "//partner.example.com/logo.svg",
      "/partners/../secret.svg",
      "/partners/logo.svg?version=1",
      "/partners/logo.svg#mark",
      "/partners\\logo.svg",
    ]) {
      const input = validCatalog();
      if (input.partners[0].logo === null) {
        throw new Error("Test fixture requires a logo.");
      }
      input.partners[0].logo.src = src;
      expect(() => parseProductCatalog(input)).toThrow(
        "must be a safe public-root local path",
      );
    }

    const emptyAlt = validCatalog();
    if (emptyAlt.partners[0].logo === null) {
      throw new Error("Test fixture requires a logo.");
    }
    emptyAlt.partners[0].logo.alt = " ";
    expect(() => parseProductCatalog(emptyAlt)).toThrow(
      "alt must be a non-empty string",
    );
  });

  it("requires unique IDs and slugs and a known partner", () => {
    const duplicatePartner = validCatalog();
    duplicatePartner.partners.push({ ...validPartner() });
    expect(() => parseProductCatalog(duplicatePartner)).toThrow(
      "partners IDs must be unique",
    );

    const duplicateProduct = validCatalog();
    duplicateProduct.products.push({
      ...validProduct(),
      id: "second-product",
    });
    expect(() => parseProductCatalog(duplicateProduct)).toThrow(
      "products slugs must be unique",
    );

    const missingPartner = validCatalog();
    missingPartner.products[0].partnerId = "missing-partner";
    expect(() => parseProductCatalog(missingPartner)).toThrow(
      "references unknown partner ID missing-partner",
    );
  });

  it("requires complete, sourced and verified facts before publication", () => {
    const missingSummary = validCatalog();
    missingSummary.products[0].summary = null;
    expect(() => parseProductCatalog(missingSummary)).toThrow(
      "requires summary",
    );

    const noPros = validCatalog();
    noPros.products[0].pros = [];
    expect(() => parseProductCatalog(noPros)).toThrow(
      "requires at least one pro and one con",
    );

    const noSources = validCatalog();
    noSources.products[0].sources = [];
    expect(() => parseProductCatalog(noSources)).toThrow(
      "requires at least one source",
    );

    const unknownAvailability = validCatalog();
    unknownAvailability.products[0].availability = {
      status: "unknown",
      description: null,
    };
    expect(() => parseProductCatalog(unknownAvailability)).toThrow(
      "requires verified availability",
    );

    const noTerms = validCatalog();
    noTerms.products[0].termsUrl = null;
    expect(() => parseProductCatalog(noTerms)).toThrow("requires termsUrl");
  });

  it("allows incomplete facts only while the product remains unpublished", () => {
    const input = validCatalog();
    Object.assign(input.products[0], {
      publicationStatus: "unpublished",
      summary: null,
      website: null,
      referralUrl: null,
      referralCode: null,
      bestFor: null,
      pros: [],
      cons: [],
      feeDescription: null,
      wiseBenefit: null,
      availability: { status: "unknown", description: null },
      disclaimer: null,
      sources: [],
      lastVerifiedAt: null,
      termsUrl: null,
    });

    const catalog = parseProductCatalog(input);
    expect(selectPublishedProducts(catalog, NOW)).toEqual([]);
  });

  it("can publish an objective guide without a referral relationship", () => {
    const input = validCatalog();
    Object.assign(input.products[0], {
      referralUrl: null,
      referralCode: null,
      wiseBenefit: null,
      promotionStartsAt: null,
      promotionEndsAt: null,
    });

    const [product] = selectPublishedProducts(
      parseProductCatalog(input),
      NOW,
    );

    expect(product.referralUrl).toBeNull();
    expect(product.referralCode).toBeNull();
    expect(product.wiseBenefit).toBeNull();
  });

  it("never accepts a referral code without a configured referral URL", () => {
    const input = validCatalog();
    input.products[0].referralUrl = null;

    expect(() => parseProductCatalog(input)).toThrow(
      "cannot define referralCode without referralUrl",
    );
  });

  it("excludes unpublished, disabled, scheduled, expired and future-reviewed products", () => {
    const cases = [
      {
        id: "unpublished-product",
        publicationStatus: "unpublished",
      },
      { id: "disabled-product", enabled: false },
      {
        id: "scheduled-product",
        promotionStartsAt: "2026-09-02T00:00:00.000Z",
        promotionEndsAt: "2026-09-30T00:00:00.000Z",
      },
      {
        id: "expired-product",
        promotionStartsAt: "2026-08-01T00:00:00.000Z",
        promotionEndsAt: "2026-09-01T11:59:59.000Z",
      },
      {
        id: "future-reviewed-product",
        lastVerifiedAt: "2026-09-01T12:00:01.000Z",
      },
    ];
    const input = validCatalog();
    input.products = cases.map(
      (changes) =>
        ({
          ...validProduct(),
          ...changes,
          slug: changes.id,
        }) as Product,
    );

    const catalog = parseProductCatalog(input);
    expect(selectPublishedProducts(catalog, NOW)).toEqual([]);

    const disabledPartner = validCatalog();
    disabledPartner.partners[0].enabled = false;
    expect(
      selectPublishedProducts(parseProductCatalog(disabledPartner), NOW),
    ).toEqual([]);
  });

  it("uses inclusive promotion boundaries and validates the date window", () => {
    const catalog = parseProductCatalog(validCatalog());
    expect(
      selectPublishedProducts(
        catalog,
        Date.parse("2026-08-31T00:00:00.000Z"),
      ),
    ).toHaveLength(1);
    expect(
      selectPublishedProducts(
        catalog,
        Date.parse("2026-09-30T23:59:59.000Z"),
      ),
    ).toHaveLength(1);

    const unpaired = validCatalog();
    unpaired.products[0].promotionEndsAt = null;
    expect(() => parseProductCatalog(unpaired)).toThrow(
      "must be set together",
    );

    const reversed = validCatalog();
    reversed.products[0].promotionEndsAt =
      reversed.products[0].promotionStartsAt;
    expect(() => parseProductCatalog(reversed)).toThrow(
      "must be after promotionStartsAt",
    );
  });

  it("rejects impossible or non-UTC verification timestamps", () => {
    for (const timestamp of [
      "not-a-date",
      "2026-02-30T00:00:00.000Z",
      "2026-09-01T24:00:00.000Z",
      "2026-09-01T12:00:00+08:00",
    ]) {
      const input = validCatalog();
      input.products[0].lastVerifiedAt = timestamp;
      expect(() => parseProductCatalog(input)).toThrow(
        "must be a valid ISO 8601 UTC timestamp",
      );
    }
  });
});
