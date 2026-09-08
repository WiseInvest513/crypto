import "server-only";

import {
  canAccessFeature,
  type UserAccess,
} from "@/lib/access/user-access";
import { PRODUCTION_SITE_URL } from "@/config/site";
import {
  analyzeMultiTimeframeCandles,
  MULTI_TIMEFRAME_CANDLE_LIMIT,
  MULTI_TIMEFRAME_INTERVALS,
  type MultiTimeframeIntervalAnalysis,
} from "@/lib/market/multi-timeframe";
import type {
  Asset,
  AvailableMarketDatum,
  ChartCandle,
  ChartCandleInterval,
  DataScope,
  DataSource,
  ErrorMarketDatum,
  MarketDatum,
  UnavailableMarketDatum,
} from "../contracts/market-data";
import {
  chartCandleCapability,
  multiTimeframeCapability,
} from "../contracts/market-data";
import type { MarketProviderRegistry } from "../contracts/providers";
import { getMarketProviderRegistry } from "../provider-registry";
import {
  isAvailableMarketDatum,
  recoverSettled,
  type SettledMarketDatum,
} from "./market-datum-utils";

export type MultiTimeframeIntervalDatum = Readonly<{
  interval: ChartCandleInterval;
  datum: MarketDatum<MultiTimeframeIntervalAnalysis>;
}>;

export type MultiTimeframeAccessPayload =
  | Readonly<{
      status: "locked";
      asset: Asset;
    }>
  | Readonly<{
      status: "granted";
      asset: Asset;
      intervals: readonly MultiTimeframeIntervalDatum[];
    }>;

type MultiTimeframeDependencies = Readonly<{
  getRegistry?: () => MarketProviderRegistry;
  now?: () => number;
}>;

const derivedSourceBase: DataSource = {
  id: "wise-crypto-multi-timeframe",
  label: "Wise Crypto 多周期计算",
  url: PRODUCTION_SITE_URL,
};

/**
 * Premium server boundary. A provider registry is not even resolved until a
 * verified VIP access tuple has passed the feature check. Rejected or malformed
 * identity promises fail closed to the metadata-free locked shape.
 */
export async function loadAssetMultiTimeframeForAccess(
  asset: Asset,
  access: Promise<UserAccess>,
  dependencies: MultiTimeframeDependencies = {},
): Promise<MultiTimeframeAccessPayload> {
  let resolvedAccess: UserAccess;
  try {
    resolvedAccess = await access;
  } catch {
    return { status: "locked", asset };
  }

  if (!canAccessFeature(resolvedAccess, "analysis.privateMultiTimeframe")) {
    return { status: "locked", asset };
  }

  const registry = (dependencies.getRegistry ?? getMarketProviderRegistry)();
  return getAssetMultiTimeframeSnapshot(
    registry,
    asset,
    dependencies.now ?? Date.now,
  );
}

async function getAssetMultiTimeframeSnapshot(
  registry: MarketProviderRegistry,
  asset: Asset,
  now: () => number = Date.now,
): Promise<Extract<MultiTimeframeAccessPayload, { status: "granted" }>> {
  const settled = await Promise.allSettled(
    MULTI_TIMEFRAME_INTERVALS.map((interval) =>
      Promise.resolve().then(() =>
        registry.candles.getChartCandles(asset, {
          interval,
          limit: MULTI_TIMEFRAME_CANDLE_LIMIT,
        }),
      ),
    ),
  );

  return {
    status: "granted",
    asset,
    intervals: settled.map((result, index) => {
      const interval = MULTI_TIMEFRAME_INTERVALS[index];
      const sourceDatum = recoverSettled(
        result as SettledMarketDatum<readonly ChartCandle[]>,
        chartCandleCapability(asset),
        registry.candles.source,
        sourceScope(asset, interval),
        now,
      );
      return {
        interval,
        datum: deriveIntervalDatum(sourceDatum, asset, interval),
      };
    }),
  };
}

function deriveIntervalDatum(
  sourceDatum: MarketDatum<readonly ChartCandle[]>,
  asset: Asset,
  interval: ChartCandleInterval,
): MarketDatum<MultiTimeframeIntervalAnalysis> {
  if (!isAvailableMarketDatum(sourceDatum)) {
    return {
      ...sourceDatum,
      capability: multiTimeframeCapability(asset),
    };
  }

  const source = derivedSource(sourceDatum.source);
  const scope = derivedScope(asset, interval);

  try {
    assertRequestedScope(sourceDatum.value, asset, interval);
    const analysis = analyzeMultiTimeframeCandles(sourceDatum.value);
    if (analysis === null) {
      return insufficientHistoryDatum(sourceDatum, asset, interval);
    }
    if (analysis.interval !== interval) {
      throw new TypeError("Multi-timeframe provider returned the wrong scope.");
    }

    return {
      status: sourceDatum.status,
      capability: multiTimeframeCapability(asset),
      value: analysis,
      source,
      scope,
      updatedAt: analysis.latestClosedAt,
      updatedAtKind: "source",
      retrievedAt: sourceDatum.retrievedAt,
      loading: false,
      stale: sourceDatum.stale,
      provenance:
        sourceDatum.provenance === "synthetic" ? "synthetic" : "derived",
      cache: sourceDatum.cache,
      error: sourceDatum.error,
      ...(sourceDatum.fallback ? { fallback: sourceDatum.fallback } : {}),
    };
  } catch {
    return invalidAnalysisDatum(sourceDatum, source, scope, asset);
  }
}

function assertRequestedScope(
  candles: readonly ChartCandle[],
  asset: Asset,
  interval: ChartCandleInterval,
): void {
  const expectedSymbol = asset === "btc" ? "BTCUSDT" : "ETHUSDT";
  if (
    candles.some(
      (candle) =>
        candle.asset !== asset ||
        candle.symbol !== expectedSymbol ||
        candle.interval !== interval ||
        candle.quoteCurrency !== "USDT",
    )
  ) {
    throw new TypeError("Multi-timeframe provider returned the wrong scope.");
  }
}

function insufficientHistoryDatum(
  sourceDatum: AvailableMarketDatum<readonly ChartCandle[]>,
  asset: Asset,
  interval: ChartCandleInterval,
): UnavailableMarketDatum {
  return {
    status: "unavailable",
    capability: multiTimeframeCapability(asset),
    value: null,
    source: derivedSource(sourceDatum.source),
    scope: derivedScope(asset, interval),
    updatedAt: null,
    retrievedAt: sourceDatum.retrievedAt,
    loading: false,
    stale: false,
    cache: sourceDatum.cache,
    error: null,
    reason: "insufficient_history",
  };
}

function invalidAnalysisDatum(
  sourceDatum: AvailableMarketDatum<readonly ChartCandle[]>,
  source: DataSource,
  scope: DataScope,
  asset: Asset,
): ErrorMarketDatum {
  return {
    status: "error",
    capability: multiTimeframeCapability(asset),
    value: null,
    source,
    scope,
    updatedAt: null,
    retrievedAt: sourceDatum.retrievedAt,
    loading: false,
    stale: false,
    cache: sourceDatum.cache,
    error: {
      code: "invalid_payload",
      retryable: false,
    },
  };
}

function sourceScope(
  asset: Asset,
  interval: ChartCandleInterval,
): DataScope {
  return {
    kind: "venue",
    label: `Binance ${asset.toUpperCase()}USDT 现货 ${interval} K 线（USDT，UTC，含形成中）`,
  };
}

function derivedScope(
  asset: Asset,
  interval: ChartCandleInterval,
): DataScope {
  return {
    kind: "derived",
    label: `${asset.toUpperCase()}USDT ${interval} 已闭合 K 线 · EMA10/20/50/200 · 近 20 根区间`,
  };
}

function derivedSource(source: DataSource): DataSource {
  return {
    ...derivedSourceBase,
    components: [source],
  };
}
