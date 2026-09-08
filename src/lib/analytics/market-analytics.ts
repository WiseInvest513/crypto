export const MARKET_ANALYTICS_ASSETS = ["btc", "eth"] as const;
export const MARKET_ANALYTICS_INTERVALS = ["15m", "1h", "4h", "1d"] as const;
export const MARKET_CYCLE_TIMELINE_ACTIONS = ["expand", "collapse"] as const;
export const MARKET_KEY_LEVEL_KINDS = [
  "at_price",
  "resistance",
  "support",
  "volume_poc",
  "volume_value_area_low",
  "volume_value_area_high",
  "fibonacci",
] as const;

export type MarketAnalyticsAsset =
  (typeof MARKET_ANALYTICS_ASSETS)[number];
export type MarketAnalyticsInterval =
  (typeof MARKET_ANALYTICS_INTERVALS)[number];
export type MarketCycleTimelineAction =
  (typeof MARKET_CYCLE_TIMELINE_ACTIONS)[number];
export type MarketKeyLevelKind =
  (typeof MARKET_KEY_LEVEL_KINDS)[number];

type SensitiveMarketAnalyticsField =
  | "account"
  | "accountBalance"
  | "accountId"
  | "amount"
  | "close"
  | "currentPrice"
  | "email"
  | "high"
  | "input"
  | "inputs"
  | "levelPrice"
  | "low"
  | "open"
  | "path"
  | "price"
  | "query"
  | "result"
  | "results"
  | "searchParams"
  | "session"
  | "sessionId"
  | "toolInput"
  | "toolInputs"
  | "toolResult"
  | "toolResults"
  | "url"
  | "user"
  | "userId"
  | "value"
  | "walletAddress";

type RejectedSensitiveMarketFields = Readonly<{
  [Field in SensitiveMarketAnalyticsField]?: never;
}>;

type MarketIntervalChangeFields = Readonly<{
  asset: MarketAnalyticsAsset;
  from: MarketAnalyticsInterval;
  to: MarketAnalyticsInterval;
}>;

type CycleTimelineToggleFields = Readonly<{
  asset: MarketAnalyticsAsset;
  action: MarketCycleTimelineAction;
  /** Number of timeline episodes revealed or hidden; public timeline max is 7. */
  hiddenCount: number;
}>;

type KeyLevelSelectFields = Readonly<{
  asset: MarketAnalyticsAsset;
  interval: MarketAnalyticsInterval;
  levelKind: MarketKeyLevelKind;
  /** Display rank only. Never a level price, strength, identifier or label. */
  rank?: number;
}>;

/**
 * Anonymous categorical contexts only. Common sensitive field names are
 * explicitly `never`, and the facade rejects every runtime key outside each
 * event's exact allowlist.
 */
export type MarketIntervalChangeContext = MarketIntervalChangeFields &
  RejectedSensitiveMarketFields;
export type CycleTimelineToggleContext = CycleTimelineToggleFields &
  RejectedSensitiveMarketFields;
export type KeyLevelSelectContext = KeyLevelSelectFields &
  RejectedSensitiveMarketFields;

export type MarketIntervalChangePayload = MarketIntervalChangeFields;
export type CycleTimelineTogglePayload = CycleTimelineToggleFields;
export type KeyLevelSelectPayload = KeyLevelSelectFields;

export type MarketAnalyticsEvent =
  | Readonly<{
      name: "market_interval_change";
      payload: MarketIntervalChangePayload;
    }>
  | Readonly<{
      name: "cycle_timeline_toggle";
      payload: CycleTimelineTogglePayload;
    }>
  | Readonly<{
      name: "key_level_select";
      payload: KeyLevelSelectPayload;
    }>;

export interface MarketAnalyticsAdapter {
  track(event: MarketAnalyticsEvent): void | Promise<void>;
}

type ExactContext<Allowed, Context extends Allowed> = Context &
  Readonly<Record<Exclude<keyof Context, keyof Allowed>, never>>;

export interface MarketAnalytics {
  trackIntervalChange<const Context extends MarketIntervalChangeContext>(
    context: ExactContext<MarketIntervalChangeContext, Context>,
  ): void;
  trackCycleTimelineToggle<
    const Context extends CycleTimelineToggleContext,
  >(
    context: ExactContext<CycleTimelineToggleContext, Context>,
  ): void;
  trackKeyLevelSelect<const Context extends KeyLevelSelectContext>(
    context: ExactContext<KeyLevelSelectContext, Context>,
  ): void;
}

export const noopMarketAnalyticsAdapter: MarketAnalyticsAdapter =
  Object.freeze({
    track: () => undefined,
  });

class MarketAnalyticsFacade implements MarketAnalytics {
  constructor(private readonly adapter: MarketAnalyticsAdapter) {}

  trackIntervalChange<const Context extends MarketIntervalChangeContext>(
    context: ExactContext<MarketIntervalChangeContext, Context>,
  ): void {
    this.dispatch("market_interval_change", context);
  }

  trackCycleTimelineToggle<
    const Context extends CycleTimelineToggleContext,
  >(
    context: ExactContext<CycleTimelineToggleContext, Context>,
  ): void {
    this.dispatch("cycle_timeline_toggle", context);
  }

  trackKeyLevelSelect<const Context extends KeyLevelSelectContext>(
    context: ExactContext<KeyLevelSelectContext, Context>,
  ): void {
    this.dispatch("key_level_select", context);
  }

  private dispatch(
    name: MarketAnalyticsEvent["name"],
    context: unknown,
  ): void {
    try {
      const event = toSafeEvent(name, context);
      if (event === null) return;

      const result = this.adapter.track(event);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics is best effort and must never interrupt market interaction.
    }
  }
}

export function createMarketAnalytics(
  adapter: MarketAnalyticsAdapter = noopMarketAnalyticsAdapter,
): MarketAnalytics {
  return new MarketAnalyticsFacade(adapter);
}

/** Provider-neutral and noop until a separately reviewed adapter is supplied. */
export const marketAnalytics = createMarketAnalytics();

const ASSET_SET = new Set<string>(MARKET_ANALYTICS_ASSETS);
const INTERVAL_SET = new Set<string>(MARKET_ANALYTICS_INTERVALS);
const TIMELINE_ACTION_SET = new Set<string>(MARKET_CYCLE_TIMELINE_ACTIONS);
const LEVEL_KIND_SET = new Set<string>(MARKET_KEY_LEVEL_KINDS);
const MAX_TIMELINE_HIDDEN_COUNT = 7;
const MAX_LEVEL_RANK = 20;

const INTERVAL_CHANGE_KEYS = new Set<PropertyKey>([
  "asset",
  "from",
  "to",
]);
const TIMELINE_TOGGLE_KEYS = new Set<PropertyKey>([
  "action",
  "asset",
  "hiddenCount",
]);
const KEY_LEVEL_SELECT_KEYS = new Set<PropertyKey>([
  "asset",
  "interval",
  "levelKind",
  "rank",
]);

function toSafeEvent(
  name: MarketAnalyticsEvent["name"],
  context: unknown,
): MarketAnalyticsEvent | null {
  if (!isPlainDataRecord(context)) return null;

  if (name === "market_interval_change") {
    if (!hasOnlyAllowedKeys(context, INTERVAL_CHANGE_KEYS)) return null;
    const { asset, from, to } = context;
    if (
      !isAllowedString(asset, ASSET_SET) ||
      !isAllowedString(from, INTERVAL_SET) ||
      !isAllowedString(to, INTERVAL_SET) ||
      from === to
    ) {
      return null;
    }
    const payload = Object.freeze({
      asset: asset as MarketAnalyticsAsset,
      from: from as MarketAnalyticsInterval,
      to: to as MarketAnalyticsInterval,
    });
    return Object.freeze({ name, payload });
  }

  if (name === "cycle_timeline_toggle") {
    if (!hasOnlyAllowedKeys(context, TIMELINE_TOGGLE_KEYS)) return null;
    const { asset, action, hiddenCount } = context;
    if (
      !isAllowedString(asset, ASSET_SET) ||
      !isAllowedString(action, TIMELINE_ACTION_SET) ||
      !isBoundedInteger(hiddenCount, 1, MAX_TIMELINE_HIDDEN_COUNT)
    ) {
      return null;
    }
    const payload = Object.freeze({
      asset: asset as MarketAnalyticsAsset,
      action: action as MarketCycleTimelineAction,
      hiddenCount,
    });
    return Object.freeze({ name, payload });
  }

  if (!hasOnlyAllowedKeys(context, KEY_LEVEL_SELECT_KEYS)) return null;
  const { asset, interval, levelKind, rank } = context;
  if (
    !isAllowedString(asset, ASSET_SET) ||
    !isAllowedString(interval, INTERVAL_SET) ||
    !isAllowedString(levelKind, LEVEL_KIND_SET) ||
    (rank !== undefined && !isBoundedInteger(rank, 1, MAX_LEVEL_RANK))
  ) {
    return null;
  }
  const payload = Object.freeze({
    asset: asset as MarketAnalyticsAsset,
    interval: interval as MarketAnalyticsInterval,
    levelKind: levelKind as MarketKeyLevelKind,
    ...(rank === undefined ? {} : { rank }),
  });
  return Object.freeze({ name, payload });
}

function isPlainDataRecord(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;

  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function hasOnlyAllowedKeys(
  value: Record<PropertyKey, unknown>,
  allowed: ReadonlySet<PropertyKey>,
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length > 0 && keys.every((key) => allowed.has(key));
}

function isAllowedString(
  value: unknown,
  allowed: ReadonlySet<string>,
): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
