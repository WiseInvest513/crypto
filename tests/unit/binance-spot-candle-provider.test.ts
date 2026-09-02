import { describe, expect, it, vi } from "vitest";
import { ResilientMarketCache } from "../../src/server/data/cache/resilient-market-cache";
import type {
  ChartCandleInterval,
  ChartCandleRequest,
} from "../../src/server/data/contracts/market-data";
import type { JsonHttpClient } from "../../src/server/data/http/fetch-json";
import { BinanceSpotCandleProvider } from "../../src/server/data/providers/binance-spot-candle-provider";

const DAY = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-08-31T12:00:00.000Z");
const RANGE = {
  from: "2026-08-27T00:00:00.000Z",
  to: "2026-08-31T12:00:00.000Z",
} as const;
const CHART_INTERVAL_MILLISECONDS = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": DAY,
} as const satisfies Record<ChartCandleInterval, number>;

type KlineOverrides = {
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  openedAt?: unknown;
  closedAt?: unknown;
};

function kline(
  day: string,
  overrides: KlineOverrides = {},
): readonly unknown[] {
  const openedAt = Date.parse(`${day}T00:00:00.000Z`);
  return [
    overrides.openedAt ?? openedAt,
    overrides.open ?? "100",
    overrides.high ?? "112",
    overrides.low ?? "94",
    overrides.close ?? "108",
    overrides.volume ?? "1250.5",
    overrides.closedAt ?? openedAt + DAY - 1,
    "135000",
    1_000,
    "600",
    "65000",
    "0",
  ];
}

function chartKline(
  openedAt: string,
  interval: ChartCandleInterval,
  overrides: KlineOverrides = {},
): readonly unknown[] {
  const openedAtMilliseconds = Date.parse(openedAt);
  return [
    overrides.openedAt ?? openedAtMilliseconds,
    overrides.open ?? "100",
    overrides.high ?? "112",
    overrides.low ?? "94",
    overrides.close ?? "108",
    overrides.volume ?? "1250.5",
    overrides.closedAt ??
      openedAtMilliseconds + CHART_INTERVAL_MILLISECONDS[interval] - 1,
    "135000",
    1_000,
    "600",
    "65000",
    "0",
  ];
}

function createProvider(
  get: JsonHttpClient["get"],
  now: () => number = () => NOW,
) {
  return new BinanceSpotCandleProvider({
    http: { get },
    cache: new ResilientMarketCache({ now }),
    now,
  });
}

describe("Binance Spot daily candle provider", () => {
  it("normalizes, sorts, deduplicates and caches only closed BTCUSDT candles", async () => {
    const duplicate = kline("2026-08-29", { close: "106" });
    const get = vi.fn(async (url: string) => {
      void url;
      return [
        kline("2026-08-30", { close: "111" }),
        duplicate,
        kline("2026-08-31", { close: "110" }),
        kline("2026-08-28", { close: "103" }),
        [...duplicate],
      ];
    });
    const provider = createProvider(get);

    const first = await provider.getDailyCandles("btc", RANGE);
    const second = await provider.getDailyCandles("btc", RANGE);

    expect(first).toMatchObject({
      status: "fresh",
      capability: "historical.btc-daily-candles",
      source: { id: "binance-spot" },
      scope: {
        kind: "venue",
        label: expect.stringContaining("BTCUSDT"),
      },
      updatedAt: "2026-08-30T23:59:59.999Z",
      retrievedAt: "2026-08-31T12:00:00.000Z",
      stale: false,
      cache: { status: "miss", revalidateSeconds: 900 },
      error: null,
    });
    if (first.status === "fresh") {
      expect(first.value).toHaveLength(3);
      expect(first.value.map((candle) => candle.openedAt)).toEqual([
        "2026-08-28T00:00:00.000Z",
        "2026-08-29T00:00:00.000Z",
        "2026-08-30T00:00:00.000Z",
      ]);
      expect(first.value[2]).toEqual({
        asset: "btc",
        symbol: "BTCUSDT",
        interval: "1d",
        quoteCurrency: "USDT",
        openedAt: "2026-08-30T00:00:00.000Z",
        closedAt: "2026-08-30T23:59:59.999Z",
        open: 100,
        high: 112,
        low: 94,
        close: 111,
        volume: 1250.5,
      });
    }
    expect(second.cache.status).toBe("hit");
    expect(get).toHaveBeenCalledTimes(1);

    const requestedUrl = new URL(String(get.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe("https://data-api.binance.vision");
    expect(requestedUrl.pathname).toBe("/api/v3/klines");
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      symbol: "BTCUSDT",
      interval: "1d",
      startTime: String(Date.parse(RANGE.from)),
      endTime: String(Date.parse(RANGE.to)),
      limit: "5",
    });
  });

  it("keeps ETH candles and capability explicitly separate from BTC", async () => {
    const provider = createProvider(vi.fn(async () => [kline("2026-08-30")]));

    const result = await provider.getDailyCandles("eth", RANGE);

    expect(result).toMatchObject({
      status: "fresh",
      capability: "historical.eth-daily-candles",
      value: [
        {
          asset: "eth",
          symbol: "ETHUSDT",
          quoteCurrency: "USDT",
        },
      ],
      scope: { label: expect.stringContaining("ETHUSDT") },
    });
  });

  it("maps Binance business errors returned with HTTP 200 to upstream errors", async () => {
    const provider = createProvider(
      vi.fn(async () => ({ code: -1121, msg: "Invalid symbol." })),
    );

    await expect(provider.getDailyCandles("btc", RANGE)).resolves.toMatchObject({
      status: "error",
      error: { code: "upstream_error", retryable: false },
      value: null,
    });
  });

  it.each([
    ["non-array payload", { unexpected: true }],
    ["short row", [[NOW, "100"]]],
    ["zero open", [kline("2026-08-30", { open: "0" })]],
    ["NaN close", [kline("2026-08-30", { close: "NaN" })]],
    ["high below open", [kline("2026-08-30", { high: "99" })]],
    ["low above close", [kline("2026-08-30", { low: "109" })]],
    ["zero volume", [kline("2026-08-30", { volume: "0" })]],
    [
      "seconds used for a millisecond timestamp",
      [
        kline("2026-08-30", {
          openedAt: Math.floor(Date.parse("2026-08-30T00:00:00.000Z") / 1_000),
        }),
      ],
    ],
    [
      "non-UTC daily boundary",
      [
        kline("2026-08-30", {
          openedAt: Date.parse("2026-08-30T01:00:00.000Z"),
          closedAt: Date.parse("2026-08-31T00:59:59.999Z"),
        }),
      ],
    ],
    [
      "conflicting duplicate candle",
      [kline("2026-08-30"), kline("2026-08-30", { close: "107" })],
    ],
  ])("rejects %s before it enters the domain", async (_name, payload) => {
    const provider = createProvider(vi.fn(async () => payload));

    await expect(provider.getDailyCandles("btc", RANGE)).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
      value: null,
    });
  });

  it.each([
    ["an empty response", []],
    ["a response containing only the forming candle", [kline("2026-08-31")]],
  ])("preserves live source metadata for empty upstream data: %s", async (_name, payload) => {
    const provider = createProvider(vi.fn(async () => payload));

    await expect(provider.getDailyCandles("btc", RANGE)).resolves.toMatchObject({
      status: "error",
      capability: "historical.btc-daily-candles",
      source: { id: "binance-spot" },
      scope: { label: expect.stringContaining("BTCUSDT") },
      retrievedAt: "2026-08-31T12:00:00.000Z",
      error: { code: "no_data", retryable: true },
      value: null,
      cache: { status: "miss", revalidateSeconds: 900 },
    });
  });

  it("serves validated last-known-good candles as stale after an empty refresh", async () => {
    let current = NOW;
    let payload: unknown = [kline("2026-08-30", { close: "109" })];
    const get = vi.fn(async () => payload);
    const provider = createProvider(get, () => current);

    const first = await provider.getDailyCandles("btc", RANGE);
    current += 901_000;
    payload = [];
    const refreshed = await provider.getDailyCandles("btc", RANGE);

    expect(first).toMatchObject({
      status: "fresh",
      value: [{ close: 109 }],
    });
    expect(refreshed).toMatchObject({
      status: "stale",
      stale: true,
      value: [{ close: 109 }],
      error: { code: "no_data", retryable: true },
      cache: { status: "hit", staleIfErrorSeconds: 604_800 },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "non-canonical timestamp",
      { from: "2026-08-27", to: RANGE.to },
    ],
    [
      "reversed range",
      { from: RANGE.to, to: RANGE.from },
    ],
    [
      "future range",
      {
        from: RANGE.from,
        to: "2026-09-01T12:00:00.000Z",
      },
    ],
    [
      "range exceeding Binance's 1000 candle limit",
      {
        from: "2023-01-01T00:00:00.000Z",
        to: RANGE.to,
      },
    ],
  ])("rejects %s before making an HTTP request", async (_name, range) => {
    const get = vi.fn();
    const provider = createProvider(get);

    await expect(provider.getDailyCandles("btc", range)).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
      cache: { status: "bypass" },
    });
    expect(get).not.toHaveBeenCalled();
  });
});

describe("Binance Spot live chart candle provider", () => {
  it("normalizes, sorts, deduplicates and caches 1h candles with only the latest candle forming", async () => {
    const duplicate = chartKline("2026-08-31T10:00:00.000Z", "1h", {
      close: "106",
    });
    const get = vi.fn(async (url: string) => {
      void url;
      return [
        chartKline("2026-08-31T12:00:00.000Z", "1h", {
          close: "110",
          volume: "0",
        }),
        chartKline("2026-08-31T11:00:00.000Z", "1h", { close: "109" }),
        duplicate,
        [...duplicate],
      ];
    });
    const provider = createProvider(get);

    const first = await provider.getChartCandles("btc", {
      interval: "1h",
      limit: 1_000,
    });
    const second = await provider.getChartCandles("btc", {
      interval: "1h",
      limit: 1_000,
    });

    expect(first).toMatchObject({
      status: "fresh",
      capability: "historical.btc-chart-candles",
      source: { id: "binance-spot" },
      scope: {
        kind: "venue",
        label: expect.stringContaining("BTCUSDT 现货 1h K 线"),
      },
      updatedAt: "2026-08-31T12:00:00.000Z",
      retrievedAt: "2026-08-31T12:00:00.000Z",
      stale: false,
      cache: {
        status: "miss",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
      error: null,
    });
    if (first.status === "fresh") {
      expect(first.value).toHaveLength(3);
      expect(first.value.map((candle) => candle.openedAt)).toEqual([
        "2026-08-31T10:00:00.000Z",
        "2026-08-31T11:00:00.000Z",
        "2026-08-31T12:00:00.000Z",
      ]);
      expect(first.value.map((candle) => candle.state)).toEqual([
        "closed",
        "closed",
        "forming",
      ]);
      expect(first.value[2]).toEqual({
        asset: "btc",
        symbol: "BTCUSDT",
        interval: "1h",
        quoteCurrency: "USDT",
        state: "forming",
        openedAt: "2026-08-31T12:00:00.000Z",
        closedAt: "2026-08-31T12:59:59.999Z",
        open: 100,
        high: 112,
        low: 94,
        close: 110,
        volume: 0,
      });
    }
    expect(second.cache.status).toBe("hit");
    expect(get).toHaveBeenCalledTimes(1);

    const requestedUrl = new URL(String(get.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe("https://data-api.binance.vision");
    expect(requestedUrl.pathname).toBe("/api/v3/klines");
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      symbol: "BTCUSDT",
      interval: "1h",
      limit: "1000",
    });
    expect(requestedUrl.searchParams.has("startTime")).toBe(false);
    expect(requestedUrl.searchParams.has("endTime")).toBe(false);
  });

  it.each([
    {
      asset: "eth" as const,
      interval: "15m" as const,
      closedAt: "2026-08-31T11:45:00.000Z",
      formingAt: "2026-08-31T12:00:00.000Z",
      symbol: "ETHUSDT",
    },
    {
      asset: "btc" as const,
      interval: "4h" as const,
      closedAt: "2026-08-31T08:00:00.000Z",
      formingAt: "2026-08-31T12:00:00.000Z",
      symbol: "BTCUSDT",
    },
  ])(
    "keeps $interval chart scope and state explicit for $symbol",
    async ({ asset, interval, closedAt, formingAt, symbol }) => {
      const get = vi.fn(async (url: string) => {
        void url;
        return [
          chartKline(closedAt, interval),
          chartKline(formingAt, interval),
        ];
      });
      const provider = createProvider(get);

      const result = await provider.getChartCandles(asset, {
        interval,
        limit: 500,
      });

      expect(result).toMatchObject({
        status: "fresh",
        capability: `historical.${asset}-chart-candles`,
        scope: { label: expect.stringContaining(`${symbol} 现货 ${interval}`) },
        value: [
          { asset, symbol, interval, state: "closed" },
          { asset, symbol, interval, state: "forming" },
        ],
      });
      const requestedUrl = new URL(String(get.mock.calls[0]?.[0]));
      expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
        symbol,
        interval,
        limit: "500",
      });
    },
  );

  it("serves validated last-known-good chart candles as stale after a failed refresh", async () => {
    let current = NOW;
    let payload: unknown = [
      chartKline("2026-08-31T11:00:00.000Z", "1h"),
      chartKline("2026-08-31T12:00:00.000Z", "1h", { close: "109" }),
    ];
    const get = vi.fn(async (url: string) => {
      void url;
      return payload;
    });
    const provider = createProvider(get, () => current);
    const request = { interval: "1h", limit: 1_000 } as const;

    const first = await provider.getChartCandles("btc", request);
    current += 5_001;
    payload = [];
    const refreshed = await provider.getChartCandles("btc", request);

    expect(first).toMatchObject({
      status: "fresh",
      value: [{ state: "closed" }, { state: "forming", close: 109 }],
    });
    expect(refreshed).toMatchObject({
      status: "stale",
      stale: true,
      value: [{ state: "closed" }, { state: "forming", close: 109 }],
      error: { code: "no_data", retryable: true },
      cache: {
        status: "hit",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["unsupported interval", { interval: "5m", limit: 500 }],
    ["limit below the minimum", { interval: "1h", limit: 1 }],
    ["limit above Binance maximum", { interval: "1h", limit: 1_001 }],
    ["non-integer limit", { interval: "1h", limit: 2.5 }],
  ])("rejects %s before making an HTTP request", async (_name, request) => {
    const get = vi.fn();
    const provider = createProvider(get);

    await expect(
      provider.getChartCandles(
        "btc",
        request as unknown as ChartCandleRequest,
      ),
    ).resolves.toMatchObject({
      status: "error",
      capability: "historical.btc-chart-candles",
      error: { code: "invalid_payload", retryable: false },
      cache: {
        status: "bypass",
        revalidateSeconds: 5,
        staleIfErrorSeconds: 300,
      },
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects conflicting chart candle duplicates", async () => {
    const provider = createProvider(
      vi.fn(async () => [
        chartKline("2026-08-31T12:00:00.000Z", "1h"),
        chartKline("2026-08-31T12:00:00.000Z", "1h", { close: "109" }),
      ]),
    );

    await expect(
      provider.getChartCandles("btc", { interval: "1h", limit: 500 }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
      value: null,
    });
  });

  it("rejects more than one forming chart candle", async () => {
    const now = Date.parse("2026-08-31T12:10:00.000Z");
    const provider = createProvider(
      vi.fn(async () => [
        chartKline("2026-08-31T12:00:00.000Z", "15m"),
        chartKline("2026-08-31T12:15:00.000Z", "15m"),
      ]),
      () => now,
    );

    await expect(
      provider.getChartCandles("btc", { interval: "15m", limit: 500 }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "invalid_payload", retryable: false },
      value: null,
    });
  });
});
