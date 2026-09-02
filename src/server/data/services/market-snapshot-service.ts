import "server-only";

import type {
  BtcDominanceReading,
  EtfFlowReading,
  EthBtcReading,
  FundingReading,
  GlobalMarket,
  LiquidationsReading,
  MarketCapReading,
  MarketDatum,
  MarketDatumView,
  OpenInterestReading,
  PriceQuote,
  SentimentReading,
} from "../contracts/market-data";
import { loadingDatum } from "../contracts/market-data";
import type { MarketProviderRegistry } from "../contracts/providers";
import {
  deriveEthBtc,
  recoverSettled,
  selectGlobal,
  selectQuote,
  type SettledMarketDatum,
} from "./market-datum-utils";

export type MarketCoreSnapshot = {
  btcPrice: MarketDatum<PriceQuote>;
  ethPrice: MarketDatum<PriceQuote>;
  marketCap: MarketDatum<MarketCapReading>;
  fearAndGreed: MarketDatum<SentimentReading>;
  btcDominance: MarketDatum<BtcDominanceReading>;
  ethBtc: MarketDatum<EthBtcReading>;
};

export type MarketQuoteSnapshot = Pick<
  MarketCoreSnapshot,
  "btcPrice" | "ethPrice"
>;

export type MarketPulseSnapshot = Pick<
  MarketCoreSnapshot,
  "marketCap" | "fearAndGreed" | "btcDominance" | "ethBtc"
>;

export type MarketIndicatorSnapshot = {
  btcFunding: MarketDatum<FundingReading>;
  ethFunding: MarketDatum<FundingReading>;
  btcOpenInterest: MarketDatum<OpenInterestReading>;
  ethOpenInterest: MarketDatum<OpenInterestReading>;
  liquidations24h: MarketDatum<LiquidationsReading>;
  btcEtfFlow: MarketDatum<EtfFlowReading>;
  ethEtfFlow: MarketDatum<EtfFlowReading>;
};

export type MarketSnapshot = MarketCoreSnapshot & MarketIndicatorSnapshot;

type SnapshotView<Snapshot> = {
  [Key in keyof Snapshot]: Snapshot[Key] extends MarketDatum<infer T>
    ? MarketDatumView<T>
    : never;
};

export type MarketCoreSnapshotView = SnapshotView<MarketCoreSnapshot>;
export type MarketIndicatorSnapshotView = SnapshotView<MarketIndicatorSnapshot>;
export type MarketSnapshotView = SnapshotView<MarketSnapshot>;

export async function getMarketCoreSnapshot(
  registry: MarketProviderRegistry,
  now: () => number = Date.now,
): Promise<MarketCoreSnapshot> {
  const [quotes, pulse] = await Promise.all([
    getMarketQuoteSnapshot(registry, now),
    getMarketPulseSnapshot(registry, now),
  ]);

  return { ...quotes, ...pulse };
}

export async function getMarketQuoteSnapshot(
  registry: MarketProviderRegistry,
  now: () => number = Date.now,
): Promise<MarketQuoteSnapshot> {
  const settled = await Promise.allSettled([
    registry.spot.getQuotes(["btc"]),
    registry.spot.getQuotes(["eth"]),
  ]);

  const btcQuotes = recoverSettled(
    settled[0] as SettledMarketDatum<readonly PriceQuote[]>,
    "spot.btc-price",
    registry.spot.source,
    { kind: "asset", label: "BTC/USD" },
    now,
  );
  const ethQuotes = recoverSettled(
    settled[1] as SettledMarketDatum<readonly PriceQuote[]>,
    "spot.eth-price",
    registry.spot.source,
    { kind: "asset", label: "ETH/USD" },
    now,
  );
  return {
    btcPrice: selectQuote(btcQuotes, "btc", now),
    ethPrice: selectQuote(ethQuotes, "eth", now),
  };
}

export async function getMarketPulseSnapshot(
  registry: MarketProviderRegistry,
  now: () => number = Date.now,
): Promise<MarketPulseSnapshot> {
  const settled = await Promise.allSettled([
    registry.spot.getQuotes(["btc", "eth"]),
    registry.spot.getGlobalMarket(),
    registry.sentiment.getFearAndGreed(),
  ]);
  const coreQuotes = recoverSettled(
    settled[0] as SettledMarketDatum<readonly PriceQuote[]>,
    "spot.core-prices",
    registry.spot.source,
    { kind: "asset", label: "同一 Provider 的 BTC/USD 与 ETH/USD 聚合报价" },
    now,
  );
  const global = recoverSettled(
    settled[1] as SettledMarketDatum<GlobalMarket>,
    "spot.market-cap",
    registry.spot.source,
    { kind: "global", label: "Global cryptocurrency market" },
    now,
  );

  const ethBtcBtcPrice = selectQuote(coreQuotes, "btc", now);
  const ethBtcEthPrice = selectQuote(coreQuotes, "eth", now);

  return {
    marketCap: selectGlobal(
      global,
      "spot.market-cap",
      (value) => ({ totalMarketCapUsd: value.totalMarketCapUsd }),
    ),
    fearAndGreed: recoverSettled(
      settled[2] as SettledMarketDatum<SentimentReading>,
      "sentiment.fear-and-greed",
      registry.sentiment.source,
      { kind: "global", label: "Crypto Fear and Greed Index" },
      now,
    ),
    btcDominance: selectGlobal(
      global,
      "spot.btc-dominance",
      (value) => ({ btcDominancePercent: value.btcDominancePercent }),
    ),
    ethBtc: deriveEthBtc(ethBtcBtcPrice, ethBtcEthPrice, now),
  };
}

export async function getMarketIndicatorSnapshot(
  registry: MarketProviderRegistry,
  now: () => number = Date.now,
): Promise<MarketIndicatorSnapshot> {
  const settled = await Promise.allSettled([
    registry.derivatives.getFunding("btc"),
    registry.derivatives.getFunding("eth"),
    registry.derivatives.getOpenInterest("btc"),
    registry.derivatives.getOpenInterest("eth"),
    registry.derivatives.getLiquidations(),
    registry.fundFlows.getBtcEtfFlow(),
    registry.fundFlows.getEthEtfFlow(),
  ]);

  return {
    btcFunding: recoverSettled(
      settled[0] as SettledMarketDatum<FundingReading>,
      "derivatives.btc-funding",
      registry.derivatives.source,
      { kind: "venue", label: "BTC derivatives venue" },
      now,
    ),
    ethFunding: recoverSettled(
      settled[1] as SettledMarketDatum<FundingReading>,
      "derivatives.eth-funding",
      registry.derivatives.source,
      { kind: "venue", label: "ETH derivatives venue" },
      now,
    ),
    btcOpenInterest: recoverSettled(
      settled[2] as SettledMarketDatum<OpenInterestReading>,
      "derivatives.btc-open-interest",
      registry.derivatives.source,
      { kind: "venue", label: "BTC derivatives venue" },
      now,
    ),
    ethOpenInterest: recoverSettled(
      settled[3] as SettledMarketDatum<OpenInterestReading>,
      "derivatives.eth-open-interest",
      registry.derivatives.source,
      { kind: "venue", label: "ETH derivatives venue" },
      now,
    ),
    liquidations24h: recoverSettled(
      settled[4] as SettledMarketDatum<LiquidationsReading>,
      "derivatives.total-liquidations",
      registry.derivatives.source,
      { kind: "global", label: "Global derivatives liquidations" },
      now,
    ),
    btcEtfFlow: recoverSettled(
      settled[5] as SettledMarketDatum<EtfFlowReading>,
      "fund-flows.btc-etf",
      registry.fundFlows.source,
      { kind: "asset", label: "US spot Bitcoin ETFs" },
      now,
    ),
    ethEtfFlow: recoverSettled(
      settled[6] as SettledMarketDatum<EtfFlowReading>,
      "fund-flows.eth-etf",
      registry.fundFlows.source,
      { kind: "asset", label: "US spot Ether ETFs" },
      now,
    ),
  };
}

export async function getMarketSnapshot(
  registry: MarketProviderRegistry,
  now: () => number = Date.now,
): Promise<MarketSnapshot> {
  const coreSnapshot = getMarketCoreSnapshot(registry, now);
  const indicatorSnapshot = getMarketIndicatorSnapshot(registry, now);
  const [core, indicators] = await Promise.all([
    coreSnapshot,
    indicatorSnapshot,
  ]);

  return { ...core, ...indicators };
}

export function createLoadingMarketCoreSnapshot(): MarketCoreSnapshotView {
  return {
    btcPrice: loadingDatum("spot.btc-price"),
    ethPrice: loadingDatum("spot.eth-price"),
    marketCap: loadingDatum("spot.market-cap"),
    fearAndGreed: loadingDatum("sentiment.fear-and-greed"),
    btcDominance: loadingDatum("spot.btc-dominance"),
    ethBtc: loadingDatum("spot.eth-btc"),
  };
}

export function createLoadingMarketIndicatorSnapshot(): MarketIndicatorSnapshotView {
  return {
    btcFunding: loadingDatum("derivatives.btc-funding"),
    ethFunding: loadingDatum("derivatives.eth-funding"),
    btcOpenInterest: loadingDatum("derivatives.btc-open-interest"),
    ethOpenInterest: loadingDatum("derivatives.eth-open-interest"),
    liquidations24h: loadingDatum("derivatives.total-liquidations"),
    btcEtfFlow: loadingDatum("fund-flows.btc-etf"),
    ethEtfFlow: loadingDatum("fund-flows.eth-etf"),
  };
}

export function createLoadingMarketSnapshot(): MarketSnapshotView {
  return {
    ...createLoadingMarketCoreSnapshot(),
    ...createLoadingMarketIndicatorSnapshot(),
  };
}
