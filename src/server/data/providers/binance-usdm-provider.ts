import "server-only";

import { cachePolicies } from "../cache/policies";
import { ResilientMarketCache } from "../cache/resilient-market-cache";
import type {
  Asset,
  FundingReading,
  LiquidationsReading,
  MarketCapability,
  MarketDatum,
  OpenInterestReading,
} from "../contracts/market-data";
import { unavailableDatum } from "../contracts/market-data";
import type { DerivativesProvider } from "../contracts/providers";
import { ProviderError } from "../errors/provider-error";
import {
  FetchJsonClient,
  type JsonHttpClient,
} from "../http/fetch-json";
import {
  array,
  finiteNumber,
  nonEmptyString,
  nonNegativeNumber,
  numberInRange,
  record,
  unixMillisecondsToIso,
} from "../validation/upstream";
import { binanceUsdMSource } from "./sources";

const BASE_URL = "https://fapi.binance.com";
const SYMBOLS: Record<Asset, string> = { btc: "BTCUSDT", eth: "ETHUSDT" };
const OPEN_INTEREST_SAMPLE_LIMIT = 289;
const MINIMUM_COMPARISON_WINDOW_MS = 23 * 60 * 60 * 1_000;
const MAXIMUM_COMPARISON_WINDOW_MS = 25 * 60 * 60 * 1_000;

/**
 * Funding and OI are supporting context, not headline data. Keep their request
 * budget short so a slow derivatives venue cannot hold the homepage open.
 * Cache/backoff behavior remains owned by ResilientMarketCache.
 */
export const BINANCE_USDM_HTTP_POLICY = {
  timeoutMs: 2_500,
  maxAttempts: 1,
} as const;

type BinanceUsdMProviderOptions = {
  cache?: ResilientMarketCache;
  http?: JsonHttpClient;
  now?: () => number;
};

export class BinanceUsdMProvider implements DerivativesProvider {
  readonly id = "binance-usdm";
  readonly mode = "live" as const;
  readonly source = binanceUsdMSource;

  private readonly cache: ResilientMarketCache;
  private readonly http: JsonHttpClient;
  private readonly now: () => number;

  constructor({
    cache = new ResilientMarketCache(),
    http = new FetchJsonClient(BINANCE_USDM_HTTP_POLICY),
    now = Date.now,
  }: BinanceUsdMProviderOptions = {}) {
    this.cache = cache;
    this.http = http;
    this.now = now;
  }

  async getFunding(asset: Asset): Promise<MarketDatum<FundingReading>> {
    const symbol = SYMBOLS[asset];
    const capability = `derivatives.${asset}-funding` as MarketCapability;
    const scope = {
      kind: "venue" as const,
      label: `Binance USDⓈ-M ${symbol} 永续合约`,
    };

    return this.cache.read({
      key: `binance-usdm:funding:${symbol}`,
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.funding,
      load: async () => {
        const payload = await this.http.get(
          `${BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`,
        );
        rejectBinanceBusinessError(payload);
        const data = record(payload);
        if (nonEmptyString(data.symbol) !== symbol) {
          throw new ProviderError("invalid_payload", false);
        }

        return {
          capability,
          value: {
            asset,
            symbol,
            rate: numberInRange(data.lastFundingRate, -1, 1),
            intervalHours: null,
          },
          source: this.source,
          scope,
          updatedAt: unixMillisecondsToIso(data.time, this.now()),
          provenance: "live" as const,
        };
      },
    });
  }

  async getOpenInterest(
    asset: Asset,
  ): Promise<MarketDatum<OpenInterestReading>> {
    const symbol = SYMBOLS[asset];
    const capability =
      `derivatives.${asset}-open-interest` as MarketCapability;
    const scope = {
      kind: "venue" as const,
      label: `Binance USDⓈ-M ${symbol} 永续合约·5 分钟 OI 样本`,
    };

    return this.cache.read({
      key: `binance-usdm:open-interest:${symbol}`,
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.openInterest,
      load: async () => {
        const payload = await this.http.get(
          `${BASE_URL}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=${OPEN_INTEREST_SAMPLE_LIMIT}`,
        );
        rejectBinanceBusinessError(payload);
        const items = array(payload);
        if (items.length === 0 || items.length > OPEN_INTEREST_SAMPLE_LIMIT) {
          throw new ProviderError("invalid_payload", false);
        }
        const samples = items.map((item) => {
          const data = record(item);
          if (nonEmptyString(data.symbol) !== symbol) {
            throw new ProviderError("invalid_payload", false);
          }

          return {
            notional: nonNegativeNumber(data.sumOpenInterestValue),
            timestamp: Date.parse(
              unixMillisecondsToIso(data.timestamp, this.now()),
            ),
          };
        });
        for (let index = 1; index < samples.length; index += 1) {
          if (samples[index].timestamp <= samples[index - 1].timestamp) {
            throw new ProviderError("invalid_payload", false);
          }
        }

        const first = samples[0];
        const latest = samples.at(-1)!;
        const comparisonWindowMs = latest.timestamp - first.timestamp;
        const hasVerifiedComparisonWindow =
          samples.length > 1 &&
          comparisonWindowMs >= MINIMUM_COMPARISON_WINDOW_MS &&
          comparisonWindowMs <= MAXIMUM_COMPARISON_WINDOW_MS &&
          first.notional > 0;
        const change24hPercent = hasVerifiedComparisonWindow
          ? ((latest.notional - first.notional) / first.notional) * 100
          : null;

        return {
          capability,
          value: {
            asset,
            symbol,
            notional: latest.notional,
            quoteCurrency: "USDT",
            samplingPeriod: "5m",
            change24hPercent,
            comparisonWindowHours: hasVerifiedComparisonWindow
              ? comparisonWindowMs / (60 * 60 * 1_000)
              : null,
          },
          source: this.source,
          scope,
          updatedAt: new Date(latest.timestamp).toISOString(),
          provenance: "live" as const,
        };
      },
    });
  }

  async getLiquidations(): Promise<MarketDatum<LiquidationsReading>> {
    return unavailableDatum(
      "derivatives.total-liquidations",
      "no_reliable_source",
    );
  }
}

function rejectBinanceBusinessError(payload: unknown): void {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return;
  }

  const candidate = payload as Record<string, unknown>;
  if (candidate.code !== undefined) {
    finiteNumber(candidate.code);
    throw new ProviderError("upstream_error", false);
  }
}
