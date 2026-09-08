import { describe, expect, it } from "vitest";
import {
  HISTORICAL_CONTEXT_ALGORITHM_VERSION,
  HISTORICAL_CONTEXT_HORIZONS,
  HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
  analyzeHistoricalContext,
  buildHistoricalContextState,
} from "@/lib/market/historical-context";
import {
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
  type LiveChartPoint,
} from "@/lib/market/live-chart";

const ALIGNED_START = Date.parse("2024-01-01T00:00:00.000Z");

function chartCandles(
  closes: readonly number[],
  options: {
    asset?: Asset;
    interval?: ChartCandleInterval;
    formingLatest?: boolean;
  } = {},
): readonly ChartCandle[] {
  const asset = options.asset ?? "btc";
  const interval = options.interval ?? "1h";
  const duration = chartIntervalMilliseconds[interval];

  return closes.map((close, index) => {
    const openedAt = ALIGNED_START + index * duration;
    const open = closes[index - 1] ?? close;
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state:
        options.formingLatest === true && index === closes.length - 1
          ? "forming"
          : "closed",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open,
      high: Math.max(open, close) * 1.004,
      low: Math.min(open, close) * 0.996,
      close,
      volume: 100 + (index % 17),
    } satisfies ChartCandle;
  });
}

function cyclicalCloses(count: number): readonly number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      1_000 +
      Math.sin((index / 40) * Math.PI * 2) * 90 +
      Math.sin((index / 11) * Math.PI * 2) * 8,
  );
}

function pointFingerprint(point: LiveChartPoint): string | null {
  return buildHistoricalContextState(point)?.fingerprint ?? null;
}

function eventIndexes(
  points: readonly LiveChartPoint[],
  target: string,
): readonly number[] {
  let currentStateStartIndex = points.length - 1;
  while (
    currentStateStartIndex > 0 &&
    pointFingerprint(points[currentStateStartIndex - 1]) === target
  ) {
    currentStateStartIndex -= 1;
  }
  const indexes: number[] = [];
  let previous: string | null = null;
  for (const [index, point] of points.entries()) {
    const current = pointFingerprint(point);
    if (current === null) {
      previous = null;
      continue;
    }
    if (
      previous !== null &&
      current === target &&
      previous !== target &&
      index !== currentStateStartIndex
    ) {
      indexes.push(index);
    }
    previous = current;
  }
  return indexes;
}

function independentIndexes(
  indexes: readonly number[],
  bars: (typeof HISTORICAL_CONTEXT_HORIZONS)[number],
): readonly number[] {
  const selected: number[] = [];
  let previous: number | null = null;
  for (const index of indexes) {
    if (previous === null || index - previous >= bars) {
      selected.push(index);
      previous = index;
    }
  }
  return selected;
}

function quantile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  return (
    sorted[lowerIndex] +
    (sorted[upperIndex] - sorted[lowerIndex]) * (position - lowerIndex)
  );
}

describe("historical context analysis", () => {
  it("keeps distinct mixed EMA orders in distinct fingerprints", () => {
    const candle = chartCandles([120])[0];
    const first = buildHistoricalContextState({
      ...candle,
      ema10: 110,
      ema20: 90,
      ema50: 100,
      ema200: null,
    });
    const second = buildHistoricalContextState({
      ...candle,
      ema10: 100,
      ema20: 110,
      ema50: 90,
      ema200: null,
    });

    expect(first?.ordering.state).toBe("mixed");
    expect(second?.ordering.state).toBe("mixed");
    expect(first?.fingerprint).not.toBe(second?.fingerprint);
    expect(first?.fingerprint).toContain("EMA10>EMA50>EMA20");
    expect(second?.fingerprint).toContain("EMA20>EMA10>EMA50");
  });

  it("builds one auditable cohort for 6/12/24-bar observations", () => {
    const candles = chartCandles(cyclicalCloses(1_000));
    const points = buildLiveChartPoints(candles);
    const target = pointFingerprint(points.at(-1)!)!;
    const candidates = eventIndexes(points, target);
    const eligible = candidates.filter((index) => index + 24 < points.length);
    const analysis = analyzeHistoricalContext(candles);

    expect(analysis).not.toBeNull();
    expect(analysis).toMatchObject({
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1h",
      algorithmVersion: HISTORICAL_CONTEXT_ALGORITHM_VERSION,
      latestClosedAt: candles.at(-1)!.closedAt,
    });
    expect(analysis!.current.fingerprint).toBe(target);
    expect(analysis!.sample).toMatchObject({
      status: "sufficient",
      closedCandleCount: candles.length,
      candidateEventCount: candidates.length,
      eventCount: eligible.length,
      excludedIncompleteEventCount: candidates.length - eligible.length,
      minimumDirectionSampleCount:
        HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
    });
    expect(eligible.length).toBeGreaterThanOrEqual(
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
    );
    expect(analysis!.horizons.map((horizon) => horizon.bars)).toEqual(
      HISTORICAL_CONTEXT_HORIZONS,
    );
    expect(
      analysis!.horizons.every((horizon) => {
        const independent = independentIndexes(eligible, horizon.bars);
        return (
          horizon.sampleCount === eligible.length &&
          horizon.independentSampleCount === independent.length &&
          horizon.positiveReturnRatePercent !== null
        );
      }),
    ).toBe(true);
    expect(analysis!.cases).toHaveLength(3);
    expect(analysis!.cases.map((item) => item.representativeOf)).toEqual([
      "q25",
      "median",
      "q75",
    ]);
  });

  it("calculates returns and excursions from future candles only", () => {
    const candles = chartCandles(cyclicalCloses(520));
    const points = buildLiveChartPoints(candles);
    const target = pointFingerprint(points.at(-1)!)!;
    const eligible = eventIndexes(points, target).filter(
      (index) => index + 24 < points.length,
    );
    const analysis = analyzeHistoricalContext(candles)!;
    const expectedReturns = eligible.map(
      (index) =>
        ((points[index + 6].close - points[index].close) /
          points[index].close) *
        100,
    );
    const expectedUpside = Math.max(
      ...eligible.map((index) => {
        const high = Math.max(
          ...points.slice(index + 1, index + 7).map((point) => point.high),
        );
        return ((high - points[index].close) / points[index].close) * 100;
      }),
    );
    const expectedDownside = Math.min(
      ...eligible.map((index) => {
        const low = Math.min(
          ...points.slice(index + 1, index + 7).map((point) => point.low),
        );
        return ((low - points[index].close) / points[index].close) * 100;
      }),
    );
    const sixBars = analysis.horizons[0];

    expect(eligible.length).toBeGreaterThan(0);
    expect(sixBars.medianReturnPercent).toBeCloseTo(
      quantile(expectedReturns, 0.5),
      10,
    );
    expect(sixBars.q25ReturnPercent).toBeCloseTo(
      quantile(expectedReturns, 0.25),
      10,
    );
    expect(sixBars.q75ReturnPercent).toBeCloseTo(
      quantile(expectedReturns, 0.75),
      10,
    );
    expect(sixBars.maxUpsidePercent).toBeCloseTo(expectedUpside, 10);
    expect(sixBars.maxDownsidePercent).toBeCloseTo(expectedDownside, 10);
  });

  it("counts only state entries and excludes events without 24 future bars", () => {
    const candles = chartCandles(cyclicalCloses(360));
    const points = buildLiveChartPoints(candles);
    const target = pointFingerprint(points.at(-1)!)!;
    const matchingBarCount = points.filter(
      (point) => pointFingerprint(point) === target,
    ).length;
    const candidates = eventIndexes(points, target);
    const eligible = candidates.filter((index) => index + 24 < points.length);
    const analysis = analyzeHistoricalContext(candles)!;

    expect(matchingBarCount).toBeGreaterThan(candidates.length);
    expect(analysis.sample.candidateEventCount).toBe(candidates.length);
    expect(analysis.sample.eventCount).toBe(eligible.length);
    expect(analysis.sample.excludedIncompleteEventCount).toBe(
      candidates.length - eligible.length,
    );
  });

  it("marks a small cohort insufficient and withholds its direction share", () => {
    const analysis = analyzeHistoricalContext(
      chartCandles(cyclicalCloses(280), { interval: "4h", asset: "eth" }),
    );

    expect(analysis).toMatchObject({
      asset: "eth",
      symbol: "ETHUSDT",
      interval: "4h",
      sample: { status: "insufficient" },
    });
    expect(analysis!.sample.eventCount).toBeLessThan(
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
    );
    expect(
      analysis!.horizons.every(
        (horizon) => horizon.positiveReturnRatePercent === null,
      ),
    ).toBe(true);
  });

  it("uses horizon-separated non-overlapping events only for direction share", () => {
    const alternating = Array.from(
      { length: 500 },
      (_, index) => (index % 2 === 0 ? 990 : 1_010),
    );
    const candles = chartCandles(alternating);
    const points = buildLiveChartPoints(candles);
    const target = pointFingerprint(points.at(-1)!)!;
    const eligible = eventIndexes(points, target).filter(
      (index) => index + 24 < points.length,
    );
    const analysis = analyzeHistoricalContext(candles)!;

    expect(eligible.length).toBeGreaterThan(
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
    );
    for (const horizon of analysis.horizons) {
      const independent = independentIndexes(eligible, horizon.bars);
      const expectedPositiveRate =
        (independent.filter(
          (index) => points[index + horizon.bars].close > points[index].close,
        ).length /
          independent.length) *
        100;

      expect(horizon.sampleCount).toBe(eligible.length);
      expect(horizon.independentSampleCount).toBe(independent.length);
      expect(horizon.independentSampleCount).toBeLessThan(horizon.sampleCount);
      expect(horizon.positiveReturnRatePercent).toBe(
        independent.length >= HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
          ? expectedPositiveRate
          : null,
      );
    }

    const twentyFourBars = analysis.horizons.at(-1)!;
    expect(twentyFourBars.independentSampleCount).toBeLessThan(
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
    );
    expect(twentyFourBars.positiveReturnRatePercent).toBeNull();
    expect(analysis.sample.status).toBe("insufficient");
    // Representative cases remain tied to the complete all-event distribution.
    expect(analysis.cases).toHaveLength(3);
  });

  it("excludes a forming tail from the current state and every outcome", () => {
    const closed = chartCandles(cyclicalCloses(480));
    const duration = chartIntervalMilliseconds["1h"];
    const formingClose = 99_999;
    const withForming = [
      ...closed,
      ...chartCandles([formingClose], { formingLatest: true }).map((candle) => ({
        ...candle,
        openedAt: new Date(ALIGNED_START + closed.length * duration).toISOString(),
        closedAt: new Date(
          ALIGNED_START + (closed.length + 1) * duration - 1,
        ).toISOString(),
        open: closed.at(-1)!.close,
        high: formingClose,
        low: closed.at(-1)!.close * 0.99,
      })),
    ];

    expect(analyzeHistoricalContext(withForming)).toEqual(
      analyzeHistoricalContext(closed),
    );
  });

  it("supports 1h/4h/1d, returns null for 15m or EMA50 warm-up, and rejects gaps", () => {
    for (const interval of ["1h", "4h", "1d"] as const) {
      expect(
        analyzeHistoricalContext(
          chartCandles(cyclicalCloses(80), { interval }),
        )?.interval,
      ).toBe(interval);
    }
    expect(
      analyzeHistoricalContext(
        chartCandles(cyclicalCloses(80), { interval: "15m" }),
      ),
    ).toBeNull();
    expect(
      analyzeHistoricalContext(chartCandles(cyclicalCloses(49))),
    ).toBeNull();

    const gapped = chartCandles(cyclicalCloses(80)).filter(
      (_, index) => index !== 60,
    );
    expect(() => analyzeHistoricalContext(gapped)).toThrow(
      "Historical context candles must be contiguous and share one scope.",
    );
  });

  it("returns an explicit empty historical distribution without inventing values", () => {
    const monotonic = Array.from({ length: 200 }, (_, index) => 500 + index);
    const analysis = analyzeHistoricalContext(chartCandles(monotonic));

    expect(analysis).not.toBeNull();
    expect(analysis!.sample).toMatchObject({
      status: "insufficient",
      candidateEventCount: 0,
      eventCount: 0,
      excludedIncompleteEventCount: 0,
      eventRange: null,
    });
    expect(analysis!.horizons).toEqual(
      HISTORICAL_CONTEXT_HORIZONS.map((bars) => ({
        bars,
        sampleCount: 0,
        independentSampleCount: 0,
        medianReturnPercent: null,
        q25ReturnPercent: null,
        q75ReturnPercent: null,
        maxUpsidePercent: null,
        maxDownsidePercent: null,
        positiveReturnRatePercent: null,
      })),
    );
    expect(analysis!.cases).toEqual([]);
  });
});
