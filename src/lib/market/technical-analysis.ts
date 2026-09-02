import type { DailyCandle } from "../../server/data/contracts/market-data";

/** The provider-independent fields needed from a normalized daily candle. */
export type TechnicalAnalysisCandle = Readonly<
  Pick<DailyCandle, "openedAt" | "closedAt" | "close">
>;

export const TECHNICAL_ANALYSIS_ALGORITHM_VERSION =
  "daily-sma-alignment-v1" as const;

export const TECHNICAL_ANALYSIS_WINDOWS = {
  ma20: 20,
  ma50: 50,
} as const;

export type RelativePosition = "above" | "below" | "equal";

export type TrendState =
  | "upward_alignment"
  | "downward_alignment"
  | "mixed"
  | "insufficient_data";

export type TechnicalChartPoint = Readonly<{
  openedAt: string;
  closedAt: string;
  price: number;
  ma20: number | null;
  ma50: number | null;
}>;

export type LatestTechnicalFacts = TechnicalChartPoint &
  Readonly<{
    priceVsMa20: RelativePosition | null;
    priceVsMa50: RelativePosition | null;
    ma20VsMa50: RelativePosition | null;
  }>;

export type TechnicalTrend = Readonly<{
  state: TrendState;
  rule: "price > ma20 > ma50 | price < ma20 < ma50 | otherwise mixed";
  minimumClosedCandles: 50;
}>;

export type TechnicalAnalysisResult = Readonly<{
  status: "available" | "insufficient_data";
  algorithmVersion: typeof TECHNICAL_ANALYSIS_ALGORITHM_VERSION;
  movingAverageMethod: "simple";
  sampleSize: number;
  points: readonly TechnicalChartPoint[];
  latest: LatestTechnicalFacts | null;
  trend: TechnicalTrend;
}>;

const TREND_RULE =
  "price > ma20 > ma50 | price < ma20 < ma50 | otherwise mixed" as const;

/**
 * Calculates strict SMA20/SMA50 facts from ascending, already-closed daily
 * candles. No partial window is emitted: a moving average remains `null` until
 * its complete window exists.
 *
 * Invalid provider/domain input is rejected instead of being coerced to zero or
 * allowing NaN/Infinity into a public chart model.
 */
export function analyzeDailyCandles(
  candles: readonly TechnicalAnalysisCandle[],
): TechnicalAnalysisResult {
  validateCandles(candles);

  const closes = candles.map((candle) => candle.close);
  const ma20Values = calculateSimpleMovingAverages(
    closes,
    TECHNICAL_ANALYSIS_WINDOWS.ma20,
  );
  const ma50Values = calculateSimpleMovingAverages(
    closes,
    TECHNICAL_ANALYSIS_WINDOWS.ma50,
  );
  const points = candles.map<TechnicalChartPoint>((candle, index) => ({
    openedAt: candle.openedAt,
    closedAt: candle.closedAt,
    price: candle.close,
    ma20: ma20Values[index],
    ma50: ma50Values[index],
  }));
  const latestPoint = points.at(-1) ?? null;
  const latest = latestPoint === null ? null : latestFacts(latestPoint);
  const trendState = classifyTrend(latest);

  return {
    status:
      trendState === "insufficient_data"
        ? "insufficient_data"
        : "available",
    algorithmVersion: TECHNICAL_ANALYSIS_ALGORITHM_VERSION,
    movingAverageMethod: "simple",
    sampleSize: candles.length,
    points,
    latest,
    trend: {
      state: trendState,
      rule: TREND_RULE,
      minimumClosedCandles: TECHNICAL_ANALYSIS_WINDOWS.ma50,
    },
  };
}

function calculateSimpleMovingAverages(
  values: readonly number[],
  windowSize: number,
): readonly (number | null)[] {
  let rollingSum = 0;

  return values.map((value, index) => {
    rollingSum += value;
    if (!Number.isFinite(rollingSum)) {
      throw new RangeError("Moving-average window exceeds numeric range.");
    }

    if (index >= windowSize) {
      rollingSum -= values[index - windowSize];
    }

    if (index < windowSize - 1) {
      return null;
    }

    const average = rollingSum / windowSize;
    if (!Number.isFinite(average)) {
      throw new RangeError("Moving-average result must be finite.");
    }

    return average;
  });
}

function latestFacts(point: TechnicalChartPoint): LatestTechnicalFacts {
  return {
    ...point,
    priceVsMa20:
      point.ma20 === null ? null : compare(point.price, point.ma20),
    priceVsMa50:
      point.ma50 === null ? null : compare(point.price, point.ma50),
    ma20VsMa50:
      point.ma20 === null || point.ma50 === null
        ? null
        : compare(point.ma20, point.ma50),
  };
}

function classifyTrend(latest: LatestTechnicalFacts | null): TrendState {
  if (latest === null || latest.ma20 === null || latest.ma50 === null) {
    return "insufficient_data";
  }

  if (latest.price > latest.ma20 && latest.ma20 > latest.ma50) {
    return "upward_alignment";
  }

  if (latest.price < latest.ma20 && latest.ma20 < latest.ma50) {
    return "downward_alignment";
  }

  return "mixed";
}

function compare(left: number, right: number): RelativePosition {
  if (left > right) {
    return "above";
  }
  if (left < right) {
    return "below";
  }
  return "equal";
}

function validateCandles(candles: readonly TechnicalAnalysisCandle[]): void {
  let previousOpenedAt = Number.NEGATIVE_INFINITY;

  for (const candle of candles) {
    const openedAt = parseStrictTimestamp(candle.openedAt, "openedAt");
    const closedAt = parseStrictTimestamp(candle.closedAt, "closedAt");

    if (openedAt <= previousOpenedAt) {
      throw new RangeError(
        "Daily candles must be strictly sorted by openedAt with no duplicates.",
      );
    }
    if (closedAt <= openedAt) {
      throw new RangeError("Daily candle closedAt must follow openedAt.");
    }
    if (!Number.isFinite(candle.close) || candle.close <= 0) {
      throw new RangeError("Daily candle close must be a positive finite number.");
    }

    previousOpenedAt = openedAt;
  }
}

function parseStrictTimestamp(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new RangeError(`${field} must be a canonical ISO-8601 timestamp.`);
  }
  return timestamp;
}
