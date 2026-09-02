import { describe, expect, it } from "vitest";
import {
  createToolAnalytics,
  toolAnalytics,
  type AnalyticsAdapter,
  type ToolAnalyticsContext,
  type ToolAnalyticsEvent,
} from "../../src/lib/analytics/tool-analytics";

const validContext = {
  toolSlug: "position-size",
  placement: "calculator_form",
  sourcePage: "/tools/position-size",
  contentId: "position-size-guide",
  contentVersion: "v0.1",
} as const;

describe("tool analytics facade", () => {
  it("is a callable noop by default", () => {
    expect(() => toolAnalytics.trackToolOpen(validContext)).not.toThrow();
    expect(() => toolAnalytics.trackToolComplete(validContext)).not.toThrow();
  });

  it("sends only the explicit non-sensitive context for both events", () => {
    const events: ToolAnalyticsEvent[] = [];
    const analytics = createToolAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackToolOpen(validContext);
    analytics.trackToolComplete(validContext);

    expect(events).toEqual([
      { name: "tool_open", payload: validContext },
      { name: "tool_complete", payload: validContext },
    ]);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0]?.payload)).toBe(true);
  });

  it.each([
    "accountBalance",
    "amount",
    "balance",
    "contribution",
    "entryPrice",
    "exitPrice",
    "leverage",
    "margin",
    "notional",
    "pnl",
    "price",
    "quantity",
    "result",
    "riskAmount",
    "riskPercent",
    "roe",
    "stopPrice",
    "targetPrice",
  ])("rejects the financial field %s at runtime", (field) => {
    const events: ToolAnalyticsEvent[] = [];
    const analytics = createToolAnalytics({
      track: (event) => {
        events.push(event);
      },
    });
    const unsafeContext = {
      ...validContext,
      [field]: 12_345,
    } as unknown as ToolAnalyticsContext;

    analytics.trackToolComplete(unsafeContext);

    expect(events).toEqual([]);
  });

  it("rejects nested calculator data and arbitrary extra metadata", () => {
    const events: ToolAnalyticsEvent[] = [];
    const analytics = createToolAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackToolComplete({
      ...validContext,
      inputs: { balance: 10_000, entryPrice: 100 },
    } as unknown as ToolAnalyticsContext);
    analytics.trackToolComplete({
      ...validContext,
      metadata: { targetPrice: 120 },
    } as unknown as ToolAnalyticsContext);

    expect(events).toEqual([]);
  });

  it.each([
    { ...validContext, toolSlug: "unknown-tool" },
    { ...validContext, placement: "unknown-placement" },
    { ...validContext, sourcePage: "/tools/unknown" },
    { ...validContext, contentId: "" },
    { ...validContext, contentVersion: "contains spaces" },
  ])("drops malformed context without calling the adapter", (context) => {
    const events: ToolAnalyticsEvent[] = [];
    const analytics = createToolAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackToolOpen(context as unknown as ToolAnalyticsContext);

    expect(events).toEqual([]);
  });

  it("swallows synchronous adapter failures", () => {
    const adapter: AnalyticsAdapter = {
      track: () => {
        throw new Error("analytics unavailable");
      },
    };
    const analytics = createToolAnalytics(adapter);

    expect(() => analytics.trackToolComplete(validContext)).not.toThrow();
  });

  it("handles asynchronous adapter failures without returning a promise", async () => {
    const analytics = createToolAnalytics({
      track: () => Promise.reject(new Error("analytics unavailable")),
    });

    const result = analytics.trackToolComplete(validContext);

    expect(result).toBeUndefined();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
});

if (false) {
  const analytics = createToolAnalytics();
  const unsafeWithFinancialInput = {
    ...validContext,
    balance: 10_000,
  } as const;
  const unsafeWithArbitraryMetadata = {
    ...validContext,
    metadata: { balance: 10_000 },
  } as const;

  // @ts-expect-error Financial inputs are excluded from analytics context.
  analytics.trackToolComplete(unsafeWithFinancialInput);
  // @ts-expect-error Arbitrary metadata cannot cross the analytics boundary.
  analytics.trackToolComplete(unsafeWithArbitraryMetadata);
}
