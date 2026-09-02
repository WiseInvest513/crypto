import { describe, expect, it } from "vitest";
import {
  TECHNICAL_ANALYSIS_ALGORITHM_VERSION,
  analyzeDailyCandles,
  type TechnicalAnalysisCandle,
} from "../../src/lib/market/technical-analysis";

const DAY_MS = 24 * 60 * 60 * 1_000;
const START_TIME = Date.parse("2026-01-01T00:00:00.000Z");

function candlesFromCloses(
  closes: readonly number[],
): readonly TechnicalAnalysisCandle[] {
  return closes.map((close, index) => ({
    openedAt: new Date(START_TIME + index * DAY_MS).toISOString(),
    closedAt: new Date(START_TIME + (index + 1) * DAY_MS - 1).toISOString(),
    close,
  }));
}

function sequence(length: number): readonly number[] {
  return Array.from({ length }, (_, index) => index + 1);
}

describe("daily candle technical analysis", () => {
  it.each([
    { count: 0, ma20: null, ma50: null },
    { count: 1, ma20: null, ma50: null },
    { count: 19, ma20: null, ma50: null },
    { count: 20, ma20: 10.5, ma50: null },
    { count: 49, ma20: 39.5, ma50: null },
    { count: 50, ma20: 40.5, ma50: 25.5 },
  ])(
    "uses only complete moving-average windows for $count candles",
    ({ count, ma20, ma50 }) => {
      const result = analyzeDailyCandles(candlesFromCloses(sequence(count)));

      expect(result.points).toHaveLength(count);
      expect(result.latest?.ma20 ?? null).toBe(ma20);
      expect(result.latest?.ma50 ?? null).toBe(ma50);
      expect(result.status).toBe(count < 50 ? "insufficient_data" : "available");
      expect(result.trend.state).toBe(
        count < 50 ? "insufficient_data" : "upward_alignment",
      );
    },
  );

  it("calculates exact SMA20 and SMA50 values at every complete window", () => {
    const result = analyzeDailyCandles(candlesFromCloses(sequence(51)));

    expect(result.points[18]).toMatchObject({ ma20: null, ma50: null });
    expect(result.points[19]).toMatchObject({ ma20: 10.5, ma50: null });
    expect(result.points[48]).toMatchObject({ ma20: 39.5, ma50: null });
    expect(result.points[49]).toMatchObject({ ma20: 40.5, ma50: 25.5 });
    expect(result.points[50]).toMatchObject({ ma20: 41.5, ma50: 26.5 });
    expect(result.latest).toMatchObject({
      price: 51,
      ma20: 41.5,
      ma50: 26.5,
      priceVsMa20: "above",
      priceVsMa50: "above",
      ma20VsMa50: "above",
    });
  });

  it("classifies only strict price/MA alignments and treats equality as mixed", () => {
    const upward = analyzeDailyCandles(candlesFromCloses(sequence(50)));
    const downward = analyzeDailyCandles(
      candlesFromCloses(sequence(50).toReversed()),
    );
    const equal = analyzeDailyCandles(
      candlesFromCloses(Array.from({ length: 50 }, () => 100)),
    );

    expect(upward.trend.state).toBe("upward_alignment");
    expect(downward.trend.state).toBe("downward_alignment");
    expect(equal.trend.state).toBe("mixed");
    expect(equal.latest).toMatchObject({
      price: 100,
      ma20: 100,
      ma50: 100,
      priceVsMa20: "equal",
      priceVsMa50: "equal",
      ma20VsMa50: "equal",
    });
  });

  it("returns explicit insufficient facts for an empty series", () => {
    const result = analyzeDailyCandles([]);

    expect(result).toMatchObject({
      status: "insufficient_data",
      algorithmVersion: TECHNICAL_ANALYSIS_ALGORITHM_VERSION,
      movingAverageMethod: "simple",
      sampleSize: 0,
      points: [],
      latest: null,
      trend: {
        state: "insufficient_data",
        minimumClosedCandles: 50,
      },
    });
  });

  it("does not mutate or reorder its candle input", () => {
    const mutableInput = candlesFromCloses(sequence(50)).map((candle) => ({
      ...candle,
    }));
    const snapshot = structuredClone(mutableInput);

    analyzeDailyCandles(Object.freeze(mutableInput));

    expect(mutableInput).toEqual(snapshot);
  });

  it.each([
    { label: "NaN", value: Number.NaN },
    { label: "positive Infinity", value: Number.POSITIVE_INFINITY },
    { label: "negative Infinity", value: Number.NEGATIVE_INFINITY },
    { label: "zero", value: 0 },
  ])("rejects $label instead of emitting invalid chart values", ({ value }) => {
    expect(() => analyzeDailyCandles(candlesFromCloses([value]))).toThrow(
      "Daily candle close must be a positive finite number.",
    );
  });

  it("rejects unsorted, duplicate, malformed, or unclosed candle ranges", () => {
    const [first, second] = candlesFromCloses([1, 2]);

    expect(() => analyzeDailyCandles([second, first])).toThrow(
      "strictly sorted",
    );
    expect(() => analyzeDailyCandles([first, first])).toThrow(
      "strictly sorted",
    );
    expect(() =>
      analyzeDailyCandles([{ ...first, openedAt: "not-a-date" }]),
    ).toThrow("canonical ISO-8601");
    expect(() =>
      analyzeDailyCandles([{ ...first, closedAt: first.openedAt }]),
    ).toThrow("closedAt must follow openedAt");
  });

  it("never emits NaN or Infinity in a valid result", () => {
    const result = analyzeDailyCandles(
      candlesFromCloses(Array.from({ length: 60 }, (_, index) => 1_000 + index / 10)),
    );
    const numericValues = result.points.flatMap((point) => [
      point.price,
      point.ma20,
      point.ma50,
    ]).filter((value): value is number => value !== null);

    expect(numericValues.every(Number.isFinite)).toBe(true);
  });
});
