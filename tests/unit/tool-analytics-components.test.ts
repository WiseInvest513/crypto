import { describe, expect, it, vi } from "vitest";
import {
  trackToolCompletion,
  trackToolOpenOnce,
} from "../../src/components/tools/use-tool-analytics";
import type {
  ToolAnalytics,
  ToolAnalyticsSlug,
  ToolAnalyticsSourcePage,
} from "../../src/lib/analytics/tool-analytics";

const TOOLS = [
  ["position-size", "/tools/position-size"],
  ["leverage", "/tools/leverage"],
  ["dca", "/tools/dca"],
  ["risk-reward", "/tools/risk-reward"],
] as const satisfies readonly (readonly [
  ToolAnalyticsSlug,
  ToolAnalyticsSourcePage,
])[];

describe("tool analytics component boundary", () => {
  it.each(TOOLS)(
    "tracks one %s open and successful completion with fixed anonymous metadata",
    (toolSlug, sourcePage) => {
      const analytics = analyticsSpy();
      const opened = { current: null as string | null };

      trackToolOpenOnce(opened, toolSlug, sourcePage, analytics);
      trackToolOpenOnce(opened, toolSlug, sourcePage, analytics);
      trackToolCompletion(toolSlug, sourcePage, analytics);

      expect(analytics.trackToolOpen).toHaveBeenCalledOnce();
      expect(analytics.trackToolOpen).toHaveBeenCalledWith({
        toolSlug,
        placement: "tool_page",
        sourcePage,
        contentVersion: "wise-crypto-v0-phase5",
      });
      expect(analytics.trackToolComplete).toHaveBeenCalledOnce();
      expect(analytics.trackToolComplete).toHaveBeenCalledWith({
        toolSlug,
        placement: "calculator_form",
        sourcePage,
        contentVersion: "wise-crypto-v0-phase5",
      });

      const payload = vi.mocked(analytics.trackToolComplete).mock.calls[0][0];
      expect(Object.keys(payload).sort()).toEqual([
        "contentVersion",
        "placement",
        "sourcePage",
        "toolSlug",
      ]);
    },
  );

  it("tracks a new tool when a mounted tracker receives a different route", () => {
    const analytics = analyticsSpy();
    const opened = { current: null as string | null };

    trackToolOpenOnce(opened, "position-size", "/tools/position-size", analytics);
    trackToolOpenOnce(opened, "leverage", "/tools/leverage", analytics);

    expect(analytics.trackToolOpen).toHaveBeenCalledTimes(2);
  });

  it("never lets a faulty tracker block opening or a completed calculation", () => {
    const analytics: Pick<ToolAnalytics, "trackToolOpen" | "trackToolComplete"> = {
      trackToolOpen: () => {
        throw new Error("analytics unavailable");
      },
      trackToolComplete: () => {
        throw new Error("analytics unavailable");
      },
    };

    expect(() =>
      trackToolOpenOnce(
        { current: null },
        "dca",
        "/tools/dca",
        analytics,
      ),
    ).not.toThrow();
    expect(() =>
      trackToolCompletion("dca", "/tools/dca", analytics),
    ).not.toThrow();
  });
});

function analyticsSpy(): Pick<
  ToolAnalytics,
  "trackToolOpen" | "trackToolComplete"
> {
  return {
    trackToolOpen: vi.fn(),
    trackToolComplete: vi.fn(),
  };
}
