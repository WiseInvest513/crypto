import type {
  ChartCandle,
  ChartCandleInterval,
} from "@/server/data/contracts/market-data";
import {
  assertChartSeries,
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  liveEmaKeys,
  summarizeLiveTrend,
  type LiveTrendSummary,
} from "./live-chart";

export const MULTI_TIMEFRAME_INTERVALS = ["15m", "1h", "4h", "1d"] as const;

export const MULTI_TIMEFRAME_CANDLE_LIMIT = 1_000;
export const MULTI_TIMEFRAME_WINDOW_CANDLES = 20;
export const MULTI_TIMEFRAME_REQUIRED_CLOSED_CANDLES = 200;
export const MULTI_TIMEFRAME_ALGORITHM_VERSION = "closed-ema-v1" as const;

export type MultiTimeframeIntervalAnalysis = Readonly<{
  interval: ChartCandleInterval;
  algorithmVersion: typeof MULTI_TIMEFRAME_ALGORITHM_VERSION;
  sampleCount: number;
  excludedFormingCandle: boolean;
  latestClosedAt: string;
  latestClose: number;
  comparisons: LiveTrendSummary["comparisons"];
  ordering: LiveTrendSummary["ordering"];
  recentThreeChangePercent: number | null;
  window: Readonly<{
    candleCount: typeof MULTI_TIMEFRAME_WINDOW_CANDLES;
    firstOpenedAt: string;
    highestPrice: number;
    highestPriceCandleOpenedAt: string;
    lowestPrice: number;
    openToCloseChangePercent: number;
    changeFromHighPercent: number;
    latestCloseRangePositionPercent: number | null;
    barsSinceHigh: number;
    latestVolume: number;
    averagePrevious20Volume: number;
    latestVolumeRatioToAverage: number | null;
  }>;
}>;

/**
 * Builds a neutral, auditable fact set for one interval. Every calculation is
 * based on closed candles only; a still-forming final candle is validated and
 * then discarded before any EMA or range value is calculated.
 */
export function analyzeMultiTimeframeCandles(
  candles: readonly ChartCandle[],
): MultiTimeframeIntervalAnalysis | null {
  assertChartSeries(candles);
  assertContiguousSeries(candles);

  const closedCandles = candles.filter((candle) => candle.state === "closed");
  if (closedCandles.length < MULTI_TIMEFRAME_REQUIRED_CLOSED_CANDLES) {
    return null;
  }

  const points = buildLiveChartPoints(closedCandles);
  const trend = summarizeLiveTrend(points, liveEmaKeys);
  if (
    trend === null ||
    trend.comparisons.some((comparison) => comparison.value === null)
  ) {
    return null;
  }

  const window = points.slice(-MULTI_TIMEFRAME_WINDOW_CANDLES);
  if (window.length !== MULTI_TIMEFRAME_WINDOW_CANDLES) {
    return null;
  }

  const first = window[0];
  const latest = window.at(-1)!;
  const previous20 = points.slice(
    -(MULTI_TIMEFRAME_WINDOW_CANDLES + 1),
    -1,
  );
  let highestPrice = Number.NEGATIVE_INFINITY;
  let highestPriceIndex = -1;
  let lowestPrice = Number.POSITIVE_INFINITY;

  for (const [index, point] of window.entries()) {
    // Prefer the most recent candle when the same high appears more than once.
    if (point.high >= highestPrice) {
      highestPrice = point.high;
      highestPriceIndex = index;
    }
    lowestPrice = Math.min(lowestPrice, point.low);
  }

  const openToCloseChangePercent =
    ((latest.close - first.open) / first.open) * 100;
  const changeFromHighPercent =
    ((latest.close - highestPrice) / highestPrice) * 100;
  const range = highestPrice - lowestPrice;
  const latestCloseRangePositionPercent =
    range === 0
      ? null
      : Math.min(100, Math.max(0, ((latest.close - lowestPrice) / range) * 100));
  const averagePrevious20Volume =
    previous20.reduce((total, point) => total + point.volume, 0) /
    MULTI_TIMEFRAME_WINDOW_CANDLES;
  const latestVolumeRatioToAverage =
    averagePrevious20Volume === 0
      ? null
      : latest.volume / averagePrevious20Volume;

  for (const value of [
    highestPrice,
    lowestPrice,
    openToCloseChangePercent,
    changeFromHighPercent,
    averagePrevious20Volume,
    ...(latestCloseRangePositionPercent === null
      ? []
      : [latestCloseRangePositionPercent]),
    ...(latestVolumeRatioToAverage === null
      ? []
      : [latestVolumeRatioToAverage]),
  ]) {
    if (!Number.isFinite(value)) {
      throw new TypeError("Multi-timeframe calculation must be finite.");
    }
  }

  return {
    interval: latest.interval,
    algorithmVersion: MULTI_TIMEFRAME_ALGORITHM_VERSION,
    sampleCount: closedCandles.length,
    excludedFormingCandle: candles.some(
      (candle) => candle.state === "forming",
    ),
    latestClosedAt: latest.closedAt,
    latestClose: latest.close,
    comparisons: trend.comparisons,
    ordering: trend.ordering,
    recentThreeChangePercent: trend.recentThreeChangePercent,
    window: {
      candleCount: MULTI_TIMEFRAME_WINDOW_CANDLES,
      firstOpenedAt: first.openedAt,
      highestPrice,
      highestPriceCandleOpenedAt: window[highestPriceIndex].openedAt,
      lowestPrice,
      openToCloseChangePercent,
      changeFromHighPercent,
      latestCloseRangePositionPercent,
      barsSinceHigh: window.length - 1 - highestPriceIndex,
      latestVolume: latest.volume,
      averagePrevious20Volume,
      latestVolumeRatioToAverage,
    },
  };
}

function assertContiguousSeries(candles: readonly ChartCandle[]): void {
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    if (
      current.asset !== previous.asset ||
      current.symbol !== previous.symbol ||
      current.interval !== previous.interval ||
      current.quoteCurrency !== previous.quoteCurrency ||
      Date.parse(current.openedAt) - Date.parse(previous.openedAt) !==
        chartIntervalMilliseconds[current.interval]
    ) {
      throw new TypeError("Multi-timeframe candles must be contiguous and share one scope.");
    }
  }
}
