import "server-only";

import type {
  DcaMarketAsset,
  DcaMarketCacheMetadata,
  DcaMarketDataError,
  DcaMarketDataSource,
  DcaMarketDataset,
  DcaMarketHistory,
  DcaMarketRequestedRange,
  DcaMarketSymbol,
} from "@/lib/tools/dca-market-data";
import type {
  DailyCandle,
  DataScope,
  DataSource,
  MarketDatum,
} from "../data/contracts/market-data";
import type { MarketProviderRegistry } from "../data/contracts/providers";
import { toDataError } from "../data/errors/provider-error";
import { getMarketProviderRegistry } from "../data/provider-registry";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const HISTORY_DAYS = 730;
const MAX_CANDLES = 1_000;
const ASSETS = ["btc", "eth"] as const satisfies readonly DcaMarketAsset[];
const SYMBOLS = {
  btc: "BTCUSDT",
  eth: "ETHUSDT",
} as const satisfies Record<DcaMarketAsset, DcaMarketSymbol>;
const BYPASS_CACHE = {
  status: "bypass",
  revalidateSeconds: 0,
  staleIfErrorSeconds: 0,
} as const;

type DcaMarketRegistry = Pick<MarketProviderRegistry, "candles">;

/**
 * Loads about two years of verified BTCUSDT and ETHUSDT Binance spot closes.
 * Provider failures are isolated per asset and always returned as serializable
 * error datasets, so a page render is never rejected by an upstream failure.
 */
export async function getDcaMarketHistory(
  registry: DcaMarketRegistry = getMarketProviderRegistry(),
  now: () => number = Date.now,
): Promise<DcaMarketHistory> {
  let requestedAt: number;
  let requestedRange: DcaMarketRequestedRange;

  try {
    requestedAt = now();
    requestedRange = dcaClosedDailyRange(requestedAt);
  } catch {
    const invalidTime = new Date(0).toISOString();
    const range = { from: invalidTime, to: invalidTime } as const;
    return {
      btc: serviceErrorDataset(
        "btc",
        range,
        registry.candles.source,
        expectedScope("btc"),
        invalidTime,
        { code: "invalid_payload", retryable: false },
      ),
      eth: serviceErrorDataset(
        "eth",
        range,
        registry.candles.source,
        expectedScope("eth"),
        invalidTime,
        { code: "invalid_payload", retryable: false },
      ),
    };
  }

  const settled = await Promise.allSettled(
    ASSETS.map((asset) =>
      Promise.resolve().then(() =>
        registry.candles.getDailyCandles(asset, requestedRange),
      ),
    ),
  );

  return {
    btc: projectSettledDatum(
      "btc",
      requestedRange,
      requestedAt,
      registry.candles.source,
      settled[0],
    ),
    eth: projectSettledDatum(
      "eth",
      requestedRange,
      requestedAt,
      registry.candles.source,
      settled[1],
    ),
  };
}

/** Semantic alias used by route-level loaders. */
export const loadDcaMarketHistory = getDcaMarketHistory;

export function dcaClosedDailyRange(
  nowMilliseconds: number,
): DcaMarketRequestedRange {
  if (!Number.isFinite(nowMilliseconds)) {
    throw new RangeError("Current time must be finite.");
  }

  const nowDate = new Date(nowMilliseconds);
  if (!Number.isFinite(nowDate.getTime())) {
    throw new RangeError("Current time must be a valid timestamp.");
  }

  const currentUtcDay = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
  );

  return {
    from: new Date(
      currentUtcDay - HISTORY_DAYS * DAY_MILLISECONDS,
    ).toISOString(),
    to: new Date(currentUtcDay).toISOString(),
  };
}

function projectSettledDatum(
  asset: DcaMarketAsset,
  requestedRange: DcaMarketRequestedRange,
  requestedAt: number,
  providerSource: DataSource | null,
  settled: PromiseSettledResult<MarketDatum<readonly DailyCandle[]>>,
): DcaMarketDataset {
  if (settled.status === "rejected") {
    return serviceErrorDataset(
      asset,
      requestedRange,
      providerSource,
      expectedScope(asset),
      new Date(requestedAt).toISOString(),
      toDataError(settled.reason),
    );
  }

  const datum = settled.value;
  if (datum.status === "error") {
    return {
      ...datasetBase(asset, requestedRange),
      status: "error",
      prices: [],
      source: serializeSource(datum.source),
      scope: serializeScope(datum.scope),
      updatedAt: datum.updatedAt,
      retrievedAt: datum.retrievedAt,
      stale: datum.stale,
      cache: { ...datum.cache },
      error: { ...datum.error },
      reason: null,
    };
  }

  if (datum.status === "unavailable") {
    return {
      ...datasetBase(asset, requestedRange),
      status: "unavailable",
      prices: [],
      source: serializeSource(datum.source),
      scope: serializeScope(datum.scope),
      updatedAt: datum.updatedAt,
      retrievedAt: datum.retrievedAt,
      stale: datum.stale,
      cache: { ...datum.cache },
      error: datum.error,
      reason: datum.reason,
    };
  }

  try {
    const prices = projectValidatedPrices(
      asset,
      datum.value,
      requestedRange,
      requestedAt,
      datum.source,
      datum.provenance,
    );
    return {
      ...datasetBase(asset, requestedRange),
      status: datum.status,
      prices,
      source: serializeSource(datum.source),
      scope: serializeScope(datum.scope),
      updatedAt: datum.updatedAt,
      retrievedAt: datum.retrievedAt,
      stale: datum.stale,
      cache: { ...datum.cache },
      error: datum.error === null ? null : { ...datum.error },
      reason: null,
    };
  } catch {
    return serviceErrorDataset(
      asset,
      requestedRange,
      datum.source,
      datum.scope,
      datum.retrievedAt,
      { code: "invalid_payload", retryable: false },
      datum.cache,
    );
  }
}

function projectValidatedPrices(
  asset: DcaMarketAsset,
  candles: readonly DailyCandle[],
  requestedRange: DcaMarketRequestedRange,
  requestedAt: number,
  source: DataSource,
  provenance: "live" | "derived" | "synthetic",
) {
  if (
    source.id !== "binance-spot" ||
    provenance !== "live" ||
    candles.length === 0 ||
    candles.length > MAX_CANDLES
  ) {
    throw new TypeError("DCA history must be live Binance spot data.");
  }

  const symbol = SYMBOLS[asset];
  const rangeStart = Date.parse(requestedRange.from);
  const rangeEnd = Date.parse(requestedRange.to);
  let previousOpenedAt = Number.NEGATIVE_INFINITY;

  return candles.map((candle) => {
    const openedAt = Date.parse(candle.openedAt);
    const closedAt = Date.parse(candle.closedAt);
    if (
      candle.asset !== asset ||
      candle.symbol !== symbol ||
      candle.interval !== "1d" ||
      candle.quoteCurrency !== "USDT" ||
      !Number.isFinite(openedAt) ||
      !Number.isFinite(closedAt) ||
      new Date(openedAt).toISOString() !== candle.openedAt ||
      new Date(closedAt).toISOString() !== candle.closedAt ||
      openedAt % DAY_MILLISECONDS !== 0 ||
      closedAt - openedAt !== DAY_MILLISECONDS - 1 ||
      openedAt < rangeStart ||
      openedAt > rangeEnd ||
      openedAt <= previousOpenedAt ||
      closedAt >= requestedAt ||
      !Number.isFinite(candle.close) ||
      candle.close <= 0
    ) {
      throw new TypeError("Invalid Binance daily candle series.");
    }

    previousOpenedAt = openedAt;
    return {
      date: candle.openedAt.slice(0, 10),
      close: candle.close,
    };
  });
}

function serviceErrorDataset(
  asset: DcaMarketAsset,
  requestedRange: DcaMarketRequestedRange,
  source: DataSource | null,
  scope: DataScope | null,
  retrievedAt: string,
  error: DcaMarketDataError,
  cache: DcaMarketCacheMetadata = BYPASS_CACHE,
): DcaMarketDataset {
  return {
    ...datasetBase(asset, requestedRange),
    status: "error",
    prices: [],
    source: serializeSource(source),
    scope: serializeScope(scope),
    updatedAt: null,
    retrievedAt,
    stale: false,
    cache: { ...cache },
    error: { ...error },
    reason: null,
  };
}

function datasetBase(
  asset: DcaMarketAsset,
  requestedRange: DcaMarketRequestedRange,
) {
  return {
    asset,
    symbol: SYMBOLS[asset],
    venue: "Binance",
    quoteCurrency: "USDT",
    interval: "1d",
    timeZone: "UTC",
    candleState: "closed",
    requestedRange: { ...requestedRange },
  } as const;
}

function expectedScope(asset: DcaMarketAsset): DataScope {
  return {
    kind: "venue",
    label: `Binance ${SYMBOLS[asset]} 现货日线（USDT，UTC，已闭合）`,
  };
}

function serializeSource(source: DataSource | null): DcaMarketDataSource | null {
  if (source === null) {
    return null;
  }

  return {
    id: source.id,
    label: source.label,
    url: source.url,
    ...(source.components
      ? { components: source.components.map(serializeRequiredSource) }
      : {}),
  };
}

function serializeRequiredSource(source: DataSource): DcaMarketDataSource {
  const serialized = serializeSource(source);
  if (serialized === null) {
    throw new TypeError("A source component cannot be null.");
  }
  return serialized;
}

function serializeScope(scope: DataScope | null) {
  return scope === null ? null : { ...scope };
}
