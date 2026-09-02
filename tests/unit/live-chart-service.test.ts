import { describe, expect, it } from "vitest";
import type {
  Asset,
  ChartCandleRequest,
} from "../../src/server/data/contracts/market-data";
import type { MarketProviderRegistry } from "../../src/server/data/contracts/providers";
import { ProviderError } from "../../src/server/data/errors/provider-error";
import {
  getAssetLiveChartDatum,
  isChartCandleInterval,
  isLiveChartMode,
} from "../../src/server/data/services/live-chart-service";
import { MockMarketProvider } from "../../src/server/data/testing/mock-market-provider";

function registry(provider: MockMarketProvider): MarketProviderRegistry {
  return {
    spot: provider,
    candles: provider,
    sentiment: provider,
    derivatives: provider,
    fundFlows: provider,
  };
}

class TrackingChartProvider extends MockMarketProvider {
  requests: { asset: Asset; request: ChartCandleRequest }[] = [];

  override async getChartCandles(
    asset: Asset,
    request: ChartCandleRequest,
  ) {
    this.requests.push({ asset, request });
    return super.getChartCandles(asset, request);
  }
}

describe("live chart service", () => {
  it("requests a full 1000-candle window without changing provider metadata", async () => {
    const provider = new TrackingChartProvider();

    const datum = await getAssetLiveChartDatum(
      registry(provider),
      "btc",
      "1h",
      "full",
    );

    expect(provider.requests).toEqual([
      { asset: "btc", request: { interval: "1h", limit: 1_000 } },
    ]);
    expect(datum).toMatchObject({
      status: "fresh",
      capability: "historical.btc-chart-candles",
      provenance: "synthetic",
      source: { id: "mock-development-only" },
    });
  });

  it("uses a bounded three-candle request for refresh tails", async () => {
    const provider = new TrackingChartProvider();

    await getAssetLiveChartDatum(
      registry(provider),
      "eth",
      "15m",
      "tail",
    );

    expect(provider.requests).toEqual([
      { asset: "eth", request: { interval: "15m", limit: 3 } },
    ]);
  });

  it("isolates thrown providers as a normalized error datum", async () => {
    class FailingChartProvider extends MockMarketProvider {
      override async getChartCandles(): Promise<never> {
        throw new ProviderError("timeout", true);
      }
    }

    const datum = await getAssetLiveChartDatum(
      registry(new FailingChartProvider()),
      "btc",
      "4h",
      "tail",
      () => Date.parse("2026-09-01T08:00:00.000Z"),
    );

    expect(datum).toMatchObject({
      status: "error",
      capability: "historical.btc-chart-candles",
      scope: {
        kind: "venue",
        label: "Binance BTCUSDT 现货 4h K 线（USDT，UTC，含形成中）",
      },
      retrievedAt: "2026-09-01T08:00:00.000Z",
      error: { code: "timeout", retryable: true },
    });
  });

  it("accepts only the public interval and request-mode allowlists", () => {
    expect(["15m", "1h", "4h", "1d"].every(isChartCandleInterval)).toBe(true);
    expect(isChartCandleInterval("5m")).toBe(false);
    expect(isChartCandleInterval(null)).toBe(false);
    expect(isLiveChartMode("full")).toBe(true);
    expect(isLiveChartMode("tail")).toBe(true);
    expect(isLiveChartMode("all")).toBe(false);
  });
});
