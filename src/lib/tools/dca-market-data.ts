import type { DcaDailyPrice } from "./dca";

export type DcaMarketAsset = "btc" | "eth";
export type DcaMarketSymbol = "BTCUSDT" | "ETHUSDT";

export type DcaMarketDataSource = Readonly<{
  id: string;
  label: string;
  url: string;
  components?: readonly DcaMarketDataSource[];
}>;

export type DcaMarketDataScope = Readonly<{
  kind: "global" | "asset" | "venue" | "derived";
  label: string;
}>;

export type DcaMarketCacheMetadata = Readonly<{
  status: "hit" | "miss" | "bypass";
  revalidateSeconds: number;
  staleIfErrorSeconds: number;
}>;

export type DcaMarketDataError = Readonly<{
  code:
    | "timeout"
    | "rate_limited"
    | "upstream_error"
    | "invalid_payload"
    | "no_data";
  retryable: boolean;
}>;

export type DcaMarketUnavailableReason =
  | "not_configured"
  | "unsupported"
  | "license_restricted"
  | "no_reliable_source"
  | "no_data"
  | "insufficient_history";

export type DcaMarketRequestedRange = Readonly<{
  from: string;
  to: string;
}>;

/**
 * Client-safe projection of one Binance spot daily-close series.
 *
 * `prices` is populated only for fresh/stale data. Error and unavailable
 * datasets intentionally use an empty array rather than a synthetic value.
 */
export type DcaMarketDataset = Readonly<{
  asset: DcaMarketAsset;
  symbol: DcaMarketSymbol;
  venue: "Binance";
  quoteCurrency: "USDT";
  interval: "1d";
  timeZone: "UTC";
  candleState: "closed";
  requestedRange: DcaMarketRequestedRange;
  status: "fresh" | "stale" | "error" | "unavailable";
  prices: readonly DcaDailyPrice[];
  source: DcaMarketDataSource | null;
  scope: DcaMarketDataScope | null;
  updatedAt: string | null;
  retrievedAt: string | null;
  stale: boolean;
  cache: DcaMarketCacheMetadata;
  error: DcaMarketDataError | null;
  reason: DcaMarketUnavailableReason | null;
}>;

export type DcaMarketHistory = Readonly<{
  btc: DcaMarketDataset;
  eth: DcaMarketDataset;
}>;
