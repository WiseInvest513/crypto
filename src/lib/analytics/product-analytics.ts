export const PRODUCT_ANALYTICS_PLACEMENTS = [
  "products_index",
  "product_detail",
] as const;

export type ProductAnalyticsPlacement =
  (typeof PRODUCT_ANALYTICS_PLACEMENTS)[number];
export type ProductAnalyticsSourcePage =
  | "/products"
  | `/products/${string}`;

type ProductAnalyticsContext<
  Placement extends ProductAnalyticsPlacement = ProductAnalyticsPlacement,
> = Readonly<{
  slug: string;
  placement: Placement;
  sourcePage: ProductAnalyticsSourcePage;
  contentVersion?: string;
}>;

export type ProductViewContext = ProductAnalyticsContext<"product_detail">;
export type ReferralClickContext = ProductAnalyticsContext;
export type TutorialClickContext = ProductAnalyticsContext<"product_detail">;

export type ProductAnalyticsEventName =
  | "product_view"
  | "referral_click"
  | "tutorial_click";

export type ProductAnalyticsPayload = Readonly<{
  slug: string;
  placement: ProductAnalyticsPlacement;
  sourcePage: ProductAnalyticsSourcePage;
  contentVersion?: string;
}>;

export type ProductAnalyticsEvent = Readonly<{
  name: ProductAnalyticsEventName;
  payload: ProductAnalyticsPayload;
}>;

export interface ProductAnalyticsAdapter {
  track(event: ProductAnalyticsEvent): void | Promise<void>;
}

type ExactContext<
  Allowed extends ProductAnalyticsContext,
  Context extends Allowed,
> = Context & Readonly<Record<Exclude<keyof Context, keyof Allowed>, never>>;

export interface ProductAnalytics {
  trackProductView<const Context extends ProductViewContext>(
    context: ExactContext<ProductViewContext, Context>,
  ): void;
  trackReferralClick<const Context extends ReferralClickContext>(
    context: ExactContext<ReferralClickContext, Context>,
  ): void;
  trackTutorialClick<const Context extends TutorialClickContext>(
    context: ExactContext<TutorialClickContext, Context>,
  ): void;
}

export const noopProductAnalyticsAdapter: ProductAnalyticsAdapter =
  Object.freeze({
    track: () => undefined,
  });

class ProductAnalyticsFacade implements ProductAnalytics {
  constructor(private readonly adapter: ProductAnalyticsAdapter) {}

  trackProductView<const Context extends ProductViewContext>(
    context: ExactContext<ProductViewContext, Context>,
  ): void {
    this.dispatch("product_view", context);
  }

  trackReferralClick<const Context extends ReferralClickContext>(
    context: ExactContext<ReferralClickContext, Context>,
  ): void {
    this.dispatch("referral_click", context);
  }

  trackTutorialClick<const Context extends TutorialClickContext>(
    context: ExactContext<TutorialClickContext, Context>,
  ): void {
    this.dispatch("tutorial_click", context);
  }

  private dispatch(
    name: ProductAnalyticsEventName,
    context: ProductAnalyticsContext,
  ): void {
    try {
      const payload = toSafePayload(name, context);

      if (!payload) {
        return;
      }

      const result = this.adapter.track(
        Object.freeze({ name, payload }) satisfies ProductAnalyticsEvent,
      );

      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics is best effort and must never interrupt navigation/rendering.
    }
  }
}

export function createProductAnalytics(
  adapter: ProductAnalyticsAdapter = noopProductAnalyticsAdapter,
): ProductAnalytics {
  return new ProductAnalyticsFacade(adapter);
}

/** Provider-neutral facade. It intentionally remains a noop until reviewed. */
export const productAnalytics = createProductAnalytics();

const ALLOWED_CONTEXT_KEYS = new Set<PropertyKey>([
  "slug",
  "placement",
  "sourcePage",
  "contentVersion",
]);
const PLACEMENT_SET = new Set<string>(PRODUCT_ANALYTICS_PLACEMENTS);
const SLUG_PATTERN = /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function toSafePayload(
  name: ProductAnalyticsEventName,
  context: unknown,
): ProductAnalyticsPayload | null {
  if (!isPlainRecord(context)) {
    return null;
  }

  if (Reflect.ownKeys(context).some((key) => !ALLOWED_CONTEXT_KEYS.has(key))) {
    return null;
  }

  const { slug, placement, sourcePage, contentVersion } = context;

  if (
    typeof slug !== "string" ||
    !SLUG_PATTERN.test(slug) ||
    typeof placement !== "string" ||
    !PLACEMENT_SET.has(placement) ||
    !isMatchingSourcePage(sourcePage, slug, placement) ||
    !isOptionalContentVersion(contentVersion) ||
    !isPlacementAllowedForEvent(name, placement)
  ) {
    return null;
  }

  return Object.freeze({
    slug,
    placement: placement as ProductAnalyticsPlacement,
    sourcePage: sourcePage as ProductAnalyticsSourcePage,
    ...(contentVersion === undefined ? {} : { contentVersion }),
  });
}

function isMatchingSourcePage(
  sourcePage: unknown,
  slug: string,
  placement: string,
): sourcePage is ProductAnalyticsSourcePage {
  if (placement === "products_index") {
    return sourcePage === "/products";
  }

  return sourcePage === `/products/${slug}`;
}

function isPlacementAllowedForEvent(
  name: ProductAnalyticsEventName,
  placement: string,
): boolean {
  if (name === "referral_click") {
    return placement === "products_index" || placement === "product_detail";
  }

  return placement === "product_detail";
}

function isOptionalContentVersion(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" && CONTENT_VERSION_PATTERN.test(value))
  );
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
