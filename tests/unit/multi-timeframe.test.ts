import { describe, expect, it } from "vitest";
import {
  analyzeMultiTimeframeCandles,
  MULTI_TIMEFRAME_REQUIRED_CLOSED_CANDLES,
} from "@/lib/market/multi-timeframe";
import {
  chartIntervalMilliseconds,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";

const ALIGNED_START = Date.parse("2026-01-01T00:00:00.000Z");

function chartCandles(
  closedCount: number,
  options: Readonly<{
    asset?: Asset;
    interval?: ChartCandleInterval;
    formingLatest?: boolean;
  }> = {},
): readonly ChartCandle[] {
  const asset = options.asset ?? "btc";
  const interval = options.interval ?? "1h";
  const duration = chartIntervalMilliseconds[interval];
  const total = closedCount + (options.formingLatest === false ? 0 : 1);

  return Array.from({ length: total }, (_, index) => {
    const openedAt = ALIGNED_START + index * duration;
    const close = 100 + index;

    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state: index < closedCount ? "closed" : "forming",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 10,
    } satisfies ChartCandle;
  });
}

describe("multi-timeframe closed-candle analysis", () => {
  it("excludes an extreme forming candle from every fact and calculates EMA10/20/50/200", () => {
    const source = chartCandles(220);
    const extremeForming = source.map((candle, index) =>
      index === source.length - 1
        ? {
            ...candle,
            open: 1_000_000,
            high: 1_500_000,
            low: 900_000,
            close: 1_400_000,
            volume: 9_999_999,
          }
        : candle,
    );

    const baseline = analyzeMultiTimeframeCandles(source);
    const analysis = analyzeMultiTimeframeCandles(extremeForming);

    expect(analysis).toEqual(baseline);
    expect(analysis).not.toBeNull();
    expect(analysis).toMatchObject({
      sampleCount: 220,
      excludedFormingCandle: true,
      latestClose: 319,
      ordering: {
        state: "short_above_long",
        expression: "EMA10 > EMA20 > EMA50 > EMA200",
      },
    });

    const comparisons = Object.fromEntries(
      analysis!.comparisons.map((comparison) => [comparison.key, comparison]),
    );
    expect(comparisons.ema10).toMatchObject({
      value: 314.5,
      relation: "above",
    });
    expect(comparisons.ema20).toMatchObject({
      value: 309.5,
      relation: "above",
    });
    expect(comparisons.ema50).toMatchObject({
      value: 294.5,
      relation: "above",
    });
    expect(comparisons.ema200).toMatchObject({
      value: 219.5,
      relation: "above",
    });
    expect(comparisons.ema200.distancePercent).toBeCloseTo(
      ((319 - 219.5) / 219.5) * 100,
    );
  });

  it("reports auditable 3-candle, 20-candle, high-distance and volume facts", () => {
    const source = chartCandles(220, { formingLatest: false }).map(
      (candle, index) => ({
        ...candle,
        high: index === 214 ? 400 : candle.high,
        volume: index === 219 ? 30 : 10,
      }),
    );

    const analysis = analyzeMultiTimeframeCandles(source);

    expect(analysis).not.toBeNull();
    expect(analysis!.recentThreeChangePercent).toBeCloseTo(
      ((319 - 316.5) / 316.5) * 100,
    );
    expect(analysis!.window).toMatchObject({
      candleCount: 20,
      highestPrice: 400,
      lowestPrice: 299,
      barsSinceHigh: 5,
      latestVolume: 30,
      averagePrevious20Volume: 10,
      latestVolumeRatioToAverage: 3,
    });
    expect(analysis!.window.openToCloseChangePercent).toBeCloseTo(
      ((319 - 299.5) / 299.5) * 100,
    );
    expect(analysis!.window.changeFromHighPercent).toBeCloseTo(
      ((319 - 400) / 400) * 100,
    );
    expect(analysis!.window.latestCloseRangePositionPercent).toBeCloseTo(
      ((319 - 299) / (400 - 299)) * 100,
    );
  });

  it("rejects an internal candle gap rather than calculating across missing history", () => {
    const source = chartCandles(220, { formingLatest: false });
    const withGap = source.filter((_, index) => index !== 100);

    expect(() => analyzeMultiTimeframeCandles(withGap)).toThrow(
      "Multi-timeframe candles must be contiguous",
    );
  });

  it("returns null when fewer than 200 closed candles are available", () => {
    const source = chartCandles(
      MULTI_TIMEFRAME_REQUIRED_CLOSED_CANDLES - 1,
    );

    expect(analyzeMultiTimeframeCandles(source)).toBeNull();
  });

  it("accepts exactly 200 closed candles while leaving the EMA200 three-bar slope unavailable", () => {
    const analysis = analyzeMultiTimeframeCandles(
      chartCandles(MULTI_TIMEFRAME_REQUIRED_CLOSED_CANDLES, {
        formingLatest: false,
      }),
    );

    expect(analysis).not.toBeNull();
    expect(analysis!.sampleCount).toBe(200);
    expect(
      analysis!.comparisons.find((comparison) => comparison.key === "ema200"),
    ).toMatchObject({
      value: 199.5,
      relation: "above",
      slope: null,
    });
  });

  it("reports a flat, zero-volume window without manufacturing position or volume ratios", () => {
    const source = chartCandles(220, { formingLatest: false }).map(
      (candle) => ({
        ...candle,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 0,
      }),
    );

    const analysis = analyzeMultiTimeframeCandles(source);

    expect(analysis).not.toBeNull();
    expect(analysis!.window).toMatchObject({
      highestPrice: 100,
      lowestPrice: 100,
      openToCloseChangePercent: 0,
      changeFromHighPercent: 0,
      latestCloseRangePositionPercent: null,
      latestVolume: 0,
      averagePrevious20Volume: 0,
      latestVolumeRatioToAverage: null,
    });
  });
});
