import { describe, expect, it } from "vitest";
import {
  assertLongTermHistoricalBaseline,
  buildDailyMarketRegimeSeries,
  buildLongTermHistoricalBaselineFromSegments,
} from "@/lib/market/historical-baseline";
import {
  HISTORICAL_CONTEXT_HORIZONS,
  buildHistoricalContextState,
  summarizeHistoricalContextEventObservations,
  type HistoricalContextEventObservation,
} from "@/lib/market/historical-context";
import {
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";

const START = Date.parse("2024-01-01T00:00:00.000Z");

function candlesAt(
  closes: readonly number[],
  openedAt: number,
  interval: ChartCandleInterval = "1h",
): readonly ChartCandle[] {
  const duration = chartIntervalMilliseconds[interval];
  return closes.map((close, index) => {
    const candleOpenedAt = openedAt + index * duration;
    const open = closes[index - 1] ?? close;
    return {
      asset: "btc",
      symbol: "BTCUSDT",
      quoteCurrency: "USDT",
      interval,
      state: "closed",
      openedAt: new Date(candleOpenedAt).toISOString(),
      closedAt: new Date(candleOpenedAt + duration - 1).toISOString(),
      open,
      high: Math.max(open, close) * 1.005,
      low: Math.min(open, close) * 0.995,
      close,
      volume: 100 + (index % 17),
    } satisfies ChartCandle;
  });
}

function waveCloses(count: number, phase = 0): readonly number[] {
  return Array.from(
    { length: count },
    (_, index) =>
      1_000 +
      Math.sin(((index + phase) / 8) * Math.PI * 2) * 38 +
      Math.sin(((index + phase) / 23) * Math.PI * 2) * 11,
  );
}

function dailyRegimes(dayCount = 260) {
  return buildDailyMarketRegimeSeries(
    candlesAt(
      Array.from({ length: dayCount }, (_, index) => 1_000 + index * 2),
      START,
      "1d",
    ),
  )!;
}

function scanEntryCounts(candles: readonly ChartCandle[]): Readonly<{
  candidate: number;
  complete: number;
  trailingIncomplete: number;
}> {
  const states = buildLiveChartPoints(candles).map(buildHistoricalContextState);
  let previous: string | null = null;
  let candidate = 0;
  let complete = 0;
  let trailingIncomplete = 0;
  for (const [index, state] of states.entries()) {
    if (state === null) {
      previous = null;
      continue;
    }
    if (previous !== null && state.fingerprint !== previous) {
      candidate += 1;
      if (index + 24 < states.length) {
        complete += 1;
      } else {
        trailingIncomplete += 1;
      }
    }
    previous = state.fingerprint;
  }
  return { candidate, complete, trailingIncomplete };
}

function observation(
  segmentIndex: number,
  pointIndex: number,
  returnPercent: number,
): HistoricalContextEventObservation {
  const segmentOffset = segmentIndex * 365 * 24;
  const eventOpenedAt = START + (segmentOffset + pointIndex) * 60 * 60 * 1_000;
  const eventClosedAt = eventOpenedAt + 60 * 60 * 1_000 - 1;
  return {
    segmentIndex,
    pointIndex,
    eventOpenedAt: new Date(eventOpenedAt).toISOString(),
    eventClosedAt: new Date(eventClosedAt).toISOString(),
    eventClose: 100,
    outcomes: HISTORICAL_CONTEXT_HORIZONS.map((bars) => ({
      bars,
      horizonClosedAt: new Date(
        eventClosedAt + bars * 60 * 60 * 1_000,
      ).toISOString(),
      returnPercent,
      maxUpsidePercent: Math.max(returnPercent, 0) + 1,
      maxDownsidePercent: Math.min(returnPercent, 0) - 1,
    })),
  };
}

describe("segmented long-term historical baseline", () => {
  it("restarts EMA warm-up after a gap and records compact gap provenance", () => {
    const first = candlesAt(waveCloses(120), START);
    const duration = chartIntervalMilliseconds["1h"];
    const secondStart =
      Date.parse(first.at(-1)!.openedAt) + 8 * duration;
    const second = candlesAt(waveCloses(49, 3), secondStart);
    const baseline = buildLongTermHistoricalBaselineFromSegments(
      [first, second],
      dailyRegimes(),
    )!;
    const firstSegmentFingerprints = new Set(
      buildLiveChartPoints(first)
        .map(buildHistoricalContextState)
        .flatMap((state) => (state === null ? [] : [state.fingerprint])),
    );

    expect(baseline.source).toEqual({
      sourceRowCount: 169,
      closedCandleCount: 169,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      segmentCount: 2,
      gapCount: 1,
      missingCandleCount: 7,
      fromOpenedAt: first[0].openedAt,
      toClosedAt: second.at(-1)!.closedAt,
    });
    expect(
      baseline.fingerprints.every((entry) =>
        firstSegmentFingerprints.has(entry.fingerprint),
      ),
    ).toBe(true);
    expect(() => assertLongTermHistoricalBaseline(baseline)).not.toThrow();
  });

  it("never completes an event with candles from the other side of a gap", () => {
    const first = candlesAt(waveCloses(150), START);
    const duration = chartIntervalMilliseconds["1h"];
    const second = candlesAt(
      waveCloses(150, 5),
      Date.parse(first.at(-1)!.openedAt) + 5 * duration,
    );
    const firstCounts = scanEntryCounts(first);
    const secondCounts = scanEntryCounts(second);
    const baseline = buildLongTermHistoricalBaselineFromSegments(
      [first, second],
      dailyRegimes(),
    )!;

    expect(firstCounts.trailingIncomplete).toBeGreaterThan(0);
    expect(secondCounts.trailingIncomplete).toBeGreaterThan(0);
    expect(baseline.events).toMatchObject({
      candidateEventCount: firstCounts.candidate + secondCounts.candidate,
      completeEventCount: firstCounts.complete + secondCounts.complete,
      excludedIncompleteEventCount:
        firstCounts.trailingIncomplete + secondCounts.trailingIncomplete,
    });
  });

  it("aggregates raw outcomes before calculating cross-segment quantiles", () => {
    const summary = summarizeHistoricalContextEventObservations([
      observation(0, 0, 0),
      observation(0, 24, 0),
      observation(0, 48, 0),
      observation(1, 0, 100),
    ]);

    expect(summary.horizons[0]).toMatchObject({
      sampleCount: 4,
      medianReturnPercent: 0,
      q25ReturnPercent: 0,
      q75ReturnPercent: 25,
    });
  });

  it("selects direction samples without overlap and resets at each segment", () => {
    const events = [0, 1].flatMap((segmentIndex) =>
      Array.from({ length: 40 }, (_, index) =>
        observation(
          segmentIndex,
          index * 6,
          segmentIndex === 0 ? 1 : -1,
        ),
      ),
    );
    const summary = summarizeHistoricalContextEventObservations(events);

    expect(summary.horizons.map((horizon) => horizon.independentSampleCount)).toEqual([
      80,
      40,
      20,
    ]);
    expect(summary.horizons.at(-1)).toMatchObject({
      sampleCount: 80,
      independentSampleCount: 20,
      positiveReturnRatePercent: 50,
    });
  });

  it("rejects fake splits, non-integral gaps, segmented daily input and tampered metadata", () => {
    const duration = chartIntervalMilliseconds["1h"];
    const first = candlesAt(waveCloses(80), START);
    const adjacent = candlesAt(
      waveCloses(80, 1),
      Date.parse(first.at(-1)!.openedAt) + duration,
    );
    expect(() =>
      buildLongTermHistoricalBaselineFromSegments(
        [first, adjacent],
        dailyRegimes(),
      ),
    ).toThrow("separated by whole missing candles");

    const nonIntegral = candlesAt(
      waveCloses(80, 1),
      Date.parse(first.at(-1)!.openedAt) + duration * 2 + 1,
    );
    expect(() =>
      buildLongTermHistoricalBaselineFromSegments(
        [first, nonIntegral],
        dailyRegimes(),
      ),
    ).toThrow();

    const daily = candlesAt(waveCloses(220), START, "1d");
    const secondDaily = candlesAt(
      waveCloses(80, 2),
      Date.parse(daily.at(-1)!.openedAt) + 2 * chartIntervalMilliseconds["1d"],
      "1d",
    );
    expect(() =>
      buildLongTermHistoricalBaselineFromSegments(
        [daily, secondDaily],
        dailyRegimes(320),
      ),
    ).toThrow("must remain one contiguous segment");

    const separated = candlesAt(
      waveCloses(80, 1),
      Date.parse(first.at(-1)!.openedAt) + duration * 3,
    );
    const baseline = buildLongTermHistoricalBaselineFromSegments(
      [first, separated],
      dailyRegimes(),
    )!;
    const tampered = structuredClone(baseline) as {
      source: { missingCandleCount: number };
    };
    tampered.source.missingCandleCount += 1;
    expect(() => assertLongTermHistoricalBaseline(tampered)).toThrow(
      "Invalid historical baseline source range",
    );
  });
});
