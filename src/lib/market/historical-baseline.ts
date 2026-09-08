import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
} from "@/server/data/contracts/market-data";
import {
  HISTORICAL_CONTEXT_ALGORITHM_VERSION,
  HISTORICAL_CONTEXT_HORIZONS,
  HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
  buildHistoricalContextEventObservations,
  buildHistoricalContextState,
  summarizeHistoricalContextEventObservations,
  type HistoricalContextEventObservation,
  type HistoricalContextHorizonStatistics,
  type HistoricalContextOrdering,
  type HistoricalContextPriceRelation,
} from "./historical-context";
import {
  assertChartSeries,
  buildLiveChartPoints,
  chartIntervalMilliseconds,
} from "./live-chart";

export const DAILY_MARKET_REGIME_SCHEMA_VERSION =
  "daily-market-regime-series-v3" as const;
export const DAILY_MARKET_REGIME_ALGORITHM_VERSION =
  "daily-close-ema50-ema200-v1" as const;
export const DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION =
  "daily-regime-episodes-close-v1" as const;
export const LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION =
  "long-term-historical-baseline-v6" as const;
export const LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION =
  "ema-fingerprint-daily-regime-v3" as const;

export const DAILY_MARKET_REGIMES = [
  "bull",
  "bear",
  "transition",
] as const;
export type DailyMarketRegime = (typeof DAILY_MARKET_REGIMES)[number];
export type LongTermHistoricalBaselineRegime = DailyMarketRegime | "all";
export type LongTermHistoricalBaselineInterval = Exclude<
  ChartCandleInterval,
  "15m"
>;

export type DailyMarketRegimePoint = Readonly<{
  openedAt: string;
  closedAt: string;
  close: number;
  ema50: number;
  ema200: number;
  regime: DailyMarketRegime;
}>;

export type DailyMarketRegimeTerminal = Readonly<{
  algorithmVersion: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
  asset: Asset;
  symbol: ChartCandle["symbol"];
  quoteCurrency: ChartCandle["quoteCurrency"];
  closedAt: string;
  close: number;
  ema50: number;
  ema200: number;
  regime: DailyMarketRegime;
}>;

export type DailyMarketRegimeSummary = Readonly<
  Record<
    DailyMarketRegime,
    Readonly<{
      dailyCandleCount: number;
      segmentCount: number;
      firstClosedAt: string | null;
      lastClosedAt: string | null;
    }>
  >
>;

export type DailyMarketRegimeEpisodeBoundary =
  | "first_classifiable"
  | "regime_change";

export type DailyMarketRegimeEpisodeEnd =
  | "regime_change"
  | "coverage_end";

/**
 * A compact, close-only mechanical regime episode. `startedAt` and `endedAt`
 * are the close times of the first and last classified daily candles. The
 * final episode is right-censored with `endedBy: "coverage_end"`; the first
 * is left-censored with `startedBy: "first_classifiable"`.
 */
export type DailyMarketRegimeEpisode = Readonly<{
  regime: DailyMarketRegime;
  startedAt: string;
  endedAt: string;
  startedBy: DailyMarketRegimeEpisodeBoundary;
  endedBy: DailyMarketRegimeEpisodeEnd;
  durationDays: number;
  closedDailyCandleCount: number;
  startClose: number;
  endClose: number;
  returnPercent: number;
  /** Highest closed-daily close relative to startClose; never an intraday high. */
  peakCloseReturnPercent: number;
  /** Largest peak-to-later-close decline as a non-negative magnitude. */
  maxDrawdownPercent: number;
}>;

export type DailyMarketRegimeMetricDistribution = Readonly<{
  median: number | null;
  q25: number | null;
  q75: number | null;
}>;

export type DailyMarketRegimeEpisodeDistribution = Readonly<{
  /** Only fully observed episodes bounded by two regime changes. */
  sampleCount: number;
  durationDays: DailyMarketRegimeMetricDistribution;
  returnPercent: DailyMarketRegimeMetricDistribution;
  peakCloseReturnPercent: DailyMarketRegimeMetricDistribution;
  maxDrawdownPercent: DailyMarketRegimeMetricDistribution;
}>;

export type DailyMarketRegimeEpisodeDistributions = Readonly<
  Record<DailyMarketRegime, DailyMarketRegimeEpisodeDistribution>
>;

export type DailyMarketRegimeSeries = Readonly<{
  schemaVersion: typeof DAILY_MARKET_REGIME_SCHEMA_VERSION;
  algorithmVersion: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
  episodeAlgorithmVersion: typeof DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION;
  asset: Asset;
  symbol: ChartCandle["symbol"];
  quoteCurrency: ChartCandle["quoteCurrency"];
  interval: "1d";
  sourceCandleCount: number;
  pointCount: number;
  range: Readonly<{
    sourceFromOpenedAt: string;
    sourceToClosedAt: string;
    firstRegimeOpenedAt: string;
    lastRegimeClosedAt: string;
  }>;
  regimeSummary: DailyMarketRegimeSummary;
  episodes: readonly DailyMarketRegimeEpisode[];
  episodeDistributions: DailyMarketRegimeEpisodeDistributions;
  terminal: DailyMarketRegimeTerminal;
  points: readonly DailyMarketRegimePoint[];
}>;

export type HistoricalBaselineCohort = Readonly<{
  status: "sufficient" | "insufficient";
  eventCount: number;
  eventRange: Readonly<{
    firstEventOpenedAt: string;
    lastEventOpenedAt: string;
  }> | null;
  horizons: readonly HistoricalContextHorizonStatistics[];
}>;

export type HistoricalBaselineFingerprint = Readonly<{
  fingerprint: string;
  priceRelations: Readonly<{
    ema10: HistoricalContextPriceRelation;
    ema20: HistoricalContextPriceRelation;
    ema50: HistoricalContextPriceRelation;
  }>;
  ordering: Readonly<{
    state: HistoricalContextOrdering;
    expression: string;
  }>;
  all: HistoricalBaselineCohort;
  regimes: Readonly<Record<DailyMarketRegime, HistoricalBaselineCohort>>;
  unclassifiedEventCount: number;
}>;

export type LongTermHistoricalBaseline = Readonly<{
  schemaVersion: typeof LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION;
  algorithmVersion: typeof LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION;
  eventStudyAlgorithmVersion: typeof HISTORICAL_CONTEXT_ALGORITHM_VERSION;
  regimeAlgorithmVersion: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
  episodeAlgorithmVersion: typeof DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION;
  asset: Asset;
  symbol: ChartCandle["symbol"];
  quoteCurrency: ChartCandle["quoteCurrency"];
  interval: LongTermHistoricalBaselineInterval;
  source: Readonly<{
    sourceRowCount: number;
    closedCandleCount: number;
    excludedUnalignedCandleCount: number;
    excludedLegacyZeroVolumePlaceholderCount: number;
    segmentCount: number;
    gapCount: number;
    missingCandleCount: number;
    fromOpenedAt: string;
    toClosedAt: string;
  }>;
  dailyRegimeSource: Readonly<{
    episodeAlgorithmVersion: typeof DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION;
    sourceCandleCount: number;
    pointCount: number;
    fromOpenedAt: string;
    toClosedAt: string;
    regimeSummary: DailyMarketRegimeSummary;
    episodes: readonly DailyMarketRegimeEpisode[];
    episodeDistributions: DailyMarketRegimeEpisodeDistributions;
    terminal: DailyMarketRegimeTerminal;
  }>;
  events: Readonly<{
    candidateEventCount: number;
    completeEventCount: number;
    excludedIncompleteEventCount: number;
    unclassifiedEventCount: number;
  }>;
  fingerprintCount: number;
  fingerprints: readonly HistoricalBaselineFingerprint[];
}>;

export type HistoricalBaselineSourceAudit = Readonly<{
  sourceRowCount: number;
  excludedUnalignedCandleCount: number;
  excludedLegacyZeroVolumePlaceholderCount: number;
}>;

export type LongTermHistoricalBaselineQuery = Readonly<{
  fingerprint: string;
  regime: LongTermHistoricalBaselineRegime;
}>;

export type LongTermHistoricalBaselineQueryResult = Readonly<{
  schemaVersion: typeof LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION;
  algorithmVersion: typeof LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION;
  eventStudyAlgorithmVersion: typeof HISTORICAL_CONTEXT_ALGORITHM_VERSION;
  regimeAlgorithmVersion: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
  episodeAlgorithmVersion: typeof DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION;
  asset: Asset;
  symbol: ChartCandle["symbol"];
  quoteCurrency: ChartCandle["quoteCurrency"];
  interval: LongTermHistoricalBaselineInterval;
  fingerprint: string;
  regime: LongTermHistoricalBaselineRegime;
  source: LongTermHistoricalBaseline["source"];
  dailyRegimeSource: LongTermHistoricalBaseline["dailyRegimeSource"];
  statistics: HistoricalBaselineCohort;
}>;

export type ResolvedDailyMarketRegime = Readonly<{
  regime: DailyMarketRegime;
  dailyOpenedAt: string;
  dailyClosedAt: string;
  close: number;
  ema50: number;
  ema200: number;
}>;

/**
 * Builds a daily regime sequence from closed, contiguous 1d candles. A regime
 * exists only after EMA200 has a complete seed. The rule is deliberately
 * mechanical:
 *
 * - bull: close > EMA200 and EMA50 > EMA200
 * - bear: close < EMA200 and EMA50 < EMA200
 * - transition: every other relationship
 */
export function buildDailyMarketRegimeSeries(
  dailyCandles: readonly ChartCandle[],
): DailyMarketRegimeSeries | null {
  if (dailyCandles.length === 0) {
    return null;
  }
  assertClosedContiguousCandles(dailyCandles, "daily regime");
  if (dailyCandles[0].interval !== "1d") {
    throw new TypeError("Daily market regimes require 1d candles.");
  }
  if (dailyCandles.length < 200) {
    return null;
  }

  const chartPoints = buildLiveChartPoints(dailyCandles);
  const points = chartPoints.flatMap((point): readonly DailyMarketRegimePoint[] => {
    if (point.ema50 === null || point.ema200 === null) {
      return [];
    }
    return [{
      openedAt: point.openedAt,
      closedAt: point.closedAt,
      close: point.close,
      ema50: point.ema50,
      ema200: point.ema200,
      regime: classifyDailyMarketRegime(point.close, point.ema50, point.ema200),
    }];
  });
  const first = points[0];
  const last = points.at(-1)!;
  const firstSource = dailyCandles[0];
  const lastSource = dailyCandles.at(-1)!;
  const episodes = buildDailyMarketRegimeEpisodes(points);

  return {
    schemaVersion: DAILY_MARKET_REGIME_SCHEMA_VERSION,
    algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
    episodeAlgorithmVersion: DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION,
    asset: firstSource.asset,
    symbol: firstSource.symbol,
    quoteCurrency: firstSource.quoteCurrency,
    interval: "1d",
    sourceCandleCount: dailyCandles.length,
    pointCount: points.length,
    range: {
      sourceFromOpenedAt: firstSource.openedAt,
      sourceToClosedAt: lastSource.closedAt,
      firstRegimeOpenedAt: first.openedAt,
      lastRegimeClosedAt: last.closedAt,
    },
    regimeSummary: summarizeDailyMarketRegimes(points),
    episodes,
    episodeDistributions:
      summarizeDailyMarketRegimeEpisodeDistributions(episodes),
    terminal: toDailyMarketRegimeTerminal(last, firstSource),
    points,
  };
}

export function classifyDailyMarketRegime(
  close: number,
  ema50: number,
  ema200: number,
): DailyMarketRegime {
  assertPositiveFinite(close, "Daily close");
  assertPositiveFinite(ema50, "Daily EMA50");
  assertPositiveFinite(ema200, "Daily EMA200");
  if (close > ema200 && ema50 > ema200) {
    return "bull";
  }
  if (close < ema200 && ema50 < ema200) {
    return "bear";
  }
  return "transition";
}

/**
 * Resolves the last daily regime whose candle had already closed at the given
 * event timestamp. A same-day daily candle is therefore unavailable to 1h/4h
 * events until its own `closedAt`, preventing a daily look-ahead leak.
 */
export function resolveDailyMarketRegimeAt(
  series: DailyMarketRegimeSeries,
  eventClosedAt: string,
): ResolvedDailyMarketRegime | null {
  assertDailyMarketRegimeSeries(series);
  const timestamp = parseCanonicalTimestamp(eventClosedAt, "Event closedAt");
  return resolveDailyMarketRegimeAtUnchecked(series, timestamp);
}

/**
 * Advances the archived EMA50/EMA200 terminal with strictly adjacent closed
 * daily candles. This preserves the full-history EMA seed instead of silently
 * reseeding from an arbitrary recent window.
 */
export function advanceDailyMarketRegimeFromTerminal(
  terminal: DailyMarketRegimeTerminal,
  newerClosedDailyCandles: readonly ChartCandle[],
): DailyMarketRegimeTerminal {
  return advanceDailyMarketRegimePointsFromTerminal(
    terminal,
    newerClosedDailyCandles,
  ).terminal;
}

export type AdvancedDailyMarketRegimeEpisodes = Readonly<{
  terminal: DailyMarketRegimeTerminal;
  episodes: readonly DailyMarketRegimeEpisode[];
  episodeDistributions: DailyMarketRegimeEpisodeDistributions;
}>;

/**
 * Extends a compact archived episode sequence with adjacent, closed daily
 * candles. A live regime change closes the archived right-censored episode,
 * so it becomes eligible for the complete-episode distribution.
 */
export function advanceDailyMarketRegimeEpisodesFromTerminal(
  terminal: DailyMarketRegimeTerminal,
  archivedEpisodes: readonly DailyMarketRegimeEpisode[],
  newerClosedDailyCandles: readonly ChartCandle[],
): AdvancedDailyMarketRegimeEpisodes {
  assertDailyMarketRegimeTerminal(terminal);
  assertDailyMarketRegimeEpisodes(
    archivedEpisodes,
    terminal.closedAt,
    terminal.regime,
  );
  const advanced = advanceDailyMarketRegimePointsFromTerminal(
    terminal,
    newerClosedDailyCandles,
  );
  if (advanced.points.length === 0) {
    return {
      terminal,
      episodes: archivedEpisodes,
      episodeDistributions:
        summarizeDailyMarketRegimeEpisodeDistributions(archivedEpisodes),
    };
  }

  const episodes = [...archivedEpisodes];
  for (const point of advanced.points) {
    const current = episodes.at(-1)!;
    if (point.regime !== current.regime) {
      episodes[episodes.length - 1] = {
        ...current,
        endedBy: "regime_change",
      };
      episodes.push(buildDailyMarketRegimeEpisode(
        [point],
        "regime_change",
        "coverage_end",
      ));
      continue;
    }
    episodes[episodes.length - 1] = extendDailyMarketRegimeEpisode(
      current,
      point,
    );
  }
  assertDailyMarketRegimeEpisodes(
    episodes,
    advanced.terminal.closedAt,
    advanced.terminal.regime,
  );
  return {
    terminal: advanced.terminal,
    episodes,
    episodeDistributions:
      summarizeDailyMarketRegimeEpisodeDistributions(episodes),
  };
}

function advanceDailyMarketRegimePointsFromTerminal(
  terminal: DailyMarketRegimeTerminal,
  newerClosedDailyCandles: readonly ChartCandle[],
): Readonly<{
  terminal: DailyMarketRegimeTerminal;
  points: readonly DailyMarketRegimePoint[];
}> {
  assertDailyMarketRegimeTerminal(terminal);
  if (newerClosedDailyCandles.length === 0) {
    return { terminal, points: [] };
  }
  assertClosedContiguousCandles(
    newerClosedDailyCandles,
    "daily regime continuation",
  );
  const first = newerClosedDailyCandles[0];
  if (
    first.interval !== "1d" ||
    first.asset !== terminal.asset ||
    first.symbol !== terminal.symbol ||
    first.quoteCurrency !== terminal.quoteCurrency ||
    Date.parse(first.openedAt) !== Date.parse(terminal.closedAt) + 1
  ) {
    throw new TypeError(
      "Daily regime continuation must begin immediately after its terminal and share one scope.",
    );
  }

  let current = terminal;
  const points: DailyMarketRegimePoint[] = [];
  const ema50Multiplier = 2 / 51;
  const ema200Multiplier = 2 / 201;
  for (const candle of newerClosedDailyCandles) {
    const ema50 =
      (candle.close - current.ema50) * ema50Multiplier + current.ema50;
    const ema200 =
      (candle.close - current.ema200) * ema200Multiplier + current.ema200;
    assertPositiveFinite(ema50, "Advanced daily EMA50");
    assertPositiveFinite(ema200, "Advanced daily EMA200");
    current = {
      algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
      asset: candle.asset,
      symbol: candle.symbol,
      quoteCurrency: candle.quoteCurrency,
      closedAt: candle.closedAt,
      close: candle.close,
      ema50,
      ema200,
      regime: classifyDailyMarketRegime(candle.close, ema50, ema200),
    };
    points.push({
      openedAt: candle.openedAt,
      closedAt: candle.closedAt,
      close: candle.close,
      ema50,
      ema200,
      regime: current.regime,
    });
  }
  return { terminal: current, points };
}

/**
 * Precomputes every observed EMA10/20/50 fingerprint as a complete cohort and
 * as bull/bear/transition cohorts. No current direction or recommendation is
 * produced; all statistics retain the shared historical-context semantics.
 */
export function buildLongTermHistoricalBaseline(
  candles: readonly ChartCandle[],
  dailyRegimes: DailyMarketRegimeSeries,
): LongTermHistoricalBaseline | null {
  return buildLongTermHistoricalBaselineFromSegments([candles], dailyRegimes);
}

/**
 * Builds one baseline from strictly contiguous archive segments. Every segment
 * gets an independent EMA warm-up, fingerprint transition scan, forward
 * horizon and independent-direction cohort. Only the resulting raw event
 * observations are combined, before quantiles or direction shares are reduced.
 */
export function buildLongTermHistoricalBaselineFromSegments(
  segments: readonly (readonly ChartCandle[])[],
  dailyRegimes: DailyMarketRegimeSeries,
  sourceAudit?: HistoricalBaselineSourceAudit,
): LongTermHistoricalBaseline | null {
  if (segments.length === 0 || segments.every((segment) => segment.length === 0)) {
    return null;
  }
  const source = applyHistoricalBaselineSourceAudit(
    assertHistoricalBaselineSegments(segments),
    sourceAudit,
  );
  const first = segments[0][0];
  if (first.interval === "15m") {
    return null;
  }
  if (source.closedCandleCount < 50) {
    return null;
  }
  assertDailyMarketRegimeSeries(dailyRegimes);
  assertMatchingRegimeScope(first, dailyRegimes);
  assertDailyRegimeCoverageRange(source, dailyRegimes);

  const descriptors = new Map<
    string,
    Pick<HistoricalBaselineFingerprint, "fingerprint" | "priceRelations" | "ordering">
  >();
  const observationsByFingerprint = new Map<
    string,
    HistoricalContextEventObservation[]
  >();
  const observationsByFingerprintAndRegime = new Map<
    string,
    Record<DailyMarketRegime, HistoricalContextEventObservation[]>
  >();
  const unclassifiedByFingerprint = new Map<string, number>();
  let candidateEventCount = 0;
  let completeEventCount = 0;
  const maximumHorizon = HISTORICAL_CONTEXT_HORIZONS.at(-1)!;

  for (const [segmentIndex, segment] of segments.entries()) {
    const points = buildLiveChartPoints(segment);
    const states = points.map(buildHistoricalContextState);
    for (const state of states) {
      if (state !== null && !descriptors.has(state.fingerprint)) {
        descriptors.set(state.fingerprint, {
          fingerprint: state.fingerprint,
          priceRelations: state.priceRelations,
          ordering: state.ordering,
        });
      }
    }

    const candidateIndexesByFingerprint = new Map<string, number[]>();
    let previousFingerprint: string | null = null;
    for (const [index, state] of states.entries()) {
      if (state === null) {
        previousFingerprint = null;
        continue;
      }
      if (
        previousFingerprint !== null &&
        state.fingerprint !== previousFingerprint
      ) {
        const indexes =
          candidateIndexesByFingerprint.get(state.fingerprint) ?? [];
        indexes.push(index);
        candidateIndexesByFingerprint.set(state.fingerprint, indexes);
        candidateEventCount += 1;
      }
      previousFingerprint = state.fingerprint;
    }

    for (const [fingerprint, indexes] of candidateIndexesByFingerprint) {
      const completeIndexes = indexes.filter(
        (index) => index + maximumHorizon < points.length,
      );
      const observations = buildHistoricalContextEventObservations(
        points,
        completeIndexes,
        segmentIndex,
      );
      completeEventCount += observations.length;
      appendHistoricalObservations(
        observationsByFingerprint,
        fingerprint,
        observations,
      );

      let regimeObservations =
        observationsByFingerprintAndRegime.get(fingerprint);
      if (regimeObservations === undefined) {
        regimeObservations = emptyRegimeObservations();
        observationsByFingerprintAndRegime.set(
          fingerprint,
          regimeObservations,
        );
      }
      let unclassifiedEventCount =
        unclassifiedByFingerprint.get(fingerprint) ?? 0;
      for (const observation of observations) {
        const resolved = resolveDailyMarketRegimeAtUnchecked(
          dailyRegimes,
          Date.parse(observation.eventClosedAt),
        );
        if (resolved === null) {
          unclassifiedEventCount += 1;
        } else {
          regimeObservations[resolved.regime].push(observation);
        }
      }
      unclassifiedByFingerprint.set(fingerprint, unclassifiedEventCount);
    }
  }

  if (descriptors.size === 0) {
    return null;
  }
  let totalUnclassifiedEventCount = 0;
  const fingerprints = [...descriptors.values()]
    .sort((left, right) =>
      left.fingerprint < right.fingerprint
        ? -1
        : left.fingerprint > right.fingerprint
          ? 1
          : 0,
    )
    .map((descriptor): HistoricalBaselineFingerprint => {
      const allObservations =
        observationsByFingerprint.get(descriptor.fingerprint) ?? [];
      const regimeObservations =
        observationsByFingerprintAndRegime.get(descriptor.fingerprint) ??
        emptyRegimeObservations();
      const unclassifiedEventCount =
        unclassifiedByFingerprint.get(descriptor.fingerprint) ?? 0;
      totalUnclassifiedEventCount += unclassifiedEventCount;

      return {
        ...descriptor,
        all: summarizeBaselineCohort(allObservations),
        regimes: {
          bull: summarizeBaselineCohort(regimeObservations.bull),
          bear: summarizeBaselineCohort(regimeObservations.bear),
          transition: summarizeBaselineCohort(
            regimeObservations.transition,
          ),
        },
        unclassifiedEventCount,
      };
    });

  return {
    schemaVersion: LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION,
    algorithmVersion: LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION,
    eventStudyAlgorithmVersion: HISTORICAL_CONTEXT_ALGORITHM_VERSION,
    regimeAlgorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
    episodeAlgorithmVersion: DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION,
    asset: first.asset,
    symbol: first.symbol,
    quoteCurrency: first.quoteCurrency,
    interval: first.interval as LongTermHistoricalBaselineInterval,
    source,
    dailyRegimeSource: {
      episodeAlgorithmVersion: dailyRegimes.episodeAlgorithmVersion,
      sourceCandleCount: dailyRegimes.sourceCandleCount,
      pointCount: dailyRegimes.pointCount,
      fromOpenedAt: dailyRegimes.range.sourceFromOpenedAt,
      toClosedAt: dailyRegimes.range.sourceToClosedAt,
      regimeSummary: dailyRegimes.regimeSummary,
      episodes: dailyRegimes.episodes,
      episodeDistributions: dailyRegimes.episodeDistributions,
      terminal: dailyRegimes.terminal,
    },
    events: {
      candidateEventCount,
      completeEventCount,
      excludedIncompleteEventCount:
        candidateEventCount - completeEventCount,
      unclassifiedEventCount: totalUnclassifiedEventCount,
    },
    fingerprintCount: fingerprints.length,
    fingerprints,
  };
}

/** Validates a deserialized baseline before returning one exact cohort. */
export function queryLongTermHistoricalBaseline(
  baseline: LongTermHistoricalBaseline,
  query: LongTermHistoricalBaselineQuery,
): LongTermHistoricalBaselineQueryResult | null {
  assertLongTermHistoricalBaseline(baseline);
  if (!isRecord(query) || typeof query.fingerprint !== "string") {
    throw new TypeError("Invalid long-term historical baseline query.");
  }
  if (query.regime !== "all" && !isDailyMarketRegime(query.regime)) {
    throw new TypeError("Invalid long-term historical baseline query regime.");
  }
  const entry = baseline.fingerprints.find(
    (candidate) => candidate.fingerprint === query.fingerprint,
  );
  if (!entry) {
    return null;
  }

  return {
    schemaVersion: baseline.schemaVersion,
    algorithmVersion: baseline.algorithmVersion,
    eventStudyAlgorithmVersion: baseline.eventStudyAlgorithmVersion,
    regimeAlgorithmVersion: baseline.regimeAlgorithmVersion,
    episodeAlgorithmVersion: baseline.episodeAlgorithmVersion,
    asset: baseline.asset,
    symbol: baseline.symbol,
    quoteCurrency: baseline.quoteCurrency,
    interval: baseline.interval,
    fingerprint: entry.fingerprint,
    regime: query.regime,
    source: baseline.source,
    dailyRegimeSource: baseline.dailyRegimeSource,
    statistics:
      query.regime === "all" ? entry.all : entry.regimes[query.regime],
  };
}

export function assertDailyMarketRegimeSeries(
  value: unknown,
): asserts value is DailyMarketRegimeSeries {
  if (!isRecord(value)) {
    throw new TypeError("Invalid daily market regime series.");
  }
  if (
    value.schemaVersion !== DAILY_MARKET_REGIME_SCHEMA_VERSION ||
    value.algorithmVersion !== DAILY_MARKET_REGIME_ALGORITHM_VERSION ||
    value.episodeAlgorithmVersion !==
      DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION ||
    !isAsset(value.asset) ||
    !isMatchingSymbol(value.asset, value.symbol) ||
    value.quoteCurrency !== "USDT" ||
    value.interval !== "1d" ||
    !isSafeCount(value.sourceCandleCount, 200) ||
    !isSafeCount(value.pointCount, 1) ||
    value.sourceCandleCount !== value.pointCount + 199 ||
    !isRecord(value.range) ||
    !isRecord(value.regimeSummary) ||
    !Array.isArray(value.episodes) ||
    !isRecord(value.episodeDistributions) ||
    !isRecord(value.terminal) ||
    !Array.isArray(value.points) ||
    value.points.length !== value.pointCount
  ) {
    throw new TypeError("Invalid daily market regime series.");
  }

  const duration = chartIntervalMilliseconds["1d"];
  const sourceFrom = parseCanonicalTimestamp(
    value.range.sourceFromOpenedAt,
    "Daily regime source start",
  );
  const sourceTo = parseCanonicalTimestamp(
    value.range.sourceToClosedAt,
    "Daily regime source end",
  );
  const firstRegime = parseCanonicalTimestamp(
    value.range.firstRegimeOpenedAt,
    "Daily regime first point",
  );
  const lastRegime = parseCanonicalTimestamp(
    value.range.lastRegimeClosedAt,
    "Daily regime last point",
  );
  if (
    firstRegime - sourceFrom !== 199 * duration ||
    sourceTo !== lastRegime ||
    sourceTo - sourceFrom !== value.sourceCandleCount * duration - 1
  ) {
    throw new TypeError("Invalid daily market regime range.");
  }

  let previousOpenedAt: number | null = null;
  for (const point of value.points) {
    if (!isRecord(point)) {
      throw new TypeError("Invalid daily market regime point.");
    }
    const openedAt = parseCanonicalTimestamp(
      point.openedAt,
      "Daily regime openedAt",
    );
    const closedAt = parseCanonicalTimestamp(
      point.closedAt,
      "Daily regime closedAt",
    );
    assertPositiveFinite(point.close, "Daily regime close");
    assertPositiveFinite(point.ema50, "Daily regime EMA50");
    assertPositiveFinite(point.ema200, "Daily regime EMA200");
    if (
      openedAt % duration !== 0 ||
      closedAt - openedAt !== duration - 1 ||
      (previousOpenedAt !== null && openedAt - previousOpenedAt !== duration) ||
      !isDailyMarketRegime(point.regime) ||
      point.regime !==
        classifyDailyMarketRegime(point.close, point.ema50, point.ema200)
    ) {
      throw new TypeError("Invalid daily market regime point.");
    }
    previousOpenedAt = openedAt;
  }
  const typedPoints = value.points as unknown as readonly DailyMarketRegimePoint[];
  if (
    typedPoints[0].openedAt !== value.range.firstRegimeOpenedAt ||
    typedPoints.at(-1)!.closedAt !== value.range.lastRegimeClosedAt
  ) {
    throw new TypeError("Invalid daily market regime range endpoints.");
  }
  assertRegimeSummary(
    value.regimeSummary,
    value.pointCount,
    firstRegime + duration - 1,
    lastRegime,
    summarizeDailyMarketRegimes(typedPoints),
  );
  assertDailyMarketRegimeEpisodes(
    value.episodes,
    value.range.lastRegimeClosedAt,
    typedPoints.at(-1)!.regime,
    typedPoints[0].closedAt,
  );
  const expectedEpisodes = buildDailyMarketRegimeEpisodes(typedPoints);
  if (JSON.stringify(value.episodes) !== JSON.stringify(expectedEpisodes)) {
    throw new TypeError("Daily regime episodes do not match their points.");
  }
  assertDailyMarketRegimeEpisodeDistributions(
    value.episodeDistributions,
    value.episodes,
  );
  assertDailyMarketRegimeTerminal(value.terminal);
  const lastPoint = typedPoints.at(-1)!;
  if (
    value.terminal.asset !== value.asset ||
    value.terminal.symbol !== value.symbol ||
    value.terminal.quoteCurrency !== value.quoteCurrency ||
    value.terminal.closedAt !== lastPoint.closedAt ||
    value.terminal.close !== lastPoint.close ||
    value.terminal.ema50 !== lastPoint.ema50 ||
    value.terminal.ema200 !== lastPoint.ema200 ||
    value.terminal.regime !== lastPoint.regime
  ) {
    throw new TypeError("Daily market regime terminal does not match its series.");
  }
}

export function assertDailyMarketRegimeTerminal(
  value: unknown,
): asserts value is DailyMarketRegimeTerminal {
  if (
    !isRecord(value) ||
    value.algorithmVersion !== DAILY_MARKET_REGIME_ALGORITHM_VERSION ||
    !isAsset(value.asset) ||
    !isMatchingSymbol(value.asset, value.symbol) ||
    value.quoteCurrency !== "USDT" ||
    !isDailyMarketRegime(value.regime)
  ) {
    throw new TypeError("Invalid daily market regime terminal.");
  }
  const closedAt = parseCanonicalTimestamp(
    value.closedAt,
    "Daily regime terminal closedAt",
  );
  assertPositiveFinite(value.close, "Daily regime terminal close");
  assertPositiveFinite(value.ema50, "Daily regime terminal EMA50");
  assertPositiveFinite(value.ema200, "Daily regime terminal EMA200");
  if (
    (closedAt + 1) % chartIntervalMilliseconds["1d"] !== 0 ||
    value.regime !==
      classifyDailyMarketRegime(value.close, value.ema50, value.ema200)
  ) {
    throw new TypeError("Invalid daily market regime terminal state.");
  }
}

export function assertLongTermHistoricalBaseline(
  value: unknown,
): asserts value is LongTermHistoricalBaseline {
  if (!isRecord(value)) {
    throw new TypeError("Invalid long-term historical baseline.");
  }
  if (
    value.schemaVersion !== LONG_TERM_HISTORICAL_BASELINE_SCHEMA_VERSION ||
    value.algorithmVersion !== LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION ||
    value.eventStudyAlgorithmVersion !== HISTORICAL_CONTEXT_ALGORITHM_VERSION ||
    value.regimeAlgorithmVersion !== DAILY_MARKET_REGIME_ALGORITHM_VERSION ||
    value.episodeAlgorithmVersion !==
      DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION ||
    !isAsset(value.asset) ||
    !isMatchingSymbol(value.asset, value.symbol) ||
    value.quoteCurrency !== "USDT" ||
    (value.interval !== "1h" &&
      value.interval !== "4h" &&
      value.interval !== "1d") ||
    !isRecord(value.source) ||
    !isRecord(value.dailyRegimeSource) ||
    !isRecord(value.events) ||
    !Array.isArray(value.fingerprints) ||
    !isSafeCount(value.fingerprintCount, 1) ||
    value.fingerprints.length !== value.fingerprintCount
  ) {
    throw new TypeError("Invalid long-term historical baseline.");
  }

  const sourceFrom = parseCanonicalTimestamp(
    value.source.fromOpenedAt,
    "Historical baseline source start",
  );
  const sourceTo = parseCanonicalTimestamp(
    value.source.toClosedAt,
    "Historical baseline source end",
  );
  const duration = chartIntervalMilliseconds[value.interval];
  if (
    !isSafeCount(value.source.sourceRowCount, 50) ||
    !isSafeCount(value.source.closedCandleCount, 50) ||
    !isSafeCount(value.source.excludedUnalignedCandleCount, 0) ||
    !isSafeCount(
      value.source.excludedLegacyZeroVolumePlaceholderCount,
      0,
    ) ||
    value.source.sourceRowCount !==
      value.source.closedCandleCount +
        value.source.excludedUnalignedCandleCount +
        value.source.excludedLegacyZeroVolumePlaceholderCount ||
    !isSafeCount(value.source.segmentCount, 1) ||
    value.source.segmentCount > value.source.closedCandleCount ||
    !isSafeCount(value.source.gapCount, 0) ||
    value.source.gapCount !== value.source.segmentCount - 1 ||
    !isSafeCount(value.source.missingCandleCount, 0) ||
    value.source.missingCandleCount < value.source.gapCount ||
    sourceFrom % duration !== 0 ||
    sourceTo - sourceFrom !==
      (value.source.closedCandleCount + value.source.missingCandleCount) *
        duration -
        1 ||
    (value.interval === "1d" &&
      (value.source.segmentCount !== 1 ||
        value.source.gapCount !== 0 ||
        value.source.missingCandleCount !== 0 ||
        value.source.excludedUnalignedCandleCount !== 0 ||
        value.source.excludedLegacyZeroVolumePlaceholderCount !== 0))
  ) {
    throw new TypeError("Invalid historical baseline source range.");
  }
  const dailyFrom = parseCanonicalTimestamp(
    value.dailyRegimeSource.fromOpenedAt,
    "Historical baseline daily source start",
  );
  const dailyTo = parseCanonicalTimestamp(
    value.dailyRegimeSource.toClosedAt,
    "Historical baseline daily source end",
  );
  if (
    value.dailyRegimeSource.episodeAlgorithmVersion !==
      DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION ||
    !isSafeCount(value.dailyRegimeSource.sourceCandleCount, 200) ||
    !isSafeCount(value.dailyRegimeSource.pointCount, 1) ||
    value.dailyRegimeSource.sourceCandleCount !==
      value.dailyRegimeSource.pointCount + 199 ||
    !isRecord(value.dailyRegimeSource.regimeSummary) ||
    !Array.isArray(value.dailyRegimeSource.episodes) ||
    !isRecord(value.dailyRegimeSource.episodeDistributions) ||
    !isRecord(value.dailyRegimeSource.terminal) ||
    dailyFrom % chartIntervalMilliseconds["1d"] !== 0 ||
    dailyTo - dailyFrom !==
      value.dailyRegimeSource.sourceCandleCount *
        chartIntervalMilliseconds["1d"] -
        1
  ) {
    throw new TypeError("Invalid historical baseline daily source range.");
  }
  assertRegimeSummary(
    value.dailyRegimeSource.regimeSummary,
    value.dailyRegimeSource.pointCount as number,
    dailyFrom + 200 * chartIntervalMilliseconds["1d"] - 1,
    dailyTo,
  );
  assertDailyMarketRegimeTerminal(value.dailyRegimeSource.terminal);
  assertDailyMarketRegimeEpisodes(
    value.dailyRegimeSource.episodes,
    new Date(dailyTo).toISOString(),
    value.dailyRegimeSource.terminal.regime,
    new Date(
      dailyFrom + 200 * chartIntervalMilliseconds["1d"] - 1,
    ).toISOString(),
  );
  assertDailyMarketRegimeEpisodeDistributions(
    value.dailyRegimeSource.episodeDistributions,
    value.dailyRegimeSource.episodes,
  );
  const archivedRegimeSummary = value.dailyRegimeSource
    .regimeSummary as DailyMarketRegimeSummary;
  for (const regime of DAILY_MARKET_REGIMES) {
    const episodes = value.dailyRegimeSource.episodes.filter(
      (episode) => episode.regime === regime,
    );
    const summary = archivedRegimeSummary[regime];
    if (
      episodes.length !== summary.segmentCount ||
      episodes.reduce(
        (total, episode) => total + episode.closedDailyCandleCount,
        0,
      ) !== summary.dailyCandleCount
    ) {
      throw new TypeError(
        "Daily regime episodes do not match the archived regime summary.",
      );
    }
  }
  const terminal = value.dailyRegimeSource.terminal;
  const terminalSummary = value.dailyRegimeSource.regimeSummary[
    terminal.regime
  ];
  if (
    !isRecord(terminalSummary) ||
    terminal.asset !== value.asset ||
    terminal.symbol !== value.symbol ||
    terminal.quoteCurrency !== value.quoteCurrency ||
    terminal.closedAt !== value.dailyRegimeSource.toClosedAt ||
    terminalSummary.lastClosedAt !== terminal.closedAt
  ) {
    throw new TypeError("Historical baseline daily terminal is inconsistent.");
  }

  for (const key of [
    "candidateEventCount",
    "completeEventCount",
    "excludedIncompleteEventCount",
    "unclassifiedEventCount",
  ] as const) {
    if (!isSafeCount(value.events[key], 0)) {
      throw new TypeError("Invalid historical baseline event counts.");
    }
  }
  const candidateEventCount = value.events.candidateEventCount as number;
  const serializedCompleteEventCount = value.events.completeEventCount as number;
  const excludedIncompleteEventCount =
    value.events.excludedIncompleteEventCount as number;
  const serializedUnclassifiedEventCount =
    value.events.unclassifiedEventCount as number;
  if (
    candidateEventCount - serializedCompleteEventCount !==
      excludedIncompleteEventCount ||
    serializedCompleteEventCount > candidateEventCount ||
    serializedUnclassifiedEventCount > serializedCompleteEventCount
  ) {
    throw new TypeError("Inconsistent historical baseline event counts.");
  }

  let previousFingerprint: string | null = null;
  let completeEventCount = 0;
  let unclassifiedEventCount = 0;
  for (const entry of value.fingerprints) {
    if (!isRecord(entry)) {
      throw new TypeError("Invalid historical baseline fingerprint.");
    }
    assertFingerprintDescriptor(entry);
    if (
    previousFingerprint !== null &&
      entry.fingerprint <= previousFingerprint
    ) {
      throw new TypeError("Historical baseline fingerprints must be unique and sorted.");
    }
    previousFingerprint = entry.fingerprint;
    const all = assertBaselineCohort(entry.all, sourceFrom, sourceTo);
    if (!isRecord(entry.regimes)) {
      throw new TypeError("Invalid historical baseline regime cohorts.");
    }
    const bull = assertBaselineCohort(entry.regimes.bull, sourceFrom, sourceTo);
    const bear = assertBaselineCohort(entry.regimes.bear, sourceFrom, sourceTo);
    const transition = assertBaselineCohort(
      entry.regimes.transition,
      sourceFrom,
      sourceTo,
    );
    if (
      !isSafeCount(entry.unclassifiedEventCount, 0) ||
      bull + bear + transition + entry.unclassifiedEventCount !== all
    ) {
      throw new TypeError("Inconsistent historical baseline regime counts.");
    }
    completeEventCount += all;
    unclassifiedEventCount += entry.unclassifiedEventCount;
  }
  if (
    completeEventCount !== serializedCompleteEventCount ||
    unclassifiedEventCount !== serializedUnclassifiedEventCount
  ) {
    throw new TypeError("Inconsistent historical baseline aggregate counts.");
  }
}

function summarizeBaselineCohort(
  observations: readonly HistoricalContextEventObservation[],
): HistoricalBaselineCohort {
  const summary = summarizeHistoricalContextEventObservations(observations);
  return {
    status: summary.status,
    eventCount: summary.eventCount,
    eventRange: summary.eventRange,
    horizons: summary.horizons,
  };
}

function emptyRegimeObservations(): Record<
  DailyMarketRegime,
  HistoricalContextEventObservation[]
> {
  return { bull: [], bear: [], transition: [] };
}

function appendHistoricalObservations(
  target: Map<string, HistoricalContextEventObservation[]>,
  fingerprint: string,
  observations: readonly HistoricalContextEventObservation[],
): void {
  if (observations.length === 0) {
    return;
  }
  const existing = target.get(fingerprint) ?? [];
  existing.push(...observations);
  target.set(fingerprint, existing);
}

function assertBaselineCohort(
  value: unknown,
  sourceFrom: number,
  sourceTo: number,
): number {
  if (
    !isRecord(value) ||
    (value.status !== "sufficient" && value.status !== "insufficient") ||
    !isSafeCount(value.eventCount, 0) ||
    !Array.isArray(value.horizons) ||
    value.horizons.length !== HISTORICAL_CONTEXT_HORIZONS.length
  ) {
    throw new TypeError("Invalid historical baseline cohort.");
  }
  if (value.eventCount === 0) {
    if (value.eventRange !== null) {
      throw new TypeError("An empty historical baseline cohort cannot have a range.");
    }
  } else {
    if (!isRecord(value.eventRange)) {
      throw new TypeError("Historical baseline cohort range is required.");
    }
    const first = parseCanonicalTimestamp(
      value.eventRange.firstEventOpenedAt,
      "Historical baseline first event",
    );
    const last = parseCanonicalTimestamp(
      value.eventRange.lastEventOpenedAt,
      "Historical baseline last event",
    );
    if (first < sourceFrom || last < first || last > sourceTo) {
      throw new TypeError("Invalid historical baseline cohort range.");
    }
  }

  for (const [index, bars] of HISTORICAL_CONTEXT_HORIZONS.entries()) {
    const horizon = value.horizons[index];
    if (
      !isRecord(horizon) ||
      horizon.bars !== bars ||
      horizon.sampleCount !== value.eventCount ||
      !isSafeCount(horizon.independentSampleCount, 0) ||
      horizon.independentSampleCount > value.eventCount
    ) {
      throw new TypeError("Invalid historical baseline horizon counts.");
    }
    const statisticKeys = [
      "medianReturnPercent",
      "q25ReturnPercent",
      "q75ReturnPercent",
      "maxUpsidePercent",
      "maxDownsidePercent",
    ] as const;
    if (value.eventCount === 0) {
      if (
        statisticKeys.some((key) => horizon[key] !== null) ||
        horizon.positiveReturnRatePercent !== null
      ) {
        throw new TypeError("An empty historical baseline horizon must be null.");
      }
    } else {
      if (statisticKeys.some((key) => !isFiniteNumber(horizon[key]))) {
        throw new TypeError("Historical baseline statistics must be finite.");
      }
      if (
        (horizon.q25ReturnPercent as number) >
          (horizon.medianReturnPercent as number) ||
        (horizon.medianReturnPercent as number) >
          (horizon.q75ReturnPercent as number)
      ) {
        throw new TypeError("Historical baseline quantiles are inconsistent.");
      }
      if (
        horizon.independentSampleCount <
        HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
      ) {
        if (horizon.positiveReturnRatePercent !== null) {
          throw new TypeError("Insufficient independent samples cannot have a rate.");
        }
      } else if (
        !isFiniteNumber(horizon.positiveReturnRatePercent) ||
        horizon.positiveReturnRatePercent < 0 ||
        horizon.positiveReturnRatePercent > 100
      ) {
        throw new TypeError("Invalid historical baseline direction share.");
      }
    }
  }
  const expectedStatus =
    value.horizons.at(-1)!.independentSampleCount >=
    HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
      ? "sufficient"
      : "insufficient";
  if (value.status !== expectedStatus) {
    throw new TypeError("Historical baseline cohort status is inconsistent.");
  }
  return value.eventCount;
}

function assertFingerprintDescriptor(
  value: Record<string, unknown>,
): asserts value is Record<string, unknown> &
  Pick<
    HistoricalBaselineFingerprint,
    "fingerprint" | "priceRelations" | "ordering"
  > {
  if (
    typeof value.fingerprint !== "string" ||
    !isRecord(value.priceRelations) ||
    !isPriceRelation(value.priceRelations.ema10) ||
    !isPriceRelation(value.priceRelations.ema20) ||
    !isPriceRelation(value.priceRelations.ema50) ||
    !isRecord(value.ordering) ||
    !isOrdering(value.ordering.state) ||
    typeof value.ordering.expression !== "string" ||
    value.ordering.expression.length === 0
  ) {
    throw new TypeError("Invalid historical baseline fingerprint descriptor.");
  }
  const normalizedOrdering = value.ordering.expression.replaceAll(" ", "");
  if (!isValidOrderingExpression(normalizedOrdering, value.ordering.state)) {
    throw new TypeError("Invalid historical baseline EMA ordering expression.");
  }
  const expected = `price:${value.priceRelations.ema10},${value.priceRelations.ema20},${value.priceRelations.ema50}|order:${value.ordering.state}:${normalizedOrdering}`;
  if (value.fingerprint !== expected) {
    throw new TypeError("Historical baseline fingerprint does not match its state.");
  }
}

function resolveDailyMarketRegimeAtUnchecked(
  series: DailyMarketRegimeSeries,
  eventClosedAt: number,
): ResolvedDailyMarketRegime | null {
  let lower = 0;
  let upper = series.points.length - 1;
  let match: DailyMarketRegimePoint | null = null;
  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);
    const point = series.points[middle];
    if (Date.parse(point.closedAt) <= eventClosedAt) {
      match = point;
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
  return match === null
    ? null
    : {
        regime: match.regime,
        dailyOpenedAt: match.openedAt,
        dailyClosedAt: match.closedAt,
        close: match.close,
        ema50: match.ema50,
        ema200: match.ema200,
      };
}

function assertClosedContiguousCandles(
  candles: readonly ChartCandle[],
  label: string,
): void {
  assertChartSeries(candles);
  const reference = candles[0];
  for (const [index, candle] of candles.entries()) {
    if (
      candle.state !== "closed" ||
      candle.asset !== reference.asset ||
      candle.symbol !== reference.symbol ||
      candle.interval !== reference.interval ||
      candle.quoteCurrency !== reference.quoteCurrency ||
      (index > 0 &&
        Date.parse(candle.openedAt) - Date.parse(candles[index - 1].openedAt) !==
          chartIntervalMilliseconds[reference.interval])
    ) {
      throw new TypeError(`${label} candles must be closed, contiguous, and share one scope.`);
    }
  }
}

function assertHistoricalBaselineSegments(
  segments: readonly (readonly ChartCandle[])[],
): LongTermHistoricalBaseline["source"] {
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    throw new TypeError("Historical baseline segments must be non-empty.");
  }
  const first = segments[0][0];
  const duration = chartIntervalMilliseconds[first.interval];
  let closedCandleCount = 0;
  let missingCandleCount = 0;
  let previousLast: ChartCandle | null = null;

  for (const [segmentIndex, segment] of segments.entries()) {
    assertClosedContiguousCandles(
      segment,
      segments.length === 1
        ? "historical baseline"
        : `historical baseline segment ${segmentIndex + 1}`,
    );
    const segmentFirst = segment[0];
    if (
      segmentFirst.asset !== first.asset ||
      segmentFirst.symbol !== first.symbol ||
      segmentFirst.interval !== first.interval ||
      segmentFirst.quoteCurrency !== first.quoteCurrency
    ) {
      throw new TypeError(
        "Historical baseline segments must share one scope.",
      );
    }
    if (previousLast !== null) {
      const openedAtDelta =
        Date.parse(segmentFirst.openedAt) - Date.parse(previousLast.openedAt);
      const missingAtBoundary = openedAtDelta / duration - 1;
      if (
        openedAtDelta <= duration ||
        openedAtDelta % duration !== 0 ||
        !Number.isSafeInteger(missingAtBoundary) ||
        missingAtBoundary < 1
      ) {
        throw new TypeError(
          "Historical baseline segments must be chronologically ordered and separated by whole missing candles.",
        );
      }
      missingCandleCount += missingAtBoundary;
    }
    closedCandleCount += segment.length;
    previousLast = segment.at(-1)!;
  }

  if (first.interval === "1d" && segments.length !== 1) {
    throw new TypeError(
      "A 1d historical baseline must remain one contiguous segment.",
    );
  }
  const last = segments.at(-1)!.at(-1)!;
  return {
    sourceRowCount: closedCandleCount,
    closedCandleCount,
    excludedUnalignedCandleCount: 0,
    excludedLegacyZeroVolumePlaceholderCount: 0,
    segmentCount: segments.length,
    gapCount: segments.length - 1,
    missingCandleCount,
    fromOpenedAt: first.openedAt,
    toClosedAt: last.closedAt,
  };
}

function applyHistoricalBaselineSourceAudit(
  source: LongTermHistoricalBaseline["source"],
  audit: HistoricalBaselineSourceAudit | undefined,
): LongTermHistoricalBaseline["source"] {
  if (audit === undefined) {
    return source;
  }
  if (
    !Number.isSafeInteger(audit.sourceRowCount) ||
    !Number.isSafeInteger(audit.excludedUnalignedCandleCount) ||
    !Number.isSafeInteger(
      audit.excludedLegacyZeroVolumePlaceholderCount,
    ) ||
    audit.sourceRowCount < 1 ||
    audit.excludedUnalignedCandleCount < 0 ||
    audit.excludedLegacyZeroVolumePlaceholderCount < 0 ||
    audit.sourceRowCount !==
      source.closedCandleCount +
        audit.excludedUnalignedCandleCount +
        audit.excludedLegacyZeroVolumePlaceholderCount
  ) {
    throw new TypeError(
      "Historical baseline source-row audit does not match accepted candles.",
    );
  }
  return {
    ...source,
    sourceRowCount: audit.sourceRowCount,
    excludedUnalignedCandleCount: audit.excludedUnalignedCandleCount,
    excludedLegacyZeroVolumePlaceholderCount:
      audit.excludedLegacyZeroVolumePlaceholderCount,
  };
}

function assertMatchingRegimeScope(
  candle: ChartCandle,
  series: DailyMarketRegimeSeries,
): void {
  if (
    candle.asset !== series.asset ||
    candle.symbol !== series.symbol ||
    candle.quoteCurrency !== series.quoteCurrency
  ) {
    throw new TypeError("Historical candles and daily regimes must share one scope.");
  }
}

function assertDailyRegimeCoverageRange(
  source: LongTermHistoricalBaseline["source"],
  series: DailyMarketRegimeSeries,
): void {
  const firstCandleOpenedAt = Date.parse(source.fromOpenedAt);
  const latestCandleClosedAt = Date.parse(source.toClosedAt);
  const dailyDuration = chartIntervalMilliseconds["1d"];
  const latestRequiredDailyCloseAt =
    Math.floor((latestCandleClosedAt + 1) / dailyDuration) * dailyDuration - 1;
  if (
    Date.parse(series.range.sourceFromOpenedAt) > firstCandleOpenedAt ||
    Date.parse(series.range.sourceToClosedAt) < latestRequiredDailyCloseAt
  ) {
    throw new TypeError("Daily regime history does not cover the historical baseline.");
  }
}

export function buildDailyMarketRegimeEpisodes(
  points: readonly DailyMarketRegimePoint[],
): readonly DailyMarketRegimeEpisode[] {
  if (points.length === 0) {
    return [];
  }
  const episodes: DailyMarketRegimeEpisode[] = [];
  let startIndex = 0;
  for (let index = 1; index <= points.length; index += 1) {
    const prior = points[index - 1];
    const next = points[index];
    if (next !== undefined && next.regime === prior.regime) {
      continue;
    }
    episodes.push(buildDailyMarketRegimeEpisode(
      points.slice(startIndex, index),
      startIndex === 0 ? "first_classifiable" : "regime_change",
      next === undefined ? "coverage_end" : "regime_change",
    ));
    startIndex = index;
  }
  return episodes;
}

export function summarizeDailyMarketRegimeEpisodeDistributions(
  episodes: readonly DailyMarketRegimeEpisode[],
): DailyMarketRegimeEpisodeDistributions {
  const complete = episodes.filter(
    (episode) =>
      episode.startedBy === "regime_change" &&
      episode.endedBy === "regime_change",
  );
  const summarize = (
    regime: DailyMarketRegime,
  ): DailyMarketRegimeEpisodeDistribution => {
    const cohort = complete.filter((episode) => episode.regime === regime);
    return {
      sampleCount: cohort.length,
      durationDays: summarizeEpisodeMetric(
        cohort.map((episode) => episode.durationDays),
      ),
      returnPercent: summarizeEpisodeMetric(
        cohort.map((episode) => episode.returnPercent),
      ),
      peakCloseReturnPercent: summarizeEpisodeMetric(
        cohort.map((episode) => episode.peakCloseReturnPercent),
      ),
      maxDrawdownPercent: summarizeEpisodeMetric(
        cohort.map((episode) => episode.maxDrawdownPercent),
      ),
    };
  };
  return {
    bull: summarize("bull"),
    bear: summarize("bear"),
    transition: summarize("transition"),
  };
}

function buildDailyMarketRegimeEpisode(
  points: readonly DailyMarketRegimePoint[],
  startedBy: DailyMarketRegimeEpisodeBoundary,
  endedBy: DailyMarketRegimeEpisodeEnd,
): DailyMarketRegimeEpisode {
  if (points.length === 0) {
    throw new TypeError("A daily market regime episode requires observations.");
  }
  const first = points[0];
  const last = points.at(-1)!;
  let peakClose = first.close;
  let maxDrawdownPercent = 0;
  for (const point of points) {
    if (point.regime !== first.regime) {
      throw new TypeError("A daily market regime episode cannot mix regimes.");
    }
    peakClose = Math.max(peakClose, point.close);
    maxDrawdownPercent = Math.max(
      maxDrawdownPercent,
      ((peakClose - point.close) / peakClose) * 100,
    );
  }
  return {
    regime: first.regime,
    startedAt: first.closedAt,
    endedAt: last.closedAt,
    startedBy,
    endedBy,
    durationDays: points.length,
    closedDailyCandleCount: points.length,
    startClose: first.close,
    endClose: last.close,
    returnPercent: percentChange(last.close, first.close),
    peakCloseReturnPercent: percentChange(peakClose, first.close),
    maxDrawdownPercent,
  };
}

function extendDailyMarketRegimeEpisode(
  episode: DailyMarketRegimeEpisode,
  point: DailyMarketRegimePoint,
): DailyMarketRegimeEpisode {
  if (
    episode.endedBy !== "coverage_end" ||
    point.regime !== episode.regime ||
    Date.parse(point.closedAt) - Date.parse(episode.endedAt) !==
      chartIntervalMilliseconds["1d"]
  ) {
    throw new TypeError("Daily regime episode continuation must be adjacent.");
  }
  const priorPeakClose = episode.startClose *
    (1 + episode.peakCloseReturnPercent / 100);
  const peakClose = Math.max(priorPeakClose, point.close);
  const drawdownPercent = ((peakClose - point.close) / peakClose) * 100;
  return {
    ...episode,
    endedAt: point.closedAt,
    durationDays: episode.durationDays + 1,
    closedDailyCandleCount: episode.closedDailyCandleCount + 1,
    endClose: point.close,
    returnPercent: percentChange(point.close, episode.startClose),
    peakCloseReturnPercent: percentChange(peakClose, episode.startClose),
    maxDrawdownPercent: Math.max(
      episode.maxDrawdownPercent,
      drawdownPercent,
    ),
  };
}

function summarizeEpisodeMetric(
  values: readonly number[],
): DailyMarketRegimeMetricDistribution {
  return values.length === 0
    ? { median: null, q25: null, q75: null }
    : {
        median: episodeQuantile(values, 0.5),
        q25: episodeQuantile(values, 0.25),
        q75: episodeQuantile(values, 0.75),
      };
}

function episodeQuantile(
  values: readonly number[],
  probability: number,
): number {
  if (values.length === 0 || probability < 0 || probability > 1) {
    throw new RangeError("A regime episode quantile needs finite samples.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  const result = lower + (upper - lower) * (position - lowerIndex);
  if (!Number.isFinite(result)) {
    throw new TypeError("Daily regime episode statistics must be finite.");
  }
  return result;
}

function percentChange(value: number, basis: number): number {
  const result = ((value - basis) / basis) * 100;
  if (!Number.isFinite(result)) {
    throw new TypeError("Daily regime episode return must be finite.");
  }
  return result;
}

function assertDailyMarketRegimeEpisodes(
  value: unknown,
  expectedLastClosedAt: string,
  expectedTerminalRegime: DailyMarketRegime,
  expectedFirstClosedAt?: string,
): asserts value is readonly DailyMarketRegimeEpisode[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Daily regime episodes must be a non-empty array.");
  }
  const duration = chartIntervalMilliseconds["1d"];
  let previous: DailyMarketRegimeEpisode | null = null;
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) {
      throw new TypeError("Invalid daily regime episode.");
    }
    assertExactObjectKeys(candidate, [
      "closedDailyCandleCount",
      "durationDays",
      "endClose",
      "endedAt",
      "endedBy",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "regime",
      "returnPercent",
      "startClose",
      "startedAt",
      "startedBy",
    ]);
    const startedAt = parseCanonicalTimestamp(
      candidate.startedAt,
      "Daily regime episode start",
    );
    const endedAt = parseCanonicalTimestamp(
      candidate.endedAt,
      "Daily regime episode end",
    );
    if (
      !isDailyMarketRegime(candidate.regime) ||
      (candidate.startedBy !== "first_classifiable" &&
        candidate.startedBy !== "regime_change") ||
      (candidate.endedBy !== "regime_change" &&
        candidate.endedBy !== "coverage_end") ||
      !isSafeCount(candidate.durationDays, 1) ||
      candidate.closedDailyCandleCount !== candidate.durationDays ||
      !isFiniteNumber(candidate.returnPercent) ||
      !isFiniteNumber(candidate.peakCloseReturnPercent) ||
      !isFiniteNumber(candidate.maxDrawdownPercent)
    ) {
      throw new TypeError("Invalid daily regime episode fields.");
    }
    assertPositiveFinite(candidate.startClose, "Episode start close");
    assertPositiveFinite(candidate.endClose, "Episode end close");
    if (
      endedAt - startedAt !==
        (candidate.closedDailyCandleCount - 1) * duration ||
      !approximatelyEqual(
        candidate.returnPercent,
        percentChange(candidate.endClose, candidate.startClose),
      ) ||
      candidate.peakCloseReturnPercent <
        Math.max(0, candidate.returnPercent) - 1e-10 ||
      candidate.maxDrawdownPercent < 0 ||
      candidate.maxDrawdownPercent >= 100
    ) {
      throw new TypeError("Invalid daily regime episode metrics.");
    }
    if (index === 0) {
      if (candidate.startedBy !== "first_classifiable") {
        throw new TypeError("The first regime episode must be left-censored.");
      }
    } else if (
      candidate.startedBy !== "regime_change" ||
      previous === null ||
      previous.endedBy !== "regime_change" ||
      candidate.regime === previous.regime ||
      startedAt - Date.parse(previous.endedAt) !== duration
    ) {
      throw new TypeError("Daily regime episodes must be adjacent transitions.");
    }
    if (
      index === value.length - 1
        ? candidate.endedBy !== "coverage_end"
        : candidate.endedBy !== "regime_change"
    ) {
      throw new TypeError("Only the final regime episode may be right-censored.");
    }
    previous = candidate as unknown as DailyMarketRegimeEpisode;
  }
  const last = value.at(-1) as unknown as DailyMarketRegimeEpisode;
  const first = value[0] as unknown as DailyMarketRegimeEpisode;
  if (
    (expectedFirstClosedAt !== undefined &&
      first.startedAt !== expectedFirstClosedAt) ||
    last.endedAt !== expectedLastClosedAt ||
    last.regime !== expectedTerminalRegime
  ) {
    throw new TypeError("Daily regime episode terminal is inconsistent.");
  }
}

function assertDailyMarketRegimeEpisodeDistributions(
  value: unknown,
  episodes: readonly DailyMarketRegimeEpisode[],
): asserts value is DailyMarketRegimeEpisodeDistributions {
  if (!isRecord(value)) {
    throw new TypeError("Invalid daily regime episode distributions.");
  }
  assertExactObjectKeys(value, [...DAILY_MARKET_REGIMES]);
  for (const regime of DAILY_MARKET_REGIMES) {
    const distribution = value[regime];
    if (!isRecord(distribution)) {
      throw new TypeError("Invalid daily regime episode distribution.");
    }
    assertExactObjectKeys(distribution, [
      "durationDays",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "returnPercent",
      "sampleCount",
    ]);
    if (!isSafeCount(distribution.sampleCount, 0)) {
      throw new TypeError("Invalid daily regime episode sample count.");
    }
    for (const key of [
      "durationDays",
      "returnPercent",
      "peakCloseReturnPercent",
      "maxDrawdownPercent",
    ] as const) {
      assertDailyMarketRegimeMetricDistribution(
        distribution[key],
        distribution.sampleCount,
        key,
      );
    }
  }
  const expected = summarizeDailyMarketRegimeEpisodeDistributions(episodes);
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new TypeError(
      "Daily regime episode distributions do not match complete episodes.",
    );
  }
}

function assertDailyMarketRegimeMetricDistribution(
  value: unknown,
  sampleCount: number,
  key:
    | "durationDays"
    | "returnPercent"
    | "peakCloseReturnPercent"
    | "maxDrawdownPercent",
): void {
  if (!isRecord(value)) {
    throw new TypeError("Invalid daily regime episode metric distribution.");
  }
  assertExactObjectKeys(value, ["median", "q25", "q75"]);
  if (sampleCount === 0) {
    if (value.median !== null || value.q25 !== null || value.q75 !== null) {
      throw new TypeError("Empty episode distributions must use null metrics.");
    }
    return;
  }
  if (
    !isFiniteNumber(value.median) ||
    !isFiniteNumber(value.q25) ||
    !isFiniteNumber(value.q75) ||
    value.q25 > value.median ||
    value.median > value.q75 ||
    (key === "durationDays" && value.q25 < 1) ||
    ((key === "peakCloseReturnPercent" || key === "maxDrawdownPercent") &&
      value.q25 < 0)
  ) {
    throw new TypeError("Invalid daily regime episode metric quantiles.");
  }
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <=
    Number.EPSILON * 16 * Math.max(1, Math.abs(left), Math.abs(right));
}

function assertExactObjectKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError("Daily regime episode contains unexpected fields.");
  }
}

function summarizeDailyMarketRegimes(
  points: readonly DailyMarketRegimePoint[],
): DailyMarketRegimeSummary {
  const mutable: Record<
    DailyMarketRegime,
    {
      dailyCandleCount: number;
      segmentCount: number;
      firstClosedAt: string | null;
      lastClosedAt: string | null;
    }
  > = {
    bull: { dailyCandleCount: 0, segmentCount: 0, firstClosedAt: null, lastClosedAt: null },
    bear: { dailyCandleCount: 0, segmentCount: 0, firstClosedAt: null, lastClosedAt: null },
    transition: { dailyCandleCount: 0, segmentCount: 0, firstClosedAt: null, lastClosedAt: null },
  };
  let previous: DailyMarketRegime | null = null;
  for (const point of points) {
    const summary = mutable[point.regime];
    summary.dailyCandleCount += 1;
    if (previous !== point.regime) {
      summary.segmentCount += 1;
    }
    summary.firstClosedAt ??= point.closedAt;
    summary.lastClosedAt = point.closedAt;
    previous = point.regime;
  }
  return mutable;
}

function toDailyMarketRegimeTerminal(
  point: DailyMarketRegimePoint,
  scope: Pick<ChartCandle, "asset" | "symbol" | "quoteCurrency">,
): DailyMarketRegimeTerminal {
  return {
    algorithmVersion: DAILY_MARKET_REGIME_ALGORITHM_VERSION,
    asset: scope.asset,
    symbol: scope.symbol,
    quoteCurrency: scope.quoteCurrency,
    closedAt: point.closedAt,
    close: point.close,
    ema50: point.ema50,
    ema200: point.ema200,
    regime: point.regime,
  };
}

function assertRegimeSummary(
  value: Record<string, unknown>,
  expectedPointCount: number,
  minimumClosedAt: number,
  maximumClosedAt: number,
  expected?: DailyMarketRegimeSummary,
): void {
  let dailyCandleCount = 0;
  let segmentCount = 0;
  for (const regime of DAILY_MARKET_REGIMES) {
    const summary = value[regime];
    if (
      !isRecord(summary) ||
      !isSafeCount(summary.dailyCandleCount, 0) ||
      !isSafeCount(summary.segmentCount, 0) ||
      summary.segmentCount > summary.dailyCandleCount
    ) {
      throw new TypeError("Invalid daily market regime summary counts.");
    }
    if (summary.dailyCandleCount === 0) {
      if (
        summary.segmentCount !== 0 ||
        summary.firstClosedAt !== null ||
        summary.lastClosedAt !== null
      ) {
        throw new TypeError("An empty daily regime summary must have null dates.");
      }
    } else {
      if (summary.segmentCount < 1) {
        throw new TypeError("A populated daily regime requires a segment.");
      }
      const first = parseCanonicalTimestamp(
        summary.firstClosedAt,
        "Daily regime summary first close",
      );
      const last = parseCanonicalTimestamp(
        summary.lastClosedAt,
        "Daily regime summary last close",
      );
      if (
        first < minimumClosedAt ||
        last < first ||
        last > maximumClosedAt
      ) {
        throw new TypeError("Invalid daily regime summary range.");
      }
    }
    if (
      expected &&
      (summary.dailyCandleCount !== expected[regime].dailyCandleCount ||
        summary.segmentCount !== expected[regime].segmentCount ||
        summary.firstClosedAt !== expected[regime].firstClosedAt ||
        summary.lastClosedAt !== expected[regime].lastClosedAt)
    ) {
      throw new TypeError("Daily regime summary does not match its points.");
    }
    dailyCandleCount += summary.dailyCandleCount;
    segmentCount += summary.segmentCount;
  }
  if (
    dailyCandleCount !== expectedPointCount ||
    segmentCount < 1 ||
    segmentCount > expectedPointCount
  ) {
    throw new TypeError("Inconsistent daily market regime summary.");
  }
}

function isValidOrderingExpression(
  expression: string,
  state: HistoricalContextOrdering,
): boolean {
  if (state === "short_above_long") {
    return expression === "EMA10>EMA20>EMA50";
  }
  if (state === "short_below_long") {
    return expression === "EMA50>EMA20>EMA10";
  }
  const match = expression.match(
    /^(EMA10|EMA20|EMA50)(>|=)(EMA10|EMA20|EMA50)(>|=)(EMA10|EMA20|EMA50)$/,
  );
  if (!match) {
    return false;
  }
  const labels = [match[1], match[3], match[5]];
  return (
    new Set(labels).size === 3 &&
    expression !== "EMA10>EMA20>EMA50" &&
    expression !== "EMA50>EMA20>EMA10"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAsset(value: unknown): value is Asset {
  return value === "btc" || value === "eth";
}

function isMatchingSymbol(asset: Asset, symbol: unknown): boolean {
  return symbol === (asset === "btc" ? "BTCUSDT" : "ETHUSDT");
}

function isDailyMarketRegime(value: unknown): value is DailyMarketRegime {
  return value === "bull" || value === "bear" || value === "transition";
}

function isPriceRelation(
  value: unknown,
): value is HistoricalContextPriceRelation {
  return value === "above" || value === "below" || value === "equal";
}

function isOrdering(value: unknown): value is HistoricalContextOrdering {
  return (
    value === "short_above_long" ||
    value === "short_below_long" ||
    value === "mixed"
  );
}

function isSafeCount(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertPositiveFinite(value: unknown, label: string): asserts value is number {
  if (!isFiniteNumber(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
}

function parseCanonicalTimestamp(value: unknown, label: string): number {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be an ISO timestamp.`);
  }
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new TypeError(`${label} must be a canonical ISO timestamp.`);
  }
  return timestamp;
}
