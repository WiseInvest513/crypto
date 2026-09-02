import { describe, expect, it } from "vitest";
import { presentMarketDatum } from "../../src/lib/market/homepage-presentation";
import type {
  Asset,
  DataSource,
  MarketDatum,
  PriceQuote,
} from "../../src/server/data/contracts/market-data";
import type { MarketProviderRegistry } from "../../src/server/data/contracts/providers";
import {
  binanceSpotSource,
  binanceUsdMSource,
  coinMarketCapSource,
} from "../../src/server/data/providers/sources";
import { getMarketSnapshot } from "../../src/server/data/services/market-snapshot-service";
import { MockMarketProvider } from "../../src/server/data/testing/mock-market-provider";

const NOW = () => Date.parse("2026-01-01T00:00:01.000Z");

const btcSource: DataSource = {
  id: "btc-spot-source",
  label: "BTC 现货来源",
  url: "https://example.com/btc",
};

const ethSource: DataSource = {
  id: "eth-spot-source",
  label: "ETH 现货来源",
  url: "https://example.com/eth",
};

class BatchQuoteSourceProvider extends MockMarketProvider {
  quoteRequests: readonly Asset[][] = [];

  override async getQuotes(
    assets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    this.quoteRequests = [...this.quoteRequests, [...assets]];
    const datum = await super.getQuotes(assets);
    if (datum.status !== "fresh" && datum.status !== "stale") {
      return datum;
    }

    return {
      ...datum,
      source: {
        id: "verified-core-batch",
        label: "BTC 与 ETH 同批报价",
        url: "https://example.com/core-batch",
        components: [btcSource, ethSource],
      },
      provenance: "live",
    };
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

describe("market data source lineage", () => {
  it("preserves both verified inputs on the derived ETH/BTC source", async () => {
    const provider = new BatchQuoteSourceProvider();
    const snapshot = await getMarketSnapshot(registry(provider), NOW);

    expect(provider.quoteRequests).toHaveLength(3);
    expect(provider.quoteRequests).toContainEqual(["btc"]);
    expect(provider.quoteRequests).toContainEqual(["eth"]);
    expect(provider.quoteRequests).toContainEqual(["btc", "eth"]);
    expect(snapshot.ethBtc).toMatchObject({
      status: "fresh",
      provenance: "derived",
      source: {
        id: "wise-crypto-derived",
        label: "Wise Crypto 派生指标",
        components: [
          {
            id: "verified-core-batch",
            components: [btcSource, ethSource],
          },
        ],
      },
    });

    const presentation = presentMarketDatum(snapshot.ethBtc, (value) => ({
      primary: value.ethBtcRatio.toFixed(4),
    }));
    expect(presentation.source?.components).toEqual([
      expect.objectContaining({
        id: "verified-core-batch",
        components: [btcSource, ethSource],
      }),
    ]);
  });

  it("deduplicates a shared upstream source without losing lineage", async () => {
    const snapshot = await getMarketSnapshot(
      registry(new MockMarketProvider()),
      NOW,
    );

    expect(snapshot.ethBtc.source?.components).toHaveLength(1);
    expect(snapshot.ethBtc.source?.components?.[0]).toMatchObject({
      id: "mock-development-only",
    });
    expect(snapshot.ethBtc).toMatchObject({ provenance: "synthetic" });
  });

  it("uses Chinese-facing labels while retaining provider brands", () => {
    expect(coinMarketCapSource.label).toBe("CoinMarketCap");
    expect(binanceSpotSource.label).toBe("Binance 现货市场数据");
    expect(binanceUsdMSource.label).toBe(
      "Binance USDⓈ-M 合约市场数据",
    );
  });
});
