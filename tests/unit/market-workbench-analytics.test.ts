import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveKeyLevelAnalyticsSelection } from "@/components/assets/market-workbench";
import type { ComputedKeyLevel, KeyLevelAnalysis } from "@/lib/market/key-levels";

function level(id: string, price: number, lower = price - 1, upper = price + 1): ComputedKeyLevel {
  return {
    id,
    price,
    lower,
    upper,
    strength: 1,
    methods: ["pivot"],
    confirmedAt: "2026-09-01T00:59:59.999Z",
    evidence: [],
  };
}

const analysis: KeyLevelAnalysis = {
  algorithmVersion: "ohlcv-key-levels-v1",
  asset: "btc",
  symbol: "BTCUSDT",
  interval: "1h",
  quoteCurrency: "USDT",
  sampleCount: 500,
  windowStartAt: "2026-08-01T00:00:00.000Z",
  confirmedAt: "2026-09-01T00:59:59.999Z",
  levels: [
    level("support-2", 80),
    level("support-1", 90),
    level("at-price", 100, 99, 101),
    level("resistance-1", 110),
    level("resistance-2", 120),
  ],
  volumeProfile: null,
};

describe("market workbench analytics wiring", () => {
  it("turns selected chart levels into categorical analytics without prices or ids", () => {
    expect(resolveKeyLevelAnalyticsSelection("at-price", analysis, 100)).toEqual({
      levelKind: "at_price",
    });
    expect(resolveKeyLevelAnalyticsSelection("resistance-2", analysis, 100)).toEqual({
      levelKind: "resistance",
      rank: 2,
    });
    expect(resolveKeyLevelAnalyticsSelection("support-2", analysis, 100)).toEqual({
      levelKind: "support",
      rank: 2,
    });
    expect(resolveKeyLevelAnalyticsSelection("poc", analysis, 100)).toEqual({
      levelKind: "volume_poc",
    });
    expect(resolveKeyLevelAnalyticsSelection("val", analysis, 100)).toEqual({
      levelKind: "volume_value_area_low",
    });
    expect(resolveKeyLevelAnalyticsSelection("vah", analysis, 100)).toEqual({
      levelKind: "volume_value_area_high",
    });
    expect(resolveKeyLevelAnalyticsSelection("fib:downswing_0.618:95", analysis, 100)).toEqual({
      levelKind: "fibonacci",
    });
    expect(resolveKeyLevelAnalyticsSelection("unknown", analysis, 100)).toBeNull();
  });

  it("connects interval, key-level and cycle-timeline interactions to the facade", () => {
    const source = readFileSync(
      new URL("../../src/components/assets/market-workbench.tsx", import.meta.url),
      "utf8",
    );
    const panel = readFileSync(
      new URL("../../src/components/assets/market-research-panel.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("marketAnalytics.trackIntervalChange");
    expect(source).toContain("marketAnalytics.trackKeyLevelSelect");
    expect(source).toContain("onCycleTimelineToggle=");
    expect(panel).toContain("onCycleTimelineToggle");
  });
});
