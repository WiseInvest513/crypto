import { describe, expect, it, vi } from "vitest";
import { ResilientMarketCache } from "../../src/server/data/cache/resilient-market-cache";
import type { JsonHttpClient } from "../../src/server/data/http/fetch-json";
import { AlternativeMeProvider } from "../../src/server/data/providers/alternative-me-provider";

const NOW = Date.parse("2026-08-31T18:00:00.000Z");
const UPDATED_SECONDS = Math.floor(NOW / 1_000) - 60;
const UPDATED_AT = new Date(UPDATED_SECONDS * 1_000).toISOString();

const ASSETS = {
  btc: { id: 1, name: "Bitcoin", slug: "bitcoin", symbol: "BTC" },
  eth: { id: 1027, name: "Ethereum", slug: "ethereum", symbol: "ETH" },
} as const;

function successMetadata() {
  return {
    timestamp: UPDATED_SECONDS,
    num_cryptocurrencies: 178,
    error: null,
  };
}

function quotePayload(asset: keyof typeof ASSETS) {
  const metadata = ASSETS[asset];
  return {
    data: [
      {
        id: metadata.id,
        name: metadata.name,
        symbol: metadata.symbol,
        website_slug: metadata.slug,
        quotes: {
          USD: {
            price: asset === "btc" ? 78_578 : 2_447.62,
            market_cap:
              asset === "btc" ? 1_577_753_108_210 : 295_397_755_664,
            percentage_change_24h: asset === "btc" ? 0.74561 : -0.22135,
            percentage_change_7d: asset === "btc" ? 1.5 : -0.3,
          },
        },
        last_updated: UPDATED_SECONDS,
      },
    ],
    metadata: successMetadata(),
  };
}

function globalPayload(dominance: unknown) {
  return {
    data: {
      bitcoin_percentage_of_market_cap: dominance,
      quotes: {
        USD: { total_market_cap: 2_433_865_288_358 },
      },
      last_updated: UPDATED_SECONDS,
    },
    metadata: successMetadata(),
  };
}

function fearAndGreedPayload() {
  return {
    name: "Fear and Greed Index",
    data: [
      {
        value: "62",
        value_classification: "Greed",
        timestamp: String(UPDATED_SECONDS),
        time_until_update: "50_622".replace("_", ""),
      },
    ],
    metadata: { error: null },
  };
}

function providerFor(get: JsonHttpClient["get"]) {
  return new AlternativeMeProvider({
    http: { get },
    cache: new ResilientMarketCache({ now: () => NOW }),
    now: () => NOW,
  });
}

describe("Alternative.me provider", () => {
  it("validates, combines and caches BTC/ETH aggregate USD quotes", async () => {
    const get = vi.fn(async (url: string) =>
      url.includes("/bitcoin/") ? quotePayload("btc") : quotePayload("eth"),
    );
    const provider = providerFor(get);

    const first = await provider.getQuotes(["btc", "eth", "btc"]);
    const second = await provider.getQuotes(["eth", "btc"]);

    expect(first).toMatchObject({
      status: "fresh",
      capability: "spot.core-prices",
      source: {
        id: "alternative-me-market",
        url: "https://alternative.me/crypto/api/",
      },
      scope: {
        kind: "asset",
      },
      updatedAt: UPDATED_AT,
      cache: { status: "miss", revalidateSeconds: 300 },
      value: [
        {
          asset: "btc",
          priceUsd: 78_578,
          change24hPercent: 0.74561,
          change7dPercent: 1.5,
          marketCapUsd: 1_577_753_108_210,
        },
        {
          asset: "eth",
          priceUsd: 2_447.62,
          change24hPercent: -0.22135,
          change7dPercent: -0.3,
          marketCapUsd: 295_397_755_664,
        },
      ],
    });
    expect(second.cache.status).toBe("hit");
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith(
      "https://api.alternative.me/v2/ticker/bitcoin/?structure=array",
    );
    expect(get).toHaveBeenCalledWith(
      "https://api.alternative.me/v2/ticker/ethereum/?structure=array",
    );
  });

  it.each([
    ["live 0–1 ratio", 0.648249973306627, 64.8249973306627],
    ["documented 0–100 percentage", 55.38, 55.38],
    ["ratio upper bound", 1, 100],
    ["percentage upper bound", 100, 100],
  ])("normalizes BTC dominance from the %s shape", async (_name, raw, expected) => {
    const provider = providerFor(vi.fn(async () => globalPayload(raw)));

    const result = await provider.getGlobalMarket();

    expect(result.status).toBe("fresh");
    if (result.status === "fresh") {
      expect(result.value.totalMarketCapUsd).toBe(2_433_865_288_358);
      expect(result.value.btcDominancePercent).toBeCloseTo(expected, 10);
      expect(result.scope.label).toContain("Alternative.me");
    }
  });

  it.each([-0.0001, 100.0001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects out-of-range BTC dominance %s",
    async (dominance) => {
      const provider = providerFor(
        vi.fn(async () => globalPayload(dominance)),
      );

      await expect(provider.getGlobalMarket()).resolves.toMatchObject({
        status: "error",
        value: null,
        error: { code: "invalid_payload", retryable: false },
      });
    },
  );

  it("validates the Bitcoin-only Fear & Greed index and preserves its required attribution", async () => {
    const get = vi.fn(async () => fearAndGreedPayload());
    const provider = providerFor(get);

    const result = await provider.getFearAndGreed();

    expect(result).toMatchObject({
      status: "fresh",
      value: { value: 62, classification: "Greed" },
      source: {
        id: "alternative-me-fear-and-greed",
        url: "https://alternative.me/crypto/fear-and-greed-index/",
      },
      scope: {
        kind: "asset",
        label: "Alternative.me Bitcoin Fear & Greed Index",
      },
      updatedAt: UPDATED_AT,
      cache: { revalidateSeconds: 3_600 },
    });
    expect(get).toHaveBeenCalledWith(
      "https://api.alternative.me/fng/?limit=1&format=json",
    );
  });

  it("maps HTTP 200 metadata errors to a non-retryable upstream error", async () => {
    const provider = providerFor(
      vi.fn(async () => ({
        data: [],
        metadata: { error: "requested slug is unavailable" },
      })),
    );

    await expect(provider.getQuotes(["btc"])).resolves.toMatchObject({
      status: "error",
      error: { code: "upstream_error", retryable: false },
    });
  });

  it.each([
    ["millisecond timestamp", { last_updated: NOW }],
    ["future timestamp", { last_updated: Math.floor(NOW / 1_000) + 301 }],
    ["wrong asset identity", { symbol: "WBTC" }],
    ["missing 7d change", { percentage_change_7d: undefined }],
  ])("rejects %s before it reaches the domain", async (_name, override) => {
    const payload = quotePayload("btc");
    const entry = payload.data[0] as Record<string, unknown>;
    if ("symbol" in override) {
      Object.assign(entry, override);
    } else if ("last_updated" in override) {
      Object.assign(entry, override);
    } else {
      Object.assign(
        (entry.quotes as { USD: Record<string, unknown> }).USD,
        override,
      );
    }
    const provider = providerFor(vi.fn(async () => payload));

    await expect(provider.getQuotes(["btc"])).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
    });
  });
});
