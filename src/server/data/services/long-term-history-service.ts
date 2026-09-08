import "server-only";

import { createHash } from "node:crypto";
import bundledManifestDocument from "../../../../data/history-baselines/v2/manifest.json";
import bundledArtifactDocument from "../generated/historical-baselines.json";
import { PRODUCTION_SITE_URL } from "@/config/site";
import {
  HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
  assertHistoricalBaselineBuildManifest,
  findHistoricalBaseline,
  parseHistoricalBaselineRuntimeArtifact,
  type HistoricalBaselineBuildManifest,
  type HistoricalBaselineRuntimeArtifact,
} from "@/lib/market/historical-baseline-artifact";
import {
  advanceDailyMarketRegimeEpisodesFromTerminal,
  queryLongTermHistoricalBaseline,
  type AdvancedDailyMarketRegimeEpisodes,
  type LongTermHistoricalBaseline,
  type LongTermHistoricalBaselineInterval,
} from "@/lib/market/historical-baseline";
import type { HistoricalContextAnalysis } from "@/lib/market/historical-context";
import {
  MARKET_CYCLE_TIMELINE_LIMIT,
  assertMarketCycleAnalysis,
  assertLongTermHistoryAnalysis,
  type LongTermHistoryAnalysis,
  type MarketCycleAnalysis,
} from "@/lib/market/long-term-history";
import {
  assertChartSeries,
  chartIntervalMilliseconds,
} from "@/lib/market/live-chart";
import {
  chartCandleCapability,
  longTermHistoryCapability,
  marketCycleCapability,
  type Asset,
  type AvailableMarketDatum,
  type ChartCandle,
  type ChartCandleInterval,
  type DataScope,
  type DataSource,
  type MarketDatum,
  type UnavailableReason,
} from "../contracts/market-data";
import { ProviderError } from "../errors/provider-error";
import { binanceSpotSource } from "../providers/sources";
import {
  createErrorDatum,
  isAvailableMarketDatum,
} from "./market-datum-utils";

export type LongTermHistoryDependencies = Readonly<{
  /** Test-only/document injection. Production uses the statically bundled pair. */
  artifact?: unknown;
  manifest?: unknown;
  now?: () => number;
}>;

const ARCHIVE_SOURCE: DataSource = {
  id: "binance-public-data-archive",
  label: "Binance Public Data",
  url: "https://data.binance.vision",
};

const DERIVED_SOURCE: DataSource = {
  id: "wise-crypto-long-term-history",
  label: "Wise Crypto 跨周期机械统计",
  url: PRODUCTION_SITE_URL,
};

const CYCLE_DERIVED_SOURCE: DataSource = {
  id: "wise-crypto-market-cycle",
  label: "Wise Crypto 牛熊周期机械统计",
  url: PRODUCTION_SITE_URL,
};

let parsedBundledArtifact: HistoricalBaselineRuntimeArtifact | null | undefined;

/**
 * Projects the verified daily archive into a compact current-cycle datum. It
 * is deliberately independent of the selected intraday interval and recent
 * EMA fingerprint, so a 15m request or a fingerprint failure cannot hide the
 * asset-level daily cycle.
 */
export function deriveMarketCycleDatum(
  asset: Asset,
  dailyCandles: MarketDatum<readonly ChartCandle[]>,
  dependencies: LongTermHistoryDependencies = {},
): MarketDatum<MarketCycleAnalysis> {
  const capability = marketCycleCapability(asset);
  const now = dependencies.now ?? Date.now;
  const scope = marketCycleScope(asset);
  const safeSource = expectedCycleSource();
  const artifact = readRuntimeArtifact(
    dependencies.artifact,
    dependencies.manifest,
  );
  if (artifact === null) {
    return unavailableCycle(
      capability,
      safeSource,
      scope,
      "no_data",
      dailyCandles.retrievedAt,
    );
  }

  let entry: ReturnType<typeof findHistoricalBaseline>;
  try {
    assertArtifactClock(artifact, now());
    entry = findHistoricalBaseline(artifact, asset, "1d");
  } catch {
    return unavailableCycle(
      capability,
      safeSource,
      scope,
      "no_data",
      dailyCandles.retrievedAt,
    );
  }

  if (!isAvailableMarketDatum(dailyCandles)) {
    if (dailyCandles.status === "error") {
      return createErrorDatum(
        capability,
        safeSource,
        scope,
        new ProviderError(
          dailyCandles.error.code,
          dailyCandles.error.retryable,
        ),
        now,
        dailyCandles.error.code,
        dailyCandles.error.retryable,
      );
    }
    return unavailableCycle(
      capability,
      safeSource,
      scope,
      dailyCandles.reason,
      dailyCandles.retrievedAt,
    );
  }

  try {
    assertDailyInput(asset, dailyCandles, now());
    const latestClosed = dailyCandles.value.findLast(
      (candle) => candle.state === "closed",
    );
    if (latestClosed === undefined) {
      throw new ProviderError("no_data", true);
    }
    const advanced = extendDailyRegimeSource(
      entry.baseline.dailyRegimeSource,
      dailyCandles.value,
      latestClosed.closedAt,
    );
    const current = advanced.episodes.at(-1)!;
    const timeline = advanced.episodes.slice(-MARKET_CYCLE_TIMELINE_LIMIT);
    const completedEpisodeCount = Object.values(
      advanced.episodeDistributions,
    ).reduce((total, distribution) => total + distribution.sampleCount, 0);
    const value: MarketCycleAnalysis = {
      asset,
      symbol: entry.baseline.symbol,
      current,
      timeline,
      distributions: advanced.episodeDistributions,
      coverage: {
        archiveFromOpenedAt:
          entry.baseline.dailyRegimeSource.fromOpenedAt,
        archiveToClosedAt: entry.baseline.dailyRegimeSource.toClosedAt,
        continuedToClosedAt: advanced.terminal.closedAt,
        archivedEpisodeCount:
          entry.baseline.dailyRegimeSource.episodes.length,
        completedEpisodeCount,
      },
      generatedAt: artifact.generatedAt,
      versions: {
        artifactSchema: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
        dataset: artifact.datasetVersion,
        dailyDataset: entry.dailyDatasetVersion,
        regimeAlgorithm: entry.baseline.regimeAlgorithmVersion,
        episodeAlgorithm: entry.baseline.episodeAlgorithmVersion,
      },
    };
    assertMarketCycleAnalysis(value, asset);

    const stale =
      dailyCandles.status === "stale" ||
      dailyCandles.stale ||
      dailyCandles.error !== null;
    return {
      status: stale ? "stale" : "fresh",
      capability,
      value,
      source: cycleSource(dailyCandles),
      scope,
      updatedAt: current.endedAt,
      updatedAtKind: "source",
      retrievedAt: dailyCandles.retrievedAt,
      loading: false,
      stale,
      cache: dailyCandles.cache,
      error: dailyCandles.error,
      provenance: "derived",
      ...(dailyCandles.fallback
        ? { fallback: dailyCandles.fallback }
        : {}),
    };
  } catch (error) {
    const normalized = error instanceof ProviderError
      ? error
      : new ProviderError("invalid_payload", false);
    return createErrorDatum(
      capability,
      safeSource,
      scope,
      normalized,
      now,
      normalized.code,
      normalized.retryable,
    );
  }
}

/**
 * Resolves one exact current EMA fingerprint against a verified, compact
 * offline baseline. This function never downloads an archive at request time.
 */
export function deriveLongTermHistoryDatum(
  asset: Asset,
  interval: ChartCandleInterval,
  history: MarketDatum<HistoricalContextAnalysis>,
  dailyCandles: MarketDatum<readonly ChartCandle[]>,
  dependencies: LongTermHistoryDependencies = {},
): MarketDatum<LongTermHistoryAnalysis> {
  const capability = longTermHistoryCapability(asset);
  const now = dependencies.now ?? Date.now;
  const scope = longTermHistoryScope(asset, interval);
  const safeSource = expectedCombinedSource();

  if (interval === "15m") {
    return unavailable(capability, safeSource, scope, "unsupported", history.retrievedAt);
  }

  const artifact = readRuntimeArtifact(
    dependencies.artifact,
    dependencies.manifest,
  );
  if (artifact === null) {
    return unavailable(capability, safeSource, scope, "no_data", history.retrievedAt);
  }

  let entry: ReturnType<typeof findHistoricalBaseline>;
  try {
    assertArtifactClock(artifact, now());
    entry = findHistoricalBaseline(artifact, asset, interval);
  } catch {
    return unavailable(capability, safeSource, scope, "no_data", history.retrievedAt);
  }

  if (!isAvailableMarketDatum(history)) {
    return mirrorUnavailableOrError(
      capability,
      safeSource,
      scope,
      history,
      now,
    );
  }
  if (!isAvailableMarketDatum(dailyCandles)) {
    return createErrorDatum(
      capability,
      safeSource,
      scope,
      datumFailure(dailyCandles),
      now,
      dailyCandles.status === "error" ? dailyCandles.error.code : "no_data",
      dailyCandles.status === "error" ? dailyCandles.error.retryable : true,
    );
  }

  try {
    assertLiveInputs(asset, interval, history, dailyCandles, now());
    const source = combinedSource(history, dailyCandles);
    if (
      history.value.algorithmVersion !== entry.baseline.eventStudyAlgorithmVersion ||
      history.value.current.fingerprint.length === 0
    ) {
      throw new ProviderError("invalid_payload", false);
    }

    const currentRegime = extendDailyRegimeSource(
      entry.baseline.dailyRegimeSource,
      dailyCandles.value,
      history.value.current.closedAt,
      true,
    ).terminal;
    const all = queryLongTermHistoricalBaseline(entry.baseline, {
      fingerprint: history.value.current.fingerprint,
      regime: "all",
    });
    const sameRegime = queryLongTermHistoricalBaseline(entry.baseline, {
      fingerprint: history.value.current.fingerprint,
      regime: currentRegime.regime,
    });
    if (all === null || sameRegime === null) {
      return unavailable(
        capability,
        source,
        scope,
        "no_data",
        history.retrievedAt,
      );
    }

    const value: LongTermHistoryAnalysis = {
      asset,
      symbol: history.value.symbol,
      interval,
      current: {
        fingerprint: history.value.current.fingerprint,
        closedAt: history.value.current.closedAt,
        regime: currentRegime.regime,
        regimeAsOf: currentRegime.closedAt,
        close: currentRegime.close,
        ema50: currentRegime.ema50,
        ema200: currentRegime.ema200,
      },
      cohorts: {
        all: all.statistics,
        sameRegime: sameRegime.statistics,
      },
      regimeSummary: entry.baseline.dailyRegimeSource.regimeSummary,
      coverage: {
        event: {
          closedCandleCount: entry.baseline.source.closedCandleCount,
          fromOpenedAt: entry.baseline.source.fromOpenedAt,
          toClosedAt: entry.baseline.source.toClosedAt,
        },
        daily: {
          sourceCandleCount: entry.baseline.dailyRegimeSource.sourceCandleCount,
          pointCount: entry.baseline.dailyRegimeSource.pointCount,
          fromOpenedAt: entry.baseline.dailyRegimeSource.fromOpenedAt,
          toClosedAt: entry.baseline.dailyRegimeSource.toClosedAt,
        },
        continuedToClosedAt: currentRegime.closedAt,
      },
      generatedAt: artifact.generatedAt,
      versions: {
        artifactSchema: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
        dataset: artifact.datasetVersion,
        eventDataset: entry.eventDatasetVersion,
        dailyDataset: entry.dailyDatasetVersion,
        baselineAlgorithm: entry.baseline.algorithmVersion,
        eventStudyAlgorithm: entry.baseline.eventStudyAlgorithmVersion,
        regimeAlgorithm: entry.baseline.regimeAlgorithmVersion,
      },
    };
    assertLongTermHistoryAnalysis(value, { asset, interval });

    const stale =
      history.status === "stale" ||
      dailyCandles.status === "stale" ||
      history.stale ||
      dailyCandles.stale;
    return {
      status: stale ? "stale" : "fresh",
      capability,
      value,
      source,
      scope,
      updatedAt: history.value.current.closedAt,
      updatedAtKind: "source",
      // Anchor client expiry to the oldest live input. Repeated stale
      // responses must never manufacture a newer last-known-good lifetime.
      retrievedAt: olderTimestamp(history.retrievedAt, dailyCandles.retrievedAt),
      loading: false,
      stale,
      cache: mergeCache(history, dailyCandles),
      error: history.error ?? dailyCandles.error,
      provenance: "derived",
    };
  } catch (error) {
    const normalized = error instanceof ProviderError
      ? error
      : new ProviderError("invalid_payload", false);
    return createErrorDatum(
      capability,
      safeSource,
      scope,
      normalized,
      now,
      normalized.code,
      normalized.retryable,
    );
  }
}

function readRuntimeArtifact(
  injectedArtifact: unknown,
  injectedManifest: unknown,
): HistoricalBaselineRuntimeArtifact | null {
  const hasInjectedArtifact = injectedArtifact !== undefined;
  const hasInjectedManifest = injectedManifest !== undefined;
  if (hasInjectedArtifact !== hasInjectedManifest) return null;

  if (hasInjectedArtifact) {
    try {
      return parseRuntimeBundle(injectedArtifact, injectedManifest);
    } catch {
      return null;
    }
  }
  if (parsedBundledArtifact !== undefined) return parsedBundledArtifact;
  try {
    parsedBundledArtifact = parseRuntimeBundle(
      bundledArtifactDocument,
      bundledManifestDocument,
    );
  } catch {
    parsedBundledArtifact = null;
  }
  return parsedBundledArtifact;
}

function parseRuntimeBundle(
  artifactDocument: unknown,
  manifestDocument: unknown,
): HistoricalBaselineRuntimeArtifact | null {
  const artifact = parseHistoricalBaselineRuntimeArtifact(artifactDocument);
  if (artifact === null) return null;

  const serializedArtifact = `${JSON.stringify(artifact)}\n`;
  const artifactSha256 = createHash("sha256")
    .update(serializedArtifact)
    .digest("hex");
  assertHistoricalBaselineBuildManifest(manifestDocument, {
    artifactSha256,
    datasetVersion: artifact.datasetVersion,
  });
  const manifest = manifestDocument as HistoricalBaselineBuildManifest;
  if (
    manifest.artifact.bytes !== Buffer.byteLength(serializedArtifact) ||
    manifest.generatedAt !== artifact.generatedAt ||
    manifest.fromMonth !== artifact.fromMonth ||
    manifest.toMonth !== artifact.toMonth
  ) {
    throw new TypeError(
      "Historical baseline runtime artifact does not match its audit manifest.",
    );
  }
  return artifact;
}

function assertArtifactClock(
  artifact: HistoricalBaselineRuntimeArtifact,
  now: number,
): void {
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new TypeError("Invalid long-term history clock.");
  }
  if (Date.parse(artifact.generatedAt) > now) {
    throw new TypeError("Future historical baseline artifact.");
  }
}

function assertLiveInputs(
  asset: Asset,
  interval: LongTermHistoricalBaselineInterval,
  history: AvailableMarketDatum<HistoricalContextAnalysis>,
  dailyCandles: AvailableMarketDatum<readonly ChartCandle[]>,
  now: number,
): void {
  const historyRetrievedAt = Date.parse(history.retrievedAt);
  const dailyRetrievedAt = Date.parse(dailyCandles.retrievedAt);
  if (
    history.provenance !== "derived" ||
    dailyCandles.provenance !== "live" ||
    !isExpectedHistorySource(history.source) ||
    !isExactBinanceSpotSource(dailyCandles.source) ||
    history.value.asset !== asset ||
    history.value.symbol !== `${asset.toUpperCase()}USDT` ||
    history.value.interval !== interval ||
    history.value.current.closedAt !== history.value.latestClosedAt ||
    Date.parse(history.value.latestClosedAt) > now ||
    !Number.isFinite(historyRetrievedAt) ||
    !Number.isFinite(dailyRetrievedAt) ||
    historyRetrievedAt > now ||
    dailyRetrievedAt > now
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  assertChartSeries(dailyCandles.value);
  if (dailyCandles.value.length === 0) {
    throw new ProviderError("no_data", true);
  }
  for (const candle of dailyCandles.value) {
    if (
      candle.asset !== asset ||
      candle.symbol !== `${asset.toUpperCase()}USDT` ||
      candle.quoteCurrency !== "USDT" ||
      candle.interval !== "1d" ||
      Date.parse(candle.openedAt) > now ||
      (candle.state === "closed" && Date.parse(candle.closedAt) >= now)
    ) {
      throw new ProviderError("invalid_payload", false);
    }
  }
}

function assertDailyInput(
  asset: Asset,
  dailyCandles: AvailableMarketDatum<readonly ChartCandle[]>,
  now: number,
): void {
  const retrievedAt = Date.parse(dailyCandles.retrievedAt);
  if (
    dailyCandles.capability !== chartCandleCapability(asset) ||
    dailyCandles.provenance !== "live" ||
    !isExactBinanceSpotSource(dailyCandles.source) ||
    !Number.isFinite(retrievedAt) ||
    retrievedAt > now
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  assertChartSeries(dailyCandles.value);
  if (dailyCandles.value.length === 0) {
    throw new ProviderError("no_data", true);
  }
  let closedCount = 0;
  for (const candle of dailyCandles.value) {
    if (
      candle.asset !== asset ||
      candle.symbol !== `${asset.toUpperCase()}USDT` ||
      candle.quoteCurrency !== "USDT" ||
      candle.interval !== "1d" ||
      Date.parse(candle.openedAt) > now ||
      (candle.state === "closed" && Date.parse(candle.closedAt) >= now)
    ) {
      throw new ProviderError("invalid_payload", false);
    }
    if (candle.state === "closed") closedCount += 1;
  }
  if (closedCount === 0) {
    throw new ProviderError("no_data", true);
  }
}

function isExpectedHistorySource(source: DataSource): boolean {
  return source.id === "wise-crypto-historical-context" &&
    source.label === "Wise Crypto 近期历史情景计算" &&
    source.url === PRODUCTION_SITE_URL &&
    Array.isArray(source.components) &&
    source.components.length === 1 &&
    isExactBinanceSpotSource(source.components[0]) &&
    hasExactKeys(source, ["components", "id", "label", "url"]);
}

function isExactBinanceSpotSource(source: DataSource | null | undefined): boolean {
  return source !== null &&
    source !== undefined &&
    source.id === binanceSpotSource.id &&
    source.label === binanceSpotSource.label &&
    source.url === binanceSpotSource.url &&
    source.components === undefined &&
    hasExactKeys(source, ["id", "label", "url"]);
}

function hasExactKeys(
  value: object,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function extendDailyRegimeSource(
  archived: LongTermHistoricalBaseline["dailyRegimeSource"],
  dailyCandles: readonly ChartCandle[],
  cutoffClosedAt: string,
  cutoffIsEventTimestamp = false,
): AdvancedDailyMarketRegimeEpisodes {
  const dailyDuration = chartIntervalMilliseconds["1d"];
  const cutoffTimestamp = Date.parse(cutoffClosedAt);
  const terminalTimestamp = Date.parse(archived.terminal.closedAt);
  const requiredDailyCloseAt = cutoffIsEventTimestamp
    ? Math.floor((cutoffTimestamp + 1) / dailyDuration) * dailyDuration - 1
    : cutoffTimestamp;
  if (!Number.isFinite(cutoffTimestamp)) {
    throw new ProviderError("invalid_payload", false);
  }
  if (cutoffIsEventTimestamp && requiredDailyCloseAt < terminalTimestamp) {
    throw new ProviderError("invalid_payload", false);
  }
  if (requiredDailyCloseAt <= terminalTimestamp) {
    return advanceDailyMarketRegimeEpisodesFromTerminal(
      archived.terminal,
      archived.episodes,
      [],
    );
  }

  const continuation = dailyCandles.filter(
    (candle) =>
      candle.state === "closed" &&
      Date.parse(candle.closedAt) > terminalTimestamp &&
      Date.parse(candle.closedAt) <= requiredDailyCloseAt,
  );
  if (continuation.length === 0) {
    throw new ProviderError("no_data", true);
  }
  if (
    Date.parse(continuation[0].openedAt) !== terminalTimestamp + 1 ||
    Date.parse(continuation.at(-1)!.closedAt) !== requiredDailyCloseAt
  ) {
    throw new ProviderError("no_data", true);
  }
  try {
    return advanceDailyMarketRegimeEpisodesFromTerminal(
      archived.terminal,
      archived.episodes,
      continuation,
    );
  } catch {
    throw new ProviderError("invalid_payload", false);
  }
}

function mirrorUnavailableOrError<T>(
  capability: ReturnType<typeof longTermHistoryCapability>,
  source: DataSource,
  scope: DataScope,
  datum: MarketDatum<T>,
  now: () => number,
): MarketDatum<LongTermHistoryAnalysis> {
  if (datum.status === "error") {
    return createErrorDatum(
      capability,
      source,
      scope,
      new ProviderError(datum.error.code, datum.error.retryable),
      now,
      datum.error.code,
      datum.error.retryable,
    );
  }
  if (datum.status !== "unavailable") {
    return createErrorDatum(
      capability,
      source,
      scope,
      new ProviderError("invalid_payload", false),
      now,
      "invalid_payload",
      false,
    );
  }
  return unavailable(
    capability,
    source,
    scope,
    datum.reason,
    datum.retrievedAt,
  );
}

function unavailable(
  capability: ReturnType<typeof longTermHistoryCapability>,
  source: DataSource,
  scope: DataScope,
  reason: UnavailableReason,
  retrievedAt: string | null,
): MarketDatum<LongTermHistoryAnalysis> {
  return {
    status: "unavailable",
    capability,
    value: null,
    source,
    scope,
    updatedAt: null,
    retrievedAt,
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: null,
    reason,
  };
}

function unavailableCycle(
  capability: ReturnType<typeof marketCycleCapability>,
  source: DataSource,
  scope: DataScope,
  reason: UnavailableReason,
  retrievedAt: string | null,
): MarketDatum<MarketCycleAnalysis> {
  return {
    status: "unavailable",
    capability,
    value: null,
    source,
    scope,
    updatedAt: null,
    retrievedAt,
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: null,
    reason,
  };
}

function datumFailure<T>(datum: MarketDatum<T>): ProviderError {
  return datum.status === "error"
    ? new ProviderError(datum.error.code, datum.error.retryable)
    : new ProviderError("no_data", true);
}

function combinedSource<T, U>(
  history: MarketDatum<T>,
  dailyCandles: MarketDatum<U>,
): DataSource {
  const inputs = [ARCHIVE_SOURCE, history.source, dailyCandles.source].filter(
    (candidate): candidate is DataSource => candidate !== null,
  );
  const components = Array.from(
    new Map(inputs.map((candidate) => [`${candidate.id}:${candidate.url}`, candidate])).values(),
  );
  return { ...DERIVED_SOURCE, components };
}

function expectedCombinedSource(): DataSource {
  return {
    ...DERIVED_SOURCE,
    components: [
      ARCHIVE_SOURCE,
      {
        id: "wise-crypto-historical-context",
        label: "Wise Crypto 近期历史情景计算",
        url: PRODUCTION_SITE_URL,
        components: [binanceSpotSource],
      },
      binanceSpotSource,
    ],
  };
}

function cycleSource(
  dailyCandles: AvailableMarketDatum<readonly ChartCandle[]>,
): DataSource {
  return {
    ...CYCLE_DERIVED_SOURCE,
    components: [ARCHIVE_SOURCE, dailyCandles.source],
  };
}

function expectedCycleSource(): DataSource {
  return {
    ...CYCLE_DERIVED_SOURCE,
    components: [ARCHIVE_SOURCE, binanceSpotSource],
  };
}

function mergeCache<T, U>(
  history: AvailableMarketDatum<T>,
  dailyCandles: AvailableMarketDatum<U>,
): AvailableMarketDatum<T>["cache"] {
  return {
    status:
      history.cache.status === "hit" && dailyCandles.cache.status === "hit"
        ? "hit"
        : "miss",
    revalidateSeconds: Math.min(
      history.cache.revalidateSeconds,
      dailyCandles.cache.revalidateSeconds,
    ),
    staleIfErrorSeconds: Math.min(
      history.cache.staleIfErrorSeconds,
      dailyCandles.cache.staleIfErrorSeconds,
    ),
  };
}

function longTermHistoryScope(
  asset: Asset,
  interval: ChartCandleInterval,
): DataScope {
  return {
    kind: "derived",
    label: `${asset.toUpperCase()}USDT ${interval} 已完成周期 · 官方归档历史样本 · 日线 EMA50/EMA200 机械阶段`,
  };
}

function marketCycleScope(asset: Asset): DataScope {
  return {
    kind: "derived",
    label: `${asset.toUpperCase()}USDT 已闭合日线 · EMA50/EMA200 机械牛熊周期`,
  };
}

function olderTimestamp(first: string, second: string): string {
  return Date.parse(first) <= Date.parse(second) ? first : second;
}
