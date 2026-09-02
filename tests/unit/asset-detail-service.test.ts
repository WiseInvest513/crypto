import { describe, expect, it } from "vitest";
import type {
  Asset,
  AvailableMarketDatum,
  CandleRange,
  DailyCandle,
  DataScope,
  MarketCapability,
  MarketDatum,
  PriceQuote,
} from "../../src/server/data/contracts/market-data";
import type { MarketProviderRegistry } from "../../src/server/data/contracts/providers";
import { ProviderError } from "../../src/server/data/errors/provider-error";
import {
  closedDailyRange,
  getAssetChartSnapshot,
  getAssetContextSnapshot,
  getAssetDetailSnapshot,
  getAssetPriceDatum,
} from "../../src/server/data/services/asset-detail-service";
import { MockMarketProvider } from "../../src/server/data/testing/mock-market-provider";

const NOW_MILLISECONDS = Date.parse("2026-08-31T12:34:56.000Z");
const NOW = () => NOW_MILLISECONDS;
const LIVE_SOURCE = {
  id: "verified-fixture",
  label: "已核验测试来源",
  url: "https://example.com/verified-fixture",
};

function liveDatum<T>(
  capability: MarketCapability,
  value: T,
  scope: DataScope,
): AvailableMarketDatum<T> {
  return {
    status: "fresh",
    capability,
    value,
    source: LIVE_SOURCE,
    scope,
    updatedAt: "2026-08-30T23:59:59.999Z",
    retrievedAt: "2026-08-31T12:00:00.000Z",
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 900,
      staleIfErrorSeconds: 604_800,
    },
    error: null,
  };
}

class TrackingLiveProvider extends MockMarketProvider {
  quoteRequests: readonly Asset[][] = [];
  globalRequests = 0;
  candleRange: CandleRange | null = null;

  override async getQuotes(
    assets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    this.quoteRequests = [...this.quoteRequests, [...assets]];
    const quotes = assets.map<PriceQuote>((asset) => ({
      asset,
      quoteCurrency: "USD",
      priceUsd: asset === "btc" ? 100_000 : 4_000,
      change24hPercent: 1,
      change7dPercent: 2,
      marketCapUsd: null,
    }));
    return liveDatum(
      assets.length === 1 ? `spot.${assets[0]}-price` : "spot.core-prices",
      quotes,
      { kind: "asset", label: "Verified aggregate quotes" },
    );
  }

  override async getGlobalMarket() {
    this.globalRequests += 1;
    return liveDatum(
      "spot.market-cap",
      { totalMarketCapUsd: 3_500_000_000_000, btcDominancePercent: 57 },
      { kind: "global", label: "Verified global market" },
    );
  }

  override async getDailyCandles(
    asset: Asset,
    range: CandleRange,
  ): Promise<MarketDatum<readonly DailyCandle[]>> {
    this.candleRange = range;
    return liveDatum(
      `historical.${asset}-daily-candles`,
      dailyCandles(asset, 60),
      { kind: "venue", label: `Binance ${asset.toUpperCase()}USDT daily` },
    );
  }
}

function registry(provider: MockMarketProvider): MarketProviderRegistry {
  return {
    spot: provider,
    candles: provider,
    sentiment: provider,
    derivatives: provider,
    fundFlows: provider,
  };
}

function dailyCandles(asset: Asset, count: number): readonly DailyCandle[] {
  const start = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 86_400_000;
  const base = asset === "btc" ? 90_000 : 3_000;
  return Array.from({ length: count }, (_, index) => {
    const close = base + index * 100;
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" as const : "ETHUSDT" as const,
      interval: "1d" as const,
      quoteCurrency: "USDT" as const,
      openedAt: new Date(start + index * day).toISOString(),
      closedAt: new Date(start + (index + 1) * day - 1).toISOString(),
      open: close - 20,
      high: close + 40,
      low: close - 60,
      close,
      volume: 1_000 + index,
    };
  });
}

describe("asset detail service", () => {
  it("loads only the BTC data slice and derives objective SMA facts", async () => {
    const provider = new TrackingLiveProvider();
    const snapshot = await getAssetDetailSnapshot(
      registry(provider),
      "btc",
      NOW,
    );

    expect(provider.quoteRequests).toEqual([["btc"]]);
    expect(provider.globalRequests).toBe(1);
    expect(provider.candleRange).toEqual({
      from: "2025-07-07T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    });
    expect(snapshot.price).toMatchObject({
      status: "fresh",
      value: { asset: "btc", priceUsd: 100_000 },
    });
    expect(snapshot.technical).toMatchObject({
      status: "fresh",
      provenance: "derived",
      value: {
        status: "available",
        movingAverageMethod: "simple",
        trend: { state: "upward_alignment" },
      },
      source: {
        id: "wise-crypto-sma",
        components: [LIVE_SOURCE],
      },
    });
    expect(snapshot.comparison).toMatchObject({
      kind: "btc-dominance",
      datum: { value: { btcDominancePercent: 57 } },
    });
  });

  it("uses one BTC/ETH quote batch for ETH/BTC and skips global metrics", async () => {
    const provider = new TrackingLiveProvider();
    const snapshot = await getAssetDetailSnapshot(
      registry(provider),
      "eth",
      NOW,
    );

    expect(provider.quoteRequests).toHaveLength(2);
    expect(provider.quoteRequests).toContainEqual(["eth"]);
    expect(provider.quoteRequests).toContainEqual(["btc", "eth"]);
    expect(provider.globalRequests).toBe(0);
    expect(snapshot.comparison).toMatchObject({
      kind: "eth-btc",
      datum: {
        status: "fresh",
        value: { ethBtcRatio: 0.04 },
        provenance: "derived",
      },
    });
  });

  it("keeps the ETH headline available when only its comparison batch fails", async () => {
    class ComparisonFailureProvider extends TrackingLiveProvider {
      override async getQuotes(assets: readonly Asset[]) {
        if (assets.length > 1) {
          throw new ProviderError("timeout", true);
        }
        return super.getQuotes(assets);
      }
    }

    const snapshot = await getAssetDetailSnapshot(
      registry(new ComparisonFailureProvider()),
      "eth",
      NOW,
    );

    expect(snapshot.price.status).toBe("fresh");
    expect(snapshot.comparison).toMatchObject({
      kind: "eth-btc",
      datum: {
        status: "error",
        error: { code: "timeout", retryable: true },
      },
    });
  });

  it("isolates candle failures and keeps the other asset facts available", async () => {
    class CandleFailureProvider extends TrackingLiveProvider {
      override async getDailyCandles(): Promise<never> {
        throw new ProviderError("timeout", true);
      }
    }

    const snapshot = await getAssetDetailSnapshot(
      registry(new CandleFailureProvider()),
      "btc",
      NOW,
    );

    expect(snapshot.candles).toMatchObject({
      status: "error",
      error: { code: "timeout", retryable: true },
    });
    expect(snapshot.technical).toMatchObject({
      status: "error",
      error: { code: "timeout", retryable: true },
    });
    expect(snapshot.price.status).toBe("fresh");
    expect(snapshot.funding.status).toBe("fresh");
  });

  it("lets price and chart resolve without waiting for slow derivatives", async () => {
    class SlowDerivativesProvider extends TrackingLiveProvider {
      override async getFunding(): Promise<never> {
        return new Promise<never>(() => undefined);
      }
    }

    const provider = new SlowDerivativesProvider();
    const providers = registry(provider);
    const price = getAssetPriceDatum(providers, "btc", NOW);
    const chart = getAssetChartSnapshot(providers, "btc", NOW);
    const context = getAssetContextSnapshot(providers, "btc", NOW);
    let contextSettled = false;
    void context.finally(() => {
      contextSettled = true;
    });

    await expect(price).resolves.toMatchObject({ status: "fresh" });
    await expect(chart).resolves.toMatchObject({
      candles: { status: "fresh" },
      technical: { status: "fresh" },
    });
    await Promise.resolve();
    expect(contextSettled).toBe(false);
  });

  it("propagates synthetic provenance through derived technical data", async () => {
    const snapshot = await getAssetDetailSnapshot(
      registry(new MockMarketProvider()),
      "btc",
      NOW,
    );

    expect(snapshot.technical).toMatchObject({
      status: "fresh",
      provenance: "synthetic",
    });
  });

  it("creates a stable UTC range and rejects invalid current time", () => {
    expect(closedDailyRange(NOW_MILLISECONDS)).toEqual({
      from: "2025-07-07T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    });
    expect(() => closedDailyRange(Number.NaN)).toThrow("must be finite");
  });
});
