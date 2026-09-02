import "server-only";

import { cachePolicies } from "../cache/policies";
import { ResilientMarketCache } from "../cache/resilient-market-cache";
import type {
  Asset,
  AvailableMarketDatum,
  GlobalMarket,
  MarketCapability,
  MarketDatum,
  PriceQuote,
  SentimentReading,
} from "../contracts/market-data";
import { unavailableDatum } from "../contracts/market-data";
import type {
  SentimentProvider,
  SpotMarketProvider,
} from "../contracts/providers";
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
  positiveNumber,
  record,
  unixSecondsToIso,
} from "../validation/upstream";
import {
  alternativeMeFearAndGreedSource,
  alternativeMeMarketSource,
} from "./sources";
import { incoherentQuoteBatchDatum } from "./quote-coherence";

const BASE_URL = "https://api.alternative.me";
const ASSET_METADATA = {
  btc: { id: 1, name: "Bitcoin", slug: "bitcoin", symbol: "BTC" },
  eth: { id: 1027, name: "Ethereum", slug: "ethereum", symbol: "ETH" },
} as const satisfies Record<
  Asset,
  { id: number; name: string; slug: string; symbol: string }
>;

const SENTIMENT_CLASSIFICATIONS = new Set([
  "Extreme Fear",
  "Fear",
  "Neutral",
  "Greed",
  "Extreme Greed",
]);

type AlternativeMeProviderOptions = {
  cache?: ResilientMarketCache;
  http?: JsonHttpClient;
  now?: () => number;
};

export class AlternativeMeProvider
  implements SpotMarketProvider, SentimentProvider
{
  readonly id = "alternative-me";
  readonly mode = "live" as const;
  readonly source = alternativeMeMarketSource;

  private readonly cache: ResilientMarketCache;
  private readonly http: JsonHttpClient;
  private readonly now: () => number;

  constructor({
    cache = new ResilientMarketCache(),
    http = new FetchJsonClient(),
    now = Date.now,
  }: AlternativeMeProviderOptions = {}) {
    this.cache = cache;
    this.http = http;
    this.now = now;
  }

  async getQuotes(
    requestedAssets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    const assets = [...new Set(requestedAssets)].sort();
    if (assets.length === 0) {
      return unavailableDatum("spot.core-prices", "unsupported");
    }

    const results = await Promise.all(
      assets.map((asset) => this.readQuote(asset)),
    );
    const capability = quoteCapability(assets);
    const failed = results.find((result) => !isAvailable(result));
    if (failed) {
      return { ...failed, capability };
    }

    const available = results as readonly AvailableMarketDatum<PriceQuote>[];
    const scope = {
      kind: "asset" as const,
      label: `Alternative.me 覆盖交易所聚合的 ${assets
        .map((asset) => `${ASSET_METADATA[asset].symbol}/USD`)
        .join(" 与 ")} 现货报价`,
    };
    const coherenceError = incoherentQuoteBatchDatum(
      capability,
      this.source,
      scope,
      available,
    );
    if (coherenceError !== null) {
      return coherenceError;
    }

    const stale = available.some((datum) => datum.stale);
    return {
      status: stale ? "stale" : "fresh",
      capability,
      value: available.map((datum) => datum.value),
      source: alternativeMeMarketSource,
      scope,
      updatedAt: oldestTimestamp(
        available.map((datum) => datum.updatedAt),
      ),
      retrievedAt: newestTimestamp(
        available.map((datum) => datum.retrievedAt),
      ),
      loading: false,
      stale,
      provenance: "live",
      cache: {
        status: available.every((datum) => datum.cache.status === "hit")
          ? "hit"
          : "miss",
        revalidateSeconds: Math.min(
          ...available.map((datum) => datum.cache.revalidateSeconds),
        ),
        staleIfErrorSeconds: Math.min(
          ...available.map((datum) => datum.cache.staleIfErrorSeconds),
        ),
      },
      error: available.find((datum) => datum.error)?.error ?? null,
    };
  }

  private readQuote(asset: Asset): Promise<MarketDatum<PriceQuote>> {
    const capability = quoteCapability([asset]);
    const metadata = ASSET_METADATA[asset];
    const scope = {
      kind: "asset" as const,
      label: `Alternative.me 覆盖交易所聚合的 ${metadata.symbol}/USD 现货报价`,
    };

    return this.cache.read({
      key: `alternative-me:quote:${asset}:usd:v1`,
      capability,
      source: alternativeMeMarketSource,
      scope,
      policy: cachePolicies.alternativeQuote,
      load: async () => {
        const payload = await this.http.get(
          `${BASE_URL}/v2/ticker/${metadata.slug}/?structure=array`,
        );
        const parsed = parseQuotePayload(payload, asset, this.now());
        return {
          capability,
          value: parsed.value,
          source: alternativeMeMarketSource,
          scope,
          updatedAt: parsed.updatedAt,
          provenance: "live" as const,
        };
      },
    });
  }

  async getGlobalMarket(): Promise<MarketDatum<GlobalMarket>> {
    const capability = "spot.market-cap" as const;
    const scope = {
      kind: "global" as const,
      label: "Alternative.me 覆盖资产与交易所的加密市场总览",
    };

    return this.cache.read({
      key: "alternative-me:global:usd:v1",
      capability,
      source: alternativeMeMarketSource,
      scope,
      policy: cachePolicies.alternativeGlobal,
      load: async () => {
        const payload = await this.http.get(`${BASE_URL}/v2/global/`);
        const parsed = parseGlobalMarket(payload, this.now());
        return {
          capability,
          value: parsed.value,
          source: alternativeMeMarketSource,
          scope,
          updatedAt: parsed.updatedAt,
          provenance: "live" as const,
        };
      },
    });
  }

  async getFearAndGreed(): Promise<MarketDatum<SentimentReading>> {
    const capability = "sentiment.fear-and-greed" as const;
    const scope = {
      kind: "asset" as const,
      label: "Alternative.me Bitcoin Fear & Greed Index",
    };

    return this.cache.read({
      key: "alternative-me:fear-and-greed:latest:v1",
      capability,
      source: alternativeMeFearAndGreedSource,
      scope,
      policy: cachePolicies.alternativeSentiment,
      load: async () => {
        const payload = await this.http.get(
          `${BASE_URL}/fng/?limit=1&format=json`,
        );
        const parsed = parseFearAndGreed(payload, this.now());
        return {
          capability,
          value: parsed.value,
          source: alternativeMeFearAndGreedSource,
          scope,
          updatedAt: parsed.updatedAt,
          provenance: "live" as const,
        };
      },
    });
  }
}

function assertAlternativeSuccess(payload: unknown): Record<string, unknown> {
  const root = record(payload);
  const metadata = record(root.metadata);
  if (!("error" in metadata)) {
    throw new ProviderError("invalid_payload", false);
  }
  if (metadata.error !== null) {
    throw new ProviderError("upstream_error", false);
  }
  return root;
}

function validateMetadataTimestamp(
  root: Record<string, unknown>,
  nowMs: number,
): void {
  const metadata = record(root.metadata);
  unixSecondsToIso(metadata.timestamp, nowMs);
}

function parseQuotePayload(
  payload: unknown,
  asset: Asset,
  nowMs: number,
): { value: PriceQuote; updatedAt: string } {
  const root = assertAlternativeSuccess(payload);
  validateMetadataTimestamp(root, nowMs);
  const entries = array(root.data);
  if (entries.length !== 1) {
    throw new ProviderError("invalid_payload", false);
  }

  const entry = record(entries[0]);
  const expected = ASSET_METADATA[asset];
  const id = finiteNumber(entry.id);
  if (
    !Number.isInteger(id) ||
    id !== expected.id ||
    nonEmptyString(entry.name) !== expected.name ||
    nonEmptyString(entry.symbol) !== expected.symbol ||
    nonEmptyString(entry.website_slug) !== expected.slug
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  const usdQuote = record(record(entry.quotes).USD);
  return {
    value: {
      asset,
      quoteCurrency: "USD",
      priceUsd: positiveNumber(usdQuote.price),
      change24hPercent: finiteNumber(usdQuote.percentage_change_24h),
      change7dPercent: finiteNumber(usdQuote.percentage_change_7d),
      marketCapUsd: positiveNumber(usdQuote.market_cap),
    },
    updatedAt: unixSecondsToIso(entry.last_updated, nowMs),
  };
}

function parseGlobalMarket(
  payload: unknown,
  nowMs: number,
): { value: GlobalMarket; updatedAt: string } {
  const root = assertAlternativeSuccess(payload);
  validateMetadataTimestamp(root, nowMs);
  const data = record(root.data);
  const usdQuote = record(record(data.quotes).USD);

  return {
    value: {
      totalMarketCapUsd: positiveNumber(usdQuote.total_market_cap),
      btcDominancePercent: normalizeBtcDominance(
        data.bitcoin_percentage_of_market_cap,
      ),
    },
    updatedAt: unixSecondsToIso(data.last_updated, nowMs),
  };
}

function parseFearAndGreed(
  payload: unknown,
  nowMs: number,
): { value: SentimentReading; updatedAt: string } {
  const root = assertAlternativeSuccess(payload);
  if (nonEmptyString(root.name) !== "Fear and Greed Index") {
    throw new ProviderError("invalid_payload", false);
  }
  const entries = array(root.data);
  if (entries.length !== 1) {
    throw new ProviderError("invalid_payload", false);
  }

  const entry = record(entries[0]);
  const classification = nonEmptyString(entry.value_classification);
  if (!SENTIMENT_CLASSIFICATIONS.has(classification)) {
    throw new ProviderError("invalid_payload", false);
  }
  const secondsUntilUpdate = nonNegativeNumber(entry.time_until_update);
  if (!Number.isInteger(secondsUntilUpdate)) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    value: {
      value: numberInRange(entry.value, 0, 100),
      classification,
    },
    updatedAt: unixSecondsToIso(entry.timestamp, nowMs),
  };
}

/**
 * Alternative.me documents a percentage (0–100), while its current live v2
 * payload returns a ratio (0–1). Both documented and live shapes are accepted;
 * anything outside those two bounded representations is rejected.
 */
function normalizeBtcDominance(value: unknown): number {
  const normalized = finiteNumber(value);
  if (normalized >= 0 && normalized <= 1) {
    return normalized * 100;
  }
  if (normalized > 1 && normalized <= 100) {
    return normalized;
  }
  throw new ProviderError("invalid_payload", false);
}

function oldestTimestamp(timestamps: readonly string[]): string {
  return timestamps.reduce((oldest, current) =>
    Date.parse(current) < Date.parse(oldest) ? current : oldest,
  );
}

function newestTimestamp(timestamps: readonly string[]): string {
  return timestamps.reduce((newest, current) =>
    Date.parse(current) > Date.parse(newest) ? current : newest,
  );
}

function quoteCapability(assets: readonly Asset[]): MarketCapability {
  return assets.length === 1
    ? `spot.${assets[0]}-price`
    : "spot.core-prices";
}

function isAvailable<T>(
  datum: MarketDatum<T>,
): datum is AvailableMarketDatum<T> {
  return datum.status === "fresh" || datum.status === "stale";
}
