export type PageViewPath =
  | "/"
  | "/btc"
  | "/eth"
  | "/exchanges"
  | "/learn"
  | "/learn/futures-intro"
  | "/tools"
  | "/tools/position-size"
  | "/tools/leverage"
  | "/tools/dca"
  | "/tools/risk-reward";

export type PageViewEvent = Readonly<{
  name: "page_view";
  payload: Readonly<{ path: PageViewPath }>;
}>;

export interface PageAnalyticsAdapter {
  track(event: PageViewEvent): void | Promise<void>;
}

export interface PageAnalytics {
  trackPageView(path: PageViewPath): void;
}

export const noopPageAnalyticsAdapter: PageAnalyticsAdapter = Object.freeze({
  track: () => undefined,
});

class PageAnalyticsFacade implements PageAnalytics {
  constructor(private readonly adapter: PageAnalyticsAdapter) {}

  trackPageView(path: PageViewPath): void {
    if (!isPublicPagePath(path)) {
      return;
    }

    try {
      const result = this.adapter.track(
        Object.freeze({
          name: "page_view",
          payload: Object.freeze({ path }),
        }),
      );

      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics is best effort and must never interrupt route transitions.
    }
  }
}

export function createPageAnalytics(
  adapter: PageAnalyticsAdapter = noopPageAnalyticsAdapter,
): PageAnalytics {
  return new PageAnalyticsFacade(adapter);
}

/** Provider-neutral facade. It remains a noop until a reviewed adapter is supplied. */
export const pageAnalytics = createPageAnalytics();

const STATIC_PAGE_PATHS = new Set<string>([
  "/",
  "/btc",
  "/eth",
  "/exchanges",
  "/learn",
  "/learn/futures-intro",
  "/tools",
  "/tools/position-size",
  "/tools/leverage",
  "/tools/dca",
  "/tools/risk-reward",
]);

export function isPublicPagePath(path: unknown): path is PageViewPath {
  return typeof path === "string" && STATIC_PAGE_PATHS.has(path);
}

export function isStaticPageViewPath(path: unknown): path is PageViewPath {
  return typeof path === "string" && STATIC_PAGE_PATHS.has(path);
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
