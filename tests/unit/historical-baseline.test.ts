import { describe, expect, it } from "vitest";
import {
  DAILY_MARKET_REGIME_ALGORITHM_VERSION,
  DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION,
  DAILY_MARKET_REGIME_SCHEMA_VERSION,
  LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION,
  LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION,
  advanceDailyMarketRegimeEpisodesFromTerminal,
  advanceDailyMarketRegimeFromTerminal,
  assertDailyMarketRegimeSeries,
  assertLongTermHistoricalBaseline,
  buildDailyMarketRegimeSeries,
  buildDailyMarketRegimeEpisodes,
  buildLongTermHistoricalBaseline,
  classifyDailyMarketRegime,
  queryLongTermHistoricalBaseline,
  resolveDailyMarketRegimeAt,
  summarizeDailyMarketRegimeEpisodeDistributions,
  type DailyMarketRegime,
  type DailyMarketRegimePoint,
  type DailyMarketRegimeSeries,
  type DailyMarketRegimeSummary,
} from "@/lib/market/historical-baseline";
import {
  HISTORICAL_CONTEXT_HORIZONS,
  HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
  buildHistoricalContextState,
} from "@/lib/market/historical-context";
import {
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";

const START = Date.parse("2024-01-01T00:00:00.000Z");

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
    const openedAt = START + index * duration;
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
      volume: 100 + (index % 23),
    } satisfies ChartCandle;
  });
}

function hourlyCloses(dayCount: number): readonly number[] {
  return Array.from({ length: dayCount * 24 }, (_, index) => {
    const day = Math.floor(index / 24);
    return (
      1_000 +
      day * 0.08 +
      Math.sin((index / 8) * Math.PI * 2) * 36 +
      Math.sin((index / 29) * Math.PI * 2) * 9
    );
  });
}

function risingDailyCandles(
  dayCount: number,
  options: { asset?: Asset } = {},
): readonly ChartCandle[] {
  return chartCandles(
    Array.from({ length: dayCount }, (_, index) => 1_000 + index * 2),
    { interval: "1d", asset: options.asset },
  );
}

function alternatingRegimeSeries(dayCount: number): DailyMarketRegimeSeries {
  const duration = chartIntervalMilliseconds["1d"];
  const regimes = ["bull", "bear", "transition"] as const;
  const points = Array.from({ length: dayCount - 199 }, (_, index) => {
    const openedAt = START + (index + 199) * duration;
    const regime = regimes[index % regimes.length];
    const values = regimeValues(regime);
    return {
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      ...values,
      regime,
    };
  });
  const last = points.at(-1)!;
  const episodes = buildDailyMarketRegimeEpisodes(points);
  return {
    schemaVersion: DAILY_MARKET_REGIME_SCHEMA_VERSION,
    algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
    episodeAlgorithmVersion: DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION,
    asset: "btc",
    symbol: "BTCUSDT",
    quoteCurrency: "USDT",
    interval: "1d",
    sourceCandleCount: dayCount,
    pointCount: points.length,
    range: {
      sourceFromOpenedAt: new Date(START).toISOString(),
      sourceToClosedAt: new Date(START + dayCount * duration - 1).toISOString(),
      firstRegimeOpenedAt: points[0].openedAt,
      lastRegimeClosedAt: points.at(-1)!.closedAt,
    },
    regimeSummary: summarizeTestRegimes(points),
    episodes,
    episodeDistributions:
      summarizeDailyMarketRegimeEpisodeDistributions(episodes),
    terminal: {
      algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
      asset: "btc",
      symbol: "BTCUSDT",
      quoteCurrency: "USDT",
      closedAt: last.closedAt,
      close: last.close,
      ema50: last.ema50,
      ema200: last.ema200,
      regime: last.regime,
    },
    points,
  };
}

function summarizeTestRegimes(
  points: readonly DailyMarketRegimePoint[],
): DailyMarketRegimeSummary {
  const summary = {
    bull: {
      dailyCandleCount: 0,
      segmentCount: 0,
      firstClosedAt: null as string | null,
      lastClosedAt: null as string | null,
    },
    bear: {
      dailyCandleCount: 0,
      segmentCount: 0,
      firstClosedAt: null as string | null,
      lastClosedAt: null as string | null,
    },
    transition: {
      dailyCandleCount: 0,
      segmentCount: 0,
      firstClosedAt: null as string | null,
      lastClosedAt: null as string | null,
    },
  };
  let previous: DailyMarketRegime | null = null;
  for (const point of points) {
    const item = summary[point.regime];
    item.dailyCandleCount += 1;
    item.segmentCount += previous === point.regime ? 0 : 1;
    item.firstClosedAt ??= point.closedAt;
    item.lastClosedAt = point.closedAt;
    previous = point.regime;
  }
  return summary;
}

function regimeValues(regime: DailyMarketRegime): Readonly<{
  close: number;
  ema50: number;
  ema200: number;
}> {
  if (regime === "bull") {
    // Close deliberately remains below EMA50 to enforce the agreed rule.
    return { close: 101, ema50: 102, ema200: 100 };
  }
  if (regime === "bear") {
    // Close deliberately remains above EMA50 to enforce the agreed rule.
    return { close: 99, ema50: 98, ema200: 100 };
  }
  return { close: 101, ema50: 99, ema200: 100 };
}

function completeEntryIndexes(
  candles: readonly ChartCandle[],
): ReadonlyMap<string, readonly number[]> {
  const points = buildLiveChartPoints(candles);
  const states = points.map(buildHistoricalContextState);
  const result = new Map<string, number[]>();
  let previous: string | null = null;
  for (const [index, state] of states.entries()) {
    if (state === null) {
      previous = null;
      continue;
    }
    if (
      previous !== null &&
      state.fingerprint !== previous &&
      index + 24 < points.length
    ) {
      const indexes = result.get(state.fingerprint) ?? [];
      indexes.push(index);
      result.set(state.fingerprint, indexes);
    }
    previous = state.fingerprint;
  }
  return result;
}

function expectedRegimeCounts(
  candles: readonly ChartCandle[],
  series: DailyMarketRegimeSeries,
  indexes: readonly number[],
): Readonly<Record<DailyMarketRegime | "unclassified", number>> {
  const result = { bull: 0, bear: 0, transition: 0, unclassified: 0 };
  for (const index of indexes) {
    const resolved = resolveDailyMarketRegimeAt(series, candles[index].closedAt);
    if (resolved === null) {
      result.unclassified += 1;
    } else {
      result[resolved.regime] += 1;
    }
  }
  return result;
}

describe("long-term historical baseline", () => {
  it("uses the agreed EMA200 regime boundaries without requiring close/EMA50 alignment", () => {
    expect(classifyDailyMarketRegime(101, 102, 100)).toBe("bull");
    expect(classifyDailyMarketRegime(99, 98, 100)).toBe("bear");
    expect(classifyDailyMarketRegime(101, 99, 100)).toBe("transition");
    expect(classifyDailyMarketRegime(99, 101, 100)).toBe("transition");
    expect(classifyDailyMarketRegime(100, 101, 100)).toBe("transition");
    expect(classifyDailyMarketRegime(101, 100, 100)).toBe("transition");
  });

  it("builds a versioned JSON-safe daily regime sequence only after EMA200", () => {
    const candles = risingDailyCandles(240);
    const series = buildDailyMarketRegimeSeries(candles);

    expect(series).not.toBeNull();
    expect(series).toMatchObject({
      schemaVersion: DAILY_MARKET_REGIME_SCHEMA_VERSION,
      algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1d",
      sourceCandleCount: 240,
      pointCount: 41,
    });
    expect(series!.points[0].openedAt).toBe(candles[199].openedAt);
    expect(series!.points.every((point) => point.regime === "bull")).toBe(true);
    expect(series!.regimeSummary).toEqual({
      bull: {
        dailyCandleCount: 41,
        segmentCount: 1,
        firstClosedAt: series!.points[0].closedAt,
        lastClosedAt: series!.points.at(-1)!.closedAt,
      },
      bear: {
        dailyCandleCount: 0,
        segmentCount: 0,
        firstClosedAt: null,
        lastClosedAt: null,
      },
      transition: {
        dailyCandleCount: 0,
        segmentCount: 0,
        firstClosedAt: null,
        lastClosedAt: null,
      },
    });
    expect(series!.terminal).toMatchObject({
      closedAt: candles.at(-1)!.closedAt,
      close: candles.at(-1)!.close,
      regime: "bull",
    });
    expect(JSON.parse(JSON.stringify(series))).toEqual(series);
    expect(() => assertDailyMarketRegimeSeries(series)).not.toThrow();
    expect(buildDailyMarketRegimeSeries(candles.slice(0, 199))).toBeNull();
  });

  it("counts each contiguous daily regime segment for auditable cycle coverage", () => {
    const series = alternatingRegimeSeries(230);

    expect(series.regimeSummary.bull).toMatchObject({
      dailyCandleCount: 11,
      segmentCount: 11,
      firstClosedAt: series.points[0].closedAt,
      lastClosedAt: series.points[30].closedAt,
    });
    expect(series.regimeSummary.bear).toMatchObject({
      dailyCandleCount: 10,
      segmentCount: 10,
    });
    expect(series.regimeSummary.transition).toMatchObject({
      dailyCandleCount: 10,
      segmentCount: 10,
    });
    expect(() => assertDailyMarketRegimeSeries(series)).not.toThrow();
  });

  it("compresses closed daily labels into auditable episodes and excludes censored edges from distributions", () => {
    const duration = chartIntervalMilliseconds["1d"];
    const regimes = [
      ["bull", 100],
      ["bull", 120],
      ["bull", 90],
      ["bear", 80],
      ["bear", 60],
      ["transition", 70],
    ] as const;
    const points: DailyMarketRegimePoint[] = regimes.map(
      ([regime, close], index) => ({
        openedAt: new Date(START + index * duration).toISOString(),
        closedAt: new Date(START + (index + 1) * duration - 1).toISOString(),
        close,
        ema50: regimeValues(regime).ema50,
        ema200: regimeValues(regime).ema200,
        regime,
      }),
    );
    const episodes = buildDailyMarketRegimeEpisodes(points);
    const distributions = summarizeDailyMarketRegimeEpisodeDistributions(
      episodes,
    );

    expect(episodes).toHaveLength(3);
    expect(episodes[0]).toMatchObject({
      regime: "bull",
      startedBy: "first_classifiable",
      endedBy: "regime_change",
      durationDays: 3,
      closedDailyCandleCount: 3,
      startClose: 100,
      endClose: 90,
      returnPercent: -10,
      peakCloseReturnPercent: 20,
      maxDrawdownPercent: 25,
    });
    expect(episodes[1]).toMatchObject({
      regime: "bear",
      startedBy: "regime_change",
      endedBy: "regime_change",
      durationDays: 2,
      returnPercent: -25,
      peakCloseReturnPercent: 0,
      maxDrawdownPercent: 25,
    });
    expect(episodes[2]).toMatchObject({
      regime: "transition",
      endedBy: "coverage_end",
    });
    expect(distributions.bear).toEqual({
      sampleCount: 1,
      durationDays: { median: 2, q25: 2, q75: 2 },
      returnPercent: { median: -25, q25: -25, q75: -25 },
      peakCloseReturnPercent: { median: 0, q25: 0, q75: 0 },
      maxDrawdownPercent: { median: 25, q25: 25, q75: 25 },
    });
    expect(distributions.bull.sampleCount).toBe(0);
    expect(distributions.transition.sampleCount).toBe(0);
  });

  it("closes the archived terminal episode on a live regime switch and never accepts a forming continuation", () => {
    const archived = alternatingRegimeSeries(230);
    const terminal = archived.terminal;
    const duration = chartIntervalMilliseconds["1d"];
    const openedAt = Date.parse(terminal.closedAt) + 1;
    const switched: ChartCandle = {
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1d",
      quoteCurrency: "USDT",
      state: "closed",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open: terminal.close,
      high: terminal.close,
      low: 1,
      close: 1,
      volume: 100,
    };
    const before = archived.episodeDistributions.bull.sampleCount;
    const advanced = advanceDailyMarketRegimeEpisodesFromTerminal(
      terminal,
      archived.episodes,
      [switched],
    );

    expect(archived.episodes.at(-1)).toMatchObject({
      regime: "bull",
      startedBy: "regime_change",
      endedBy: "coverage_end",
    });
    expect(advanced.episodes.at(-2)).toMatchObject({
      regime: "bull",
      endedBy: "regime_change",
    });
    expect(advanced.episodes.at(-1)).toMatchObject({
      regime: "bear",
      startedBy: "regime_change",
      endedBy: "coverage_end",
      closedDailyCandleCount: 1,
    });
    expect(advanced.episodeDistributions.bull.sampleCount).toBe(before + 1);
    expect(() =>
      advanceDailyMarketRegimeEpisodesFromTerminal(
        terminal,
        archived.episodes,
        [{ ...switched, state: "forming" }],
      ),
    ).toThrow("must be closed");
  });

  it("advances the archived daily terminal without reseeding either EMA", () => {
    const allCandles = risingDailyCandles(245);
    const archived = buildDailyMarketRegimeSeries(allCandles.slice(0, 225))!;
    const rebuilt = buildDailyMarketRegimeSeries(allCandles)!;

    expect(
      advanceDailyMarketRegimeFromTerminal(
        archived.terminal,
        allCandles.slice(225),
      ),
    ).toEqual(rebuilt.terminal);
    expect(
      advanceDailyMarketRegimeFromTerminal(archived.terminal, []),
    ).toBe(archived.terminal);
    expect(() =>
      advanceDailyMarketRegimeFromTerminal(
        archived.terminal,
        allCandles.slice(226),
      ),
    ).toThrow("must begin immediately");
    expect(() =>
      advanceDailyMarketRegimeFromTerminal(archived.terminal, [
        { ...allCandles[225], state: "forming" },
      ]),
    ).toThrow("must be closed");
  });

  it("never maps a low-period event to a daily regime that had not closed", () => {
    const series = alternatingRegimeSeries(230);
    const targetDay = series.points[6];
    const previousDay = series.points[5];
    const intradayClosedAt = new Date(
      Date.parse(targetDay.openedAt) + 12 * 60 * 60 * 1_000,
    ).toISOString();
    const immediatelyBeforeClose = new Date(
      Date.parse(targetDay.closedAt) - 1,
    ).toISOString();

    expect(resolveDailyMarketRegimeAt(series, intradayClosedAt)).toMatchObject({
      regime: previousDay.regime,
      dailyClosedAt: previousDay.closedAt,
    });
    expect(
      resolveDailyMarketRegimeAt(series, immediatelyBeforeClose),
    ).toMatchObject({
      regime: previousDay.regime,
      dailyClosedAt: previousDay.closedAt,
    });
    expect(resolveDailyMarketRegimeAt(series, targetDay.closedAt)).toMatchObject({
      regime: targetDay.regime,
      dailyClosedAt: targetDay.closedAt,
    });
    expect(
      resolveDailyMarketRegimeAt(
        series,
        new Date(Date.parse(series.points[0].closedAt) - 1).toISOString(),
      ),
    ).toBeNull();
  });

  it("precomputes every fingerprint for all and point-in-time regime cohorts", () => {
    const dayCount = 260;
    const candles = chartCandles(hourlyCloses(dayCount));
    const regimes = alternatingRegimeSeries(dayCount);
    const baseline = buildLongTermHistoricalBaseline(candles, regimes);

    expect(baseline).not.toBeNull();
    expect(baseline).toMatchObject({
      schemaVersion: LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION,
      algorithmVersion: LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION,
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1h",
      source: { closedCandleCount: dayCount * 24 },
    });
    expect(baseline!.dailyRegimeSource.regimeSummary).toEqual(
      regimes.regimeSummary,
    );
    expect(baseline!.dailyRegimeSource.terminal).toEqual(regimes.terminal);
    const expectedIndexes = completeEntryIndexes(candles);
    expect(baseline!.fingerprintCount).toBe(baseline!.fingerprints.length);
    expect(baseline!.fingerprints.length).toBeGreaterThan(1);

    for (const entry of baseline!.fingerprints) {
      const indexes = expectedIndexes.get(entry.fingerprint) ?? [];
      const expected = expectedRegimeCounts(candles, regimes, indexes);
      expect(entry.all.eventCount).toBe(indexes.length);
      expect(entry.regimes.bull.eventCount).toBe(expected.bull);
      expect(entry.regimes.bear.eventCount).toBe(expected.bear);
      expect(entry.regimes.transition.eventCount).toBe(expected.transition);
      expect(entry.unclassifiedEventCount).toBe(expected.unclassified);
      expect(
        entry.regimes.bull.eventCount +
          entry.regimes.bear.eventCount +
          entry.regimes.transition.eventCount +
          entry.unclassifiedEventCount,
      ).toBe(entry.all.eventCount);
    }
    expect(() => assertLongTermHistoricalBaseline(baseline)).not.toThrow();
  });

  it("supports 1h, 4h and 1d baselines while declining 15m", () => {
    const regimes = alternatingRegimeSeries(230);
    for (const interval of ["1h", "4h", "1d"] as const) {
      const baseline = buildLongTermHistoricalBaseline(
        chartCandles(
          interval === "1h" ? hourlyCloses(230) : hourlyCloses(8),
          { interval },
        ),
        regimes,
      );
      expect(baseline?.interval).toBe(interval);
    }
    expect(
      buildLongTermHistoricalBaseline(
        chartCandles(hourlyCloses(8), { interval: "15m" }),
        regimes,
      ),
    ).toBeNull();
  });

  it("keeps a final archived state entry when its 24-bar future is complete", () => {
    const dayCount = 260;
    const closes = [
      ...hourlyCloses(dayCount - 10),
      ...Array.from({ length: 240 }, (_, index) => 1_100 + index * 1.5),
    ];
    const candles = chartCandles(closes);
    const points = buildLiveChartPoints(candles);
    const states = points.map(buildHistoricalContextState);
    const latest = states.at(-1)!;
    let latestEntryIndex = states.length - 1;
    while (
      latestEntryIndex > 0 &&
      states[latestEntryIndex - 1]?.fingerprint === latest.fingerprint
    ) {
      latestEntryIndex -= 1;
    }
    const baseline = buildLongTermHistoricalBaseline(
      candles,
      alternatingRegimeSeries(dayCount),
    )!;
    const entry = baseline.fingerprints.find(
      (candidate) => candidate.fingerprint === latest.fingerprint,
    )!;

    expect(latestEntryIndex + 24).toBeLessThan(points.length);
    expect(entry.all.eventRange?.lastEventOpenedAt).toBe(
      points[latestEntryIndex].openedAt,
    );
  });

  it("keeps direction shares on horizon-separated samples in every baseline cohort", () => {
    const dayCount = 260;
    const candles = chartCandles(hourlyCloses(dayCount));
    const baseline = buildLongTermHistoricalBaseline(
      candles,
      alternatingRegimeSeries(dayCount),
    )!;
    const denseEntry = [...baseline.fingerprints]
      .sort((left, right) => right.all.eventCount - left.all.eventCount)[0];

    expect(denseEntry.all.eventCount).toBeGreaterThan(0);
    for (const horizon of denseEntry.all.horizons) {
      expect(horizon.independentSampleCount).toBeLessThanOrEqual(
        horizon.sampleCount,
      );
      expect(horizon.positiveReturnRatePercent).toEqual(
        horizon.independentSampleCount >=
          HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
          ? expect.any(Number)
          : null,
      );
    }
    expect(denseEntry.all.horizons.map((item) => item.bars)).toEqual(
      HISTORICAL_CONTEXT_HORIZONS,
    );
  });

  it("queries validated serialized all/regime cohorts without changing statistics", () => {
    const dayCount = 230;
    const baseline = buildLongTermHistoricalBaseline(
      chartCandles(hourlyCloses(dayCount)),
      alternatingRegimeSeries(dayCount),
    )!;
    const serialized = JSON.parse(
      JSON.stringify(baseline),
    ) as typeof baseline;
    const entry = serialized.fingerprints.find(
      (candidate) => candidate.regimes.bull.eventCount > 0,
    )!;
    const result = queryLongTermHistoricalBaseline(serialized, {
      fingerprint: entry.fingerprint,
      regime: "bull",
    });

    expect(result).toMatchObject({
      schemaVersion: LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION,
      algorithmVersion: LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION,
      fingerprint: entry.fingerprint,
      regime: "bull",
      statistics: entry.regimes.bull,
    });
    expect(
      queryLongTermHistoricalBaseline(serialized, {
        fingerprint:
          "price:equal,equal,equal|order:mixed:EMA10=EMA20=EMA50",
        regime: "all",
      }),
    ).toBeNull();
  });

  it("strictly rejects forming, discontinuous, mismatched and tampered inputs", () => {
    const daily = buildDailyMarketRegimeSeries(risingDailyCandles(230))!;
    const hourly = chartCandles(hourlyCloses(230));
    expect(() =>
      buildLongTermHistoricalBaseline(
        chartCandles(hourlyCloses(230), { formingLatest: true }),
        daily,
      ),
    ).toThrow("historical baseline candles must be closed");
    expect(() =>
      buildLongTermHistoricalBaseline(
        hourly.filter((_, index) => index !== 500),
        daily,
      ),
    ).toThrow("historical baseline candles must be closed, contiguous");
    expect(() =>
      buildLongTermHistoricalBaseline(
        chartCandles(hourlyCloses(230), { asset: "eth" }),
        daily,
      ),
    ).toThrow("must share one scope");
    expect(
      buildLongTermHistoricalBaseline(
        chartCandles(hourlyCloses(230), { interval: "15m" }),
        daily,
      ),
    ).toBeNull();

    const baseline = buildLongTermHistoricalBaseline(hourly, daily)!;
    const tampered = JSON.parse(JSON.stringify(baseline)) as Record<
      string,
      unknown
    >;
    tampered.algorithmVersion = "unknown";
    expect(() => assertLongTermHistoricalBaseline(tampered)).toThrow(
      "Invalid long-term historical baseline",
    );

    const tamperedSeries = JSON.parse(JSON.stringify(daily)) as {
      terminal: { ema200: number };
    };
    tamperedSeries.terminal.ema200 = 0;
    expect(() => assertDailyMarketRegimeSeries(tamperedSeries)).toThrow(
      "terminal EMA200 must be a positive finite number",
    );

    const tamperedTerminal = JSON.parse(JSON.stringify(baseline)) as {
      dailyRegimeSource: { terminal: { closedAt: string } };
    };
    tamperedTerminal.dailyRegimeSource.terminal.closedAt =
      daily.points.at(-2)!.closedAt;
    expect(() => assertLongTermHistoricalBaseline(tamperedTerminal)).toThrow(
      "daily terminal is inconsistent",
    );

    const unexpectedEpisodeField = JSON.parse(JSON.stringify(baseline)) as {
      dailyRegimeSource: {
        episodes: Array<Record<string, unknown>>;
      };
    };
    unexpectedEpisodeField.dailyRegimeSource.episodes[0].rawCandles = [];
    expect(() =>
      assertLongTermHistoricalBaseline(unexpectedEpisodeField),
    ).toThrow("unexpected fields");

    const forgedDistribution = JSON.parse(JSON.stringify(baseline)) as {
      dailyRegimeSource: {
        episodeDistributions: {
          bull: { sampleCount: number };
        };
      };
    };
    forgedDistribution.dailyRegimeSource.episodeDistributions.bull
      .sampleCount += 1;
    expect(() => assertLongTermHistoricalBaseline(forgedDistribution)).toThrow(
      /metric quantiles|do not match complete episodes/,
    );
  });
});
