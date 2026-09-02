import "server-only";

import type {
  AvailableMarketDatum,
  DataScope,
  DataSource,
  ErrorMarketDatum,
  MarketCapability,
  PriceQuote,
} from "../contracts/market-data";

export const MAX_QUOTE_TIMESTAMP_SKEW_MILLISECONDS = 10 * 60 * 1_000;

export function incoherentQuoteBatchDatum(
  capability: MarketCapability,
  source: DataSource,
  scope: DataScope,
  quotes: readonly AvailableMarketDatum<PriceQuote>[],
): ErrorMarketDatum | null {
  if (quotes.length < 2) {
    return null;
  }

  const updatedTimes = quotes.map((quote) => Date.parse(quote.updatedAt));
  const coherent =
    updatedTimes.every(Number.isFinite) &&
    Math.max(...updatedTimes) - Math.min(...updatedTimes) <=
      MAX_QUOTE_TIMESTAMP_SKEW_MILLISECONDS;

  if (coherent) {
    return null;
  }

  return {
    status: "error",
    capability,
    value: null,
    source,
    scope,
    updatedAt: null,
    retrievedAt: newestTimestamp(quotes.map((quote) => quote.retrievedAt)),
    loading: false,
    stale: false,
    cache: {
      status: quotes.every((quote) => quote.cache.status === "hit")
        ? "hit"
        : "miss",
      revalidateSeconds: Math.min(
        ...quotes.map((quote) => quote.cache.revalidateSeconds),
      ),
      staleIfErrorSeconds: Math.min(
        ...quotes.map((quote) => quote.cache.staleIfErrorSeconds),
      ),
    },
    error: { code: "invalid_payload", retryable: false },
  };
}

function newestTimestamp(timestamps: readonly string[]): string {
  return timestamps.reduce((newest, timestamp) =>
    Date.parse(timestamp) > Date.parse(newest) ? timestamp : newest,
  );
}
