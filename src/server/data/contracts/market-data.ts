export type Asset = "btc" | "eth";
export type QuoteCurrency = "USD";
export type CandleQuoteCurrency = "USDT";
export type CandleInterval = "1d";
export const chartCandleIntervals = ["15m", "1h", "4h", "1d"] as const;
export type ChartCandleInterval = (typeof chartCandleIntervals)[number];
export type ChartCandleState = "closed" | "forming";
export type CandleSymbol = "BTCUSDT" | "ETHUSDT";

export const marketCapabilities = [
  "spot.btc-price",
  "spot.eth-price",
  "spot.core-prices",
  "spot.btc-performance",
  "spot.eth-performance",
  "spot.market-cap",
  "spot.btc-dominance",
  "spot.eth-btc",
  "historical.btc-daily-candles",
  "historical.eth-daily-candles",
  "historical.btc-chart-candles",
  "historical.eth-chart-candles",
  "analysis.btc-multi-timeframe",
  "analysis.eth-multi-timeframe",
  "analysis.btc-key-levels",
  "analysis.eth-key-levels",
  "analysis.btc-historical-context",
  "analysis.eth-historical-context",
  "analysis.btc-long-term-history",
  "analysis.eth-long-term-history",
  "analysis.btc-market-cycle",
  "analysis.eth-market-cycle",
  "sentiment.fear-and-greed",
  "derivatives.btc-funding",
  "derivatives.eth-funding",
  "derivatives.btc-open-interest",
  "derivatives.eth-open-interest",
  "derivatives.total-liquidations",
  "fund-flows.btc-etf",
  "fund-flows.eth-etf",
] as const;

export type MarketCapability = (typeof marketCapabilities)[number];

export type DataSource = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  /** Direct, verified inputs used to produce a composite or derived datum. */
  readonly components?: readonly DataSource[];
};

export type DataScope = {
  kind: "global" | "asset" | "venue" | "derived";
  label: string;
};

export type CacheMetadata = {
  status: "hit" | "miss" | "bypass";
  revalidateSeconds: number;
  staleIfErrorSeconds: number;
};

/**
 * Describes what `updatedAt` means for an available datum.
 *
 * `source` is the timestamp published by the upstream source. `observed` is
 * the time our server observed a live value when the upstream payload does not
 * publish an update timestamp (for example, a still-forming Binance candle).
 * The field is optional so existing providers continue to mean `source`.
 */
export type UpdatedAtKind = "source" | "observed";

export type DataErrorCode =
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "invalid_payload"
  | "no_data";

export type DataError = {
  code: DataErrorCode;
  retryable: boolean;
};

export type UnavailableReason =
  | "not_configured"
  | "unsupported"
  | "license_restricted"
  | "no_reliable_source"
  | "no_data"
  | "insufficient_history";

export type FallbackMetadata =
  | {
      primarySource: DataSource | null;
      primaryStatus: "stale";
      primaryError: DataError | null;
      primaryReason: null;
    }
  | {
      primarySource: DataSource | null;
      primaryStatus: "error";
      primaryError: DataError;
      primaryReason: null;
    }
  | {
      primarySource: DataSource | null;
      primaryStatus: "unavailable";
      primaryError: null;
      primaryReason: UnavailableReason;
    };

type DatumBase = {
  capability: MarketCapability;
  source: DataSource | null;
  scope: DataScope | null;
  updatedAt: string | null;
  updatedAtKind?: UpdatedAtKind;
  retrievedAt: string | null;
  loading: boolean;
  stale: boolean;
  cache: CacheMetadata;
  error: DataError | null;
};

export type AvailableMarketDatum<T> = DatumBase & {
  status: "fresh" | "stale";
  value: T;
  source: DataSource;
  scope: DataScope;
  updatedAt: string;
  retrievedAt: string;
  loading: false;
  provenance: "live" | "derived" | "synthetic";
  /** Present only when a secondary provider supplied the displayed value. */
  fallback?: FallbackMetadata;
};

export type ErrorMarketDatum = DatumBase & {
  status: "error";
  value: null;
  updatedAt: null;
  retrievedAt: string;
  loading: false;
  stale: false;
  error: DataError;
};

export type UnavailableMarketDatum = DatumBase & {
  status: "unavailable";
  value: null;
  source: DataSource | null;
  scope: DataScope | null;
  updatedAt: null;
  retrievedAt: string | null;
  loading: false;
  stale: false;
  error: null;
  reason: UnavailableReason;
};

export type LoadingMarketDatum = DatumBase & {
  status: "loading";
  value: null;
  source: null;
  scope: null;
  updatedAt: null;
  retrievedAt: null;
  loading: true;
  stale: false;
  error: null;
};

export type MarketDatum<T> =
  | AvailableMarketDatum<T>
  | ErrorMarketDatum
  | UnavailableMarketDatum;

export type MarketDatumView<T> = MarketDatum<T> | LoadingMarketDatum;

export type PriceQuote = {
  asset: Asset;
  quoteCurrency: QuoteCurrency;
  priceUsd: number;
  change24hPercent: number | null;
  change7dPercent: number | null;
  marketCapUsd: number | null;
};

export type GlobalMarket = {
  totalMarketCapUsd: number;
  btcDominancePercent: number;
};

export type MarketCapReading = Pick<GlobalMarket, "totalMarketCapUsd">;

export type BtcDominanceReading = Pick<
  GlobalMarket,
  "btcDominancePercent"
>;

export type EthBtcReading = {
  ethBtcRatio: number;
};

export type DailyCandle = {
  asset: Asset;
  symbol: CandleSymbol;
  interval: CandleInterval;
  quoteCurrency: CandleQuoteCurrency;
  openedAt: string;
  closedAt: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * A chart-only Binance Spot candle. Unlike DailyCandle, the latest item may
 * still be forming and must never enter the closed-daily analysis path.
 */
export type ChartCandle = {
  asset: Asset;
  symbol: CandleSymbol;
  interval: ChartCandleInterval;
  quoteCurrency: CandleQuoteCurrency;
  state: ChartCandleState;
  openedAt: string;
  closedAt: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartCandleRequest = {
  interval: ChartCandleInterval;
  limit: number;
};

export type CandleRange = {
  from: string;
  to: string;
};

export function dailyCandleCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "historical.btc-daily-candles"
  | "historical.eth-daily-candles"
> {
  return `historical.${asset}-daily-candles`;
}

export function chartCandleCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "historical.btc-chart-candles"
  | "historical.eth-chart-candles"
> {
  return `historical.${asset}-chart-candles`;
}

export function multiTimeframeCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "analysis.btc-multi-timeframe"
  | "analysis.eth-multi-timeframe"
> {
  return `analysis.${asset}-multi-timeframe`;
}

export function keyLevelCapability(
  asset: Asset,
): Extract<MarketCapability, "analysis.btc-key-levels" | "analysis.eth-key-levels"> {
  return `analysis.${asset}-key-levels`;
}

export function historicalContextCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "analysis.btc-historical-context"
  | "analysis.eth-historical-context"
> {
  return `analysis.${asset}-historical-context`;
}

export function longTermHistoryCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "analysis.btc-long-term-history"
  | "analysis.eth-long-term-history"
> {
  return `analysis.${asset}-long-term-history`;
}

export function marketCycleCapability(
  asset: Asset,
): Extract<
  MarketCapability,
  | "analysis.btc-market-cycle"
  | "analysis.eth-market-cycle"
> {
  return `analysis.${asset}-market-cycle`;
}

export type SentimentReading = {
  value: number;
  classification: string;
};

export type FundingReading = {
  asset: Asset;
  symbol: string;
  rate: number;
  intervalHours: number | null;
};

export type OpenInterestReading = {
  asset: Asset;
  symbol: string;
  notional: number;
  quoteCurrency: "USDT";
  samplingPeriod: "5m";
  /**
   * Same-venue notional OI change over an approximately 24-hour comparison
   * window. Null means the provider could not verify a complete comparison
   * window and the UI must not infer a trend from the current snapshot.
   */
  change24hPercent?: number | null;
  comparisonWindowHours?: number | null;
};

export type LiquidationsReading = {
  asset: "all";
  totalUsd: number;
  longUsd: number | null;
  shortUsd: number | null;
  window: string;
};

export type EtfFlowReading = {
  asset: Asset;
  netFlowUsd: number;
  tradingDate: string;
};

const bypassCache: CacheMetadata = {
  status: "bypass",
  revalidateSeconds: 0,
  staleIfErrorSeconds: 0,
};

export function unavailableDatum(
  capability: MarketCapability,
  reason: UnavailableReason = "not_configured",
): UnavailableMarketDatum {
  return {
    status: "unavailable",
    capability,
    value: null,
    source: null,
    scope: null,
    updatedAt: null,
    retrievedAt: null,
    loading: false,
    stale: false,
    cache: bypassCache,
    error: null,
    reason,
  };
}

export function loadingDatum(
  capability: MarketCapability,
): LoadingMarketDatum {
  return {
    status: "loading",
    capability,
    value: null,
    source: null,
    scope: null,
    updatedAt: null,
    retrievedAt: null,
    loading: true,
    stale: false,
    cache: bypassCache,
    error: null,
  };
}
