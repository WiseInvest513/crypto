export const TOOL_ANALYTICS_SLUGS = [
  "position-size",
  "leverage",
  "dca",
  "risk-reward",
] as const;

export const TOOL_ANALYTICS_PLACEMENTS = [
  "tools_index",
  "tool_page",
  "calculator_form",
  "related_tools",
  "direct",
] as const;

export const TOOL_ANALYTICS_SOURCE_PAGES = [
  "/",
  "/btc",
  "/eth",
  "/tools",
  "/tools/position-size",
  "/tools/leverage",
  "/tools/dca",
  "/tools/risk-reward",
] as const;

export type ToolAnalyticsSlug = (typeof TOOL_ANALYTICS_SLUGS)[number];
export type ToolAnalyticsPlacement =
  (typeof TOOL_ANALYTICS_PLACEMENTS)[number];
export type ToolAnalyticsSourcePage =
  (typeof TOOL_ANALYTICS_SOURCE_PAGES)[number];

type FinancialInputField =
  | "accountBalance"
  | "amount"
  | "balance"
  | "contribution"
  | "entryPrice"
  | "exitPrice"
  | "leverage"
  | "margin"
  | "notional"
  | "pnl"
  | "price"
  | "quantity"
  | "result"
  | "riskAmount"
  | "riskPercent"
  | "roe"
  | "stopPrice"
  | "targetPrice";

type RejectedFinancialInputs = Readonly<{
  [Field in FinancialInputField]?: never;
}>;

type ToolAnalyticsFields = Readonly<{
  toolSlug: ToolAnalyticsSlug;
  placement: ToolAnalyticsPlacement;
  sourcePage: ToolAnalyticsSourcePage;
  contentId?: string;
  contentVersion?: string;
}>;

/**
 * Deliberately excludes calculator inputs and outputs. The `never` fields make
 * common financial values fail at the call site even when an object has first
 * been assigned to a variable; the runtime boundary also rejects every key
 * outside the explicit allowlist.
 */
export type ToolAnalyticsContext = ToolAnalyticsFields &
  RejectedFinancialInputs;

export type ToolAnalyticsEventName = "tool_open" | "tool_complete";

export type ToolAnalyticsPayload = Readonly<{
  toolSlug: ToolAnalyticsSlug;
  placement: ToolAnalyticsPlacement;
  sourcePage: ToolAnalyticsSourcePage;
  contentId?: string;
  contentVersion?: string;
}>;

export type ToolAnalyticsEvent = Readonly<{
  name: ToolAnalyticsEventName;
  payload: ToolAnalyticsPayload;
}>;

export interface AnalyticsAdapter {
  track(event: ToolAnalyticsEvent): void | Promise<void>;
}

type ExactToolAnalyticsContext<Context extends ToolAnalyticsContext> =
  Context &
    Readonly<
      Record<Exclude<keyof Context, keyof ToolAnalyticsContext>, never>
    >;

export interface ToolAnalytics {
  trackToolOpen<const Context extends ToolAnalyticsContext>(
    context: ExactToolAnalyticsContext<Context>,
  ): void;
  trackToolComplete<const Context extends ToolAnalyticsContext>(
    context: ExactToolAnalyticsContext<Context>,
  ): void;
}

export const noopAnalyticsAdapter: AnalyticsAdapter = Object.freeze({
  track: () => undefined,
});

class ToolAnalyticsFacade implements ToolAnalytics {
  constructor(private readonly adapter: AnalyticsAdapter) {}

  trackToolOpen<const Context extends ToolAnalyticsContext>(
    context: ExactToolAnalyticsContext<Context>,
  ): void {
    this.dispatch("tool_open", context);
  }

  trackToolComplete<const Context extends ToolAnalyticsContext>(
    context: ExactToolAnalyticsContext<Context>,
  ): void {
    this.dispatch("tool_complete", context);
  }

  private dispatch(
    name: ToolAnalyticsEventName,
    context: ToolAnalyticsContext,
  ): void {
    try {
      const payload = toSafePayload(context);

      if (!payload) {
        return;
      }

      const result = this.adapter.track(
        Object.freeze({ name, payload }) satisfies ToolAnalyticsEvent,
      );

      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics is best effort and must never interrupt a calculation.
    }
  }
}

export function createToolAnalytics(
  adapter: AnalyticsAdapter = noopAnalyticsAdapter,
): ToolAnalytics {
  return new ToolAnalyticsFacade(adapter);
}

/** Default provider-neutral facade. It remains a noop until a reviewed adapter is supplied. */
export const toolAnalytics = createToolAnalytics();

const ALLOWED_CONTEXT_KEYS = new Set<PropertyKey>([
  "toolSlug",
  "placement",
  "sourcePage",
  "contentId",
  "contentVersion",
]);
const TOOL_SLUG_SET = new Set<string>(TOOL_ANALYTICS_SLUGS);
const PLACEMENT_SET = new Set<string>(TOOL_ANALYTICS_PLACEMENTS);
const SOURCE_PAGE_SET = new Set<string>(TOOL_ANALYTICS_SOURCE_PAGES);
const CONTENT_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function toSafePayload(context: unknown): ToolAnalyticsPayload | null {
  if (!isPlainRecord(context)) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(context);

  if (ownKeys.some((key) => !ALLOWED_CONTEXT_KEYS.has(key))) {
    return null;
  }

  const { toolSlug, placement, sourcePage, contentId, contentVersion } =
    context;

  if (
    !isAllowedString(toolSlug, TOOL_SLUG_SET) ||
    !isAllowedString(placement, PLACEMENT_SET) ||
    !isAllowedString(sourcePage, SOURCE_PAGE_SET) ||
    !isOptionalContentIdentifier(contentId) ||
    !isOptionalContentIdentifier(contentVersion)
  ) {
    return null;
  }

  return Object.freeze({
    toolSlug: toolSlug as ToolAnalyticsSlug,
    placement: placement as ToolAnalyticsPlacement,
    sourcePage: sourcePage as ToolAnalyticsSourcePage,
    ...(contentId === undefined ? {} : { contentId }),
    ...(contentVersion === undefined ? {} : { contentVersion }),
  });
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAllowedString(value: unknown, allowed: ReadonlySet<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function isOptionalContentIdentifier(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" && CONTENT_IDENTIFIER_PATTERN.test(value))
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
