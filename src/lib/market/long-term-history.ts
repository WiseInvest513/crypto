import type {
  DailyMarketRegimeEpisode,
  DailyMarketRegimeEpisodeDistributions,
  DailyMarketRegime,
  DailyMarketRegimeSummary,
  HistoricalBaselineCohort,
  LongTermHistoricalBaselineInterval,
} from "./historical-baseline";
import {
  DAILY_MARKET_REGIME_ALGORITHM_VERSION,
  DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION,
  DAILY_MARKET_REGIMES,
  LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION,
} from "./historical-baseline";
import {
  HISTORICAL_CONTEXT_ALGORITHM_VERSION,
  HISTORICAL_CONTEXT_HORIZONS,
  HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
} from "./historical-context";
import type { Asset, CandleSymbol } from "@/server/data/contracts/market-data";

export const MARKET_CYCLE_TIMELINE_LIMIT = 7;

/** Public, compact asset-level daily cycle projection. */
export type MarketCycleAnalysis = Readonly<{
  asset: Asset;
  symbol: CandleSymbol;
  current: DailyMarketRegimeEpisode;
  /** At most seven episodes, chronological; the final item equals current. */
  timeline: readonly DailyMarketRegimeEpisode[];
  distributions: DailyMarketRegimeEpisodeDistributions;
  coverage: Readonly<{
    archiveFromOpenedAt: string;
    archiveToClosedAt: string;
    continuedToClosedAt: string;
    archivedEpisodeCount: number;
    completedEpisodeCount: number;
  }>;
  generatedAt: string;
  versions: Readonly<{
    artifactSchema: string;
    dataset: string;
    dailyDataset: string;
    regimeAlgorithm: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
    episodeAlgorithm: typeof DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION;
  }>;
}>;

/**
 * Small, public projection of the verified offline artifact. The complete
 * fingerprint table, archive file list, checksums and raw candles remain on
 * the server/offline build path and are never serialized to the browser.
 */
export type LongTermHistoryAnalysis = Readonly<{
  asset: Asset;
  symbol: CandleSymbol;
  interval: LongTermHistoricalBaselineInterval;
  current: Readonly<{
    fingerprint: string;
    /** Latest closed candle used to select the fingerprint. */
    closedAt: string;
    regime: DailyMarketRegime;
    /** Latest closed 1d candle available at `closedAt`; never a future day. */
    regimeAsOf: string;
    close: number;
    ema50: number;
    ema200: number;
  }>;
  cohorts: Readonly<{
    all: HistoricalBaselineCohort;
    sameRegime: HistoricalBaselineCohort;
  }>;
  /** Archived daily observations only; the live continuation is named below. */
  regimeSummary: DailyMarketRegimeSummary;
  coverage: Readonly<{
    event: Readonly<{
      closedCandleCount: number;
      fromOpenedAt: string;
      toClosedAt: string;
    }>;
    daily: Readonly<{
      sourceCandleCount: number;
      pointCount: number;
      fromOpenedAt: string;
      toClosedAt: string;
    }>;
    continuedToClosedAt: string;
  }>;
  generatedAt: string;
  versions: Readonly<{
    artifactSchema: string;
    dataset: string;
    eventDataset: string;
    dailyDataset: string;
    baselineAlgorithm: typeof LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION;
    eventStudyAlgorithm: typeof HISTORICAL_CONTEXT_ALGORITHM_VERSION;
    regimeAlgorithm: typeof DAILY_MARKET_REGIME_ALGORITHM_VERSION;
  }>;
}>;

export function assertMarketCycleAnalysis(
  value: unknown,
  expectedAsset?: Asset,
): asserts value is MarketCycleAnalysis {
  if (!isRecord(value)) throw new TypeError("Invalid market cycle analysis.");
  assertExactKeys(value, [
    "asset",
    "coverage",
    "current",
    "distributions",
    "generatedAt",
    "symbol",
    "timeline",
    "versions",
  ]);
  if (
    (value.asset !== "btc" && value.asset !== "eth") ||
    (expectedAsset !== undefined && value.asset !== expectedAsset) ||
    value.symbol !== `${String(value.asset).toUpperCase()}USDT` ||
    !Array.isArray(value.timeline) ||
    value.timeline.length < 1 ||
    value.timeline.length > MARKET_CYCLE_TIMELINE_LIMIT ||
    !isRecord(value.coverage) ||
    !isRecord(value.versions)
  ) {
    throw new TypeError("Invalid market cycle scope.");
  }
  assertCycleEpisode(value.current);
  let previous: DailyMarketRegimeEpisode | null = null;
  for (const candidate of value.timeline) {
    assertCycleEpisode(candidate);
    const episode = candidate as DailyMarketRegimeEpisode;
    if (
      previous !== null &&
      (Date.parse(episode.startedAt) - Date.parse(previous.endedAt) !==
        24 * 60 * 60 * 1_000 ||
        previous.endedBy !== "regime_change" ||
        episode.startedBy !== "regime_change" ||
        episode.regime === previous.regime)
    ) {
      throw new TypeError("Market cycle timeline must contain adjacent transitions.");
    }
    previous = episode;
  }
  const current = value.current as DailyMarketRegimeEpisode;
  const timelineCurrent = value.timeline.at(-1) as DailyMarketRegimeEpisode;
  if (
    current.endedBy !== "coverage_end" ||
    !sameCycleEpisode(current, timelineCurrent)
  ) {
    throw new TypeError("Market cycle timeline must end with current.");
  }

  assertCycleDistributions(value.distributions);
  assertExactKeys(value.coverage, [
    "archiveFromOpenedAt",
    "archiveToClosedAt",
    "archivedEpisodeCount",
    "completedEpisodeCount",
    "continuedToClosedAt",
  ]);
  const archiveFrom = parseTimestamp(value.coverage.archiveFromOpenedAt);
  const archiveTo = parseTimestamp(value.coverage.archiveToClosedAt);
  const continuedTo = parseTimestamp(value.coverage.continuedToClosedAt);
  if (
    archiveFrom > archiveTo ||
    continuedTo < archiveTo ||
    continuedTo !== Date.parse(current.endedAt) ||
    !isSafeCount(value.coverage.archivedEpisodeCount, 1) ||
    !isSafeCount(value.coverage.completedEpisodeCount, 0) ||
    value.coverage.completedEpisodeCount >
      value.coverage.archivedEpisodeCount +
        Math.max(0, Math.floor((continuedTo - archiveTo) / (24 * 60 * 60 * 1_000)))
  ) {
    throw new TypeError("Invalid market cycle coverage.");
  }
  const distributions = value.distributions as DailyMarketRegimeEpisodeDistributions;
  if (
    DAILY_MARKET_REGIMES.reduce(
      (total, regime) => total + distributions[regime].sampleCount,
      0,
    ) !== value.coverage.completedEpisodeCount
  ) {
    throw new TypeError("Market cycle completed count is inconsistent.");
  }

  parseTimestamp(value.generatedAt);
  assertExactKeys(value.versions, [
    "artifactSchema",
    "dailyDataset",
    "dataset",
    "episodeAlgorithm",
    "regimeAlgorithm",
  ]);
  if (
    typeof value.versions.artifactSchema !== "string" ||
    value.versions.artifactSchema.length === 0 ||
    !isSha256(value.versions.dataset) ||
    !isSha256(value.versions.dailyDataset) ||
    value.versions.regimeAlgorithm !== DAILY_MARKET_REGIME_ALGORITHM_VERSION ||
    value.versions.episodeAlgorithm !==
      DAILY_MARKET_REGIME_EPISODE_ALGORITHM_VERSION
  ) {
    throw new TypeError("Invalid market cycle versions.");
  }
}

export function assertLongTermHistoryAnalysis(
  value: unknown,
  expected?: Readonly<{
    asset: Asset;
    interval: LongTermHistoricalBaselineInterval;
  }>,
): asserts value is LongTermHistoryAnalysis {
  if (!isRecord(value)) throw new TypeError("Invalid long-term history analysis.");
  if (
    (value.asset !== "btc" && value.asset !== "eth") ||
    value.symbol !== `${String(value.asset).toUpperCase()}USDT` ||
    (value.interval !== "1h" && value.interval !== "4h" && value.interval !== "1d") ||
    (expected !== undefined &&
      (value.asset !== expected.asset || value.interval !== expected.interval)) ||
    !isRecord(value.current) ||
    !isRecord(value.cohorts) ||
    !isRecord(value.regimeSummary) ||
    !isRecord(value.coverage) ||
    !isRecord(value.versions)
  ) {
    throw new TypeError("Invalid long-term history analysis scope.");
  }

  if (
    typeof value.current.fingerprint !== "string" ||
    value.current.fingerprint.length === 0 ||
    !isRegime(value.current.regime) ||
    !isPositiveFinite(value.current.close) ||
    !isPositiveFinite(value.current.ema50) ||
    !isPositiveFinite(value.current.ema200)
  ) {
    throw new TypeError("Invalid current long-term history state.");
  }
  const currentClosedAt = parseTimestamp(value.current.closedAt);
  const regimeAsOf = parseTimestamp(value.current.regimeAsOf);
  if (regimeAsOf > currentClosedAt) {
    throw new TypeError("Long-term history regime uses a future daily candle.");
  }

  assertCohort(value.cohorts.all);
  assertCohort(value.cohorts.sameRegime);
  assertRegimeSummary(value.regimeSummary);

  if (
    !isRecord(value.coverage.event) ||
    !isSafeCount(value.coverage.event.closedCandleCount, 50) ||
    !isRecord(value.coverage.daily) ||
    !isSafeCount(value.coverage.daily.sourceCandleCount, 200) ||
    !isSafeCount(value.coverage.daily.pointCount, 1) ||
    value.coverage.daily.sourceCandleCount !== value.coverage.daily.pointCount + 199
  ) {
    throw new TypeError("Invalid long-term history coverage.");
  }
  const eventFrom = parseTimestamp(value.coverage.event.fromOpenedAt);
  const eventTo = parseTimestamp(value.coverage.event.toClosedAt);
  const dailyFrom = parseTimestamp(value.coverage.daily.fromOpenedAt);
  const dailyTo = parseTimestamp(value.coverage.daily.toClosedAt);
  const continuedTo = parseTimestamp(value.coverage.continuedToClosedAt);
  if (
    eventFrom > eventTo ||
    dailyFrom > dailyTo ||
    continuedTo < dailyTo ||
    continuedTo !== regimeAsOf
  ) {
    throw new TypeError("Invalid long-term history coverage order.");
  }

  parseTimestamp(value.generatedAt);
  if (
    typeof value.versions.artifactSchema !== "string" ||
    value.versions.artifactSchema.length === 0 ||
    !isSha256(value.versions.dataset) ||
    !isSha256(value.versions.eventDataset) ||
    !isSha256(value.versions.dailyDataset) ||
    value.versions.baselineAlgorithm !== LONG_TERM_HISTORICAL_BASELINE_ALGORITHM_VERSION ||
    value.versions.eventStudyAlgorithm !== HISTORICAL_CONTEXT_ALGORITHM_VERSION ||
    value.versions.regimeAlgorithm !== DAILY_MARKET_REGIME_ALGORITHM_VERSION
  ) {
    throw new TypeError("Invalid long-term history versions.");
  }
}

function assertCohort(value: unknown): asserts value is HistoricalBaselineCohort {
  if (
    !isRecord(value) ||
    (value.status !== "sufficient" && value.status !== "insufficient") ||
    !isSafeCount(value.eventCount, 0) ||
    !Array.isArray(value.horizons) ||
    value.horizons.length !== HISTORICAL_CONTEXT_HORIZONS.length
  ) {
    throw new TypeError("Invalid historical baseline cohort.");
  }
  if (value.eventRange === null) {
    if (value.eventCount !== 0) throw new TypeError("Invalid cohort event range.");
  } else {
    if (!isRecord(value.eventRange) || value.eventCount === 0) {
      throw new TypeError("Invalid cohort event range.");
    }
    if (
      parseTimestamp(value.eventRange.firstEventOpenedAt) >
      parseTimestamp(value.eventRange.lastEventOpenedAt)
    ) {
      throw new TypeError("Invalid cohort event order.");
    }
  }
  for (const [index, horizon] of value.horizons.entries()) {
    if (
      !isRecord(horizon) ||
      horizon.bars !== HISTORICAL_CONTEXT_HORIZONS[index] ||
      !isSafeCount(horizon.sampleCount, 0) ||
      !isSafeCount(horizon.independentSampleCount, 0) ||
      horizon.independentSampleCount > horizon.sampleCount ||
      horizon.sampleCount !== value.eventCount ||
      horizon.minimumDirectionSampleCount !== undefined
    ) {
      throw new TypeError("Invalid historical baseline horizon.");
    }
    for (const key of [
      "medianReturnPercent",
      "q25ReturnPercent",
      "q75ReturnPercent",
      "maxUpsidePercent",
      "maxDownsidePercent",
      "positiveReturnRatePercent",
    ] as const) {
      if (!isNullableFinite(horizon[key])) {
        throw new TypeError("Invalid historical baseline statistic.");
      }
    }
    const positiveReturnRatePercent = horizon.positiveReturnRatePercent as number | null;
    if (value.eventCount === 0) {
      if (
        horizon.medianReturnPercent !== null ||
        horizon.q25ReturnPercent !== null ||
        horizon.q75ReturnPercent !== null ||
        horizon.maxUpsidePercent !== null ||
        horizon.maxDownsidePercent !== null ||
        positiveReturnRatePercent !== null
      ) {
        throw new TypeError("Empty baseline cohorts must contain null statistics.");
      }
    } else {
      if (
        typeof horizon.medianReturnPercent !== "number" ||
        typeof horizon.q25ReturnPercent !== "number" ||
        typeof horizon.q75ReturnPercent !== "number" ||
        typeof horizon.maxUpsidePercent !== "number" ||
        typeof horizon.maxDownsidePercent !== "number"
      ) {
        throw new TypeError("Non-empty baseline cohorts require statistics.");
      }
      const q25 = horizon.q25ReturnPercent as number;
      const median = horizon.medianReturnPercent as number;
      const q75 = horizon.q75ReturnPercent as number;
      if (q25 > median || median > q75) {
        throw new TypeError("Invalid historical baseline quantiles.");
      }
    }
    if (
      positiveReturnRatePercent !== null &&
      (horizon.independentSampleCount < HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES ||
        positiveReturnRatePercent < 0 ||
        positiveReturnRatePercent > 100)
    ) {
      throw new TypeError("Invalid historical baseline direction share.");
    }
  }
  const strictest = value.horizons.at(-1)!;
  const expectedStatus = strictest.independentSampleCount >= HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
    ? "sufficient"
    : "insufficient";
  if (value.status !== expectedStatus) {
    throw new TypeError("Invalid historical baseline sufficiency.");
  }
}

function assertRegimeSummary(value: Record<string, unknown>): void {
  for (const regime of DAILY_MARKET_REGIMES) {
    const summary = value[regime];
    if (
      !isRecord(summary) ||
      !isSafeCount(summary.dailyCandleCount, 0) ||
      !isSafeCount(summary.segmentCount, 0) ||
      summary.segmentCount > summary.dailyCandleCount
    ) {
      throw new TypeError("Invalid long-term regime summary.");
    }
    if (summary.dailyCandleCount === 0) {
      if (
        summary.segmentCount !== 0 ||
        summary.firstClosedAt !== null ||
        summary.lastClosedAt !== null
      ) {
        throw new TypeError("Invalid empty regime summary.");
      }
    } else if (
      typeof summary.firstClosedAt !== "string" ||
      typeof summary.lastClosedAt !== "string" ||
      parseTimestamp(summary.firstClosedAt) > parseTimestamp(summary.lastClosedAt)
    ) {
      throw new TypeError("Invalid regime summary range.");
    }
  }
}

function assertCycleEpisode(
  value: unknown,
): asserts value is DailyMarketRegimeEpisode {
  if (!isRecord(value)) throw new TypeError("Invalid market cycle episode.");
  assertExactKeys(value, [
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
  const startedAt = parseTimestamp(value.startedAt);
  const endedAt = parseTimestamp(value.endedAt);
  if (
    !isRegime(value.regime) ||
    (value.startedBy !== "first_classifiable" &&
      value.startedBy !== "regime_change") ||
    (value.endedBy !== "regime_change" && value.endedBy !== "coverage_end") ||
    !isSafeCount(value.durationDays, 1) ||
    value.closedDailyCandleCount !== value.durationDays ||
    endedAt - startedAt !==
      (value.durationDays - 1) * 24 * 60 * 60 * 1_000 ||
    !isPositiveFinite(value.startClose) ||
    !isPositiveFinite(value.endClose) ||
    !isFiniteNumber(value.returnPercent) ||
    !isFiniteNumber(value.peakCloseReturnPercent) ||
    !isFiniteNumber(value.maxDrawdownPercent) ||
    Math.abs(
      value.returnPercent -
        ((value.endClose - value.startClose) / value.startClose) * 100,
    ) > Number.EPSILON * 16 * Math.max(1, Math.abs(value.returnPercent)) ||
    value.peakCloseReturnPercent < Math.max(0, value.returnPercent) - 1e-10 ||
    value.maxDrawdownPercent < 0 ||
    value.maxDrawdownPercent >= 100
  ) {
    throw new TypeError("Invalid market cycle episode metrics.");
  }
}

function sameCycleEpisode(
  left: DailyMarketRegimeEpisode,
  right: DailyMarketRegimeEpisode,
): boolean {
  return left.regime === right.regime &&
    left.startedAt === right.startedAt &&
    left.endedAt === right.endedAt &&
    left.startedBy === right.startedBy &&
    left.endedBy === right.endedBy &&
    left.durationDays === right.durationDays &&
    left.closedDailyCandleCount === right.closedDailyCandleCount &&
    left.startClose === right.startClose &&
    left.endClose === right.endClose &&
    left.returnPercent === right.returnPercent &&
    left.peakCloseReturnPercent === right.peakCloseReturnPercent &&
    left.maxDrawdownPercent === right.maxDrawdownPercent;
}

function assertCycleDistributions(
  value: unknown,
): asserts value is DailyMarketRegimeEpisodeDistributions {
  if (!isRecord(value)) {
    throw new TypeError("Invalid market cycle distributions.");
  }
  assertExactKeys(value, [...DAILY_MARKET_REGIMES]);
  for (const regime of DAILY_MARKET_REGIMES) {
    const distribution = value[regime];
    if (!isRecord(distribution)) {
      throw new TypeError("Invalid market cycle distribution.");
    }
    assertExactKeys(distribution, [
      "durationDays",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "returnPercent",
      "sampleCount",
    ]);
    if (!isSafeCount(distribution.sampleCount, 0)) {
      throw new TypeError("Invalid market cycle distribution count.");
    }
    for (const key of [
      "durationDays",
      "returnPercent",
      "peakCloseReturnPercent",
      "maxDrawdownPercent",
    ] as const) {
      const metric = distribution[key];
      if (!isRecord(metric)) {
        throw new TypeError("Invalid market cycle distribution metric.");
      }
      assertExactKeys(metric, ["median", "q25", "q75"]);
      if (distribution.sampleCount === 0) {
        if (metric.median !== null || metric.q25 !== null || metric.q75 !== null) {
          throw new TypeError("Empty market cycle metrics must be null.");
        }
      } else if (
        !isFiniteNumber(metric.median) ||
        !isFiniteNumber(metric.q25) ||
        !isFiniteNumber(metric.q75) ||
        metric.q25 > metric.median ||
        metric.median > metric.q75 ||
        (key === "durationDays" && metric.q25 < 1) ||
        ((key === "peakCloseReturnPercent" ||
          key === "maxDrawdownPercent") &&
          metric.q25 < 0)
      ) {
        throw new TypeError("Invalid market cycle distribution quantiles.");
      }
    }
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError("Unexpected market cycle fields.");
  }
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== "string") throw new TypeError("Invalid timestamp.");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError("Invalid canonical timestamp.");
  }
  return timestamp;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRegime(value: unknown): value is DailyMarketRegime {
  return typeof value === "string" && (DAILY_MARKET_REGIMES as readonly string[]).includes(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFinite(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isSafeCount(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
