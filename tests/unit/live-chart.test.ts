import { describe, expect, it } from "vitest";
import {
  assertChartSeries,
  buildLiveChartPoints,
  chartTailNeedsFullRefresh,
  mergeChartCandles,
  summarizeLiveTrend,
  summarizeVisibleChart,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";

const INTERVAL_MILLISECONDS = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
} as const satisfies Record<ChartCandleInterval, number>;

const ALIGNED_START = Date.parse("2026-08-01T00:00:00.000Z");

function chartCandles(
  count: number,
  options: {
    asset?: Asset;
    interval?: ChartCandleInterval;
    start?: number;
    formingLatest?: boolean;
    closeStart?: number;
  } = {},
): readonly ChartCandle[] {
  const asset = options.asset ?? "btc";
  const interval = options.interval ?? "1h";
  const duration = INTERVAL_MILLISECONDS[interval];
  const start = options.start ?? ALIGNED_START;
  const closeStart = options.closeStart ?? 100;

  return Array.from({ length: count }, (_, index) => {
    const openedAt = start + index * duration;
    const close = closeStart + index;
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state:
        options.formingLatest !== false && index === count - 1
          ? "forming"
          : "closed",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: index,
    } satisfies ChartCandle;
  });
}

describe("live chart calculations", () => {
  it("calculates SMA-seeded EMA10, EMA20 and EMA50 including the forming chart candle", () => {
    const points = buildLiveChartPoints(chartCandles(50));

    expect(points).toHaveLength(50);
    expect(points[8].ema10).toBeNull();
    expect(points[9].ema10).toBe(104.5);
    expect(points[18].ema20).toBeNull();
    expect(points[19].ema20).toBe(109.5);
    expect(points[48].ema50).toBeNull();
    expect(points[49]).toMatchObject({
      state: "forming",
      ema10: 144.5,
      ema20: 139.5,
      ema50: 124.5,
      ema200: null,
    });
  });

  it("uses the recursive EMA multiplier after the complete-window seed", () => {
    const source = chartCandles(11).map((candle, index) =>
      index === 10
        ? { ...candle, open: 100, high: 121, low: 99, close: 120 }
        : { ...candle, open: 100, high: 101, low: 99, close: 100 },
    );
    const points = buildLiveChartPoints(source);

    expect(points[9].ema10).toBe(100);
    expect(points[10].ema10).toBeCloseTo(103.6363636364, 8);
  });

  it("rejects a non-finite EMA seed instead of exposing an infinite line", () => {
    const extreme = chartCandles(10).map((candle) => ({
      ...candle,
      open: Number.MAX_VALUE,
      high: Number.MAX_VALUE,
      low: Number.MAX_VALUE,
      close: Number.MAX_VALUE,
    }));

    expect(() => buildLiveChartPoints(extreme)).toThrow(
      "Chart summary calculation must be finite.",
    );
  });

  it("summarizes selected EMA position, ordering and slopes from the latest closed candle", () => {
    const points = buildLiveChartPoints(chartCandles(210));
    const summary = summarizeLiveTrend(points, ["ema10", "ema20", "ema50"]);

    expect(summary?.point.state).toBe("closed");
    expect(summary?.point.close).toBe(308);
    expect(summary?.comparisons.map((comparison) => comparison.relation)).toEqual([
      "above",
      "above",
      "above",
    ]);
    expect(summary?.comparisons.every((comparison) => comparison.slope?.direction === "rising")).toBe(true);
    expect(summary?.ordering).toEqual({
      state: "short_above_long",
      expression: "EMA10 > EMA20 > EMA50",
    });
    expect(summary?.recentThreeChangePercent).toBeCloseTo((2.5 / 305.5) * 100);
  });

  it("excludes the forming candle from live trend facts", () => {
    const source = chartCandles(60);
    const changed = source.map((candle, index) =>
      index === source.length - 1
        ? { ...candle, open: 500, high: 601, low: 499, close: 600 }
        : candle,
    );

    const baseline = summarizeLiveTrend(
      buildLiveChartPoints(source),
      ["ema10", "ema20", "ema50"],
    );
    const withChangedForming = summarizeLiveTrend(
      buildLiveChartPoints(changed),
      ["ema10", "ema20", "ema50"],
    );

    expect(withChangedForming).toEqual(baseline);
  });

  it("reports unavailable long EMA samples and validates indicator selections", () => {
    const points = buildLiveChartPoints(chartCandles(60));
    const summary = summarizeLiveTrend(points, ["ema20", "ema200"]);

    expect(summary?.comparisons).toMatchObject([
      { key: "ema20", relation: "above" },
      { key: "ema200", relation: "unavailable", value: null },
    ]);
    expect(summary?.ordering).toBeNull();
    expect(() => summarizeLiveTrend(points, ["ema20", "ema20"])).toThrow(
      "Invalid live EMA selection.",
    );
  });

  it("replaces an updated forming candle, appends the next candle and caps history", () => {
    const current = chartCandles(3);
    const incoming = chartCandles(2, {
      start: ALIGNED_START + 2 * INTERVAL_MILLISECONDS["1h"],
      closeStart: 250,
    });

    const merged = mergeChartCandles(current, incoming, 3);

    expect(merged.map((candle) => candle.openedAt)).toEqual([
      new Date(ALIGNED_START + INTERVAL_MILLISECONDS["1h"]).toISOString(),
      new Date(ALIGNED_START + 2 * INTERVAL_MILLISECONDS["1h"]).toISOString(),
      new Date(ALIGNED_START + 3 * INTERVAL_MILLISECONDS["1h"]).toISOString(),
    ]);
    expect(merged.at(-2)).toMatchObject({ close: 250, state: "closed" });
    expect(merged.at(-1)).toMatchObject({ close: 251, state: "forming" });
  });

  it("rejects mixed asset, symbol or interval scopes during a merge", () => {
    const current = chartCandles(3);
    const incoming = chartCandles(2, { asset: "eth" });

    expect(() => mergeChartCandles(current, incoming)).toThrow(
      "Cannot merge mixed-scope chart candles.",
    );
  });

  it("detects gaps that require a full refresh without flagging overlap", () => {
    const current = chartCandles(3);
    const overlap = chartCandles(2, {
      start: ALIGNED_START + 2 * INTERVAL_MILLISECONDS["1h"],
    });
    const firstExpectedNext = chartCandles(1, {
      start: ALIGNED_START + 3 * INTERVAL_MILLISECONDS["1h"],
    });
    const gap = chartCandles(1, {
      start: ALIGNED_START + 4 * INTERVAL_MILLISECONDS["1h"],
    });

    expect(chartTailNeedsFullRefresh(current, overlap)).toBe(false);
    expect(chartTailNeedsFullRefresh(current, firstExpectedNext)).toBe(false);
    expect(chartTailNeedsFullRefresh(current, gap)).toBe(true);
    expect(chartTailNeedsFullRefresh([], gap)).toBe(true);
    expect(
      chartTailNeedsFullRefresh(current, chartCandles(1, { asset: "eth" })),
    ).toBe(true);
  });

  it("summarizes the visible price range and forming volume against 20 closed candles", () => {
    const points = buildLiveChartPoints(chartCandles(21)).map((point, index) => ({
      ...point,
      volume: index === 20 ? 210 : index + 1,
    }));

    expect(summarizeVisibleChart(points)).toEqual({
      openToCloseChangePercent: (20.5 / 99.5) * 100,
      highestPrice: 121,
      lowestPrice: 99,
      amplitudePercent: (22 / 99.5) * 100,
      totalVolume: 420,
      latestCloseRangePercentile: (21 / 22) * 100,
      formingVolumeComparison: {
        formingVolume: 210,
        averageClosed20Volume: 10.5,
        ratioToAverage: 20,
      },
    });
  });

  it("returns null for an empty window and omits an insufficient volume comparison", () => {
    expect(summarizeVisibleChart([])).toBeNull();

    const summary = summarizeVisibleChart(
      buildLiveChartPoints(chartCandles(20)),
    );

    expect(summary).not.toBeNull();
    expect(summary?.formingVolumeComparison).toBeNull();
  });

  it("does not compare volume when the latest candle is closed", () => {
    const summary = summarizeVisibleChart(
      buildLiveChartPoints(chartCandles(21, { formingLatest: false })),
    );

    expect(summary?.formingVolumeComparison).toBeNull();
  });

  it("uses null for undefined flat-range percentile and zero-average volume ratio", () => {
    const points = buildLiveChartPoints(chartCandles(21)).map((point, index) => ({
      ...point,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: index === 20 ? 5 : 0,
    }));

    const summary = summarizeVisibleChart(points);

    expect(summary).toMatchObject({
      openToCloseChangePercent: 0,
      highestPrice: 100,
      lowestPrice: 100,
      amplitudePercent: 0,
      totalVolume: 5,
      latestCloseRangePercentile: null,
      formingVolumeComparison: {
        formingVolume: 5,
        averageClosed20Volume: 0,
        ratioToAverage: null,
      },
    });
  });

  it("rejects non-finite point values, moving averages and aggregate overflow", () => {
    const points = buildLiveChartPoints(chartCandles(21));

    expect(() =>
      summarizeVisibleChart([
        ...points.slice(0, -1),
        { ...points.at(-1)!, close: Number.NaN },
      ]),
    ).toThrow("Invalid chart candle series.");
    expect(() =>
      summarizeVisibleChart([
        ...points.slice(0, -1),
        { ...points.at(-1)!, ema20: Number.POSITIVE_INFINITY },
      ]),
    ).toThrow("Chart exponential moving averages must be finite or null.");
    expect(() =>
      summarizeVisibleChart(
        points.map((point) => ({ ...point, volume: Number.MAX_VALUE })),
      ),
    ).toThrow("Chart summary calculation must be finite.");
  });

  it("rejects mixed-scope visible points", () => {
    const points = buildLiveChartPoints(chartCandles(3));

    expect(() =>
      summarizeVisibleChart([
        points[0],
        { ...points[1], asset: "eth", symbol: "ETHUSDT" },
        points[2],
      ]),
    ).toThrow("Cannot summarize mixed-scope chart points.");
  });
});

describe("live chart validation", () => {
  it.each([
    [
      "out-of-order timestamps",
      () => {
        const candles = chartCandles(3, { formingLatest: false });
        return [candles[1], candles[0], candles[2]];
      },
    ],
    [
      "duplicate timestamps",
      () => {
        const candles = chartCandles(3, { formingLatest: false });
        return [candles[0], candles[0], candles[2]];
      },
    ],
    [
      "a forming candle before the latest position",
      () => {
        const candles = chartCandles(3, { formingLatest: false });
        return [{ ...candles[0], state: "forming" as const }, ...candles.slice(1)];
      },
    ],
    [
      "an interval boundary mismatch",
      () => {
        const candles = chartCandles(2, { formingLatest: false });
        return [
          candles[0],
          {
            ...candles[1],
            openedAt: new Date(Date.parse(candles[1].openedAt) + 1).toISOString(),
          },
        ];
      },
    ],
    [
      "invalid OHLC bounds",
      () => {
        const candles = chartCandles(2, { formingLatest: false });
        return [candles[0], { ...candles[1], high: candles[1].close - 1 }];
      },
    ],
  ])("rejects %s", (_label, buildInvalidSeries) => {
    expect(() => assertChartSeries(buildInvalidSeries())).toThrow();
  });

  it("accepts a valid series with zero volume and only the latest candle forming", () => {
    expect(() => assertChartSeries(chartCandles(3))).not.toThrow();
  });
});
