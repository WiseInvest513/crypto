import { describe, expect, it, vi } from "vitest";
import { PricePerformanceService } from "@/server/data/services/price-performance-service";
import { ProviderError } from "@/server/data/errors/provider-error";
import type { Asset } from "@/server/data/contracts/market-data";
import type { JsonHttpClient } from "@/server/data/http/fetch-json";

const MINUTE = 60_000;
const DAY = 86_400_000;
const NOW = Date.parse("2026-09-03T05:12:34.000Z");

function ticker(window: "1d" | "7d", now = NOW, symbol = "BTCUSDT") {
  return {
    symbol,
    openPrice: "100", lastPrice: "110", priceChangePercent: "10.000",
    openTime: Math.floor((now - (window === "1d" ? DAY : 7 * DAY)) / MINUTE) * MINUTE,
    closeTime: now,
  };
}

function minute(openTime: number, historical = false): unknown[][] {
  const open = historical ? "80" : "100";
  return [[openTime, open, "115", "75", "110", "12", openTime + MINUTE - 1, "1", 1, "1", "1", "0"]];
}

function upstream(url: string, now = NOW): unknown {
  const parsed = new URL(url);
  if (parsed.pathname === "/api/v3/ticker") {
    return ticker(parsed.searchParams.get("windowSize") as "1d" | "7d", now, parsed.searchParams.get("symbol") ?? "");
  }
  const anchor = parsed.searchParams.get("startTime");
  return minute(anchor ? Number(anchor) : Math.floor(now / MINUTE) * MINUTE, anchor !== null);
}

function create(get: JsonHttpClient["get"] = async (url) => upstream(url), now: () => number = () => NOW) {
  return new PricePerformanceService({ http: { get }, now });
}

describe("same-source rolling price performance", () => {
  it("returns independently timestamped 1d / 7d ticker windows and a real minute-anchored 30d change", async () => {
    const get = vi.fn(async (url: string) => upstream(url));
    const result = await create(get).load("btc");
    expect(result.asset).toBe("btc");
    expect(result.windows.map(({ window }) => window)).toEqual(["1d", "7d", "30d"]);
    expect(result.windows[0]?.datum).toMatchObject({
      status: "fresh", capability: "spot.btc-performance", updatedAtKind: "source",
      source: { id: "binance-spot" }, scope: { kind: "venue" },
      updatedAt: new Date(NOW).toISOString(), retrievedAt: new Date(NOW).toISOString(),
      provenance: "live", error: null, loading: false, stale: false,
      cache: { status: "miss", revalidateSeconds: 60, staleIfErrorSeconds: 300 },
      value: { asset: "btc", symbol: "BTCUSDT", window: "1d", quoteCurrency: "USDT", openPrice: 100, latestPrice: 110, basis: "rolling-ticker" },
    });
    expect(result.windows[0]?.datum.value?.changePercent).toBeCloseTo(10);
    expect(result.windows[2]?.datum).toMatchObject({
      status: "fresh", provenance: "derived", updatedAtKind: "observed",
      value: { window: "30d", openPrice: 80, latestPrice: 110, changePercent: 37.5, basis: "minute-anchor" },
    });
    expect(get).toHaveBeenCalledTimes(4);
    const urls = get.mock.calls.map(([url]) => new URL(url));
    expect(urls.every((url) => url.origin === "https://data-api.binance.vision")).toBe(true);
    expect(urls.some((url) => url.searchParams.get("windowSize") === "30d")).toBe(false);
    const historical = urls.find((url) => url.searchParams.has("startTime"));
    const anchor = Math.floor((NOW - 30 * DAY) / MINUTE) * MINUTE;
    expect(Object.fromEntries(historical!.searchParams)).toEqual({ symbol: "BTCUSDT", interval: "1m", startTime: String(anchor), endTime: String(anchor + MINUTE - 1), limit: "1" });
  });

  it("keeps ETH scope and never mixes quote currencies or USD aggregate prices", async () => {
    const result = await create().load("eth");
    for (const { datum } of result.windows) {
      expect(datum.capability).toBe("spot.eth-performance");
      expect(datum.value).toMatchObject({ asset: "eth", symbol: "ETHUSDT", quoteCurrency: "USDT" });
      expect(datum.scope?.label).toContain("ETHUSDT");
    }
  });

  it("uses one request set for concurrent readers and caches three windows for 60 seconds", async () => {
    let now = NOW;
    const get = vi.fn(async (url: string) => upstream(url, now));
    const service = create(get, () => now);
    await Promise.all([service.load("btc"), service.load("btc"), service.load("btc")]);
    expect(get).toHaveBeenCalledTimes(4);
    now += 59_000;
    expect((await service.load("btc")).windows.every(({ datum }) => datum.cache.status === "hit")).toBe(true);
    expect(get).toHaveBeenCalledTimes(4);
    now += 1_000;
    await service.load("btc");
    expect(get).toHaveBeenCalledTimes(8);
  });

  it("isolates a failed weekly result from the day and month", async () => {
    const service = create(async (url) => {
      if (new URL(url).searchParams.get("windowSize") === "7d") throw new ProviderError("rate_limited", true);
      return upstream(url);
    });
    const result = await service.load("btc");
    expect(result.windows.map(({ datum }) => datum.status)).toEqual(["fresh", "error", "fresh"]);
    expect(result.windows[1]?.datum).toMatchObject({ value: null, error: { code: "rate_limited" } });
  });

  it("keeps the day and week when 30-day historical anchor is missing", async () => {
    const result = await create(async (url) => new URL(url).searchParams.has("startTime") ? [] : upstream(url)).load("btc");
    expect(result.windows.map(({ datum }) => datum.status)).toEqual(["fresh", "fresh", "error"]);
    expect(result.windows[2]?.datum).toMatchObject({ value: null, error: { code: "no_data" } });
  });

  it("falls back only to a fixed same-exchange endpoint on a transient transport error", async () => {
    const get = vi.fn(async (url: string) => {
      if (new URL(url).origin === "https://data-api.binance.vision") throw new ProviderError("timeout", true);
      return upstream(url);
    });
    const result = await create(get).load("btc");
    expect(result.windows.every(({ datum }) => datum.status === "fresh")).toBe(true);
    expect(get).toHaveBeenCalledTimes(8);
    expect(new Set(get.mock.calls.map(([url]) => new URL(url).origin))).toEqual(new Set(["https://data-api.binance.vision", "https://api.binance.com"]));
  });

  it.each([
    new ProviderError("rate_limited", true),
    new ProviderError("upstream_error", false),
    new ProviderError("invalid_payload", false),
  ])("does not retry a rate limit, WAF/restricted host or invalid payload elsewhere", async (failure) => {
    const get = vi.fn(async () => { throw failure; });
    const result = await create(get).load("btc");
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.windows.every(({ datum }) => datum.status === "error")).toBe(true);
  });

  it("keeps last-good values on failures, backs off, and never extends their absolute 300s expiry", async () => {
    let now = NOW;
    let failed = false;
    const get = vi.fn(async (url: string) => {
      if (failed) throw new ProviderError("rate_limited", true);
      return upstream(url, now);
    });
    const service = create(get, () => now);
    await service.load("btc");
    now += 60_000;
    failed = true;
    const stale = await service.load("btc");
    expect(stale.windows.every(({ datum }) => datum.status === "stale" && datum.stale && datum.value !== null)).toBe(true);
    expect(stale.windows[0]?.datum.retrievedAt).toBe(new Date(NOW).toISOString());
    expect(get).toHaveBeenCalledTimes(7);
    now += 10_000;
    await service.load("btc");
    expect(get).toHaveBeenCalledTimes(7);
    now = NOW + 295_000;
    expect((await service.load("btc")).windows[0]?.datum.status).toBe("stale");
    now = NOW + 301_000;
    const expired = await service.load("btc");
    expect(expired.windows.every(({ datum }) => datum.status === "error" && datum.value === null)).toBe(true);
  });

  it("rejects an upstream time rollback without replacing last-good readings", async () => {
    let now = NOW;
    let sentNow = NOW;
    const service = create(async (url) => upstream(url, sentNow), () => now);
    await service.load("btc");
    now += 60_000;
    sentNow -= 1_000;
    const result = await service.load("btc");
    expect(result.windows[0]?.datum).toMatchObject({ status: "stale", updatedAt: new Date(NOW).toISOString(), error: { code: "invalid_payload" } });
  });

  it.each([
    { symbol: "ETHUSDT" }, { openPrice: null }, { openPrice: "0" },
    { lastPrice: "NaN" }, { lastPrice: "Infinity" }, { priceChangePercent: "99" },
    { openTime: NOW - DAY }, { openTime: Math.floor((NOW - 7 * DAY) / MINUTE) * MINUTE },
    { closeTime: Math.floor(NOW / 1_000) }, { closeTime: "2026-09-03T05:12:34.000Z" },
    { code: -1003 },
  ])("rejects malformed or mislabeled ticker data %j", async (changes) => {
    const result = await create(async (url) => {
      if (new URL(url).searchParams.get("windowSize") === "1d") return { ...ticker("1d"), ...changes };
      return upstream(url);
    }).load("btc");
    expect(result.windows[0]?.datum.status).toBe("error");
    expect(result.windows[0]?.datum.value).toBeNull();
    expect(result.windows[1]?.datum.status).toBe("fresh");
  });

  it("rejects stale upstream tickers instead of renewing their timestamp", async () => {
    const result = await create(async (url) => {
      if (new URL(url).pathname === "/api/v3/ticker") return ticker("1d", NOW - 121_000);
      return upstream(url);
    }).load("btc");
    expect(result.windows[0]?.datum).toMatchObject({ status: "error", updatedAt: null, error: { code: "no_data" } });
  });

  it("rejects future ticker timestamps even within general provider clock tolerance", async () => {
    const result = await create(async (url) => {
      if (new URL(url).searchParams.get("windowSize") === "1d") return ticker("1d", NOW + 10_000);
      return upstream(url);
    }).load("btc");
    expect(result.windows[0]?.datum).toMatchObject({ status: "error", error: { code: "invalid_payload" } });
  });

  it.each([
    (row: unknown[]) => { row[0] = Number(row[0]) + 1; },
    (row: unknown[]) => { row[6] = Number(row[6]) + 1; },
    (row: unknown[]) => { row[1] = "0"; },
    (row: unknown[]) => { row[2] = "50"; },
    (row: unknown[]) => { row[3] = "120"; },
    (row: unknown[]) => { row[4] = "Infinity"; },
  ])("rejects malformed minute anchors", async (mutate) => {
    const result = await create(async (url) => {
      const payload = upstream(url);
      if (new URL(url).searchParams.has("startTime")) mutate((payload as unknown[][])[0]!);
      return payload;
    }).load("btc");
    expect(result.windows[2]?.datum).toMatchObject({ status: "error", value: null });
  });

  it("rejects a different historical minute instead of silently changing the period", async () => {
    const result = await create(async (url) => {
      const start = new URL(url).searchParams.get("startTime");
      return start ? minute(Number(start) + MINUTE, true) : upstream(url);
    }).load("btc");
    expect(result.windows[2]?.datum).toMatchObject({ status: "error", error: { code: "no_data" } });
  });

  it("rejects an asset outside the public allowlist without any request", async () => {
    const get = vi.fn(async (url: string) => upstream(url));
    await expect(create(get).load("xrp" as Asset)).rejects.toBeInstanceOf(ProviderError);
    expect(get).not.toHaveBeenCalled();
  });
});
