import "server-only";

import type {
  Asset,
  CandleRange,
  ChartCandle,
  ChartCandleRequest,
  DailyCandle,
  EtfFlowReading,
  FundingReading,
  GlobalMarket,
  LiquidationsReading,
  MarketCapability,
  MarketDatum,
  OpenInterestReading,
  PriceQuote,
  SentimentReading,
  UnavailableReason,
} from "../contracts/market-data";
import {
  chartCandleCapability,
  dailyCandleCapability,
  unavailableDatum,
} from "../contracts/market-data";
import type {
  CandleProvider,
  DerivativesProvider,
  FundFlowProvider,
  SentimentProvider,
  SpotMarketProvider,
} from "../contracts/providers";

function capabilityForAsset(
  asset: Asset,
  suffix: "price" | "funding" | "open-interest",
): MarketCapability {
  return suffix === "price"
    ? `spot.${asset}-price`
    : `derivatives.${asset}-${suffix}`;
}

export class UnavailableMarketProvider
  implements
    SpotMarketProvider,
    CandleProvider,
    SentimentProvider,
    DerivativesProvider,
    FundFlowProvider
{
  readonly id = "unavailable";
  readonly mode = "unavailable" as const;
  readonly source = null;

  constructor(
    private readonly reason: UnavailableReason = "not_configured",
  ) {}

  async getQuotes(
    assets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    return unavailableDatum(
      assets.length === 1
        ? capabilityForAsset(assets[0], "price")
        : "spot.btc-price",
      this.reason,
    );
  }

  async getGlobalMarket(): Promise<MarketDatum<GlobalMarket>> {
    return unavailableDatum("spot.market-cap", this.reason);
  }

  async getDailyCandles(
    asset: Asset,
    range: CandleRange,
  ): Promise<MarketDatum<readonly DailyCandle[]>> {
    void range;
    return unavailableDatum(dailyCandleCapability(asset), this.reason);
  }

  async getChartCandles(
    asset: Asset,
    request: ChartCandleRequest,
  ): Promise<MarketDatum<readonly ChartCandle[]>> {
    void request;
    return unavailableDatum(chartCandleCapability(asset), this.reason);
  }

  async getFearAndGreed(): Promise<MarketDatum<SentimentReading>> {
    return unavailableDatum("sentiment.fear-and-greed", this.reason);
  }

  async getFunding(asset: Asset): Promise<MarketDatum<FundingReading>> {
    return unavailableDatum(
      capabilityForAsset(asset, "funding"),
      this.reason,
    );
  }

  async getOpenInterest(
    asset: Asset,
  ): Promise<MarketDatum<OpenInterestReading>> {
    return unavailableDatum(
      capabilityForAsset(asset, "open-interest"),
      this.reason,
    );
  }

  async getLiquidations(): Promise<MarketDatum<LiquidationsReading>> {
    return unavailableDatum("derivatives.total-liquidations", this.reason);
  }

  async getBtcEtfFlow(): Promise<MarketDatum<EtfFlowReading>> {
    return unavailableDatum("fund-flows.btc-etf", this.reason);
  }

  async getEthEtfFlow(): Promise<MarketDatum<EtfFlowReading>> {
    return unavailableDatum("fund-flows.eth-etf", this.reason);
  }
}
