import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
  ChartCandleState,
  MarketDatum,
} from "@/server/data/contracts/market-data";

export type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
  ChartCandleState,
  MarketDatum,
};

export const LIVE_CHART_REFRESH_MILLISECONDS = 5_000;
export const LIVE_CHART_MAX_CANDLES = 1_000;

export const chartIntervalLabels = {
  "15m": "15 分钟",
  "1h": "1 小时",
  "4h": "4 小时",
  "1d": "1 日",
} as const satisfies Record<ChartCandleInterval, string>;

export const chartIntervalMilliseconds = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
} as const satisfies Record<ChartCandleInterval, number>;

export const liveEmaDefinitions = {
  ema10: { label: "EMA10", period: 10 },
  ema20: { label: "EMA20", period: 20 },
  ema50: { label: "EMA50", period: 50 },
  ema200: { label: "EMA200", period: 200 },
} as const;

export type LiveEmaKey = keyof typeof liveEmaDefinitions;

export const liveEmaKeys = Object.keys(
  liveEmaDefinitions,
) as readonly LiveEmaKey[];

export type LiveChartPoint = ChartCandle & {
  ema10: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
};

export type LiveTrendSummary = Readonly<{
  point: LiveChartPoint;
  comparisons: readonly Readonly<{
    key: LiveEmaKey;
    value: number | null;
    relation: "above" | "below" | "equal" | "unavailable";
    distancePercent: number | null;
    slope: Readonly<{
      direction: "rising" | "falling" | "flat";
      changePercent: number;
      closedCandleSpan: 3;
    }> | null;
  }>[];
  ordering: Readonly<{
    state: "short_above_long" | "short_below_long" | "mixed";
    expression: string;
  }> | null;
  recentThreeChangePercent: number | null;
}>;

export type VisibleChartSummary = Readonly<{
  openToCloseChangePercent: number;
  highestPrice: number;
  lowestPrice: number;
  amplitudePercent: number;
  totalVolume: number;
  latestCloseRangePercentile: number | null;
  formingVolumeComparison: Readonly<{
    formingVolume: number;
    averageClosed20Volume: number;
    ratioToAverage: number | null;
  }> | null;
}>;

/**
 * Builds display-only exponential moving averages for the selected chart
 * interval. Each series is seeded with the first complete simple average, so
 * values before the requested period remain unavailable. The forming candle
 * may affect only its own chart point; this result is never used by the
 * closed-daily technical-analysis service.
 */
export function buildLiveChartPoints(
  candles: readonly ChartCandle[],
): readonly LiveChartPoint[] {
  assertChartSeries(candles);
  const closes = candles.map((candle) => candle.close);
  const emaSeries = Object.fromEntries(
    liveEmaKeys.map((key) => [
      key,
      exponentialMovingAverage(closes, liveEmaDefinitions[key].period),
    ]),
  ) as Record<LiveEmaKey, readonly (number | null)[]>;
  return candles.map((candle, index) => ({
    ...candle,
    ema10: emaSeries.ema10[index],
    ema20: emaSeries.ema20[index],
    ema50: emaSeries.ema50[index],
    ema200: emaSeries.ema200[index],
  }));
}

/**
 * Produces neutral relative-position facts from the latest closed candle in
 * the supplied window. The latest forming candle is deliberately excluded
 * from every statement and slope calculation.
 */
export function summarizeLiveTrend(
  points: readonly LiveChartPoint[],
  selectedKeys: readonly LiveEmaKey[],
): LiveTrendSummary | null {
  if (points.length === 0) {
    return null;
  }

  assertChartSeries(points);
  assertChartPointAverages(points);
  assertSingleChartScope(points);
  assertLiveEmaSelection(selectedKeys);

  const closed = points.filter((point) => point.state === "closed");
  const point = closed.at(-1);
  if (!point) {
    return null;
  }

  const previousForSlope = closed.at(-4) ?? null;
  const comparisons = selectedKeys.map((key) => {
    const value = point[key];
    if (value === null) {
      return {
        key,
        value,
        relation: "unavailable" as const,
        distancePercent: null,
        slope: null,
      };
    }

    const distancePercent = ((point.close - value) / value) * 100;
    assertFiniteCalculation(distancePercent);
    const previousValue = previousForSlope?.[key] ?? null;
    let slope: LiveTrendSummary["comparisons"][number]["slope"] = null;
    if (previousValue !== null) {
      const changePercent = ((value - previousValue) / previousValue) * 100;
      assertFiniteCalculation(changePercent);
      slope = {
        direction:
          value > previousValue
            ? "rising"
            : value < previousValue
              ? "falling"
              : "flat",
        changePercent,
        closedCandleSpan: 3,
      };
    }

    return {
      key,
      value,
      relation:
        point.close > value
          ? "above" as const
          : point.close < value
            ? "below" as const
            : "equal" as const,
      distancePercent,
      slope,
    };
  });

  const availableComparisons = comparisons.filter(
    (comparison) => comparison.value !== null,
  );
  const ordering =
    selectedKeys.length >= 2 &&
    availableComparisons.length === selectedKeys.length
      ? buildEmaOrdering(availableComparisons)
      : null;
  const recentThree = closed.slice(-3);
  const recentThreeChangePercent =
    recentThree.length === 3
      ? ((recentThree.at(-1)!.close - recentThree[0].open) /
          recentThree[0].open) *
        100
      : null;
  if (recentThreeChangePercent !== null) {
    assertFiniteCalculation(recentThreeChangePercent);
  }

  return {
    point,
    comparisons,
    ordering,
    recentThreeChangePercent,
  };
}

/**
 * Summarizes only the candles currently visible in the chart. This function
 * returns auditable numeric facts and deliberately does not attach a market
 * interpretation to them.
 */
export function summarizeVisibleChart(
  points: readonly LiveChartPoint[],
): VisibleChartSummary | null {
  if (points.length === 0) {
    return null;
  }

  assertChartSeries(points);
  assertChartPointAverages(points);
  assertSingleChartScope(points);

  const firstOpen = points[0].open;
  const latestClose = points.at(-1)!.close;
  let highestPrice = Number.NEGATIVE_INFINITY;
  let lowestPrice = Number.POSITIVE_INFINITY;
  let totalVolume = 0;

  for (const point of points) {
    highestPrice = Math.max(highestPrice, point.high);
    lowestPrice = Math.min(lowestPrice, point.low);
    totalVolume += point.volume;
    assertFiniteCalculation(totalVolume);
  }

  const openToCloseChangePercent =
    ((latestClose - firstOpen) / firstOpen) * 100;
  const priceRange = highestPrice - lowestPrice;
  const amplitudePercent = (priceRange / firstOpen) * 100;
  assertFiniteCalculation(openToCloseChangePercent);
  assertFiniteCalculation(priceRange);
  assertFiniteCalculation(amplitudePercent);

  const latestCloseRangePercentile =
    priceRange === 0
      ? null
      : Math.min(
          100,
          Math.max(0, ((latestClose - lowestPrice) / priceRange) * 100),
        );
  if (latestCloseRangePercentile !== null) {
    assertFiniteCalculation(latestCloseRangePercentile);
  }

  const latestPoint = points.at(-1)!;
  const recentClosed = points
    .filter((point) => point.state === "closed")
    .slice(-20);
  let formingVolumeComparison: VisibleChartSummary["formingVolumeComparison"] =
    null;

  if (latestPoint.state === "forming" && recentClosed.length === 20) {
    let closedVolumeTotal = 0;
    for (const point of recentClosed) {
      closedVolumeTotal += point.volume;
      assertFiniteCalculation(closedVolumeTotal);
    }
    const averageClosed20Volume = closedVolumeTotal / 20;
    assertFiniteCalculation(averageClosed20Volume);
    const ratioToAverage =
      averageClosed20Volume === 0
        ? null
        : latestPoint.volume / averageClosed20Volume;
    if (ratioToAverage !== null) {
      assertFiniteCalculation(ratioToAverage);
    }
    formingVolumeComparison = {
      formingVolume: latestPoint.volume,
      averageClosed20Volume,
      ratioToAverage,
    };
  }

  return {
    openToCloseChangePercent,
    highestPrice,
    lowestPrice,
    amplitudePercent,
    totalVolume,
    latestCloseRangePercentile,
    formingVolumeComparison,
  };
}

export function mergeChartCandles(
  current: readonly ChartCandle[],
  incoming: readonly ChartCandle[],
  maximum = LIVE_CHART_MAX_CANDLES,
): readonly ChartCandle[] {
  if (!Number.isSafeInteger(maximum) || maximum < 2) {
    throw new RangeError("Chart candle maximum must be a safe integer of at least 2.");
  }
  assertChartSeries(current);
  assertChartSeries(incoming);

  const reference = current[0] ?? incoming[0];
  for (const candle of [...current, ...incoming]) {
    if (
      reference &&
      (candle.asset !== reference.asset ||
        candle.symbol !== reference.symbol ||
        candle.interval !== reference.interval ||
        candle.quoteCurrency !== reference.quoteCurrency)
    ) {
      throw new TypeError("Cannot merge mixed-scope chart candles.");
    }
  }

  const merged = new Map(current.map((candle) => [candle.openedAt, candle]));
  for (const candle of incoming) {
    merged.set(candle.openedAt, candle);
  }
  const values = Array.from(merged.values()).sort(
    (left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt),
  );
  const limited = values.slice(-maximum);
  assertChartSeries(limited);
  return limited;
}

export function chartTailNeedsFullRefresh(
  current: readonly ChartCandle[],
  incoming: readonly ChartCandle[],
): boolean {
  if (current.length === 0 || incoming.length === 0) {
    return true;
  }
  assertChartSeries(current);
  assertChartSeries(incoming);
  const currentLatest = current.at(-1)!;
  const incomingFirst = incoming[0];
  if (
    currentLatest.asset !== incomingFirst.asset ||
    currentLatest.symbol !== incomingFirst.symbol ||
    currentLatest.interval !== incomingFirst.interval
  ) {
    return true;
  }
  return (
    Date.parse(incomingFirst.openedAt) >
    Date.parse(currentLatest.openedAt) +
      chartIntervalMilliseconds[currentLatest.interval]
  );
}

export function assertChartSeries(
  candles: readonly ChartCandle[],
): void {
  let previousOpenedAt = Number.NEGATIVE_INFINITY;
  let formingCount = 0;

  for (const [index, candle] of candles.entries()) {
    const openedAt = Date.parse(candle.openedAt);
    const closedAt = Date.parse(candle.closedAt);
    const duration = chartIntervalMilliseconds[candle.interval];
    if (
      !Number.isFinite(openedAt) ||
      !Number.isFinite(closedAt) ||
      new Date(openedAt).toISOString() !== candle.openedAt ||
      new Date(closedAt).toISOString() !== candle.closedAt ||
      openedAt <= previousOpenedAt ||
      openedAt % duration !== 0 ||
      closedAt - openedAt !== duration - 1 ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close) ||
      !Number.isFinite(candle.volume) ||
      candle.open <= 0 ||
      candle.high <= 0 ||
      candle.low <= 0 ||
      candle.close <= 0 ||
      candle.volume < 0 ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.low > candle.high ||
      (candle.state !== "closed" && candle.state !== "forming")
    ) {
      throw new TypeError("Invalid chart candle series.");
    }
    if (candle.state === "forming") {
      formingCount += 1;
      if (index !== candles.length - 1) {
        throw new TypeError("Only the latest chart candle may be forming.");
      }
    }
    previousOpenedAt = openedAt;
  }

  if (formingCount > 1) {
    throw new TypeError("Only one chart candle may be forming.");
  }
}

function exponentialMovingAverage(
  values: readonly number[],
  period: number,
): readonly (number | null)[] {
  const result = Array<number | null>(values.length).fill(null);
  if (values.length < period) {
    return result;
  }

  let total = 0;
  for (let cursor = 0; cursor < period; cursor += 1) {
    total += values[cursor];
  }
  let current = total / period;
  assertFiniteCalculation(current);
  result[period - 1] = current;
  const multiplier = 2 / (period + 1);

  for (let cursor = period; cursor < values.length; cursor += 1) {
    current = (values[cursor] - current) * multiplier + current;
    assertFiniteCalculation(current);
    result[cursor] = current;
  }

  return result;
}

function assertChartPointAverages(points: readonly LiveChartPoint[]): void {
  for (const point of points) {
    for (const key of liveEmaKeys) {
      if (point[key] !== null && !Number.isFinite(point[key])) {
        throw new TypeError("Chart exponential moving averages must be finite or null.");
      }
    }
  }
}

function assertLiveEmaSelection(keys: readonly LiveEmaKey[]): void {
  const seen = new Set<LiveEmaKey>();
  for (const key of keys) {
    if (!Object.hasOwn(liveEmaDefinitions, key) || seen.has(key)) {
      throw new TypeError("Invalid live EMA selection.");
    }
    seen.add(key);
  }
}

function buildEmaOrdering(
  comparisons: readonly LiveTrendSummary["comparisons"][number][],
): NonNullable<LiveTrendSummary["ordering"]> {
  const byPeriod = [...comparisons].sort(
    (left, right) =>
      liveEmaDefinitions[left.key].period - liveEmaDefinitions[right.key].period,
  );
  const values = byPeriod.map((comparison) => comparison.value!);
  const shortAboveLong = values.every(
    (value, index) => index === 0 || values[index - 1] > value,
  );
  const shortBelowLong = values.every(
    (value, index) => index === 0 || values[index - 1] < value,
  );
  const ranked = [...comparisons].sort((left, right) => {
    if (right.value! !== left.value!) {
      return right.value! - left.value!;
    }
    return (
      liveEmaDefinitions[left.key].period -
      liveEmaDefinitions[right.key].period
    );
  });
  const expression = ranked.reduce((result, comparison, index) => {
    const label = liveEmaDefinitions[comparison.key].label;
    if (index === 0) {
      return label;
    }
    const previous = ranked[index - 1];
    const separator = previous.value === comparison.value ? " = " : " > ";
    return `${result}${separator}${label}`;
  }, "");

  return {
    state: shortAboveLong
      ? "short_above_long"
      : shortBelowLong
        ? "short_below_long"
        : "mixed",
    expression,
  };
}

function assertSingleChartScope(points: readonly LiveChartPoint[]): void {
  const reference = points[0];
  for (const point of points.slice(1)) {
    if (
      point.asset !== reference.asset ||
      point.symbol !== reference.symbol ||
      point.interval !== reference.interval ||
      point.quoteCurrency !== reference.quoteCurrency
    ) {
      throw new TypeError("Cannot summarize mixed-scope chart points.");
    }
  }
}

function assertFiniteCalculation(value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError("Chart summary calculation must be finite.");
  }
}
