import { describe, expect, it, vi } from "vitest";
import type {
  Asset,
  AvailableMarketDatum,
  DailyCandle,
  DataScope,
  DataSource,
  ErrorMarketDatum,
  MarketDatum,
  UnavailableMarketDatum,
} from "../../src/server/data/contracts/market-data";
import type { CandleProvider } from "../../src/server/data/contracts/providers";
import { ProviderError } from "../../src/server/data/errors/provider-error";
import {
  dcaClosedDailyRange,
  getDcaMarketHistory,
} from "../../src/server/tools/dca-history-service";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const NOW_MILLISECONDS = Date.parse("2026-08-31T12:34:56.000Z");
const NOW = () => NOW_MILLISECONDS;
const BINANCE_SOURCE: DataSource = {
  id: "binance-spot",
  label: "Binance 现货市场数据",
  url: "https://developers.binance.com/spot",
  components: [
    {
      id: "binance-public-api",
      label: "Binance Public API",
      url: "https://data-api.binance.vision",
    },
  ],
};
const CACHE = {
  status: "miss",
  revalidateSeconds: 900,
  staleIfErrorSeconds: 604_800,
} as const;

describe("DCA history service", () => {
  it("requests BTC and ETH once over a stable two-year UTC range", async () => {
    const getDailyCandles = vi.fn(
      async (asset: Asset): Promise<MarketDatum<readonly DailyCandle[]>> =>
        availableDatum(asset, candles(asset)),
    );

    const history = await getDcaMarketHistory(
      registry(getDailyCandles),
      NOW,
    );

    const range = {
      from: "2024-08-31T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    };
    expect(getDailyCandles).toHaveBeenCalledTimes(2);
    expect(getDailyCandles).toHaveBeenNthCalledWith(1, "btc", range);
    expect(getDailyCandles).toHaveBeenNthCalledWith(2, "eth", range);
    expect(history.btc).toMatchObject({
      asset: "btc",
      symbol: "BTCUSDT",
      venue: "Binance",
      quoteCurrency: "USDT",
      interval: "1d",
      timeZone: "UTC",
      candleState: "closed",
      requestedRange: range,
      status: "fresh",
      prices: [
        { date: "2026-08-29", close: 100_000 },
        { date: "2026-08-30", close: 101_000 },
      ],
      source: BINANCE_SOURCE,
      scope: {
        kind: "venue",
        label: "Binance BTCUSDT 现货日线（USDT，UTC）",
      },
      updatedAt: "2026-08-30T23:59:59.999Z",
      retrievedAt: "2026-08-31T12:00:00.000Z",
      stale: false,
      cache: CACHE,
      error: null,
      reason: null,
    });
    expect(history.eth.prices).toEqual([
      { date: "2026-08-29", close: 4_000 },
      { date: "2026-08-30", close: 4_100 },
    ]);
    expect(JSON.parse(JSON.stringify(history))).toEqual(history);
  });

  it("preserves stale, cache, source-lineage and upstream error metadata", async () => {
    const upstreamError = { code: "timeout", retryable: true } as const;
    const getDailyCandles = vi.fn(async (asset: Asset) => ({
      ...availableDatum(asset, candles(asset)),
      status: "stale" as const,
      stale: true,
      cache: { ...CACHE, status: "hit" as const },
      error: upstreamError,
    }));

    const history = await getDcaMarketHistory(
      registry(getDailyCandles),
      NOW,
    );

    expect(history.btc).toMatchObject({
      status: "stale",
      stale: true,
      cache: { status: "hit" },
      error: upstreamError,
      source: { components: BINANCE_SOURCE.components },
    });
    expect(history.btc.prices).toHaveLength(2);
  });

  it("keeps unavailable and provider error states empty without inventing prices", async () => {
    const getDailyCandles = vi.fn(
      async (asset: Asset): Promise<MarketDatum<readonly DailyCandle[]>> =>
        asset === "btc" ? unavailableDatum(asset) : errorDatum(asset),
    );

    const history = await getDcaMarketHistory(
      registry(getDailyCandles),
      NOW,
    );

    expect(history.btc).toMatchObject({
      status: "unavailable",
      prices: [],
      source: null,
      scope: null,
      updatedAt: null,
      retrievedAt: null,
      stale: false,
      cache: { status: "bypass" },
      error: null,
      reason: "no_data",
    });
    expect(history.eth).toMatchObject({
      status: "error",
      prices: [],
      source: BINANCE_SOURCE,
      updatedAt: null,
      retrievedAt: "2026-08-31T12:00:00.000Z",
      stale: false,
      cache: CACHE,
      error: { code: "rate_limited", retryable: true },
      reason: null,
    });
  });

  it("isolates a thrown provider failure to one asset and never rejects the page load", async () => {
    const getDailyCandles = vi.fn(async (asset: Asset) => {
      if (asset === "eth") {
        throw new ProviderError("timeout", true);
      }
      return availableDatum(asset, candles(asset));
    });

    await expect(
      getDcaMarketHistory(registry(getDailyCandles), NOW),
    ).resolves.toMatchObject({
      btc: { status: "fresh", prices: [{}, {}] },
      eth: {
        status: "error",
        prices: [],
        error: { code: "timeout", retryable: true },
        retrievedAt: "2026-08-31T12:34:56.000Z",
      },
    });
  });

  it.each([
    {
      label: "unsorted candles",
      create: () => candles("btc").toReversed(),
    },
    {
      label: "a forming candle",
      create: () => [dailyCandle("btc", "2026-08-31", 102_000)],
    },
    {
      label: "the wrong symbol",
      create: () => [
        { ...dailyCandle("btc", "2026-08-30", 101_000), symbol: "ETHUSDT" },
      ] as readonly DailyCandle[],
    },
  ])("rejects $label before exposing data to the client", async ({ create }) => {
    const getDailyCandles = vi.fn(async (asset: Asset) =>
      availableDatum(asset, asset === "btc" ? create() : candles(asset)),
    );

    const history = await getDcaMarketHistory(
      registry(getDailyCandles),
      NOW,
    );

    expect(history.btc).toMatchObject({
      status: "error",
      prices: [],
      error: { code: "invalid_payload", retryable: false },
      cache: CACHE,
    });
    expect(history.eth.status).toBe("fresh");
  });

  it.each([
    {
      label: "synthetic data",
      override: { provenance: "synthetic" as const },
    },
    {
      label: "a non-Binance source",
      override: {
        source: {
          id: "another-venue",
          label: "Another venue",
          url: "https://example.com/another-venue",
        },
      },
    },
  ])("rejects $label instead of relabeling it", async ({ override }) => {
    const getDailyCandles = vi.fn(async (asset: Asset) => ({
      ...availableDatum(asset, candles(asset)),
      ...override,
    }));

    const history = await getDcaMarketHistory(
      registry(getDailyCandles),
      NOW,
    );

    expect(history.btc).toMatchObject({
      status: "error",
      prices: [],
      error: { code: "invalid_payload", retryable: false },
    });
    expect(history.eth.prices).toEqual([]);
  });

  it("turns an invalid clock into two error DTOs without calling the provider", async () => {
    const getDailyCandles = vi.fn();

    await expect(
      getDcaMarketHistory(registry(getDailyCandles), () => Number.NaN),
    ).resolves.toMatchObject({
      btc: {
        status: "error",
        prices: [],
        error: { code: "invalid_payload", retryable: false },
      },
      eth: {
        status: "error",
        prices: [],
        error: { code: "invalid_payload", retryable: false },
      },
    });
    expect(getDailyCandles).not.toHaveBeenCalled();
  });

  it("keeps the public range helper UTC-stable and below Binance's limit", () => {
    const range = dcaClosedDailyRange(NOW_MILLISECONDS);

    expect(range).toEqual({
      from: "2024-08-31T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    });
    const inclusiveRequestedCandles =
      (Date.parse(range.to) - Date.parse(range.from)) / DAY_MILLISECONDS + 1;
    expect(inclusiveRequestedCandles).toBe(731);
    expect(inclusiveRequestedCandles).toBeLessThanOrEqual(1_000);
    expect(() => dcaClosedDailyRange(Number.NaN)).toThrow("must be finite");
  });
});

function registry(
  getDailyCandles: CandleProvider["getDailyCandles"],
): Pick<{ candles: CandleProvider }, "candles"> {
  return {
    candles: {
      id: "binance-spot-candles",
      mode: "live",
      source: BINANCE_SOURCE,
      getDailyCandles,
      getChartCandles: async () => {
        throw new Error("Chart candles are not used by the DCA service.");
      },
    },
  };
}

function availableDatum(
  asset: Asset,
  value: readonly DailyCandle[],
): AvailableMarketDatum<readonly DailyCandle[]> {
  return {
    status: "fresh",
    capability: `historical.${asset}-daily-candles`,
    value,
    source: BINANCE_SOURCE,
    scope: scope(asset),
    updatedAt: "2026-08-30T23:59:59.999Z",
    retrievedAt: "2026-08-31T12:00:00.000Z",
    loading: false,
    stale: false,
    provenance: "live",
    cache: CACHE,
    error: null,
  };
}

function unavailableDatum(asset: Asset): UnavailableMarketDatum {
  return {
    status: "unavailable",
    capability: `historical.${asset}-daily-candles`,
    value: null,
    source: null,
    scope: null,
    updatedAt: null,
    retrievedAt: null,
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 900,
      staleIfErrorSeconds: 604_800,
    },
    error: null,
    reason: "no_data",
  };
}

function errorDatum(asset: Asset): ErrorMarketDatum {
  return {
    status: "error",
    capability: `historical.${asset}-daily-candles`,
    value: null,
    source: BINANCE_SOURCE,
    scope: scope(asset),
    updatedAt: null,
    retrievedAt: "2026-08-31T12:00:00.000Z",
    loading: false,
    stale: false,
    cache: CACHE,
    error: { code: "rate_limited", retryable: true },
  };
}

function scope(asset: Asset): DataScope {
  return {
    kind: "venue",
    label: `Binance ${asset.toUpperCase()}USDT 现货日线（USDT，UTC）`,
  };
}

function candles(asset: Asset): readonly DailyCandle[] {
  const base = asset === "btc" ? 100_000 : 4_000;
  return [
    dailyCandle(asset, "2026-08-29", base),
    dailyCandle(asset, "2026-08-30", base + (asset === "btc" ? 1_000 : 100)),
  ];
}

function dailyCandle(asset: Asset, date: string, close: number): DailyCandle {
  const openedAt = Date.parse(`${date}T00:00:00.000Z`);
  return {
    asset,
    symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
    interval: "1d",
    quoteCurrency: "USDT",
    openedAt: new Date(openedAt).toISOString(),
    closedAt: new Date(openedAt + DAY_MILLISECONDS - 1).toISOString(),
    open: close - 50,
    high: close + 100,
    low: close - 100,
    close,
    volume: 1_000,
  };
}
