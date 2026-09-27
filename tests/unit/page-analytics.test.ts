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

  it("accepts the single public course URL without allowing lesson state URLs", () => {
    expect(isPublicPagePath("/exchanges")).toBe(true);
    expect(isStaticPageViewPath("/exchanges")).toBe(true);
    expect(isPublicPagePath("/exchanges?from=header")).toBe(false);
    expect(isPublicPagePath("/exchanges/binance")).toBe(false);
    expect(isPublicPagePath("/learn")).toBe(true);
    expect(isPublicPagePath("/learn/futures-intro")).toBe(true);
    expect(isStaticPageViewPath("/learn/futures-intro")).toBe(true);
    expect(isPublicPagePath("/learn/futures-intro?lesson=lesson-01")).toBe(false);
    expect(isPublicPagePath("/learn/futures-intro/lesson-01")).toBe(false);
    expect(isPublicPagePath("/tools/futures-intro")).toBe(false);
  });

  it("rejects queries, unknown routes, malformed slugs, and oversized slugs", () => {
    for (const path of [
      "/btc?ref=secret",
      "/unknown",
      "/products",
      "/products/ledger-hardware-wallet",
      "/products/UPPERCASE",
      "/products/a--b",
      `/products/${"a".repeat(65)}`,
    ]) {
      expect(isPublicPagePath(path)).toBe(false);
    }

    expect(isStaticPageViewPath("/products/ledger-hardware-wallet")).toBe(false);
    expect(isStaticPageViewPath("/products/not-published")).toBe(false);
    expect(isStaticPageViewPath("/products")).toBe(false);
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
    expect(() => asynchronous.trackPageView("/eth")).not.toThrow();
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
    trackPageViewOnce(previous, "/exchanges", analytics);
    trackPageViewOnce(previous, "/eth", analytics);

    expect(trackPageView).toHaveBeenCalledTimes(3);
    expect(trackPageView).toHaveBeenNthCalledWith(1, "/btc");
    expect(trackPageView).toHaveBeenNthCalledWith(2, "/exchanges");
    expect(trackPageView).toHaveBeenNthCalledWith(3, "/eth");
  });

  it("tracks a static page again after traversing a retired product path", () => {
    const previous = { current: null as string | null };
    const trackPageView = vi.fn();
    const analytics: Pick<PageAnalytics, "trackPageView"> = { trackPageView };

    trackPageViewOnce(previous, "/tools", analytics);
    trackPageViewOnce(previous, "/products/binance", analytics);
    trackPageViewOnce(previous, "/tools", analytics);

    expect(trackPageView).toHaveBeenCalledTimes(2);
    expect(trackPageView).toHaveBeenNthCalledWith(1, "/tools");
    expect(trackPageView).toHaveBeenNthCalledWith(2, "/tools");
  });

  it("keeps the adapter contract free of identifiers and arbitrary metadata", () => {
    const adapter: PageAnalyticsAdapter = { track: () => undefined };
    const analytics = createPageAnalytics(adapter);

    // @ts-expect-error page_view accepts a path, not an identifying payload.
    analytics.trackPageView({ path: "/", userId: "user-1" });
  });
});
