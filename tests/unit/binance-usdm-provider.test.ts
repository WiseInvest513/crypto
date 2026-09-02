import { describe, expect, it, vi } from "vitest";
import { ResilientMarketCache } from "../../src/server/data/cache/resilient-market-cache";
import type { JsonHttpClient } from "../../src/server/data/http/fetch-json";
import {
  BINANCE_USDM_HTTP_POLICY,
  BinanceUsdMProvider,
} from "../../src/server/data/providers/binance-usdm-provider";

const NOW = Date.parse("2026-08-28T12:00:00.000Z");
const UPDATED = NOW - 30_000;

function createProvider(get: JsonHttpClient["get"]) {
  return new BinanceUsdMProvider({
    http: { get },
    cache: new ResilientMarketCache({ now: () => NOW }),
    now: () => NOW,
  });
}

describe("Binance USDⓈ-M provider", () => {
  it("uses one short attempt for non-core derivatives requests", () => {
    expect(BINANCE_USDM_HTTP_POLICY).toEqual({
      timeoutMs: 2_500,
      maxAttempts: 1,
    });
  });

  it("returns venue-scoped funding and open interest", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes("premiumIndex")) {
        return {
          symbol: "BTCUSDT",
          lastFundingRate: "0.000123",
          time: UPDATED,
        };
      }
      return [
        {
          symbol: "BTCUSDT",
          sumOpenInterestValue: "12450000000.25",
          timestamp: UPDATED,
        },
      ];
    });
    const provider = createProvider(get);

    const funding = await provider.getFunding("btc");
    const openInterest = await provider.getOpenInterest("btc");

    expect(funding).toMatchObject({
      status: "fresh",
      value: {
        asset: "btc",
        symbol: "BTCUSDT",
        rate: 0.000123,
        intervalHours: null,
      },
      source: { id: "binance-usdm" },
      scope: { kind: "venue" },
    });
    expect(openInterest).toMatchObject({
      status: "fresh",
      value: {
        asset: "btc",
        symbol: "BTCUSDT",
        notional: 12_450_000_000.25,
        quoteCurrency: "USDT",
        samplingPeriod: "5m",
      },
      scope: { label: expect.stringContaining("BTCUSDT") },
    });
  });

  it("rejects Binance business errors returned with HTTP 200", async () => {
    const provider = createProvider(
      vi.fn(async () => ({ code: -1121, msg: "Invalid symbol." })),
    );

    await expect(provider.getFunding("btc")).resolves.toMatchObject({
      status: "error",
      error: { code: "upstream_error", retryable: false },
    });
  });

  it("marks minute-scale Binance snapshots stale instead of treating hours-old data as fresh", async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes("premiumIndex")) {
        return {
          symbol: "BTCUSDT",
          lastFundingRate: "0.0001",
          time: NOW - 6 * 60_000,
        };
      }
      return [
        {
          symbol: "BTCUSDT",
          sumOpenInterestValue: "1000000",
          timestamp: NOW - 11 * 60_000,
        },
      ];
    });
    const provider = createProvider(get);

    await expect(provider.getFunding("btc")).resolves.toMatchObject({
      status: "stale",
      stale: true,
      error: null,
    });
    await expect(provider.getOpenInterest("btc")).resolves.toMatchObject({
      status: "stale",
      stale: true,
      value: { samplingPeriod: "5m" },
    });
  });

  it.each([
    ["null notional", { sumOpenInterestValue: null, timestamp: UPDATED }],
    ["NaN notional", { sumOpenInterestValue: Number.NaN, timestamp: UPDATED }],
    [
      "seconds passed as milliseconds",
      { sumOpenInterestValue: 10_000, timestamp: Math.floor(UPDATED / 1_000) },
    ],
  ])("rejects %s", async (_name, override) => {
    const provider = createProvider(
      vi.fn(async () => [{ symbol: "ETHUSDT", ...override }]),
    );

    await expect(provider.getOpenInterest("eth")).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
    });
  });

  it("does not relabel Binance data as global liquidations", async () => {
    const provider = createProvider(vi.fn());

    await expect(provider.getLiquidations()).resolves.toMatchObject({
      status: "unavailable",
      reason: "no_reliable_source",
      source: null,
    });
  });
});
