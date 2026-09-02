import { describe, expect, it, vi } from "vitest";
import {
  createPageAnalytics,
  isPublicPagePath,
  isStaticPageViewPath,
  type PageAnalytics,
  type PageAnalyticsAdapter,
} from "../../src/lib/analytics/page-analytics";
import { trackPageViewOnce } from "../../src/components/analytics/page-view-tracker";

describe("page analytics facade", () => {
  it("emits only the provider-neutral page_view path payload", () => {
    const events: unknown[] = [];
    const analytics = createPageAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackPageView("/btc");

    expect(events).toEqual([
      { name: "page_view", payload: { path: "/btc" } },
    ]);
  });

  it("rejects queries, unknown routes, malformed slugs, and oversized slugs", () => {
    for (const path of [
      "/btc?ref=secret",
      "/unknown",
      "/products/UPPERCASE",
      "/products/a--b",
      `/products/${"a".repeat(65)}`,
    ]) {
      expect(isPublicPagePath(path)).toBe(false);
    }

    expect(isPublicPagePath("/products/ledger-hardware-wallet")).toBe(true);
    expect(isStaticPageViewPath("/products/ledger-hardware-wallet")).toBe(false);
    expect(isStaticPageViewPath("/products/not-published")).toBe(false);
    expect(isStaticPageViewPath("/products")).toBe(true);
  });

  it("never lets synchronous or asynchronous adapters block navigation", async () => {
    const synchronous = createPageAnalytics({
      track: () => {
        throw new Error("analytics unavailable");
      },
    });
    const asynchronous = createPageAnalytics({
      track: () => Promise.reject(new Error("analytics unavailable")),
    });

    expect(() => synchronous.trackPageView("/tools")).not.toThrow();
    expect(() => asynchronous.trackPageView("/products")).not.toThrow();
    await Promise.resolve();
  });

  it("tracks a pathname once per transition and ignores non-public paths", () => {
    const previous = { current: null as string | null };
    const trackPageView = vi.fn();
    const analytics: Pick<PageAnalytics, "trackPageView"> = { trackPageView };

    trackPageViewOnce(previous, "/btc", analytics);
    trackPageViewOnce(previous, "/btc", analytics);
    trackPageViewOnce(previous, "/missing", analytics);
    trackPageViewOnce(previous, "/products/not-published", analytics);
    trackPageViewOnce(previous, "/eth", analytics);

    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(trackPageView).toHaveBeenNthCalledWith(1, "/btc");
    expect(trackPageView).toHaveBeenNthCalledWith(2, "/eth");
  });

  it("tracks a static page again after traversing an excluded detail path", () => {
    const previous = { current: null as string | null };
    const trackPageView = vi.fn();
    const analytics: Pick<PageAnalytics, "trackPageView"> = { trackPageView };

    trackPageViewOnce(previous, "/products", analytics);
    trackPageViewOnce(previous, "/products/binance", analytics);
    trackPageViewOnce(previous, "/products", analytics);

    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(trackPageView).toHaveBeenNthCalledWith(1, "/products");
    expect(trackPageView).toHaveBeenNthCalledWith(2, "/products");
  });

  it("keeps the adapter contract free of identifiers and arbitrary metadata", () => {
    const adapter: PageAnalyticsAdapter = { track: () => undefined };
    const analytics = createPageAnalytics(adapter);

    // @ts-expect-error page_view accepts a path, not an identifying payload.
    analytics.trackPageView({ path: "/", userId: "user-1" });
  });
});
