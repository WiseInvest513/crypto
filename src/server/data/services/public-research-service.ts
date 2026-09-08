import "server-only";

import { PRODUCTION_SITE_URL } from "@/config/site";
import { analyzeKeyLevels } from "@/lib/market/key-levels";
import {
  analyzeHistoricalContext,
  type HistoricalContextAnalysis,
} from "@/lib/market/historical-context";
import type { PublicResearchSnapshot } from "@/lib/market/public-research";
import {
  assertChartSeries,
  chartIntervalMilliseconds,
  chartTailNeedsFullRefresh,
  mergeChartCandles,
} from "@/lib/market/live-chart";
import {
  analyzeMultiTimeframeCandles,
  MULTI_TIMEFRAME_CANDLE_LIMIT,
  MULTI_TIMEFRAME_INTERVALS,
} from "@/lib/market/multi-timeframe";
import {
  chartCandleCapability,
  historicalContextCapability,
  keyLevelCapability,
  longTermHistoryCapability,
  marketCycleCapability,
  multiTimeframeCapability,
  type Asset,
  type AvailableMarketDatum,
  type ChartCandle,
  type ChartCandleInterval,
  type DataScope,
  type DataSource,
  type MarketCapability,
  type MarketDatum,
} from "../contracts/market-data";
import type { CandleProvider, MarketProviderRegistry } from "../contracts/providers";
import { ProviderError } from "../errors/provider-error";
import { getMarketProviderRegistry } from "../provider-registry";
import { binanceSpotSource } from "../providers/sources";
import {
  createErrorDatum,
  isAvailableMarketDatum,
  recoverSettled,
} from "./market-datum-utils";
import {
  deriveLongTermHistoryDatum,
  deriveMarketCycleDatum,
} from "./long-term-history-service";
export type { PublicResearchSnapshot } from "@/lib/market/public-research";

export type PublicResearchDependencies = Readonly<{
  getRegistry?: () => MarketProviderRegistry;
  historicalBaselineArtifact?: unknown;
  historicalBaselineManifest?: unknown;
  now?: () => number;
}>;

export const PUBLIC_RESEARCH_REFRESH_SECONDS = 60;
const LAST_GOOD_SECONDS = 300;
const FAILURE_BACKOFF_SECONDS = 15;
const TAIL_CANDLE_LIMIT = 3;
// Two assets × four allowlisted intervals. Provider identity is weakly held;
// user identity, request cookies and editorial content never enter this cache.
const MAX_PROVIDER_CACHE_ENTRIES = 8;
const cachePolicy = {
  revalidateSeconds: PUBLIC_RESEARCH_REFRESH_SECONDS,
  staleIfErrorSeconds: LAST_GOOD_SECONDS,
} as const;

type CandleDatum = MarketDatum<readonly ChartCandle[]>;
type AvailableCandles = AvailableMarketDatum<readonly ChartCandle[]>;
type CacheEntry = {
  result?: CandleDatum;
  good?: AvailableCandles;
  expiresAt: number;
  pending?: Promise<CandleDatum>;
};
const providerCaches = new WeakMap<CandleProvider, Map<string, CacheEntry>>();

/** Public objective facts only. Deliberately separate from the VIP service. */
export async function loadAssetResearchSnapshot(
  asset: Asset,
  interval: ChartCandleInterval,
  dependencies: PublicResearchDependencies = {},
): Promise<PublicResearchSnapshot> {
  assertResearchRequest(asset, interval);
  const now = dependencies.now ?? Date.now;
  let provider: CandleProvider;
  try {
    provider = (dependencies.getRegistry ?? getMarketProviderRegistry)().candles;
    assertBinanceSpotCandleProvider(provider);
  } catch (error) {
    return failedSnapshot(asset, interval, error, now);
  }

  const settled = await Promise.allSettled(
    MULTI_TIMEFRAME_INTERVALS.map((requestedInterval) =>
      readResearchCandles(provider, asset, requestedInterval, now),
    ),
  );
  const sources = settled.map((result, index) => recoverSettled(
    result,
    chartCandleCapability(asset),
    provider.source,
    sourceScope(asset, MULTI_TIMEFRAME_INTERVALS[index]),
    now,
  ));
  const selected = sources[MULTI_TIMEFRAME_INTERVALS.indexOf(interval)];
  const history = interval === "15m"
    ? unsupportedHistoricalContext(selected, asset, interval)
    : deriveDatum(
        selected,
        historicalContextCapability(asset),
        "historical-context",
        `${asset.toUpperCase()}USDT ${interval} 已完成周期 · 近 1000 根 EMA 情景回顾`,
        analyzeHistoricalContext,
        (value) => value.latestClosedAt,
      );
  const dailyCandles = sources[MULTI_TIMEFRAME_INTERVALS.indexOf("1d")];

  return {
    asset,
    interval,
    levels: deriveDatum(
      selected,
      keyLevelCapability(asset),
      "key-levels",
      `${asset.toUpperCase()}USDT ${interval} 已完成周期 · 客观关键位与成交分布估算`,
      analyzeKeyLevels,
      (value) => value.confirmedAt,
    ),
    history,
    cycle: deriveMarketCycleDatum(asset, dailyCandles, {
      now,
      ...(dependencies.historicalBaselineArtifact === undefined
        ? {}
        : { artifact: dependencies.historicalBaselineArtifact }),
      ...(dependencies.historicalBaselineManifest === undefined
        ? {}
        : { manifest: dependencies.historicalBaselineManifest }),
    }),
    longHistory: deriveLongTermHistoryDatum(
      asset,
      interval,
      history,
      dailyCandles,
      {
        now,
        ...(dependencies.historicalBaselineArtifact === undefined
          ? {}
          : { artifact: dependencies.historicalBaselineArtifact }),
        ...(dependencies.historicalBaselineManifest === undefined
          ? {}
          : { manifest: dependencies.historicalBaselineManifest }),
      },
    ),
    timeframes: sources.map((source, index) => {
      const timeframe = MULTI_TIMEFRAME_INTERVALS[index];
      return {
        interval: timeframe,
        datum: deriveDatum(
          source,
          multiTimeframeCapability(asset),
          "multi-timeframe",
          `${asset.toUpperCase()}USDT ${timeframe} 已完成周期 · EMA10/20/50/200 · 近 20 根区间`,
          analyzeMultiTimeframeCandles,
          (value) => value.latestClosedAt,
        ),
      };
    }),
  };
}

function assertResearchRequest(asset: Asset, interval: ChartCandleInterval): void {
  if ((asset !== "btc" && asset !== "eth") || !MULTI_TIMEFRAME_INTERVALS.includes(interval)) {
    throw new TypeError("Unsupported public research request.");
  }
}

async function readResearchCandles(
  provider: CandleProvider,
  asset: Asset,
  interval: ChartCandleInterval,
  now: () => number,
): Promise<CandleDatum> {
  let cache = providerCaches.get(provider);
  if (!cache) {
    cache = new Map();
    providerCaches.set(provider, cache);
  }
  const key = `${asset}:${interval}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = { expiresAt: 0 };
    cache.set(key, entry);
    while (cache.size > MAX_PROVIDER_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value!);
    }
  }
  if (entry.result && now() < entry.expiresAt) {
    return { ...entry.result, cache: { ...entry.result.cache, status: "hit" } };
  }
  if (entry.pending) return entry.pending;

  const pending = refreshResearchCandles(provider, asset, interval, entry, now);
  entry.pending = pending;
  try {
    return await pending;
  } finally {
    if (entry.pending === pending) entry.pending = undefined;
  }
}

async function refreshResearchCandles(
  provider: CandleProvider,
  asset: Asset,
  interval: ChartCandleInterval,
  entry: CacheEntry,
  now: () => number,
): Promise<CandleDatum> {
  const good = entry.good;
  const usableHistory = good && now() - Date.parse(good.retrievedAt) <= LAST_GOOD_SECONDS * 1_000;
  let result: CandleDatum;
  try {
    result = await provider.getChartCandles(asset, {
      interval,
      limit: usableHistory ? TAIL_CANDLE_LIMIT : MULTI_TIMEFRAME_CANDLE_LIMIT,
    });
    assertBinanceSpotDatumSource(result);
    if (isAvailableMarketDatum(result)) {
      assertUsableCandles(result, asset, interval, now());
      if (usableHistory) {
        if (
          result.source.id !== good.source.id ||
          result.source.url !== good.source.url ||
          chartTailNeedsFullRefresh(good.value, result.value) ||
          (good.value.at(-1)?.state === "forming" &&
            Date.parse(result.value[0].openedAt) > Date.parse(good.value.at(-1)!.openedAt))
        ) {
          // Never splice disjoint history or distinct providers into one series.
          result = await provider.getChartCandles(asset, {
            interval,
            limit: MULTI_TIMEFRAME_CANDLE_LIMIT,
          });
          assertBinanceSpotDatumSource(result);
        } else if (Date.parse(result.retrievedAt) < Date.parse(good.retrievedAt)) {
          // An upstream tail's stale cache must not roll already verified
          // history back or turn a confirmed candle into a forming candle.
          throw new ProviderError("no_data", true);
        } else {
          result = {
            ...result,
            value: mergeChartCandles(good.value, result.value, MULTI_TIMEFRAME_CANDLE_LIMIT),
          };
        }
      }
      if (isAvailableMarketDatum(result)) {
        assertUsableCandles(result, asset, interval, now());
        result = markDelayedResearch(result, interval, now());
      }
    }
  } catch (error) {
    result = createErrorDatum(chartCandleCapability(asset), provider.source, sourceScope(asset, interval), error, now);
  }

  if (result.status === "error" && result.error.retryable && usableHistory) {
    result = {
      ...good,
      status: "stale",
      stale: true,
      error: result.error,
      cache: { ...cachePolicy, status: "hit" },
    };
  }
  const completedAt = now();
  if (isAvailableMarketDatum(result) && result.status === "fresh") {
    entry.good = result;
  } else if (entry.good && completedAt - Date.parse(entry.good.retrievedAt) > LAST_GOOD_SECONDS * 1_000) {
    entry.good = undefined;
  }
  result = { ...result, cache: { ...cachePolicy, status: result.cache.status } };
  entry.result = result;
  const duration = chartIntervalMilliseconds[interval];
  const nextBoundary = (Math.floor(completedAt / duration) + 1) * duration;
  entry.expiresAt = Math.min(
    completedAt + (result.status === "fresh" ? PUBLIC_RESEARCH_REFRESH_SECONDS : FAILURE_BACKOFF_SECONDS) * 1_000,
    nextBoundary,
    isAvailableMarketDatum(result) && result.status === "stale"
      ? Date.parse(result.retrievedAt) + LAST_GOOD_SECONDS * 1_000
      : Number.POSITIVE_INFINITY,
  );
  return result;
}

function assertBinanceSpotCandleProvider(provider: CandleProvider): void {
  if (
    provider.id !== "binance-spot-candles" ||
    provider.mode !== "live" ||
    !isExactBinanceSpotSource(provider.source)
  ) {
    throw new ProviderError("invalid_payload", false);
  }
}

function assertBinanceSpotDatumSource(datum: CandleDatum): void {
  if (!isExactBinanceSpotSource(datum.source)) {
    throw new ProviderError("invalid_payload", false);
  }
}

function isExactBinanceSpotSource(source: DataSource | null): boolean {
  if (
    source === null ||
    source.id !== binanceSpotSource.id ||
    source.label !== binanceSpotSource.label ||
    source.url !== binanceSpotSource.url ||
    source.components !== undefined
  ) {
    return false;
  }
  const keys = Object.keys(source).sort();
  return keys.length === 3 &&
    keys.every((key, index) => key === ["id", "label", "url"][index]);
}

function assertUsableCandles(
  datum: AvailableCandles,
  asset: Asset,
  interval: ChartCandleInterval,
  now: number,
): void {
  if (datum.provenance === "synthetic") throw new ProviderError("invalid_payload", false);
  const retrievedAt = Date.parse(datum.retrievedAt);
  const updatedAt = Date.parse(datum.updatedAt);
  if (!Number.isFinite(retrievedAt) || !Number.isFinite(updatedAt) || retrievedAt > now || updatedAt > now) {
    throw new ProviderError("invalid_payload", false);
  }
  if (now - retrievedAt > LAST_GOOD_SECONDS * 1_000) throw new ProviderError("no_data", true);
  if (datum.value.length === 0) throw new ProviderError("no_data", true);
  if (datum.value.length > MULTI_TIMEFRAME_CANDLE_LIMIT) throw new ProviderError("invalid_payload", false);
  try {
    assertChartSeries(datum.value);
    for (const [index, candle] of datum.value.entries()) {
      if (
        candle.asset !== asset ||
        candle.symbol !== `${asset.toUpperCase()}USDT` ||
        candle.quoteCurrency !== "USDT" ||
        candle.interval !== interval ||
        Date.parse(candle.openedAt) > now ||
        (candle.state === "closed" && Date.parse(candle.closedAt) >= now) ||
        (index > 0 && Date.parse(candle.openedAt) - Date.parse(datum.value[index - 1].openedAt) !== chartIntervalMilliseconds[interval])
      ) throw new TypeError("Invalid research candle scope or clock.");
    }
  } catch {
    throw new ProviderError("invalid_payload", false);
  }
}

function markDelayedResearch(datum: AvailableCandles, interval: ChartCandleInterval, now: number): AvailableCandles {
  const latestClosed = datum.value.findLast((candle) => candle.state === "closed");
  const expectedClose = Math.floor(now / chartIntervalMilliseconds[interval]) * chartIntervalMilliseconds[interval] - 1;
  const delayed = latestClosed && Date.parse(latestClosed.closedAt) < expectedClose;
  const stale = datum.stale || datum.status === "stale" || datum.error !== null || Boolean(delayed);
  return { ...datum, status: stale ? "stale" : "fresh", stale };
}

function deriveDatum<T>(
  datum: CandleDatum,
  capability: MarketCapability,
  sourceId: string,
  scopeLabel: string,
  analyze: (candles: readonly ChartCandle[]) => T | null,
  getUpdatedAt: (analysis: T) => string,
): MarketDatum<T> {
  if (!isAvailableMarketDatum(datum)) {
    const shared = {
      capability,
      value: null,
      source: datum.source,
      scope: datum.scope,
      updatedAt: null,
      loading: false as const,
      stale: false as const,
      cache: datum.cache,
    };
    return datum.status === "error"
      ? { ...shared, status: "error", retrievedAt: datum.retrievedAt, error: datum.error }
      : { ...shared, status: "unavailable", retrievedAt: datum.retrievedAt, error: null, reason: datum.reason };
  }
  const source: DataSource = {
    id: `wise-crypto-${sourceId}`,
    label: sourceId === "key-levels"
      ? "Wise Crypto 客观关键位计算"
      : sourceId === "historical-context"
        ? "Wise Crypto 近期历史情景计算"
        : "Wise Crypto 多周期计算",
    url: PRODUCTION_SITE_URL,
    components: [datum.source],
  };
  const scope: DataScope = { kind: "derived", label: scopeLabel };
  try {
    const value = analyze(datum.value);
    if (value === null) {
      return {
        status: "unavailable", capability, value: null, source, scope,
        updatedAt: null, retrievedAt: datum.retrievedAt, loading: false,
        stale: false, cache: datum.cache, error: null, reason: "insufficient_history",
      };
    }
    return {
      status: datum.status,
      capability,
      source,
      scope,
      value,
      updatedAt: getUpdatedAt(value),
      updatedAtKind: "source",
      retrievedAt: datum.retrievedAt,
      loading: false,
      stale: datum.stale,
      error: datum.error,
      cache: datum.cache,
      provenance: "derived",
      ...(datum.fallback ? { fallback: datum.fallback } : {}),
    };
  } catch {
    return {
      status: "error", capability, value: null, source, scope,
      updatedAt: null, retrievedAt: datum.retrievedAt, loading: false,
      stale: false, cache: datum.cache, error: { code: "invalid_payload", retryable: false },
    };
  }
}

function unsupportedHistoricalContext(
  datum: CandleDatum,
  asset: Asset,
  interval: ChartCandleInterval,
): MarketDatum<HistoricalContextAnalysis> {
  const source: DataSource = {
    id: "wise-crypto-historical-context",
    label: "Wise Crypto 近期历史情景计算",
    url: PRODUCTION_SITE_URL,
    ...(datum.source ? { components: [datum.source] } : {}),
  };
  return {
    status: "unavailable",
    capability: historicalContextCapability(asset),
    value: null,
    source,
    scope: {
      kind: "derived",
      label: `${asset.toUpperCase()}USDT ${interval} · 首版暂不提供超短周期历史情景`,
    },
    updatedAt: null,
    retrievedAt: datum.retrievedAt,
    loading: false,
    stale: false,
    cache: datum.cache,
    error: null,
    reason: "unsupported",
  };
}

function sourceScope(asset: Asset, interval: ChartCandleInterval): DataScope {
  return { kind: "venue", label: `Binance ${asset.toUpperCase()}USDT 现货 ${interval} K 线（USDT，UTC）` };
}

function failedSnapshot(asset: Asset, interval: ChartCandleInterval, error: unknown, now: () => number): PublicResearchSnapshot {
  return {
    asset,
    interval,
    levels: createErrorDatum(keyLevelCapability(asset), null, sourceScope(asset, interval), error, now),
    history: createErrorDatum(historicalContextCapability(asset), null, sourceScope(asset, interval), error, now),
    cycle: createErrorDatum(marketCycleCapability(asset), null, sourceScope(asset, "1d"), error, now),
    longHistory: createErrorDatum(longTermHistoryCapability(asset), null, sourceScope(asset, interval), error, now),
    timeframes: MULTI_TIMEFRAME_INTERVALS.map((timeframe) => ({
      interval: timeframe,
      datum: createErrorDatum(multiTimeframeCapability(asset), null, sourceScope(asset, timeframe), error, now),
    })),
  };
}
