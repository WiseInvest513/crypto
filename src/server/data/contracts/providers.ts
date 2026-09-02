import type {
  Asset,
  ChartCandle,
  ChartCandleRequest,
  CandleRange,
  DailyCandle,
  DataSource,
  EtfFlowReading,
  FundingReading,
  GlobalMarket,
  LiquidationsReading,
  MarketDatum,
  OpenInterestReading,
  PriceQuote,
  SentimentReading,
} from "./market-data";

export type ProviderMode = "live" | "unavailable" | "mock";

export interface MarketDataProvider {
  readonly id: string;
  readonly mode: ProviderMode;
  readonly source: DataSource | null;
}

export interface SpotMarketProvider extends MarketDataProvider {
  getQuotes(assets: readonly Asset[]): Promise<MarketDatum<readonly PriceQuote[]>>;
  getGlobalMarket(): Promise<MarketDatum<GlobalMarket>>;
}

export interface CandleProvider extends MarketDataProvider {
  getDailyCandles(
    asset: Asset,
    range: CandleRange,
  ): Promise<MarketDatum<readonly DailyCandle[]>>;
  getChartCandles(
    asset: Asset,
    request: ChartCandleRequest,
  ): Promise<MarketDatum<readonly ChartCandle[]>>;
}

export type HistoricalMarketProvider = CandleProvider;

export interface SentimentProvider extends MarketDataProvider {
  getFearAndGreed(): Promise<MarketDatum<SentimentReading>>;
}

export interface FundingOpenInterestProvider extends MarketDataProvider {
  getFunding(asset: Asset): Promise<MarketDatum<FundingReading>>;
  getOpenInterest(asset: Asset): Promise<MarketDatum<OpenInterestReading>>;
}

export interface LiquidationsProvider extends MarketDataProvider {
  getLiquidations(): Promise<MarketDatum<LiquidationsReading>>;
}

export interface DerivativesProvider
  extends FundingOpenInterestProvider,
    LiquidationsProvider {}

export interface FundFlowProvider extends MarketDataProvider {
  getBtcEtfFlow(): Promise<MarketDatum<EtfFlowReading>>;
  getEthEtfFlow(): Promise<MarketDatum<EtfFlowReading>>;
}

export type MarketProviderRegistry = {
  spot: SpotMarketProvider;
  candles: CandleProvider;
  sentiment: SentimentProvider;
  derivatives: DerivativesProvider;
  fundFlows: FundFlowProvider;
};
