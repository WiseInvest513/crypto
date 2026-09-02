import "server-only";

import { cachePolicies } from "../cache/policies";
import { ResilientMarketCache } from "../cache/resilient-market-cache";
import type {
  Asset,
  AvailableMarketDatum,
  GlobalMarket,
  LiquidationsReading,
  MarketCapability,
  MarketDatum,
  PriceQuote,
  SentimentReading,
} from "../contracts/market-data";
import { unavailableDatum } from "../contracts/market-data";
import type {
  LiquidationsProvider,
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
  isoTimestamp,
  nonEmptyString,
  nonNegativeNumber,
  numberInRange,
  optionalFiniteNumber,
  positiveNumber,
  record,
} from "../validation/upstream";
import { incoherentQuoteBatchDatum } from "./quote-coherence";
import { coinMarketCapSource } from "./sources";

const PUBLIC_BASE_URL = "https://pro-api.coinmarketcap.com/public-api";
const PRO_BASE_URL = "https://pro-api.coinmarketcap.com";
const CORE_ASSETS = ["btc", "eth"] as const satisfies readonly Asset[];
const CMC_IDS: Record<Asset, number> = { btc: 1, eth: 1027 };
const CMC_SYMBOLS: Record<Asset, string> = { btc: "BTC", eth: "ETH" };

type CoinMarketCapProviderOptions = {
  apiKey?: string | null;
  cache?: ResilientMarketCache;
  http?: JsonHttpClient;
  now?: () => number;
};

export class CoinMarketCapProvider
  implements SpotMarketProvider, SentimentProvider, LiquidationsProvider
{
  readonly id = "coinmarketcap";
  readonly mode = "live" as const;
  readonly source = coinMarketCapSource;

  readonly #apiKey: string | null;
  #quoteBatchInFlight: Promise<unknown> | null = null;
  private readonly cache: ResilientMarketCache;
  private readonly http: JsonHttpClient;
  private readonly now: () => number;

  constructor({
    apiKey = null,
    cache = new ResilientMarketCache(),
    http = new FetchJsonClient(),
    now = Date.now,
  }: CoinMarketCapProviderOptions = {}) {
    this.#apiKey = apiKey?.trim() || null;
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
      label: `CoinMarketCap aggregated ${assets
        .map((asset) => `${CMC_SYMBOLS[asset]}/USD`)
        .join(" and ")} spot quote${assets.length === 1 ? "" : "s"}`,
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
      source: this.source,
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
    const scope = {
      kind: "asset" as const,
      label: `CoinMarketCap aggregated ${CMC_SYMBOLS[asset]}/USD spot quote`,
    };

    return this.cache.read({
      key: `cmc:quote:${asset}:usd:v1`,
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.quote,
      load: async () => {
        const payload = await this.requestQuoteBatch();
        const parsed = parseQuotePayload(payload, asset, this.now());
        return {
          capability,
          value: parsed.value,
          source: this.source,
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
      label: "CoinMarketCap global cryptocurrency market",
    };

    return this.cache.read({
      key: "cmc:global:usd",
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.global,
      load: async () => {
        const payload = await this.requestCmc(
          "/v1/global-metrics/quotes/latest?convert=USD",
        );
        const parsed = parseGlobalMarket(payload, this.now());
        return {
          capability,
          value: parsed.value,
          source: this.source,
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
      kind: "global" as const,
      label: "CoinMarketCap Crypto Fear and Greed Index",
    };

    return this.cache.read({
      key: "cmc:fear-and-greed:latest",
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.sentiment,
      load: async () => {
        const payload = await this.requestCmc(
          "/v3/fear-and-greed/latest",
        );
        const parsed = parseFearAndGreed(payload, this.now());
        return {
          capability,
          value: parsed.value,
          source: this.source,
          scope,
          updatedAt: parsed.updatedAt,
          provenance: "live" as const,
        };
      },
    });
  }

  async getLiquidations(): Promise<MarketDatum<LiquidationsReading>> {
    const apiKey = this.#apiKey;
    if (!apiKey) {
      return unavailableDatum(
        "derivatives.total-liquidations",
        "not_configured",
      );
    }

    const capability = "derivatives.total-liquidations" as const;
    const scope = {
      kind: "global" as const,
      label: "CoinMarketCap tracked derivatives exchanges, rolling 24h",
    };

    return this.cache.read({
      key: "cmc:liquidations:global:24h:usd",
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.liquidations,
      load: async () => {
        const payload = await this.requestCmc(
          "/v5/derivatives/liquidations/quotes/latest?convert=USD",
        );
        const parsed = parseLiquidations(payload, this.now());
        return {
          capability,
          value: parsed.value,
          source: this.source,
          scope,
          updatedAt: parsed.updatedAt,
          provenance: "live" as const,
        };
      },
    });
  }

  private async requestQuoteBatch(): Promise<unknown> {
    if (this.#quoteBatchInFlight) {
      return this.#quoteBatchInFlight;
    }

    const ids = CORE_ASSETS.map((asset) => CMC_IDS[asset]).join(",");
    const pending = this.requestCmc(
      `/v3/cryptocurrency/quotes/latest?id=${ids}&convert=USD`,
    );
    this.#quoteBatchInFlight = pending;
    try {
      return await pending;
    } finally {
      if (this.#quoteBatchInFlight === pending) {
        this.#quoteBatchInFlight = null;
      }
    }
  }

  private requestCmc(path: string): Promise<unknown> {
    if (this.#apiKey) {
      return this.http.get(`${PRO_BASE_URL}${path}`, {
        headers: { "X-CMC_PRO_API_KEY": this.#apiKey },
      });
    }
    return this.http.get(`${PUBLIC_BASE_URL}${path}`);
  }
}

function assertCmcSuccess(payload: unknown): Record<string, unknown> {
  const root = record(payload);
  const status = record(root.status);
  const errorCode = finiteNumber(status.error_code);
  if (!Number.isInteger(errorCode)) {
    throw new ProviderError("invalid_payload", false);
  }
  if (errorCode !== 0) {
    throw new ProviderError("upstream_error", false);
  }
  return root;
}

function parseQuotePayload(
  payload: unknown,
  asset: Asset,
  nowMs: number,
): { value: PriceQuote; updatedAt: string } {
  const root = assertCmcSuccess(payload);
  const entries = array(root.data).map(record);
  const id = CMC_IDS[asset];
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry || nonEmptyString(entry.symbol) !== CMC_SYMBOLS[asset]) {
    throw new ProviderError("invalid_payload", false);
  }

  const usdQuote = array(entry.quote)
    .map(record)
    .find((candidate) => nonEmptyString(candidate.symbol) === "USD");
  if (!usdQuote) {
    throw new ProviderError("invalid_payload", false);
  }

  const marketCap = optionalFiniteNumber(usdQuote.market_cap);
  if (marketCap !== null && marketCap < 0) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    value: {
      asset,
      quoteCurrency: "USD",
      priceUsd: positiveNumber(usdQuote.price),
      change24hPercent: optionalFiniteNumber(usdQuote.percent_change_24h),
      change7dPercent: optionalFiniteNumber(usdQuote.percent_change_7d),
      marketCapUsd: marketCap,
    },
    updatedAt: isoTimestamp(usdQuote.last_updated, nowMs),
  };
}

function parseGlobalMarket(
  payload: unknown,
  nowMs: number,
): { value: GlobalMarket; updatedAt: string } {
  const root = assertCmcSuccess(payload);
  const data = record(root.data);
  const usdQuote = record(record(data.quote).USD);
  return {
    value: {
      totalMarketCapUsd: positiveNumber(usdQuote.total_market_cap),
      btcDominancePercent: numberInRange(data.btc_dominance, 0, 100),
    },
    updatedAt: oldestTimestamp([
      isoTimestamp(data.last_updated, nowMs),
      isoTimestamp(usdQuote.last_updated, nowMs),
    ]),
  };
}

function parseFearAndGreed(
  payload: unknown,
  nowMs: number,
): { value: SentimentReading; updatedAt: string } {
  const root = assertCmcSuccess(payload);
  const data = record(root.data);
  return {
    value: {
      value: numberInRange(data.value, 0, 100),
      classification: nonEmptyString(data.value_classification),
    },
    updatedAt: isoTimestamp(data.update_time, nowMs),
  };
}

function parseLiquidations(
  payload: unknown,
  nowMs: number,
): { value: LiquidationsReading; updatedAt: string } {
  const root = assertCmcSuccess(payload);
  const quotes = array(record(root.data).quotes).map(record);
  const usdQuote = quotes.find(
    (candidate) => nonEmptyString(candidate.symbol) === "USD",
  );
  if (!usdQuote) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    value: {
      asset: "all",
      totalUsd: nonNegativeNumber(usdQuote.total_liquidations_24h),
      longUsd: nonNegativeNumber(usdQuote.long_liquidations_24h),
      shortUsd: nonNegativeNumber(usdQuote.short_liquidations_24h),
      window: "24h",
    },
    updatedAt: isoTimestamp(usdQuote.last_updated, nowMs),
  };
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
