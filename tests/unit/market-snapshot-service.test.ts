import { describe, expect, it } from "vitest";
import type { Asset } from "../../src/server/data/contracts/market-data";
import type { MarketProviderRegistry } from "../../src/server/data/contracts/providers";
import { ProviderError } from "../../src/server/data/errors/provider-error";
import {
  createLoadingMarketCoreSnapshot,
  createLoadingMarketIndicatorSnapshot,
  createLoadingMarketSnapshot,
  getMarketCoreSnapshot,
  getMarketIndicatorSnapshot,
  getMarketPulseSnapshot,
  getMarketQuoteSnapshot,
  getMarketSnapshot,
} from "../../src/server/data/services/market-snapshot-service";
import { MockMarketProvider } from "../../src/server/data/testing/mock-market-provider";

const FIXTURE_NOW = () => Date.parse("2026-01-01T00:00:01.000Z");

function registryFor(provider: MockMarketProvider): MarketProviderRegistry {
  return {
    spot: provider,
    candles: provider,
    sentiment: provider,
    derivatives: provider,
    fundFlows: provider,
  };
}

describe("market snapshot service", () => {
  it("exposes core and supporting indicators as independently loadable snapshots", async () => {
    const registry = registryFor(new MockMarketProvider());
    const [core, indicators] = await Promise.all([
      getMarketCoreSnapshot(registry, FIXTURE_NOW),
      getMarketIndicatorSnapshot(registry, FIXTURE_NOW),
    ]);

    expect(Object.keys(core)).toEqual([
      "btcPrice",
      "ethPrice",
      "marketCap",
      "fearAndGreed",
      "btcDominance",
      "ethBtc",
    ]);
    expect(Object.keys(indicators)).toEqual([
      "btcFunding",
      "ethFunding",
      "btcOpenInterest",
      "ethOpenInterest",
      "liquidations24h",
      "btcEtfFlow",
      "ethEtfFlow",
    ]);
    expect(core.btcPrice.status).toBe("fresh");
    expect(indicators.btcFunding.status).toBe("fresh");
  });

  it("does not invoke supporting providers while loading the core snapshot", async () => {
    class IndicatorTrackingProvider extends MockMarketProvider {
      indicatorCalls = 0;

      override async getFunding(asset: Asset) {
        this.indicatorCalls += 1;
        return super.getFunding(asset);
      }

      override async getOpenInterest(asset: Asset) {
        this.indicatorCalls += 1;
        return super.getOpenInterest(asset);
      }

      override async getLiquidations() {
        this.indicatorCalls += 1;
        return super.getLiquidations();
      }

      override async getBtcEtfFlow() {
        this.indicatorCalls += 1;
        return super.getBtcEtfFlow();
      }

      override async getEthEtfFlow() {
        this.indicatorCalls += 1;
        return super.getEthEtfFlow();
      }
    }

    const provider = new IndicatorTrackingProvider();
    const core = await getMarketCoreSnapshot(
      registryFor(provider),
      FIXTURE_NOW,
    );

    expect(core.btcPrice.status).toBe("fresh");
    expect(provider.indicatorCalls).toBe(0);
  });

  it("lets asset quotes resolve without waiting for slow global metrics", async () => {
    class SlowGlobalProvider extends MockMarketProvider {
      override async getGlobalMarket(): Promise<never> {
        return new Promise<never>(() => undefined);
      }
    }

    const providers = registryFor(new SlowGlobalProvider());
    const quotes = getMarketQuoteSnapshot(providers, FIXTURE_NOW);
    const pulse = getMarketPulseSnapshot(providers, FIXTURE_NOW);
    let pulseSettled = false;
    void pulse.finally(() => {
      pulseSettled = true;
    });

    await expect(quotes).resolves.toMatchObject({
      btcPrice: { status: "fresh" },
      ethPrice: { status: "fresh" },
    });
    await Promise.resolve();
    expect(pulseSettled).toBe(false);
  });

  it("returns every Phase 2 metric and derives ETH/BTC from validated prices", async () => {
    const snapshot = await getMarketSnapshot(
      registryFor(new MockMarketProvider()),
      FIXTURE_NOW,
    );

    expect(Object.keys(snapshot)).toHaveLength(13);
    expect(snapshot.btcPrice).toMatchObject({
      status: "fresh",
      value: { asset: "btc", priceUsd: 100_000 },
    });
    expect(snapshot.marketCap).toMatchObject({
      status: "fresh",
      value: { totalMarketCapUsd: 3_500_000_000_000 },
    });
    expect(snapshot.btcDominance).toMatchObject({
      status: "fresh",
      value: { btcDominancePercent: 57 },
    });
    expect(snapshot.ethBtc).toMatchObject({
      status: "fresh",
      value: { ethBtcRatio: 0.04 },
      provenance: "synthetic",
      scope: { kind: "derived" },
    });
  });

  it("starts core and indicator groups concurrently when composing the legacy snapshot", async () => {
    let signalIndicatorStarted: () => void = () => undefined;
    const indicatorStarted = new Promise<void>((resolve) => {
      signalIndicatorStarted = resolve;
    });

    class CoordinatedProvider extends MockMarketProvider {
      override async getQuotes(assets: readonly Asset[]) {
        await indicatorStarted;
        return super.getQuotes(assets);
      }

      override async getFunding(asset: Asset) {
        signalIndicatorStarted();
        return super.getFunding(asset);
      }
    }

    const snapshot = await getMarketSnapshot(
      registryFor(new CoordinatedProvider()),
      FIXTURE_NOW,
    );

    expect(snapshot.btcPrice.status).toBe("fresh");
    expect(snapshot.btcFunding.status).toBe("fresh");
  });

  it("isolates one provider failure instead of rejecting the snapshot", async () => {
    class SentimentFailureProvider extends MockMarketProvider {
      override async getFearAndGreed(): Promise<never> {
        throw new ProviderError("timeout", true);
      }
    }

    const snapshot = await getMarketSnapshot(
      registryFor(new SentimentFailureProvider()),
      FIXTURE_NOW,
    );

    expect(snapshot.fearAndGreed).toMatchObject({
      status: "error",
      error: { code: "timeout", retryable: true },
    });
    expect(snapshot.btcPrice.status).toBe("fresh");
    expect(snapshot.ethFunding.status).toBe("fresh");
    expect(snapshot.btcEtfFlow.status).toBe("fresh");
  });

  it("requests BTC and ETH in one batch so ETH/BTC never mixes quote batches", async () => {
    class BatchTrackingProvider extends MockMarketProvider {
      quoteRequests: readonly Asset[][] = [];

      override async getQuotes(assets: readonly Asset[]) {
        this.quoteRequests = [...this.quoteRequests, [...assets]];
        return super.getQuotes(assets);
      }
    }

    const provider = new BatchTrackingProvider();
    const snapshot = await getMarketSnapshot(
      registryFor(provider),
      FIXTURE_NOW,
    );

    expect(provider.quoteRequests).toHaveLength(3);
    expect(provider.quoteRequests).toContainEqual(["btc"]);
    expect(provider.quoteRequests).toContainEqual(["eth"]);
    expect(provider.quoteRequests).toContainEqual(["btc", "eth"]);
    expect(snapshot.btcPrice.status).toBe("fresh");
    expect(snapshot.ethPrice.status).toBe("fresh");
    expect(snapshot.ethBtc).toMatchObject({
      status: "fresh",
      capability: "spot.eth-btc",
    });
    expect(snapshot.marketCap.status).toBe("fresh");
  });

  it("keeps the ETH headline when BTC and the ratio batch fail", async () => {
    class BtcFailureProvider extends MockMarketProvider {
      override async getQuotes(assets: readonly Asset[]) {
        if (assets.includes("btc")) {
          throw new ProviderError("rate_limited", true);
        }
        return super.getQuotes(assets);
      }
    }

    const snapshot = await getMarketSnapshot(
      registryFor(new BtcFailureProvider()),
      FIXTURE_NOW,
    );

    expect(snapshot.btcPrice).toMatchObject({
      status: "error",
      error: { code: "rate_limited" },
    });
    expect(snapshot.ethPrice.status).toBe("fresh");
    expect(snapshot.ethBtc).toMatchObject({
      status: "error",
      capability: "spot.eth-btc",
    });
    expect(snapshot.marketCap.status).toBe("fresh");
  });

  it("provides explicit loading values for every snapshot field", () => {
    const coreLoading = createLoadingMarketCoreSnapshot();
    const indicatorLoading = createLoadingMarketIndicatorSnapshot();
    const loading = createLoadingMarketSnapshot();

    expect(Object.keys(coreLoading)).toHaveLength(6);
    expect(Object.keys(indicatorLoading)).toHaveLength(7);
    expect(loading).toEqual({ ...coreLoading, ...indicatorLoading });

    for (const datum of Object.values(loading)) {
      expect(datum).toMatchObject({
        status: "loading",
        value: null,
        source: null,
        updatedAt: null,
        loading: true,
        stale: false,
        error: null,
        cache: { status: "bypass" },
      });
    }
  });
});
