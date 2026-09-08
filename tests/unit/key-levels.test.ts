import { describe, expect, it } from "vitest";
import {
  analyzeKeyLevels,
  KEY_LEVEL_ALGORITHM_VERSION,
  KEY_LEVEL_CLUSTER_PRICE_RATIO,
  KEY_LEVEL_REQUIRED_CLOSED_CANDLES,
  KEY_LEVEL_WINDOW_CANDLES,
  type KeyLevelAnalysis,
} from "@/lib/market/key-levels";
import {
  chartIntervalMilliseconds,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";

const START = Date.parse("2026-01-01T00:00:00.000Z");

function candles(
  count = 200,
  interval: ChartCandleInterval = "1h",
): ChartCandle[] {
  const duration = chartIntervalMilliseconds[interval];
  return Array.from({ length: count }, (_, index) => ({
    asset: "btc",
    symbol: "BTCUSDT",
    interval,
    quoteCurrency: "USDT",
    state: "closed",
    openedAt: new Date(START + duration * index).toISOString(),
    closedAt: new Date(START + duration * (index + 1) - 1).toISOString(),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 100,
  }));
}

function evidence(analysis: KeyLevelAnalysis) {
  return analysis.levels.flatMap((level) => level.evidence);
}

function flat(candle: ChartCandle, price: number, volume = 0): ChartCandle {
  return { ...candle, open: price, high: price, low: price, close: price, volume };
}

describe("fixed-window objective key levels", () => {
  it("requires 200 completed candles and never counts the forming tail", () => {
    expect(analyzeKeyLevels([])).toBeNull();
    expect(analyzeKeyLevels(candles(KEY_LEVEL_REQUIRED_CLOSED_CANDLES - 1))).toBeNull();
    const withForming = candles(200);
    withForming[199].state = "forming";
    expect(analyzeKeyLevels(withForming)).toBeNull();
    expect(analyzeKeyLevels(candles(200))?.sampleCount).toBe(200);
  });

  it("uses only the most recent 500 completed candles, independent of older prices", () => {
    const source = candles(650);
    const alteredPrefix = source.map((candle, index) => index < 150 ? {
      ...candle, high: 5_000, low: 1, volume: 999_999,
    } : candle);
    const result = analyzeKeyLevels(source)!;

    expect(result).toEqual(analyzeKeyLevels(source.slice(150)));
    expect(result).toEqual(analyzeKeyLevels(alteredPrefix));
    expect(result).toMatchObject({
      algorithmVersion: KEY_LEVEL_ALGORITHM_VERSION,
      sampleCount: KEY_LEVEL_WINDOW_CANDLES,
      windowStartAt: source[150].openedAt,
      confirmedAt: source[649].closedAt,
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1h",
      quoteCurrency: "USDT",
    });
  });

  it("does not allow an extreme forming candle into any price or volume calculation", () => {
    const source = candles(221);
    source[220] = {
      ...source[220], state: "forming", open: 100_000, high: 200_000,
      low: 1, close: 190_000, volume: 9_999_999,
    };

    expect(analyzeKeyLevels(source)).toEqual(analyzeKeyLevels(source.slice(0, -1)));
  });

  it("uses the latest completed bar for Pivot, not the second-to-last bar", () => {
    const source = candles();
    source[199] = { ...source[199], open: 110, high: 120, low: 90, close: 114 };
    const result = analyzeKeyLevels(source)!;
    const pivots = evidence(result).filter((item) => item.method === "pivot");

    expect(Object.fromEntries(pivots.map((item) => [item.label, item.price]))).toEqual({
      P: 108, R1: 126, S1: 96, R2: 138, S2: 78, R3: 156, S3: 66,
    });
    expect(pivots.every((item) => item.anchorAt === source[199].openedAt &&
      item.confirmedAt === source[199].closedAt)).toBe(true);
  });

  it("does not expose mathematically negative Pivot projections as prices", () => {
    const source = candles();
    source[199] = { ...source[199], open: 1, high: 100, low: 1, close: 1 };
    const pivots = evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "pivot");

    expect(pivots.every((item) => item.price > 0)).toBe(true);
    expect(pivots.some((item) => item.label === "S1")).toBe(false);
  });

  it("requires all five following completed bars before confirming a swing", () => {
    const source = candles(206);
    source[200] = { ...source[200], high: 150 };
    const before = analyzeKeyLevels(source.slice(0, 205))!;
    const after = analyzeKeyLevels(source)!;

    expect(evidence(before).filter((item) => item.method === "swing_high")).toEqual([]);
    expect(evidence(after).filter((item) => item.method === "swing_high")).toEqual([
      {
        method: "swing_high", label: "swing_high", price: 150, weight: 2,
        anchorAt: source[200].openedAt,
        confirmedAt: source[205].closedAt,
      },
    ]);
    source[205].state = "forming";
    expect(evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "swing_high")).toEqual([]);
  });

  it("collapses equal neighbouring swing highs and never inflates a flat plateau", () => {
    const source = candles(220);
    for (const index of [100, 101, 102]) source[index].high = 150;
    const swings = evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "swing_high");
    expect(swings).toHaveLength(1);
    expect(swings[0].anchorAt).toBe(source[100].openedAt);

    const constant = candles().map((candle) => flat(candle, 100, 1));
    const result = analyzeKeyLevels(constant)!;
    expect(evidence(result).filter((item) => item.method.startsWith("swing"))).toEqual([]);
    expect(evidence(result).filter((item) => item.method === "fibonacci")).toEqual([]);
    expect(result.levels).toHaveLength(1);
    expect(result.levels[0]).toMatchObject({ price: 100, strength: 1.5, methods: ["pivot"] });
  });

  it("applies the same five-bar confirmation to lows and keeps only the ten most recent of each side", () => {
    const source = candles(500);
    for (let index = 20; index <= 480; index += 20) {
      source[index].high = 200 + index;
      source[index + 10].low = 90 - index / 10;
    }
    const result = evidence(analyzeKeyLevels(source)!);
    const highs = result.filter((item) => item.method === "swing_high");
    const lows = result.filter((item) => item.method === "swing_low");
    expect(highs).toHaveLength(10);
    expect(lows).toHaveLength(10);
    expect(highs.every((item) => item.anchorAt >= source[300].openedAt)).toBe(true);
    expect(lows.every((item) => item.anchorAt >= source[310].openedAt)).toBe(true);
    expect(lows.find((item) => item.anchorAt === source[490].openedAt)?.confirmedAt)
      .toBe(source[495].closedAt);
  });

  it.each(["upswing", "downswing"] as const)("derives Fibonacci direction from the order of window extremes: %s", (direction) => {
    const source = candles();
    const highIndex = direction === "upswing" ? 160 : 50;
    const lowIndex = direction === "upswing" ? 50 : 160;
    source[highIndex].high = 200;
    source[lowIndex].low = 50;
    const fib = evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "fibonacci");

    expect(fib).toHaveLength(7);
    expect(fib.find((item) => item.label === `${direction}_0.236`)?.price)
      .toBeCloseTo(direction === "upswing" ? 164.6 : 85.4);
    expect(fib.every((item) => item.confirmedAt === source[199].closedAt)).toBe(true);
    expect(fib.every((item) => item.anchorAt === source[160].openedAt)).toBe(true);
  });

  it("does not invent intrabar Fibonacci direction when both extrema occur in one candle", () => {
    const source = candles();
    source[100] = { ...source[100], high: 200, low: 50 };
    expect(evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "fibonacci")).toEqual([]);
  });

  it("retains the exact positive Fibonacci endpoints across a very wide range", () => {
    const source = candles();
    source[50].low = Number.MIN_VALUE;
    source[160].high = 200;
    const fib = evidence(analyzeKeyLevels(source)!).filter((item) => item.method === "fibonacci");
    expect(fib.find((item) => item.label === "upswing_1")?.price).toBe(Number.MIN_VALUE);
    expect(fib.every((item) => item.price > 0)).toBe(true);
  });

  it("bounds whole clusters instead of joining an arbitrarily long chain of neighbours", () => {
    const source = candles().map((candle) => ({ ...candle, high: 100.4, low: 99.6, volume: 0 }));
    const result = analyzeKeyLevels(source)!;
    expect(result.levels.length).toBeGreaterThan(1);
    expect(result.levels.some((level) => level.evidence.length > 1)).toBe(true);
    for (const [index, level] of result.levels.entries()) {
      expect(level.upper - level.lower).toBeLessThanOrEqual(source[199].close * KEY_LEVEL_CLUSTER_PRICE_RATIO);
      expect(level.price).toBeGreaterThanOrEqual(level.lower);
      expect(level.price).toBeLessThanOrEqual(level.upper);
      expect(level.strength).toBe(level.evidence.reduce((sum, item) => sum + item.weight, 0));
      expect(level).not.toHaveProperty("support");
      expect(level).not.toHaveProperty("resistance");
      expect(level).not.toHaveProperty("confidence");
      if (index > 0) expect(level.price).toBeGreaterThan(result.levels[index - 1].price);
    }
    expect(new Set(result.levels.map((level) => level.id)).size).toBe(result.levels.length);
  });

  it.each(["15m", "1h", "4h", "1d"] as const)("works for one contiguous %s scope", (interval) => {
    expect(analyzeKeyLevels(candles(220, interval))?.interval).toBe(interval);
    const eth = candles(220, interval).map((candle) => ({
      ...candle, asset: "eth" as const, symbol: "ETHUSDT" as const,
    }));
    expect(analyzeKeyLevels(eth)?.asset).toBe("eth");
  });

  it("does not mutate caller data and returns deterministic snapshots", () => {
    const source = Object.freeze(candles().map((candle) => Object.freeze(candle)));
    const serialized = JSON.stringify(source);
    expect(analyzeKeyLevels(source)).toEqual(analyzeKeyLevels(source));
    expect(JSON.stringify(source)).toBe(serialized);
  });
});

describe("OHLCV volume distribution estimates", () => {
  it("conserves volume and uses bucket edges for a 70% value area", () => {
    const result = analyzeKeyLevels(candles())!.volumeProfile!;
    expect(result).toMatchObject({
      estimated: true,
      totalVolume: 20_000,
      valueAreaVolume: 14_000,
      valueAreaCoverage: 0.7,
      actualCoverage: 0.7,
      binCount: 100,
      binWidth: 0.02,
      val: 99,
    });
    expect(result.poc).toBeCloseTo(99.01);
    expect(result.vah).toBeCloseTo(100.4);
    expect(result.bins.every((bin) => bin.volume === 200)).toBe(true);
    expect(result.bins.reduce((sum, bin) => sum + bin.volume, 0)).toBe(result.totalVolume);
    expect(result.hvn).toEqual([]);
  });

  it("keeps all volume for flat candles at the minimum, interior edge and maximum", () => {
    const source = candles().map((candle) => flat(candle, 100));
    source[0].high = 200;
    source[196] = flat(source[196], 100, 3);
    source[197] = flat(source[197], 150, 7);
    source[198] = flat(source[198], 200, 11);
    source[199] = { ...source[199], open: 150.5, close: 150.5, low: 150, high: 151, volume: 13 };
    const result = analyzeKeyLevels(source)!.volumeProfile!;

    expect(result.totalVolume).toBe(34);
    expect(result.bins[0].volume).toBe(3);
    expect(result.bins[49].volume).toBe(0);
    expect(result.bins[50].volume).toBe(20);
    expect(result.bins[51].volume).toBe(0);
    expect(result.bins[99].volume).toBe(11);
    expect(result.bins.reduce((sum, bin) => sum + bin.volume, 0)).toBe(34);
    expect(result.poc).toBe(150.5);
  });

  it("returns no profile for all-zero volume while retaining valid price-based candidates", () => {
    const result = analyzeKeyLevels(candles().map((candle) => ({ ...candle, volume: 0 })))!;
    expect(result.volumeProfile).toBeNull();
    expect(result.levels.length).toBeGreaterThan(0);
    expect(evidence(result).some((item) => item.method === "hvn")).toBe(false);
  });

  it("represents a positive-volume flat price as exactly one bucket", () => {
    const result = analyzeKeyLevels(candles().map((candle) => flat(candle, 100, 3)))!.volumeProfile!;
    expect(result).toMatchObject({
      poc: 100, val: 100, vah: 100, totalVolume: 600, valueAreaVolume: 600,
      binCount: 1, binWidth: 0, actualCoverage: 1,
      bins: [{ lower: 100, upper: 100, price: 100, volume: 600 }],
    });
  });

  it("collapses a high-volume plateau into one HVN rather than repeated evidence", () => {
    const source = candles().map((candle) => flat(candle, 100));
    source[0].high = 200;
    source[198] = flat(source[198], 150, 25);
    source[199] = flat(source[199], 151, 25);
    const result = analyzeKeyLevels(source)!;

    expect(result.volumeProfile?.hvn).toEqual([150.5]);
    expect(evidence(result).filter((item) => item.method === "hvn")).toEqual([
      {
        method: "hvn", label: "volume_high_node", price: 150.5, weight: 2.5,
        anchorAt: source[0].openedAt, confirmedAt: source[199].closedAt,
      },
    ]);
  });

  it("conserves fractional candle volume across arbitrary bucket overlaps", () => {
    const source = candles(500).map((candle, index) => {
      const price = 100 + Math.sin(index / 7) * 20;
      return { ...candle, open: price, close: price, high: price + 3.5, low: price - 2.1, volume: index % 11 / 10 + 0.13 };
    });
    const result = analyzeKeyLevels(source)!.volumeProfile!;
    const expectedVolume = source.reduce((sum, candle) => sum + candle.volume, 0);

    expect(result.totalVolume).toBeCloseTo(expectedVolume, 10);
    expect(result.bins.reduce((sum, bin) => sum + bin.volume, 0)).toBeCloseTo(expectedVolume, 10);
    expect(result.valueAreaVolume).toBeGreaterThanOrEqual(expectedVolume * 0.7);
    expect(result.bins.every((bin) => bin.volume >= 0)).toBe(true);
    expect(result.val).toBeLessThanOrEqual(result.poc);
    expect(result.vah).toBeGreaterThanOrEqual(result.poc);
  });

  it("reduces buckets rather than inventing precision for an almost-flat price range", () => {
    const source = candles().map((candle) => ({
      ...candle, open: 100, close: 100, low: 100, high: 100 + Number.EPSILON * 100, volume: 1,
    }));
    const result = analyzeKeyLevels(source)!.volumeProfile!;
    expect(result.binCount).toBeLessThan(100);
    expect(result.bins.every((bin) => bin.upper > bin.lower)).toBe(true);
    expect(result.bins.reduce((sum, bin) => sum + bin.volume, 0)).toBeCloseTo(200);
  });
});

describe("key-level input and arithmetic integrity", () => {
  it.each([
    { volume: Number.NaN }, { volume: Number.POSITIVE_INFINITY }, { volume: -1 },
    { low: 0 }, { high: 99 }, { open: 105 }, { close: 0 }, { close: Number.NaN },
    { openedAt: "invalid" }, { closedAt: "2026-01-01T01:00:00.000Z" },
    { state: "future" },
  ])("rejects malformed candles: %j", (patch) => {
    const source = candles();
    source[50] = { ...source[50], ...patch } as ChartCandle;
    expect(() => analyzeKeyLevels(source)).toThrow(TypeError);
  });

  it.each([
    { asset: "eth", symbol: "ETHUSDT" },
    { asset: "btc", symbol: "ETHUSDT" },
    { asset: "doge", symbol: "BTCUSDT" },
    { quoteCurrency: "USD" },
    { interval: "15m" },
  ])("rejects mixed or invalid scope: %j", (patch) => {
    const source = candles();
    source[50] = { ...source[50], ...patch } as ChartCandle;
    expect(() => analyzeKeyLevels(source)).toThrow(TypeError);
  });

  it("rejects even a uniformly invalid symbol or quote scope", () => {
    const source = candles().map((candle) => ({ ...candle, symbol: "ETHUSDT" as const }));
    expect(() => analyzeKeyLevels(source)).toThrow("one valid scope");
  });

  it("rejects gaps, duplicates, reversed order and a forming candle in the middle", () => {
    const source = candles(220);
    expect(() => analyzeKeyLevels(source.filter((_, index) => index !== 100))).toThrow("contiguous");
    expect(() => analyzeKeyLevels([...source.slice(0, 100), source[99], ...source.slice(100)])).toThrow(TypeError);
    expect(() => analyzeKeyLevels([...source].reverse())).toThrow(TypeError);
    source[100].state = "forming";
    expect(() => analyzeKeyLevels(source)).toThrow("Only the latest");
  });

  it("validates excluded old candles and the forming tail rather than hiding corrupt data", () => {
    const source = candles(650);
    source[0].volume = Number.NaN;
    expect(() => analyzeKeyLevels(source)).toThrow(TypeError);
    const tail = candles(221);
    tail[220] = { ...tail[220], state: "forming", volume: Number.NaN };
    expect(() => analyzeKeyLevels(tail)).toThrow(TypeError);
  });

  it("rejects numerical overflow rather than returning Infinity that serializes as null", () => {
    const volumeOverflow = candles().map((candle) => ({ ...candle, volume: Number.MAX_VALUE }));
    expect(() => analyzeKeyLevels(volumeOverflow)).toThrow("finite");
    const pivotOverflow = candles().map((candle) => flat(candle, Number.MAX_VALUE));
    expect(() => analyzeKeyLevels(pivotOverflow)).toThrow("finite");
  });

  it("rejects volume allocation underflow instead of producing fake zero-volume buckets", () => {
    const source = candles().map((candle) => ({ ...candle, volume: 0 }));
    source[100].volume = Number.MIN_VALUE;
    expect(() => analyzeKeyLevels(source)).toThrow("precision");
  });
});
