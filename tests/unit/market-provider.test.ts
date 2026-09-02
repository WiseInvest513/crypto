import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarketProviderRegistry } from "../../src/server/data/provider-registry";
import { createTestingRegistry } from "../../src/server/data/testing/create-testing-registry";

describe("market provider registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses live production providers without enabling synthetic data", async () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "");
    const registry = createMarketProviderRegistry();

    expect(registry.spot.mode).toBe("live");
    expect(registry.candles.mode).toBe("live");
    expect(registry.sentiment.mode).toBe("live");
    expect(registry.derivatives.mode).toBe("live");
    expect(registry.fundFlows.mode).toBe("unavailable");
    expect(registry.spot.id).toBe(
      "fallback:alternative-me->coinmarketcap",
    );
    await expect(registry.derivatives.getLiquidations()).resolves.toMatchObject({
      status: "unavailable",
      reason: "not_configured",
    });
    await expect(registry.fundFlows.getBtcEtfFlow()).resolves.toMatchObject({
      status: "unavailable",
      reason: "license_restricted",
    });
  });

  it("prefers authenticated CoinMarketCap and keeps Alternative.me as fallback", () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "server-only-key");

    const registry = createMarketProviderRegistry();

    expect(registry.spot.id).toBe(
      "fallback:coinmarketcap->alternative-me",
    );
    expect(registry.sentiment).toBe(registry.spot);
  });

  it("does not enable synthetic data unless explicitly requested", () => {
    const registry = createTestingRegistry({
      runtime: "development",
      enableSyntheticData: false,
    });

    expect(registry.spot.mode).toBe("live");
  });

  it("rejects synthetic data in production", () => {
    expect(() =>
      createTestingRegistry({
        runtime: "production",
        enableSyntheticData: true,
      }),
    ).toThrow("Synthetic market data is forbidden in production.");
  });

  it("labels explicitly enabled development data as synthetic", async () => {
    const registry = createTestingRegistry({
      runtime: "development",
      enableSyntheticData: true,
    });
    const quotes = await registry.spot.getQuotes(["btc"]);
    const candles = await registry.candles.getDailyCandles("btc", {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
    });

    expect(registry.spot.mode).toBe("mock");
    expect(registry.candles.mode).toBe("mock");
    expect(quotes.status).toBe("fresh");
    if (quotes.status === "fresh") {
      expect(quotes.provenance).toBe("synthetic");
      expect(quotes.source.label).toBe("Mock / Development only");
      expect(quotes.scope.kind).toBe("asset");
      expect(quotes.loading).toBe(false);
      expect(quotes.error).toBeNull();
    }
    expect(candles).toMatchObject({
      status: "fresh",
      capability: "historical.btc-daily-candles",
      provenance: "synthetic",
    });
  });
});
