import { describe, expect, it } from "vitest";
import {
  createProductAnalytics,
  productAnalytics,
  type ProductAnalyticsAdapter,
  type ProductAnalyticsEvent,
  type ReferralClickContext,
} from "../../src/lib/analytics/product-analytics";

const detailContext = {
  slug: "example-product",
  placement: "product_detail",
  sourcePage: "/products/example-product",
  contentVersion: "phase6.1",
} as const;

const indexContext = {
  slug: "example-product",
  placement: "products_index",
  sourcePage: "/products",
  contentVersion: "phase6.1",
} as const;

describe("product analytics facade", () => {
  it("is a callable noop by default", () => {
    expect(() => productAnalytics.trackProductView(detailContext)).not.toThrow();
    expect(() =>
      productAnalytics.trackReferralClick(indexContext),
    ).not.toThrow();
    expect(() =>
      productAnalytics.trackTutorialClick(detailContext),
    ).not.toThrow();
  });

  it("dispatches all three events with only the explicit context", () => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackProductView(detailContext);
    analytics.trackReferralClick(indexContext);
    analytics.trackTutorialClick(detailContext);

    expect(events).toEqual([
      { name: "product_view", payload: detailContext },
      { name: "referral_click", payload: indexContext },
      { name: "tutorial_click", payload: detailContext },
    ]);
    expect(events.every(Object.isFrozen)).toBe(true);
    expect(events.every((event) => Object.isFrozen(event.payload))).toBe(true);
  });

  it.each([
    "referralUrl",
    "referralCode",
    "website",
    "href",
    "url",
    "user",
    "userId",
    "accountId",
    "sessionId",
    "email",
    "walletAddress",
    "metadata",
  ])("rejects the sensitive or arbitrary field %s at runtime", (field) => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackReferralClick({
      ...detailContext,
      [field]: field === "metadata" ? { userId: "user-1" } : "secret",
    } as unknown as ReferralClickContext);

    expect(events).toEqual([]);
  });

  it("rejects symbol keys and non-plain input records", () => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });
    const withSymbol = {
      ...detailContext,
      [Symbol("private")]: "secret",
    } as unknown as ReferralClickContext;
    const inherited = Object.create(detailContext) as ReferralClickContext;

    analytics.trackReferralClick(withSymbol);
    analytics.trackReferralClick(inherited);

    expect(events).toEqual([]);
  });

  it.each([
    { ...detailContext, slug: "" },
    { ...detailContext, slug: "Example_Product" },
    { ...detailContext, slug: "example--product" },
    {
      ...detailContext,
      slug: "p".repeat(65),
      sourcePage: `/products/${"p".repeat(65)}`,
    },
    { ...detailContext, sourcePage: "/products/another-product" },
    { ...detailContext, sourcePage: "/products" },
    { ...detailContext, placement: "unknown" },
    { ...detailContext, contentVersion: "" },
    { ...detailContext, contentVersion: "contains spaces" },
    { ...detailContext, contentVersion: "v".repeat(65) },
  ])("drops malformed detail context %#", (context) => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackReferralClick(context as unknown as ReferralClickContext);

    expect(events).toEqual([]);
  });

  it("requires index placement and source page to agree", () => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackReferralClick({
      ...indexContext,
      sourcePage: "/products/example-product",
    });
    analytics.trackReferralClick({
      ...detailContext,
      sourcePage: "/products",
    });

    expect(events).toEqual([]);
  });

  it("allows index placement only for referral clicks", () => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackProductView(
      indexContext as unknown as Parameters<
        typeof analytics.trackProductView
      >[0],
    );
    analytics.trackTutorialClick(
      indexContext as unknown as Parameters<
        typeof analytics.trackTutorialClick
      >[0],
    );

    expect(events).toEqual([]);
  });

  it("supports a valid context without an optional content version", () => {
    const events: ProductAnalyticsEvent[] = [];
    const analytics = createProductAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackProductView({
      slug: "example-product",
      placement: "product_detail",
      sourcePage: "/products/example-product",
    });

    expect(events).toEqual([
      {
        name: "product_view",
        payload: {
          slug: "example-product",
          placement: "product_detail",
          sourcePage: "/products/example-product",
        },
      },
    ]);
  });

  it("swallows synchronous adapter failures", () => {
    const adapter: ProductAnalyticsAdapter = {
      track: () => {
        throw new Error("analytics unavailable");
      },
    };
    const analytics = createProductAnalytics(adapter);

    expect(() => analytics.trackReferralClick(detailContext)).not.toThrow();
  });

  it("absorbs asynchronous adapter failures without returning a promise", async () => {
    const analytics = createProductAnalytics({
      track: () => Promise.reject(new Error("analytics unavailable")),
    });

    const result = analytics.trackReferralClick(detailContext);

    expect(result).toBeUndefined();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
});

if (false) {
  const analytics = createProductAnalytics();

  // @ts-expect-error Referral URLs cannot cross the analytics boundary.
  analytics.trackReferralClick({ ...detailContext, referralUrl: "https://x" });
  // @ts-expect-error Referral codes cannot cross the analytics boundary.
  analytics.trackReferralClick({ ...detailContext, referralCode: "PRIVATE" });
  // @ts-expect-error User identifiers cannot cross the analytics boundary.
  analytics.trackProductView({ ...detailContext, userId: "user-1" });
  // @ts-expect-error Product views cannot use the products index placement.
  analytics.trackProductView(indexContext);
  // @ts-expect-error Tutorial clicks cannot use the products index placement.
  analytics.trackTutorialClick(indexContext);
  // @ts-expect-error Arbitrary content identifiers are not in the allowlist.
  analytics.trackReferralClick({ ...detailContext, contentId: "not-allowed" });
}
