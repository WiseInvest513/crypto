import "server-only";

import type {
  Asset,
  AvailableMarketDatum,
  CandleRange,
  ChartCandle,
  ChartCandleRequest,
  DailyCandle,
  DataScope,
  EtfFlowReading,
  FundingReading,
  GlobalMarket,
  LiquidationsReading,
  MarketCapability,
  MarketDatum,
  OpenInterestReading,
  PriceQuote,
  SentimentReading,
} from "../contracts/market-data";
import {
  chartCandleCapability,
  dailyCandleCapability,
} from "../contracts/market-data";
import type {
  CandleProvider,
  DerivativesProvider,
  FundFlowProvider,
  SentimentProvider,
  SpotMarketProvider,
} from "../contracts/providers";

const FIXTURE_TIME = "2026-01-01T00:00:00.000Z";
const MOCK_SOURCE = {
  id: "mock-development-only",
  label: "Mock / Development only",
  url: "https://example.invalid/mock-market-data",
};

function syntheticDatum<T>(
  capability: MarketCapability,
  value: T,
  scope: DataScope,
): AvailableMarketDatum<T> {
  return {
    status: "fresh",
    capability,
    value,
    source: MOCK_SOURCE,
    scope,
    updatedAt: FIXTURE_TIME,
    retrievedAt: FIXTURE_TIME,
    loading: false,
    stale: false,
    provenance: "synthetic",
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: null,
  };
}

function assetCapability(
  asset: Asset,
  suffix: "price" | "funding" | "open-interest",
): MarketCapability {
  return suffix === "price"
    ? `spot.${asset}-price`
    : `derivatives.${asset}-${suffix}`;
}

export class MockMarketProvider
  implements
    SpotMarketProvider,
    CandleProvider,
    SentimentProvider,
    DerivativesProvider,
    FundFlowProvider
{
  readonly id = "mock-development-only";
  readonly mode = "mock" as const;
  readonly source = MOCK_SOURCE;

  async getQuotes(
    assets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    const quotes = assets.map<PriceQuote>((asset) => ({
      asset,
      quoteCurrency: "USD",
      priceUsd: asset === "btc" ? 100_000 : 4_000,
      change24hPercent: 1.25,
      change7dPercent: 3.5,
      marketCapUsd: asset === "btc" ? 2_000_000_000_000 : 480_000_000_000,
    }));

    return syntheticDatum(
      assets.length === 1
        ? assetCapability(assets[0], "price")
        : "spot.btc-price",
      quotes,
      { kind: "asset", label: "Synthetic BTC/ETH fixtures" },
    );
  }

  async getGlobalMarket(): Promise<MarketDatum<GlobalMarket>> {
    return syntheticDatum(
      "spot.market-cap",
      {
        totalMarketCapUsd: 3_500_000_000_000,
        btcDominancePercent: 57,
      },
      { kind: "global", label: "Synthetic global market fixture" },
    );
  }

  async getDailyCandles(
    asset: Asset,
    range: CandleRange,
  ): Promise<MarketDatum<readonly DailyCandle[]>> {
    const base = asset === "btc" ? 100_000 : 4_000;
    return syntheticDatum(
      dailyCandleCapability(asset),
      [
        {
          asset,
          symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
          interval: "1d",
          quoteCurrency: "USDT",
          openedAt: range.from,
          closedAt: range.to,
          open: base,
          high: base * 1.02,
          low: base * 0.98,
          close: base * 1.01,
          volume: 1_000,
        },
      ],
      { kind: "asset", label: `Synthetic ${asset.toUpperCase()} candles` },
    );
  }

  async getChartCandles(
    asset: Asset,
    request: ChartCandleRequest,
  ): Promise<MarketDatum<readonly ChartCandle[]>> {
    const base = asset === "btc" ? 100_000 : 4_000;
    const intervalMilliseconds = {
      "15m": 15 * 60 * 1_000,
      "1h": 60 * 60 * 1_000,
      "4h": 4 * 60 * 60 * 1_000,
      "1d": 24 * 60 * 60 * 1_000,
    }[request.interval];
    const openedAt = Date.parse(FIXTURE_TIME);
    return syntheticDatum(
      chartCandleCapability(asset),
      [
        {
          asset,
          symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
          interval: request.interval,
          quoteCurrency: "USDT",
          state: "forming",
          openedAt: new Date(openedAt).toISOString(),
          closedAt: new Date(openedAt + intervalMilliseconds - 1).toISOString(),
          open: base,
          high: base * 1.02,
          low: base * 0.98,
          close: base * 1.01,
          volume: 1_000,
        },
      ],
      { kind: "asset", label: `Synthetic ${asset.toUpperCase()} chart candles` },
    );
  }

  async getFearAndGreed(): Promise<MarketDatum<SentimentReading>> {
    return syntheticDatum(
      "sentiment.fear-and-greed",
      { value: 50, classification: "Neutral fixture" },
      { kind: "asset", label: "Synthetic Bitcoin sentiment fixture" },
    );
  }

  async getFunding(asset: Asset): Promise<MarketDatum<FundingReading>> {
    return syntheticDatum(
      assetCapability(asset, "funding"),
      {
        asset,
        symbol: `${asset.toUpperCase()}USDT`,
        rate: 0.0001,
        intervalHours: null,
      },
      { kind: "venue", label: "Synthetic derivatives venue fixture" },
    );
  }

  async getOpenInterest(
    asset: Asset,
  ): Promise<MarketDatum<OpenInterestReading>> {
    return syntheticDatum(
      assetCapability(asset, "open-interest"),
      {
        asset,
        symbol: `${asset.toUpperCase()}USDT`,
        notional: 1_000_000_000,
        quoteCurrency: "USDT",
        samplingPeriod: "5m",
      },
      { kind: "venue", label: "Synthetic derivatives venue fixture" },
    );
  }

  async getLiquidations(): Promise<MarketDatum<LiquidationsReading>> {
    return syntheticDatum(
      "derivatives.total-liquidations",
      {
        asset: "all",
        totalUsd: 10_000_000,
        longUsd: 6_000_000,
        shortUsd: 4_000_000,
        window: "24h",
      },
      { kind: "global", label: "Synthetic market-wide fixture" },
    );
  }

  async getBtcEtfFlow(): Promise<MarketDatum<EtfFlowReading>> {
    return syntheticDatum(
      "fund-flows.btc-etf",
      { asset: "btc", netFlowUsd: 1_000_000, tradingDate: "2026-01-01" },
      { kind: "asset", label: "Synthetic BTC ETF fixture" },
    );
  }

  async getEthEtfFlow(): Promise<MarketDatum<EtfFlowReading>> {
    return syntheticDatum(
      "fund-flows.eth-etf",
      { asset: "eth", netFlowUsd: 500_000, tradingDate: "2026-01-01" },
      { kind: "asset", label: "Synthetic ETH ETF fixture" },
    );
  }
}
