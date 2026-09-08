import { describe, expect, it } from "vitest";
import {
  createMarketAnalytics,
  marketAnalytics,
  type CycleTimelineToggleContext,
  type KeyLevelSelectContext,
  type MarketAnalyticsAdapter,
  type MarketAnalyticsEvent,
  type MarketIntervalChangeContext,
} from "../../src/lib/analytics/market-analytics";

const intervalChangeContext = {
  asset: "btc",
  from: "15m",
  to: "1h",
} as const;

const timelineToggleContext = {
  asset: "eth",
  action: "expand",
  hiddenCount: 3,
} as const;

const keyLevelContext = {
  asset: "btc",
  interval: "4h",
  levelKind: "resistance",
  rank: 2,
} as const;

function createEventCollector(): {
  events: MarketAnalyticsEvent[];
  analytics: ReturnType<typeof createMarketAnalytics>;
} {
  const events: MarketAnalyticsEvent[] = [];
  return {
    events,
    analytics: createMarketAnalytics({
      track: (event) => {
        events.push(event);
      },
    }),
  };
}

describe("market analytics facade", () => {
  it("is a callable noop by default", () => {
    expect(() =>
      marketAnalytics.trackIntervalChange(intervalChangeContext),
    ).not.toThrow();
    expect(() =>
      marketAnalytics.trackCycleTimelineToggle(timelineToggleContext),
    ).not.toThrow();
    expect(() =>
      marketAnalytics.trackKeyLevelSelect(keyLevelContext),
    ).not.toThrow();
  });

  it("emits only the provider-neutral categorical payloads", () => {
    const { analytics, events } = createEventCollector();

    analytics.trackIntervalChange(intervalChangeContext);
    analytics.trackCycleTimelineToggle(timelineToggleContext);
    analytics.trackKeyLevelSelect(keyLevelContext);

    expect(events).toEqual([
      {
        name: "market_interval_change",
        payload: intervalChangeContext,
      },
      {
        name: "cycle_timeline_toggle",
        payload: timelineToggleContext,
      },
      {
        name: "key_level_select",
        payload: keyLevelContext,
      },
    ]);
    for (const event of events) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.payload)).toBe(true);
    }
  });

  it("allows a key-level category without an optional display rank", () => {
    const { analytics, events } = createEventCollector();

    analytics.trackKeyLevelSelect({
      asset: "eth",
      interval: "1d",
      levelKind: "volume_poc",
    });

    expect(events).toEqual([
      {
        name: "key_level_select",
        payload: {
          asset: "eth",
          interval: "1d",
          levelKind: "volume_poc",
        },
      },
    ]);
    expect(Object.hasOwn(events[0]?.payload ?? {}, "rank")).toBe(false);
  });

  it.each([
    "account",
    "accountBalance",
    "accountId",
    "amount",
    "close",
    "currentPrice",
    "email",
    "high",
    "input",
    "inputs",
    "levelPrice",
    "low",
    "open",
    "path",
    "price",
    "query",
    "result",
    "results",
    "searchParams",
    "session",
    "sessionId",
    "toolInput",
    "toolInputs",
    "toolResult",
    "toolResults",
    "url",
    "user",
    "userId",
    "value",
    "walletAddress",
  ])("rejects the sensitive field %s at runtime", (field) => {
    const { analytics, events } = createEventCollector();
    const unsafeContext = {
      ...keyLevelContext,
      [field]: field === "price" ? 77_000 : "private",
    } as unknown as KeyLevelSelectContext;

    analytics.trackKeyLevelSelect(unsafeContext);

    expect(events).toEqual([]);
  });

  it("rejects event-specific and arbitrary extra fields", () => {
    const { analytics, events } = createEventCollector();

    analytics.trackIntervalChange({
      ...intervalChangeContext,
      action: "expand",
    } as unknown as MarketIntervalChangeContext);
    analytics.trackCycleTimelineToggle({
      ...timelineToggleContext,
      interval: "1d",
    } as unknown as CycleTimelineToggleContext);
    analytics.trackKeyLevelSelect({
      ...keyLevelContext,
      hiddenCount: 4,
    } as unknown as KeyLevelSelectContext);
    analytics.trackKeyLevelSelect({
      ...keyLevelContext,
      metadata: { price: 77_000 },
    } as unknown as KeyLevelSelectContext);

    expect(events).toEqual([]);
  });

  it.each([
    { asset: "sol", from: "15m", to: "1h" },
    { asset: "btc", from: "5m", to: "1h" },
    { asset: "btc", from: "15m", to: "1w" },
    { asset: "btc", from: "1h", to: "1h" },
    { asset: "btc", from: "15m" },
  ])("drops malformed interval-change context %#", (context) => {
    const { analytics, events } = createEventCollector();

    analytics.trackIntervalChange(
      context as unknown as MarketIntervalChangeContext,
    );

    expect(events).toEqual([]);
  });

  it.each([
    { asset: "btc", action: "show", hiddenCount: 3 },
    { asset: "btc", action: "expand", hiddenCount: 0 },
    { asset: "btc", action: "expand", hiddenCount: 8 },
    { asset: "btc", action: "expand", hiddenCount: 1.5 },
    { asset: "btc", action: "expand", hiddenCount: Number.NaN },
    { asset: "btc", action: "expand" },
  ])("drops malformed timeline context %#", (context) => {
    const { analytics, events } = createEventCollector();

    analytics.trackCycleTimelineToggle(
      context as unknown as CycleTimelineToggleContext,
    );

    expect(events).toEqual([]);
  });

  it.each([
    { asset: "btc", interval: "1h", levelKind: "pivot", rank: 1 },
    { asset: "btc", interval: "5m", levelKind: "support", rank: 1 },
    { asset: "btc", interval: "1h", levelKind: "support", rank: 0 },
    { asset: "btc", interval: "1h", levelKind: "support", rank: 21 },
    { asset: "btc", interval: "1h", levelKind: "support", rank: 1.5 },
    {
      asset: "btc",
      interval: "1h",
      levelKind: "support",
      rank: Number.NaN,
    },
    { asset: "btc", interval: "1h" },
  ])("drops malformed key-level context %#", (context) => {
    const { analytics, events } = createEventCollector();

    analytics.trackKeyLevelSelect(context as unknown as KeyLevelSelectContext);

    expect(events).toEqual([]);
  });

  it("rejects symbols, inherited objects, arrays, and accessor properties", () => {
    const { analytics, events } = createEventCollector();
    const symbolContext = {
      ...intervalChangeContext,
      [Symbol("private")]: "value",
    } as unknown as MarketIntervalChangeContext;
    const inheritedContext = Object.create(intervalChangeContext) as
      MarketIntervalChangeContext;
    const arrayContext = [intervalChangeContext] as unknown as
      MarketIntervalChangeContext;
    let accessorRead = false;
    const accessorContext = {
      from: "15m",
      to: "1h",
    } as Record<string, unknown>;
    Object.defineProperty(accessorContext, "asset", {
      enumerable: true,
      get: () => {
        accessorRead = true;
        return "btc";
      },
    });

    analytics.trackIntervalChange(symbolContext);
    analytics.trackIntervalChange(inheritedContext);
    analytics.trackIntervalChange(arrayContext);
    analytics.trackIntervalChange(
      accessorContext as unknown as MarketIntervalChangeContext,
    );

    expect(events).toEqual([]);
    expect(accessorRead).toBe(false);
  });

  it("swallows synchronous adapter failures", () => {
    const adapter: MarketAnalyticsAdapter = {
      track: () => {
        throw new Error("analytics unavailable");
      },
    };
    const analytics = createMarketAnalytics(adapter);

    expect(() =>
      analytics.trackIntervalChange(intervalChangeContext),
    ).not.toThrow();
  });

  it("handles asynchronous adapter failures without returning a promise", async () => {
    const analytics = createMarketAnalytics({
      track: () => Promise.reject(new Error("analytics unavailable")),
    });

    const result = analytics.trackCycleTimelineToggle(timelineToggleContext);

    expect(result).toBeUndefined();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
});

if (false) {
  const analytics = createMarketAnalytics();

  // @ts-expect-error Raw prices cannot cross the analytics boundary.
  analytics.trackKeyLevelSelect({ ...keyLevelContext, price: 77_000 });
  // @ts-expect-error Account identifiers cannot cross the analytics boundary.
  analytics.trackIntervalChange({ ...intervalChangeContext, accountId: "1" });
  // @ts-expect-error Tool inputs cannot cross the analytics boundary.
  analytics.trackCycleTimelineToggle({ ...timelineToggleContext, inputs: {} });
  // @ts-expect-error Tool results cannot cross the analytics boundary.
  analytics.trackKeyLevelSelect({ ...keyLevelContext, results: {} });
  // @ts-expect-error User identifiers cannot cross the analytics boundary.
  analytics.trackIntervalChange({ ...intervalChangeContext, userId: "user-1" });
  // @ts-expect-error Session identifiers cannot cross the analytics boundary.
  analytics.trackIntervalChange({ ...intervalChangeContext, sessionId: "1" });
  // @ts-expect-error Query strings cannot cross the analytics boundary.
  analytics.trackIntervalChange({ ...intervalChangeContext, query: "secret" });
  // @ts-expect-error Arbitrary metadata is rejected by the exact context type.
  analytics.trackIntervalChange({ ...intervalChangeContext, metadata: {} });
}
