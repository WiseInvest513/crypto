import { describe, expect, it, vi } from "vitest";
import {
  ANONYMOUS_USER_ACCESS,
  type UserAccess,
} from "@/lib/access/user-access";
import {
  MULTI_TIMEFRAME_CANDLE_LIMIT,
  MULTI_TIMEFRAME_INTERVALS,
} from "@/lib/market/multi-timeframe";
import {
  chartCandleCapability,
  chartCandleIntervals,
  dailyCandleCapability,
  unavailableDatum,
  type Asset,
  type AvailableMarketDatum,
  type ChartCandle,
  type ChartCandleInterval,
  type ChartCandleRequest,
  type DataSource,
  type MarketDatum,
} from "@/server/data/contracts/market-data";
import type {
  CandleProvider,
  MarketProviderRegistry,
} from "@/server/data/contracts/providers";
import { ProviderError } from "@/server/data/errors/provider-error";
import {
  loadAssetMultiTimeframeForAccess,
} from "@/server/data/services/multi-timeframe-service";
import { MockMarketProvider } from "@/server/data/testing/mock-market-provider";

const RETRIEVED_AT = "2026-09-02T08:00:00.000Z";
const NOW = Date.parse("2026-09-02T08:05:00.000Z");
const ALIGNED_START = Date.parse("2026-01-01T00:00:00.000Z");
const PROVIDER_SOURCE: DataSource = {
  id: "binance-spot-candles",
  label: "Binance 现货市场数据",
  url: "https://data-api.binance.vision",
};
const VERIFIED_REGULAR_ACCESS: UserAccess = Object.freeze({
  tier: "regular",
  isAuthenticated: true,
  source: "verified-identity",
});
const VERIFIED_VIP_ACCESS: UserAccess = Object.freeze({
  tier: "vip",
  isAuthenticated: true,
  source: "verified-identity",
});

const intervalMilliseconds = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
} as const satisfies Record<ChartCandleInterval, number>;

function chartCandles(
  asset: Asset,
  interval: ChartCandleInterval,
  closedCount = 220,
): readonly ChartCandle[] {
  const duration = intervalMilliseconds[interval];
  const base = asset === "btc" ? 50_000 : 2_000;

  return Array.from({ length: closedCount + 1 }, (_, index) => {
    const openedAt = ALIGNED_START + index * duration;
    const close = base + index;
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state: index < closedCount ? "closed" : "forming",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 100 + index,
    } satisfies ChartCandle;
  });
}

function availableChartDatum(
  asset: Asset,
  interval: ChartCandleInterval,
  options: Readonly<{
    stale?: boolean;
    provenance?: AvailableMarketDatum<unknown>["provenance"];
  }> = {},
): AvailableMarketDatum<readonly ChartCandle[]> {
  const stale = options.stale ?? false;
  return {
    status: stale ? "stale" : "fresh",
    capability: chartCandleCapability(asset),
    value: chartCandles(asset, interval),
    source: PROVIDER_SOURCE,
    scope: {
      kind: "venue",
      label: `Binance ${asset.toUpperCase()}USDT 现货 ${interval} K 线`,
    },
    updatedAt: "2026-09-02T07:59:59.999Z",
    updatedAtKind: "observed",
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale,
    provenance: options.provenance ?? "live",
    cache: {
      status: "hit",
      revalidateSeconds: 5,
      staleIfErrorSeconds: 300,
    },
    error: stale ? { code: "timeout", retryable: true } : null,
    ...(stale
      ? {
          fallback: {
            primarySource: PROVIDER_SOURCE,
            primaryStatus: "error" as const,
            primaryError: { code: "timeout" as const, retryable: true },
            primaryReason: null,
          },
        }
      : {}),
  };
}

function candleProvider(
  getChartCandles: (
    asset: Asset,
    request: ChartCandleRequest,
  ) => Promise<MarketDatum<readonly ChartCandle[]>>,
): CandleProvider {
  return {
    id: PROVIDER_SOURCE.id,
    mode: "live",
    source: PROVIDER_SOURCE,
    getDailyCandles: async (asset) =>
      unavailableDatum(dailyCandleCapability(asset), "unsupported"),
    getChartCandles,
  };
}

function registry(provider: CandleProvider): MarketProviderRegistry {
  const fallback = new MockMarketProvider();
  return {
    spot: fallback,
    candles: provider,
    sentiment: fallback,
    derivatives: fallback,
    fundFlows: fallback,
  };
}

describe("multi-timeframe VIP server boundary", () => {
  it.each([
    ["anonymous regular", () => Promise.resolve(ANONYMOUS_USER_ACCESS)],
    ["verified regular", () => Promise.resolve(VERIFIED_REGULAR_ACCESS)],
    [
      "forged VIP tuple",
      () =>
        Promise.resolve({
          tier: "vip",
          isAuthenticated: false,
          source: "anonymous-default",
        } as UserAccess),
    ],
    ["rejected access", () => Promise.reject(new Error("identity failed"))],
  ])("returns a metadata-free lock for %s without resolving providers", async (_, access) => {
    const getRegistry = vi.fn((): MarketProviderRegistry => {
      throw new Error("registry must remain unreachable");
    });

    await expect(
      loadAssetMultiTimeframeForAccess("btc", access(), { getRegistry }),
    ).resolves.toEqual({ status: "locked", asset: "btc" });
    expect(getRegistry).not.toHaveBeenCalled();
  });

  it("starts all four verified-VIP interval reads concurrently with a 1000-candle limit", async () => {
    const requests: { asset: Asset; request: ChartCandleRequest }[] = [];
    let active = 0;
    let maximumConcurrent = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = candleProvider(async (asset, request) => {
      requests.push({ asset, request });
      active += 1;
      maximumConcurrent = Math.max(maximumConcurrent, active);
      await gate;
      active -= 1;
      return availableChartDatum(asset, request.interval);
    });
    const getRegistry = vi.fn(() => registry(provider));
    const pending = loadAssetMultiTimeframeForAccess(
      "btc",
      Promise.resolve(VERIFIED_VIP_ACCESS),
      { getRegistry, now: () => NOW },
    );

    try {
      await vi.waitFor(() => expect(requests).toHaveLength(4));
      expect(maximumConcurrent).toBe(4);
      expect(requests).toEqual(
        MULTI_TIMEFRAME_INTERVALS.map((interval) => ({
          asset: "btc",
          request: { interval, limit: MULTI_TIMEFRAME_CANDLE_LIMIT },
        })),
      );
      expect(MULTI_TIMEFRAME_CANDLE_LIMIT).toBe(1_000);
    } finally {
      release();
    }

    const payload = await pending;
    expect(getRegistry).toHaveBeenCalledTimes(1);
    expect(payload.status).toBe("granted");
    if (payload.status === "granted") {
      expect(payload.intervals.map((item) => item.interval)).toEqual(
        chartCandleIntervals,
      );
      expect(
        payload.intervals.every(
          (item) =>
            item.datum.status === "fresh" &&
            item.datum.provenance === "derived",
        ),
      ).toBe(true);
    }
  });

  it("isolates one thrown provider interval without failing the other three", async () => {
    const provider = candleProvider(async (asset, request) => {
      if (request.interval === "4h") {
        throw new ProviderError("timeout", true);
      }
      return availableChartDatum(asset, request.interval);
    });

    const payload = await loadAssetMultiTimeframeForAccess(
      "eth",
      Promise.resolve(VERIFIED_VIP_ACCESS),
      { getRegistry: () => registry(provider), now: () => NOW },
    );

    if (payload.status !== "granted") {
      throw new Error("Verified VIP fixture must be granted.");
    }
    expect(payload.intervals).toHaveLength(4);
    expect(payload.intervals.find((item) => item.interval === "4h")?.datum).toMatchObject({
      status: "error",
      capability: "analysis.eth-multi-timeframe",
      source: PROVIDER_SOURCE,
      scope: {
        kind: "venue",
        label: "Binance ETHUSDT 现货 4h K 线（USDT，UTC，含形成中）",
      },
      retrievedAt: "2026-09-02T08:05:00.000Z",
      error: { code: "timeout", retryable: true },
    });
    expect(
      payload.intervals
        .filter((item) => item.interval !== "4h")
        .every((item) => item.datum.status === "fresh"),
    ).toBe(true);
  });

  it("preserves stale/cache/error/fallback metadata and never launders synthetic provenance", async () => {
    const provider = candleProvider(async (asset, request) =>
      availableChartDatum(asset, request.interval, {
        stale: true,
        provenance: "synthetic",
      }),
    );

    const payload = await loadAssetMultiTimeframeForAccess(
      "btc",
      Promise.resolve(VERIFIED_VIP_ACCESS),
      { getRegistry: () => registry(provider), now: () => NOW },
    );
    if (payload.status !== "granted") {
      throw new Error("Verified VIP fixture must be granted.");
    }
    const datum = payload.intervals.find(
      (item) => item.interval === "1h",
    )!.datum;

    expect(datum).toMatchObject({
      status: "stale",
      capability: "analysis.btc-multi-timeframe",
      source: {
        id: "wise-crypto-multi-timeframe",
        components: [PROVIDER_SOURCE],
      },
      scope: {
        kind: "derived",
        label: "BTCUSDT 1h 已闭合 K 线 · EMA10/20/50/200 · 近 20 根区间",
      },
      updatedAtKind: "source",
      retrievedAt: RETRIEVED_AT,
      loading: false,
      stale: true,
      provenance: "synthetic",
      cache: {
        status: "hit",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
      error: { code: "timeout", retryable: true },
      fallback: {
        primarySource: PROVIDER_SOURCE,
        primaryStatus: "error",
        primaryError: { code: "timeout", retryable: true },
        primaryReason: null,
      },
    });
    if (datum.status === "stale") {
      expect(datum.updatedAt).toBe(datum.value.latestClosedAt);
    }
  });

  it("keeps derived source, scope, retrieval, and cache metadata when history is insufficient", async () => {
    const provider = candleProvider(async (asset, request) => ({
      ...availableChartDatum(asset, request.interval),
      value: chartCandles(asset, request.interval, 199),
    }));

    const payload = await loadAssetMultiTimeframeForAccess(
      "btc",
      Promise.resolve(VERIFIED_VIP_ACCESS),
      { getRegistry: () => registry(provider), now: () => NOW },
    );
    if (payload.status !== "granted") {
      throw new Error("Verified VIP fixture must be granted.");
    }

    expect(payload.intervals[0].datum).toMatchObject({
      status: "unavailable",
      reason: "insufficient_history",
      capability: "analysis.btc-multi-timeframe",
      source: {
        id: "wise-crypto-multi-timeframe",
        components: [PROVIDER_SOURCE],
      },
      scope: {
        kind: "derived",
        label: "BTCUSDT 15m 已闭合 K 线 · EMA10/20/50/200 · 近 20 根区间",
      },
      retrievedAt: RETRIEVED_AT,
      cache: {
        status: "hit",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
    });
  });

  it.each(["symbol", "quote"] as const)(
    "rejects a provider payload whose %s does not match the requested market",
    async (mismatch) => {
    const provider = candleProvider(async (asset, request) => {
      const datum = availableChartDatum(asset, request.interval);
      return {
        ...datum,
        value: datum.value.map((candle) => ({
          ...candle,
          ...(mismatch === "symbol"
            ? { symbol: "ETHUSDT" as const }
            : {
                quoteCurrency:
                  "BUSD" as ChartCandle["quoteCurrency"],
              }),
        })),
      };
    });

    const payload = await loadAssetMultiTimeframeForAccess(
      "btc",
      Promise.resolve(VERIFIED_VIP_ACCESS),
      { getRegistry: () => registry(provider), now: () => NOW },
    );
    if (payload.status !== "granted") {
      throw new Error("Verified VIP fixture must be granted.");
    }

    expect(payload.intervals[0].datum).toMatchObject({
      status: "error",
      capability: "analysis.btc-multi-timeframe",
      source: {
        id: "wise-crypto-multi-timeframe",
        components: [PROVIDER_SOURCE],
      },
      scope: {
        kind: "derived",
        label: "BTCUSDT 15m 已闭合 K 线 · EMA10/20/50/200 · 近 20 根区间",
      },
      retrievedAt: RETRIEVED_AT,
      cache: {
        status: "hit",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
      error: { code: "invalid_payload", retryable: false },
    });
    },
  );
});
