import { describe, expect, it } from "vitest";
import type {
  AvailableMarketDatum,
  PriceQuote,
} from "../../src/server/data/contracts/market-data";
import {
  incoherentQuoteBatchDatum,
  MAX_QUOTE_TIMESTAMP_SKEW_MILLISECONDS,
} from "../../src/server/data/providers/quote-coherence";
import { coinMarketCapSource } from "../../src/server/data/providers/sources";

const BASE_TIME = Date.parse("2026-08-31T12:00:00.000Z");
const scope = { kind: "asset" as const, label: "BTC/USD 与 ETH/USD" };

function quote(
  asset: "btc" | "eth",
  updatedAtMilliseconds: number,
): AvailableMarketDatum<PriceQuote> {
  return {
    status: "fresh",
    capability: asset === "btc" ? "spot.btc-price" : "spot.eth-price",
    value: {
      asset,
      quoteCurrency: "USD",
      priceUsd: asset === "btc" ? 100_000 : 4_000,
      change24hPercent: null,
      change7dPercent: null,
      marketCapUsd: null,
    },
    source: coinMarketCapSource,
    scope,
    updatedAt: new Date(updatedAtMilliseconds).toISOString(),
    retrievedAt: "2026-08-31T12:01:00.000Z",
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "hit",
      revalidateSeconds: 600,
      staleIfErrorSeconds: 900,
    },
    error: null,
  };
}

describe("quote timestamp coherence", () => {
  it("accepts a same-provider pair at the maximum permitted skew", () => {
    expect(
      incoherentQuoteBatchDatum(
        "spot.core-prices",
        coinMarketCapSource,
        scope,
        [
          quote("btc", BASE_TIME),
          quote("eth", BASE_TIME + MAX_QUOTE_TIMESTAMP_SKEW_MILLISECONDS),
        ],
      ),
    ).toBeNull();
  });

  it("rejects a pair whose source timestamps are too far apart", () => {
    expect(
      incoherentQuoteBatchDatum(
        "spot.core-prices",
        coinMarketCapSource,
        scope,
        [
          quote("btc", BASE_TIME),
          quote(
            "eth",
            BASE_TIME + MAX_QUOTE_TIMESTAMP_SKEW_MILLISECONDS + 1,
          ),
        ],
      ),
    ).toMatchObject({
      status: "error",
      source: coinMarketCapSource,
      scope,
      retrievedAt: "2026-08-31T12:01:00.000Z",
      error: { code: "invalid_payload", retryable: false },
    });
  });
});
