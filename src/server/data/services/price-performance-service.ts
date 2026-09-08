import "server-only";

import {
  pricePerformanceWindows,
  type PricePerformanceReading,
  type PricePerformanceSnapshot,
  type PricePerformanceWindow,
} from "@/lib/market/price-performance";
import type { CachePolicy } from "../cache/policies";
import { ResilientMarketCache } from "../cache/resilient-market-cache";
import type { Asset, CandleSymbol, MarketDatum } from "../contracts/market-data";
import { ProviderError, normalizeProviderError } from "../errors/provider-error";
import { FetchJsonClient, type JsonHttpClient } from "../http/fetch-json";
import { binanceSpotSource } from "../providers/sources";
import { finiteNumber, positiveNumber, record, unixMillisecondsToIso } from "../validation/upstream";

const MINUTE = 60_000;
const DAY = 86_400_000;
const SYMBOLS = { btc: "BTCUSDT", eth: "ETHUSDT" } as const;
const HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"] as const;
const POLICY: CachePolicy = {
  revalidateSeconds: 60,
  staleIfErrorSeconds: 300,
  maxSourceAgeSeconds: 120,
};

type Options = { http?: JsonHttpClient; cache?: ResilientMarketCache; now?: () => number };

/** Public, identity-independent Binance Spot changes; six bounded cache keys. */
export class PricePerformanceService {
  private readonly http: JsonHttpClient;
  private readonly cache: ResilientMarketCache;
  private readonly now: () => number;
  private readonly latestCloseTimes = new Map<string, number>();

  constructor({ http, cache, now = Date.now }: Options = {}) {
    this.now = now;
    this.http = http ?? new FetchJsonClient({ timeoutMs: 4_000, maxAttempts: 1 });
    this.cache = cache ?? new ResilientMarketCache({ now }, 6);
  }

  async load(asset: Asset): Promise<PricePerformanceSnapshot> {
    if (asset !== "btc" && asset !== "eth") throw new ProviderError("invalid_payload", false);
    return {
      asset,
      windows: await Promise.all(pricePerformanceWindows.map(async (window) => ({
        window,
        datum: await this.readWindow(asset, window),
      }))),
    };
  }

  private readWindow(asset: Asset, window: PricePerformanceWindow): Promise<MarketDatum<PricePerformanceReading>> {
    const symbol = SYMBOLS[asset];
    const capability = `spot.${asset}-performance` as const;
    const scope = {
      kind: "venue" as const,
      label: `Binance ${symbol} 现货近 ${Number.parseInt(window)} 天变化（USDT，分钟对齐）`,
    };
    const key = `binance-spot:performance:${asset}:${window}:v1`;
    return this.cache.read({
      key, capability, source: binanceSpotSource, scope, policy: POLICY,
      load: async () => {
        const value = window === "30d"
          ? await this.loadMonth(asset, symbol)
          : await this.loadTicker(asset, symbol, window);
        const closeTime = Date.parse(value.closeTime);
        if (closeTime < (this.latestCloseTimes.get(key) ?? 0)) {
          throw new ProviderError("invalid_payload", true);
        }
        this.latestCloseTimes.set(key, closeTime);
        return {
          capability, value, source: binanceSpotSource, scope,
          updatedAt: value.closeTime,
          updatedAtKind: value.basis === "minute-anchor" ? "observed" as const : "source" as const,
          provenance: value.basis === "minute-anchor" ? "derived" as const : "live" as const,
        };
      },
    });
  }

  private async loadTicker(asset: Asset, symbol: CandleSymbol, window: "1d" | "7d"): Promise<PricePerformanceReading> {
    const payload = record(await this.request("/api/v3/ticker", { symbol, windowSize: window, type: "FULL" }));
    assertNoBusinessError(payload);
    if (payload.symbol !== symbol) throw new ProviderError("invalid_payload", false);
    const now = this.now();
    const openTime = checkedTimestamp(payload.openTime, now);
    const closeTime = checkedTimestamp(payload.closeTime, now);
    const windowMs = (window === "1d" ? 1 : 7) * DAY;
    if (Date.parse(openTime) !== Math.floor((Date.parse(closeTime) - windowMs) / MINUTE) * MINUTE) {
      throw new ProviderError("invalid_payload", false);
    }
    assertRecent(Date.parse(closeTime), now);
    const openPrice = positiveNumber(payload.openPrice);
    const latestPrice = positiveNumber(payload.lastPrice);
    const changePercent = percentageChange(openPrice, latestPrice);
    const upstreamChange = finiteNumber(payload.priceChangePercent);
    if (Math.abs(upstreamChange - changePercent) > Math.max(0.001, Math.abs(changePercent) * 1e-10)) {
      throw new ProviderError("invalid_payload", false);
    }
    return { asset, symbol, window, quoteCurrency: "USDT", openPrice, latestPrice, changePercent, openTime, closeTime, basis: "rolling-ticker" };
  }

  private async loadMonth(asset: Asset, symbol: CandleSymbol): Promise<PricePerformanceReading> {
    // Binance rolling ticker currently supports at most 7d. A 30d comparison
    // therefore uses a real historical minute open, never 30 daily candles.
    const latestPayload = await this.request("/api/v3/klines", { symbol, interval: "1m", limit: "1" });
    const observedAt = this.now();
    const latest = parseMinuteCandle(latestPayload, observedAt);
    assertRecent(latest.openTime, observedAt);
    if (latest.openTime !== Math.floor(observedAt / MINUTE) * MINUTE) {
      throw new ProviderError("no_data", true);
    }
    const anchorTime = Math.floor((observedAt - 30 * DAY) / MINUTE) * MINUTE;
    const historicalPayload = await this.request("/api/v3/klines", {
      symbol, interval: "1m", startTime: String(anchorTime), endTime: String(anchorTime + MINUTE - 1), limit: "1",
    });
    const anchor = parseMinuteCandle(historicalPayload, this.now());
    if (anchor.openTime !== anchorTime) throw new ProviderError("no_data", true);
    return {
      asset, symbol, window: "30d", quoteCurrency: "USDT",
      openPrice: anchor.open, latestPrice: latest.close,
      changePercent: percentageChange(anchor.open, latest.close),
      openTime: new Date(anchorTime).toISOString(), closeTime: new Date(observedAt).toISOString(), basis: "minute-anchor",
    };
  }

  private async request(path: string, params: Record<string, string>): Promise<unknown> {
    for (let index = 0; index < HOSTS.length; index += 1) {
      const url = new URL(path, HOSTS[index]);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      try {
        return await this.http.get(url.toString());
      } catch (error) {
        const normalized = normalizeProviderError(error);
        // Never evade a Binance rate limit, WAF or malformed request by
        // switching host. Only transient transport/server failures may retry.
        if (!normalized.retryable || normalized.code === "rate_limited" || index === HOSTS.length - 1) throw normalized;
      }
    }
    throw new ProviderError("upstream_error", true);
  }
}

function checkedTimestamp(value: unknown, now: number): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new ProviderError("invalid_payload", false);
  return unixMillisecondsToIso(value, now);
}

function assertRecent(value: number, now: number): void {
  if (value > now + 5_000) throw new ProviderError("invalid_payload", false);
  if (now - value > POLICY.maxSourceAgeSeconds * 1_000) throw new ProviderError("no_data", true);
}

function assertNoBusinessError(value: Record<string, unknown>): void {
  if ("code" in value) {
    const code = finiteNumber(value.code);
    throw new ProviderError(code === -1003 ? "rate_limited" : "upstream_error", true);
  }
}

function percentageChange(open: number, latest: number): number {
  const result = (latest / open - 1) * 100;
  if (!Number.isFinite(result)) throw new ProviderError("invalid_payload", false);
  return result;
}

function parseMinuteCandle(payload: unknown, now: number): { openTime: number; open: number; close: number } {
  if (!Array.isArray(payload)) {
    assertNoBusinessError(record(payload));
    throw new ProviderError("invalid_payload", false);
  }
  if (payload.length === 0) throw new ProviderError("no_data", true);
  if (payload.length !== 1 || !Array.isArray(payload[0]) || payload[0].length < 7) throw new ProviderError("invalid_payload", false);
  const row = payload[0];
  const openTime = Date.parse(checkedTimestamp(row[0], now));
  const closeTime = Date.parse(checkedTimestamp(row[6], now));
  const open = positiveNumber(row[1]);
  const high = positiveNumber(row[2]);
  const low = positiveNumber(row[3]);
  const close = positiveNumber(row[4]);
  if (openTime % MINUTE !== 0 || closeTime !== openTime + MINUTE - 1 || high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
    throw new ProviderError("invalid_payload", false);
  }
  return { openTime, open, close };
}

const sharedService = new PricePerformanceService();

export function loadAssetPerformanceSnapshot(asset: Asset): Promise<PricePerformanceSnapshot> {
  return sharedService.load(asset);
}
