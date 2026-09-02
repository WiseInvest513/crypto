import "server-only";

import {
  analyzeDailyCandles,
  type TechnicalAnalysisResult,
} from "@/lib/market/technical-analysis";
import type {
  Asset,
  AvailableMarketDatum,
  BtcDominanceReading,
  DailyCandle,
  DataSource,
  EtfFlowReading,
  EthBtcReading,
  FundingReading,
  GlobalMarket,
  LiquidationsReading,
  MarketDatum,
  OpenInterestReading,
  PriceQuote,
} from "../contracts/market-data";
import { dailyCandleCapability } from "../contracts/market-data";
import type { MarketProviderRegistry } from "../contracts/providers";
import {
  createErrorDatum,
  deriveEthBtc,
  isAvailableMarketDatum,
  recoverSettled,
  selectGlobal,
  selectQuote,
  type SettledMarketDatum,
} from "./market-datum-utils";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const CANDLE_LOOKBACK_DAYS = 420;

const technicalSource: DataSource = {
  id: "wise-crypto-sma",
  label: "Wise Crypto 均线计算",
  url: "https://crypto.wise-invest.org",
};

export type AssetComparison =
  | {
      kind: "btc-dominance";
      datum: MarketDatum<BtcDominanceReading>;
    }
  | {
      kind: "eth-btc";
      datum: MarketDatum<EthBtcReading>;
    };

export type AssetDetailSnapshot = {
  asset: Asset;
  price: MarketDatum<PriceQuote>;
  candles: MarketDatum<readonly DailyCandle[]>;
  technical: MarketDatum<TechnicalAnalysisResult>;
  funding: MarketDatum<FundingReading>;
  openInterest: MarketDatum<OpenInterestReading>;
  liquidations24h: MarketDatum<LiquidationsReading>;
  etfFlow: MarketDatum<EtfFlowReading>;
  comparison: AssetComparison;
};

export type AssetChartSnapshot = Pick<
  AssetDetailSnapshot,
  "candles" | "technical"
>;

export type AssetContextSnapshot = Pick<
  AssetDetailSnapshot,
  | "funding"
  | "openInterest"
  | "liquidations24h"
  | "etfFlow"
  | "comparison"
>;

export async function getAssetDetailSnapshot(
  registry: MarketProviderRegistry,
  asset: Asset,
  now: () => number = Date.now,
): Promise<AssetDetailSnapshot> {
  const [price, chart, context] = await Promise.all([
    getAssetPriceDatum(registry, asset, now),
    getAssetChartSnapshot(registry, asset, now),
    getAssetContextSnapshot(registry, asset, now),
  ]);

  return {
    asset,
    price,
    ...chart,
    ...context,
  };
}

export async function getAssetPriceDatum(
  registry: MarketProviderRegistry,
  asset: Asset,
  now: () => number = Date.now,
): Promise<MarketDatum<PriceQuote>> {
  const [quotesResult] = await Promise.allSettled([
    registry.spot.getQuotes([asset]),
  ]);
  const symbol = asset.toUpperCase();
  const quotes = recoverSettled(
    quotesResult as SettledMarketDatum<readonly PriceQuote[]>,
    `spot.${asset}-price`,
    registry.spot.source,
    { kind: "asset", label: `${symbol}/USD` },
    now,
  );

  return selectQuote(quotes, asset, now);
}

export async function getAssetChartSnapshot(
  registry: MarketProviderRegistry,
  asset: Asset,
  now: () => number = Date.now,
): Promise<AssetChartSnapshot> {
  const requestTime = now();
  const range = closedDailyRange(requestTime);
  const [candlesResult] = await Promise.allSettled([
    registry.candles.getDailyCandles(asset, range),
  ]);
  const symbol = asset.toUpperCase();
  const candles = recoverSettled(
    candlesResult as SettledMarketDatum<readonly DailyCandle[]>,
    dailyCandleCapability(asset),
    registry.candles.source,
    {
      kind: "venue",
      label: `Binance ${symbol}USDT 现货日线（USDT，UTC）`,
    },
    now,
  );

  return {
    candles,
    technical: deriveTechnicalDatum(candles, asset, now),
  };
}

export async function getAssetContextSnapshot(
  registry: MarketProviderRegistry,
  asset: Asset,
  now: () => number = Date.now,
): Promise<AssetContextSnapshot> {
  const etfFlowRequest =
    asset === "btc"
      ? registry.fundFlows.getBtcEtfFlow()
      : registry.fundFlows.getEthEtfFlow();
  const comparisonRequest =
    asset === "btc"
      ? registry.spot.getGlobalMarket()
      : Promise.resolve(null);
  const ethBtcRequest =
    asset === "eth"
      ? registry.spot.getQuotes(["btc", "eth"])
      : Promise.resolve(null);

  const settled = await Promise.allSettled([
    registry.derivatives.getFunding(asset),
    registry.derivatives.getOpenInterest(asset),
    registry.derivatives.getLiquidations(),
    etfFlowRequest,
    comparisonRequest,
    ethBtcRequest,
  ]);

  const symbol = asset.toUpperCase();
  const funding = recoverSettled(
    settled[0] as SettledMarketDatum<FundingReading>,
    `derivatives.${asset}-funding`,
    registry.derivatives.source,
    { kind: "venue", label: `${symbol} derivatives venue` },
    now,
  );
  const openInterest = recoverSettled(
    settled[1] as SettledMarketDatum<OpenInterestReading>,
    `derivatives.${asset}-open-interest`,
    registry.derivatives.source,
    { kind: "venue", label: `${symbol} derivatives venue` },
    now,
  );
  const liquidations24h = recoverSettled(
    settled[2] as SettledMarketDatum<LiquidationsReading>,
    "derivatives.total-liquidations",
    registry.derivatives.source,
    { kind: "global", label: "Global derivatives liquidations" },
    now,
  );
  const etfFlow = recoverSettled(
    settled[3] as SettledMarketDatum<EtfFlowReading>,
    `fund-flows.${asset}-etf`,
    registry.fundFlows.source,
    {
      kind: "asset",
      label: asset === "btc" ? "US spot Bitcoin ETFs" : "US spot Ether ETFs",
    },
    now,
  );

  return {
    funding,
    openInterest,
    liquidations24h,
    etfFlow,
    comparison:
      asset === "btc"
        ? {
            kind: "btc-dominance",
            datum: selectBtcDominance(
              settled[4] as PromiseSettledResult<MarketDatum<GlobalMarket>>,
              registry,
              now,
            ),
          }
        : {
            kind: "eth-btc",
            datum: selectEthBtc(
              settled[5] as PromiseSettledResult<
                MarketDatum<readonly PriceQuote[]> | null
              >,
              registry,
              now,
            ),
          },
  };
}

function selectEthBtc(
  result: PromiseSettledResult<MarketDatum<readonly PriceQuote[]> | null>,
  registry: MarketProviderRegistry,
  now: () => number,
): MarketDatum<EthBtcReading> {
  if (result.status === "fulfilled" && result.value === null) {
    return createErrorDatum(
      "spot.eth-btc",
      registry.spot.source,
      { kind: "derived", label: "ETH/USD ÷ BTC/USD" },
      new Error("ETH/BTC quote batch was not requested."),
      now,
      "no_data",
      false,
    );
  }

  const quotes = recoverSettled(
    result as PromiseSettledResult<MarketDatum<readonly PriceQuote[]>>,
    "spot.core-prices",
    registry.spot.source,
    { kind: "asset", label: "同一 Provider 的 BTC/USD 与 ETH/USD 聚合报价" },
    now,
  );

  return deriveEthBtc(
    selectQuote(quotes, "btc", now),
    selectQuote(quotes, "eth", now),
    now,
  );
}

export function closedDailyRange(nowMilliseconds: number): {
  from: string;
  to: string;
} {
  if (!Number.isFinite(nowMilliseconds)) {
    throw new RangeError("Current time must be finite.");
  }
  const now = new Date(nowMilliseconds);
  const currentUtcDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return {
    from: new Date(
      currentUtcDay - CANDLE_LOOKBACK_DAYS * DAY_MILLISECONDS,
    ).toISOString(),
    to: new Date(currentUtcDay).toISOString(),
  };
}

function selectBtcDominance(
  result: PromiseSettledResult<MarketDatum<GlobalMarket>>,
  registry: MarketProviderRegistry,
  now: () => number,
): MarketDatum<BtcDominanceReading> {
  const global = recoverSettled(
    result,
    "spot.btc-dominance",
    registry.spot.source,
    { kind: "global", label: "Global cryptocurrency market" },
    now,
  );
  return selectGlobal(global, "spot.btc-dominance", (value) => ({
    btcDominancePercent: value.btcDominancePercent,
  }));
}

function deriveTechnicalDatum(
  candles: MarketDatum<readonly DailyCandle[]>,
  asset: Asset,
  now: () => number,
): MarketDatum<TechnicalAnalysisResult> {
  if (!isAvailableMarketDatum(candles)) {
    return candles;
  }

  try {
    const value = analyzeDailyCandles(candles.value);
    const source = withInputSource(technicalSource, candles.source);
    const stale = candles.status === "stale";
    const datum: AvailableMarketDatum<TechnicalAnalysisResult> = {
      status: stale ? "stale" : "fresh",
      capability: dailyCandleCapability(asset),
      value,
      source,
      scope: {
        kind: "derived",
        label: `基于 Binance ${asset.toUpperCase()}USDT 已闭合日线的 SMA20 / SMA50`,
      },
      updatedAt: candles.updatedAt,
      retrievedAt: candles.retrievedAt,
      loading: false,
      stale,
      provenance:
        candles.provenance === "synthetic" ? "synthetic" : "derived",
      cache: candles.cache,
      error: candles.error,
    };
    return datum;
  } catch (error) {
    return createErrorDatum(
      dailyCandleCapability(asset),
      withInputSource(technicalSource, candles.source),
      {
        kind: "derived",
        label: `基于 ${asset.toUpperCase()}USDT 日线的 SMA20 / SMA50`,
      },
      error,
      now,
      "invalid_payload",
      false,
    );
  }
}

function withInputSource(source: DataSource, input: DataSource): DataSource {
  return { ...source, components: [input] };
}
