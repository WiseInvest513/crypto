import { describe, expect, it, vi } from "vitest";
import { chartIntervalMilliseconds } from "@/lib/market/live-chart";
import { MULTI_TIMEFRAME_INTERVALS } from "@/lib/market/multi-timeframe";
import { parsePublicResearchSnapshot } from "@/lib/market/public-research";
import {
  chartCandleCapability,
  dailyCandleCapability,
  unavailableDatum,
  type Asset,
  type AvailableMarketDatum,
  type ChartCandle,
  type ChartCandleInterval,
  type ChartCandleRequest,
  type MarketDatum,
} from "@/server/data/contracts/market-data";
import type { CandleProvider, MarketProviderRegistry } from "@/server/data/contracts/providers";
import { ProviderError } from "@/server/data/errors/provider-error";
import { binanceSpotSource } from "@/server/data/providers/sources";
import { loadAssetResearchSnapshot } from "@/server/data/services/public-research-service";

const NOW = Date.parse("2026-09-03T08:05:00.000Z");
const SOURCE = binanceSpotSource;

function candles(asset: Asset, interval: ChartCandleInterval, now: number, count = 240): readonly ChartCandle[] {
  const duration = chartIntervalMilliseconds[interval];
  const lastOpen = Math.floor(now / duration) * duration;
  const base = asset === "btc" ? 50_000 : 2_000;
  return Array.from({ length: count + 1 }, (_, index) => {
    const open = lastOpen - (count - index) * duration;
    const close = base + Math.sin(open / duration) * 20;
    return {
      asset, symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT", interval,
      quoteCurrency: "USDT", state: index === count ? "forming" : "closed",
      openedAt: new Date(open).toISOString(), closedAt: new Date(open + duration - 1).toISOString(),
      open: close - 1, high: close + 5, low: close - 5, close, volume: 100,
    };
  });
}

function datum(asset: Asset, interval: ChartCandleInterval, now = NOW, count = 240): AvailableMarketDatum<readonly ChartCandle[]> {
  return {
    status: "fresh", capability: chartCandleCapability(asset), value: candles(asset, interval, now, count),
    source: SOURCE, scope: { kind: "venue", label: `${asset.toUpperCase()}USDT ${interval}` },
    updatedAt: new Date(now).toISOString(), updatedAtKind: "observed", retrievedAt: new Date(now).toISOString(),
    loading: false, stale: false, provenance: "live", error: null,
    cache: { status: "miss", revalidateSeconds: 5, staleIfErrorSeconds: 300 },
  };
}

function provider(read: (asset: Asset, request: ChartCandleRequest) => Promise<MarketDatum<readonly ChartCandle[]>>): CandleProvider {
  return {
    id: "binance-spot-candles", mode: "live", source: SOURCE, getChartCandles: read,
    getDailyCandles: async (asset) => unavailableDatum(dailyCandleCapability(asset), "unsupported"),
  };
}

// Only candles are in scope. Any accidental spot/session/editorial dependency
// fails rather than supplying an unrelated provider or fake production datum.
function registry(candles: CandleProvider): MarketProviderRegistry {
  return { candles } as MarketProviderRegistry;
}

describe("public objective research service", () => {
  it("loads four allowlisted periods without access and derives closed-only public facts", async () => {
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => datum(asset, request.interval));
    const result = await loadAssetResearchSnapshot("btc", "1h", { getRegistry: () => registry(provider(read)), now: () => NOW });
    expect(read.mock.calls).toEqual(MULTI_TIMEFRAME_INTERVALS.map((interval) => ["btc", { interval, limit: 1_000 }]));
    expect(result.timeframes.map((row) => row.interval)).toEqual(MULTI_TIMEFRAME_INTERVALS);
    expect(result.levels).toMatchObject({
      status: "fresh", capability: "analysis.btc-key-levels", provenance: "derived",
      source: { id: "wise-crypto-key-levels", components: [SOURCE] },
      updatedAt: "2026-09-03T07:59:59.999Z", updatedAtKind: "source", retrievedAt: "2026-09-03T08:05:00.000Z",
      cache: { revalidateSeconds: 60, staleIfErrorSeconds: 300 },
      value: { sampleCount: 240, interval: "1h" },
    });
    expect(result.timeframes.every((row) => row.datum.status === "fresh")).toBe(true);
    expect(result.history).toMatchObject({
      status: "fresh",
      capability: "analysis.btc-historical-context",
      provenance: "derived",
      source: { id: "wise-crypto-historical-context", components: [SOURCE] },
      value: { interval: "1h", algorithmVersion: "closed-ema-context-v2" },
    });
    expect(result.longHistory).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-long-term-history",
      reason: "no_data",
      value: null,
    });
    expect(result.cycle).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-market-cycle",
      reason: "no_data",
      value: null,
    });
    expect(result).not.toHaveProperty("access");
    expect(result).not.toHaveProperty("editorial");
  });

  it("single-flights all periods across concurrent requests and shares selected-interval switches", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => {
      await gate;
      return datum(asset, request.interval);
    });
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => NOW };
    const first = loadAssetResearchSnapshot("btc", "1h", dependencies);
    const second = loadAssetResearchSnapshot("btc", "4h", dependencies);
    try { await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4)); } finally { release(); }
    const results = await Promise.all([first, second]);
    expect(results.map((item) => item.interval)).toEqual(["1h", "4h"]);
    const fifteenMinute = await loadAssetResearchSnapshot("btc", "15m", dependencies);
    expect(read).toHaveBeenCalledTimes(4);
    expect(fifteenMinute.history).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-historical-context",
      reason: "unsupported",
      value: null,
    });
    expect(fifteenMinute.longHistory).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-long-term-history",
      reason: "unsupported",
      value: null,
    });
    expect(fifteenMinute.cycle).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-market-cycle",
      reason: "no_data",
      value: null,
    });
  });

  it("serves repeated 5-second visits from cache, then merges small tails after 60 seconds", async () => {
    let current = NOW;
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => {
      const result = datum(asset, request.interval, current);
      return { ...result, value: request.limit === 3 ? result.value.slice(-3) : result.value };
    });
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    await loadAssetResearchSnapshot("eth", "1h", dependencies);
    for (let step = 1; step <= 11; step += 1) {
      current = NOW + step * 5_000;
      const result = await loadAssetResearchSnapshot("eth", "1h", dependencies);
      expect(result.levels.cache.status).toBe("hit");
    }
    expect(read).toHaveBeenCalledTimes(4);
    current = NOW + 60_000;
    const result = await loadAssetResearchSnapshot("eth", "1h", dependencies);
    expect(read.mock.calls.slice(4).every(([, request]) => request.limit === 3)).toBe(true);
    expect(result.levels).toMatchObject({ status: "fresh", value: { sampleCount: 240 } });
  });

  it("invalidates only periods crossing a close boundary even before TTL expires", async () => {
    let current = Date.parse("2026-09-03T08:14:50.000Z");
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => {
      const value = datum(asset, request.interval, current);
      return { ...value, value: request.limit === 3 ? value.value.slice(-3) : value.value };
    });
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    await loadAssetResearchSnapshot("btc", "15m", dependencies);
    current += 11_000;
    const result = await loadAssetResearchSnapshot("btc", "15m", dependencies);
    expect(read).toHaveBeenCalledTimes(5);
    expect(read.mock.calls.at(-1)).toEqual(["btc", { interval: "15m", limit: 3 }]);
    expect(result.levels.updatedAt).toBe("2026-09-03T08:14:59.999Z");
  });

  it("fails closed instead of accepting a tail from a different source", async () => {
    let current = NOW;
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => datum(asset, request.interval, current));
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    await loadAssetResearchSnapshot("btc", "15m", dependencies);
    current += 60_000;
    // A provider method cannot silently return another venue/source even when
    // the provider object itself passed the production identity gate.
    read.mockImplementation(async (asset, request) => {
      const result = datum(asset, request.interval, current);
      return { ...result, source: { ...SOURCE, id: "alternate-history" }, value: request.limit === 3 ? result.value.slice(-3) : result.value };
    });
    const result = await loadAssetResearchSnapshot("btc", "15m", dependencies);
    expect(read.mock.calls.slice(4).every(([, request]) => request.limit === 3)).toBe(true);
    expect(result.levels).toMatchObject({
      status: "error",
      value: null,
      source: SOURCE,
      error: { code: "invalid_payload", retryable: false },
    });
    expect(JSON.stringify(result)).not.toContain("alternate-history");
  });

  it.each([
    { field: "id", value: "alternate-candles" },
    { field: "mode", value: "mock" },
    {
      field: "source",
      value: { ...SOURCE, url: "https://example.com/other-venue" },
    },
  ] as const)("rejects a forged Binance provider $field before reading candles", async ({ field, value }) => {
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => datum(asset, request.interval));
    const forged = { ...provider(read), [field]: value } as CandleProvider;
    const result = await loadAssetResearchSnapshot("btc", "1h", {
      getRegistry: () => registry(forged),
      now: () => NOW,
    });

    expect(read).not.toHaveBeenCalled();
    expect(result.levels).toMatchObject({
      status: "error",
      value: null,
      error: { code: "invalid_payload", retryable: false },
    });
  });

  it("reloads full history when a tail cannot close a previously forming candle", async () => {
    let current = Date.parse("2026-09-03T08:14:50.000Z");
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => {
      const result = datum(asset, request.interval, current);
      return { ...result, value: request.limit === 3 ? result.value.slice(-1) : result.value };
    });
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    await loadAssetResearchSnapshot("btc", "15m", dependencies);
    current += 20_000;
    const result = await loadAssetResearchSnapshot("btc", "15m", dependencies);
    // A one-candle tail overlaps the following interval but leaves the old
    // forming state unresolved. Never reclassify it using a guessed close.
    expect(read).toHaveBeenCalledTimes(6);
    expect(read.mock.calls.at(-1)).toEqual(["btc", { interval: "15m", limit: 1_000 }]);
    expect(result.levels.status).toBe("fresh");
  });

  it("isolates one timeout without losing the other three periods or exposing exception text", async () => {
    const read = async (asset: Asset, request: ChartCandleRequest) => {
      if (request.interval === "4h") throw new ProviderError("timeout", true);
      return datum(asset, request.interval);
    };
    const result = await loadAssetResearchSnapshot("btc", "4h", { getRegistry: () => registry(provider(read)), now: () => NOW });
    expect(result.levels).toMatchObject({ status: "error", error: { code: "timeout" }, source: SOURCE });
    expect(result.timeframes.filter((row) => row.datum.status === "fresh")).toHaveLength(3);
  });

  it("preserves stale metadata and bounds last-known-good without extending it on failures", async () => {
    let current = NOW;
    let failing = false;
    const read = vi.fn(async (asset: Asset, request: ChartCandleRequest) => {
      if (failing) throw new ProviderError("timeout", true);
      return datum(asset, request.interval, current);
    });
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    await loadAssetResearchSnapshot("btc", "1h", dependencies);
    failing = true;
    current += 60_000;
    const fallback = await loadAssetResearchSnapshot("btc", "1h", dependencies);
    expect(fallback.levels).toMatchObject({
      status: "stale", stale: true, error: { code: "timeout", retryable: true },
      retrievedAt: new Date(NOW).toISOString(), updatedAt: "2026-09-03T07:59:59.999Z",
    });
    expect(fallback.history).toMatchObject({
      status: "stale", stale: true, error: { code: "timeout", retryable: true },
      retrievedAt: new Date(NOW).toISOString(), updatedAt: "2026-09-03T07:59:59.999Z",
    });
    current = NOW + 301_000;
    const expired = await loadAssetResearchSnapshot("btc", "1h", dependencies);
    expect(expired.levels).toMatchObject({ status: "error", value: null, error: { code: "timeout" } });
  });

  it("retains upstream stale/error/fallback/source provenance in the derived result", async () => {
    const read = async (asset: Asset, request: ChartCandleRequest): Promise<MarketDatum<readonly ChartCandle[]>> => ({
      ...datum(asset, request.interval), status: "stale", stale: true,
      error: { code: "rate_limited", retryable: true },
      fallback: { primarySource: SOURCE, primaryStatus: "error", primaryError: { code: "rate_limited", retryable: true }, primaryReason: null },
    });
    const result = await loadAssetResearchSnapshot("eth", "1h", { getRegistry: () => registry(provider(read)), now: () => NOW });
    expect(result.levels).toMatchObject({ status: "stale", stale: true, provenance: "derived", error: { code: "rate_limited" }, fallback: { primaryStatus: "error" } });
  });

  it("does not roll verified history back to an older stale tail", async () => {
    let current = NOW;
    let staleTail = false;
    const read = async (asset: Asset, request: ChartCandleRequest): Promise<MarketDatum<readonly ChartCandle[]>> => {
      const result = datum(asset, request.interval, staleTail ? NOW - 60_000 : current);
      return staleTail ? { ...result, status: "stale", stale: true, value: result.value.slice(-3) } : result;
    };
    const candlesProvider = provider(read);
    const dependencies = { getRegistry: () => registry(candlesProvider), now: () => current };
    const first = await loadAssetResearchSnapshot("btc", "1h", dependencies);
    current += 60_000;
    staleTail = true;
    const second = await loadAssetResearchSnapshot("btc", "1h", dependencies);
    expect(second.levels).toMatchObject({ status: "stale", retrievedAt: new Date(NOW).toISOString(), error: { code: "no_data" } });
    expect(second.levels.value).toEqual(first.levels.value);
  });

  it("isolates cache entries by asset and provider instance rather than cookie or tier", async () => {
    const firstRead = vi.fn(async (asset: Asset, request: ChartCandleRequest) => datum(asset, request.interval));
    const secondRead = vi.fn(async (asset: Asset, request: ChartCandleRequest) => datum(asset, request.interval));
    const firstProvider = provider(firstRead);
    const secondProvider = provider(secondRead);
    const firstDependencies = { getRegistry: () => registry(firstProvider), now: () => NOW };
    const btc = await loadAssetResearchSnapshot("btc", "1h", firstDependencies);
    const eth = await loadAssetResearchSnapshot("eth", "1h", firstDependencies);
    await loadAssetResearchSnapshot("btc", "1h", { getRegistry: () => registry(secondProvider), now: () => NOW });
    expect(firstRead).toHaveBeenCalledTimes(8);
    expect(secondRead).toHaveBeenCalledTimes(4);
    expect(btc.levels).toMatchObject({ value: { asset: "btc", symbol: "BTCUSDT" } });
    expect(eth.levels).toMatchObject({ value: { asset: "eth", symbol: "ETHUSDT" } });
  });

  it("projects a public-only response instead of forwarding unexpected provider fields", async () => {
    const result = await loadAssetResearchSnapshot("btc", "1h", {
      getRegistry: () => registry(provider(async (asset, request) => ({
        ...datum(asset, request.interval),
        wiseScenario: "private-editorial-must-never-appear",
        access: { tier: "vip" },
      }))), now: () => NOW,
    });
    expect(Object.keys(result).sort()).toEqual(["asset", "cycle", "history", "interval", "levels", "longHistory", "timeframes"]);
    expect(JSON.stringify(result)).not.toContain("private-editorial");
    expect(JSON.stringify(result)).not.toContain('"access"');
  });

  it.each(["synthetic", "wrong-symbol", "gap", "future-close", "nan"])("rejects %s rather than emitting fabricated research", async (fault) => {
    const read = async (asset: Asset, request: ChartCandleRequest) => {
      const result = datum(asset, request.interval);
      if (fault === "synthetic") return { ...result, provenance: "synthetic" as const };
      if (fault === "gap") return { ...result, value: result.value.filter((_, index) => index !== 20) };
      return { ...result, value: result.value.map((candle, index) => ({
        ...candle,
        ...(fault === "wrong-symbol" ? { symbol: "ETHUSDT" as const } : {}),
        ...(fault === "future-close" && index === result.value.length - 1 ? { state: "closed" as const } : {}),
        ...(fault === "nan" && index === 0 ? { high: Number.NaN } : {}),
      })) };
    };
    const result = await loadAssetResearchSnapshot("btc", "1h", { getRegistry: () => registry(provider(read)), now: () => NOW });
    expect(result.levels).toMatchObject({ status: "error", value: null, error: { code: "invalid_payload", retryable: false } });
    expect(JSON.stringify(result)).not.toContain('"provenance":"derived"');
  });

  it("returns unavailable for short windows and null volume estimates for zero volume", async () => {
    const short = await loadAssetResearchSnapshot("btc", "1h", { getRegistry: () => registry(provider(async (asset, request) => datum(asset, request.interval, NOW, 199))), now: () => NOW });
    expect(short.levels).toMatchObject({ status: "unavailable", reason: "insufficient_history", value: null });
    const zero = await loadAssetResearchSnapshot("btc", "1h", {
      getRegistry: () => registry(provider(async (asset, request) => {
        const result = datum(asset, request.interval);
        return { ...result, value: result.value.map((candle) => ({ ...candle, volume: 0 })) };
      })), now: () => NOW,
    });
    expect(zero.levels).toMatchObject({ status: "fresh", value: { volumeProfile: null } });
  });

  it("marks a purported fresh but missing-latest-close series stale", async () => {
    const result = await loadAssetResearchSnapshot("btc", "1h", {
      getRegistry: () => registry(provider(async (asset, request) => {
        const value = datum(asset, request.interval);
        return { ...value, value: value.value.slice(0, -2) };
      })), now: () => NOW,
    });
    expect(result.levels).toMatchObject({ status: "stale", stale: true });
  });

  it("returns a sanitized independent failure if registry initialization fails", async () => {
    const result = await loadAssetResearchSnapshot("btc", "1h", { getRegistry: () => { throw new Error("secret-key-must-not-leak"); }, now: () => NOW });
    expect(result.timeframes).toHaveLength(4);
    expect(result.levels.status).toBe("error");
    expect(result.history.status).toBe("error");
    expect(result.longHistory.status).toBe("error");
    expect(result.cycle.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("rejects unsupported direct service calls before resolving a provider", async () => {
    const getRegistry = vi.fn();
    await expect(loadAssetResearchSnapshot("xrp" as Asset, "1h", { getRegistry })).rejects.toThrow("Unsupported");
    await expect(loadAssetResearchSnapshot("btc", "5m" as ChartCandleInterval, { getRegistry })).rejects.toThrow("Unsupported");
    expect(getRegistry).not.toHaveBeenCalled();
  });

  it("validates the complete JSON boundary and rejects a forged long-history envelope", async () => {
    const result = await loadAssetResearchSnapshot("btc", "1h", {
      getRegistry: () => registry(provider(async (asset, request) => datum(asset, request.interval))),
      now: () => NOW,
    });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(parsePublicResearchSnapshot(json, "btc", "1h")).toEqual(result);

    const forged = structuredClone(json) as {
      longHistory: { capability: string };
    };
    forged.longHistory.capability = "analysis.eth-long-term-history";
    expect(() => parsePublicResearchSnapshot(forged, "btc", "1h")).toThrow(
      /datum/,
    );
    const forgedCycle = structuredClone(json) as {
      cycle: { capability: string };
    };
    forgedCycle.cycle.capability = "analysis.eth-market-cycle";
    expect(() => parsePublicResearchSnapshot(forgedCycle, "btc", "1h"))
      .toThrow(/datum/);
    expect(() => parsePublicResearchSnapshot({ ...json, access: "vip" }, "btc", "1h"))
      .toThrow(/Unexpected/);
  });
});
