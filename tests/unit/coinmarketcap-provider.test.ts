import { describe, expect, it, vi } from "vitest";
import { ResilientMarketCache } from "../../src/server/data/cache/resilient-market-cache";
import type { JsonHttpClient } from "../../src/server/data/http/fetch-json";
import { CoinMarketCapProvider } from "../../src/server/data/providers/coinmarketcap-provider";

const NOW = Date.parse("2026-08-28T12:00:00.000Z");
const UPDATED_AT = "2026-08-28T11:59:00.000Z";

function successStatus() {
  return { error_code: 0, error_message: "" };
}

function quotePayload(overrides: Record<string, unknown> = {}) {
  return {
    status: successStatus(),
    data: [
      {
        id: 1,
        symbol: "BTC",
        quote: [
          {
            symbol: "USD",
            price: 110_000,
            percent_change_24h: 1.5,
            percent_change_7d: null,
            market_cap: 2_100_000_000_000,
            last_updated: UPDATED_AT,
            ...overrides,
          },
        ],
      },
    ],
  };
}

function coreQuotePayload(
  btcPrice: number,
  ethPrice: number,
  updatedAt: string,
  includeEth = true,
) {
  const entry = (id: number, symbol: string, price: number) => ({
    id,
    symbol,
    quote: [
      {
        symbol: "USD",
        price,
        percent_change_24h: 1,
        percent_change_7d: 2,
        market_cap: price * 1_000_000,
        last_updated: updatedAt,
      },
    ],
  });
  return {
    status: successStatus(),
    data: [
      entry(1, "BTC", btcPrice),
      ...(includeEth ? [entry(1027, "ETH", ethPrice)] : []),
    ],
  };
}

function providerFor(payload: unknown) {
  const get = vi.fn(async () => payload);
  const http: JsonHttpClient = { get };
  const provider = new CoinMarketCapProvider({
    http,
    cache: new ResilientMarketCache({ now: () => NOW }),
    now: () => NOW,
  });
  return { provider, get };
}

describe("CoinMarketCap provider", () => {
  it("validates and caches BTC spot quotes", async () => {
    const { provider, get } = providerFor(quotePayload());

    const first = await provider.getQuotes(["btc"]);
    const second = await provider.getQuotes(["btc"]);

    expect(first).toMatchObject({
      status: "fresh",
      capability: "spot.btc-price",
      source: { id: "coinmarketcap" },
      updatedAt: UPDATED_AT,
      loading: false,
      stale: false,
      cache: { status: "miss", revalidateSeconds: 300 },
      error: null,
    });
    if (first.status === "fresh") {
      expect(first.value[0]).toEqual({
        asset: "btc",
        quoteCurrency: "USD",
        priceUsd: 110_000,
        change24hPercent: 1.5,
        change7dPercent: null,
        marketCapUsd: 2_100_000_000_000,
      });
    }
    expect(second.cache.status).toBe("hit");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps per-asset LKG when a later batched response is partial", async () => {
    let current = NOW;
    let payload = coreQuotePayload(110_000, 4_400, UPDATED_AT);
    const get = vi.fn(async () => payload);
    const provider = new CoinMarketCapProvider({
      http: { get },
      cache: new ResilientMarketCache({ now: () => current }),
      now: () => current,
    });

    await Promise.all([
      provider.getQuotes(["btc"]),
      provider.getQuotes(["eth"]),
    ]);
    const combined = await provider.getQuotes(["btc", "eth"]);
    expect(combined.capability).toBe("spot.core-prices");
    expect(get).toHaveBeenCalledTimes(1);

    current += 301_000;
    payload = coreQuotePayload(
      111_000,
      0,
      new Date(current - 60_000).toISOString(),
      false,
    );
    const [btc, eth] = await Promise.all([
      provider.getQuotes(["btc"]),
      provider.getQuotes(["eth"]),
    ]);

    expect(btc).toMatchObject({
      status: "fresh",
      capability: "spot.btc-price",
      value: [{ asset: "btc", priceUsd: 111_000 }],
    });
    expect(eth).toMatchObject({
      status: "stale",
      capability: "spot.eth-price",
      value: [{ asset: "eth", priceUsd: 4_400 }],
      error: { code: "invalid_payload" },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("validates global market and CMC Fear & Greed payloads", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes("global-metrics")) {
        return {
          status: successStatus(),
          data: {
            btc_dominance: 56.4,
            last_updated: UPDATED_AT,
            quote: {
              USD: {
                total_market_cap: 3_800_000_000_000,
                last_updated: UPDATED_AT,
              },
            },
          },
        };
      }
      return {
        status: successStatus(),
        data: {
          value: 42,
          value_classification: "Fear",
          update_time: UPDATED_AT,
        },
      };
    });
    const provider = new CoinMarketCapProvider({
      http: { get },
      cache: new ResilientMarketCache({ now: () => NOW }),
      now: () => NOW,
    });

    const global = await provider.getGlobalMarket();
    const sentiment = await provider.getFearAndGreed();

    expect(global).toMatchObject({
      status: "fresh",
      value: {
        totalMarketCapUsd: 3_800_000_000_000,
        btcDominancePercent: 56.4,
      },
    });
    expect(sentiment).toMatchObject({
      status: "fresh",
      value: { value: 42, classification: "Fear" },
      scope: { kind: "global" },
    });
  });

  it("keeps liquidations unavailable until a server key is configured", async () => {
    const { provider, get } = providerFor({});

    await expect(provider.getLiquidations()).resolves.toMatchObject({
      status: "unavailable",
      reason: "not_configured",
      source: null,
      updatedAt: null,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("validates keyed global liquidation totals and sends the key in a header", async () => {
    const get = vi.fn(async () => ({
      status: successStatus(),
      data: {
        quotes: [
          {
            symbol: "USD",
            total_liquidations_24h: 500_000_000,
            long_liquidations_24h: 350_000_000,
            short_liquidations_24h: 150_000_000,
            last_updated: UPDATED_AT,
          },
        ],
      },
    }));
    const provider = new CoinMarketCapProvider({
      apiKey: "server-secret",
      http: { get },
      cache: new ResilientMarketCache({ now: () => NOW }),
      now: () => NOW,
    });

    const result = await provider.getLiquidations();

    expect(result).toMatchObject({
      status: "fresh",
      value: {
        asset: "all",
        totalUsd: 500_000_000,
        longUsd: 350_000_000,
        shortUsd: 150_000_000,
        window: "24h",
      },
    });
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("/v5/derivatives/liquidations/quotes/latest"),
      { headers: { "X-CMC_PRO_API_KEY": "server-secret" } },
    );
  });

  it("treats HTTP 200 business errors as provider errors", async () => {
    const { provider } = providerFor({
      status: { error_code: 1001, error_message: "business failure" },
      data: [],
    });

    await expect(provider.getQuotes(["btc"])).resolves.toMatchObject({
      status: "error",
      error: { code: "upstream_error", retryable: false },
    });
  });

  it.each([
    ["null price", { price: null }],
    ["NaN price", { price: Number.NaN }],
    ["millisecond number in an ISO field", { last_updated: NOW }],
    ["future timestamp", { last_updated: "2030-01-01T00:00:00.000Z" }],
  ])("rejects %s before it reaches the domain", async (_name, override) => {
    const { provider } = providerFor(quotePayload(override));

    await expect(provider.getQuotes(["btc"])).resolves.toMatchObject({
      status: "error",
      value: null,
      updatedAt: null,
      error: { code: "invalid_payload", retryable: false },
    });
  });
});
