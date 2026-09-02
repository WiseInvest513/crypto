import "server-only";

import type {
  Asset,
  AvailableMarketDatum,
  DataScope,
  DataSource,
  ErrorMarketDatum,
  EthBtcReading,
  GlobalMarket,
  MarketCapability,
  MarketDatum,
  PriceQuote,
} from "../contracts/market-data";
import { toDataError } from "../errors/provider-error";

export type SettledMarketDatum<T> = PromiseSettledResult<MarketDatum<T>>;

const derivedSource: DataSource = {
  id: "wise-crypto-derived",
  label: "Wise Crypto 派生指标",
  url: "https://crypto.wise-invest.org",
};

export function recoverSettled<T>(
  result: SettledMarketDatum<T>,
  capability: MarketCapability,
  source: DataSource | null,
  scope: DataScope,
  now: () => number,
): MarketDatum<T> {
  if (result.status === "fulfilled") {
    return remapCapability(result.value, capability);
  }

  return createErrorDatum(capability, source, scope, result.reason, now);
}

export function selectQuote(
  datum: MarketDatum<readonly PriceQuote[]>,
  asset: Asset,
  now: () => number,
): MarketDatum<PriceQuote> {
  const capability = `spot.${asset}-price` as MarketCapability;
  if (!isAvailableMarketDatum(datum)) {
    return remapCapability(datum, capability);
  }

  const quote = datum.value.find((candidate) => candidate.asset === asset);
  if (!quote) {
    return createErrorDatum(
      capability,
      datum.source,
      datum.scope,
      new Error("Validated quote batch did not contain the requested asset."),
      now,
      "invalid_payload",
      false,
    );
  }

  return { ...datum, capability, value: quote };
}

export function selectGlobal<T>(
  datum: MarketDatum<GlobalMarket>,
  capability: MarketCapability,
  select: (value: GlobalMarket) => T,
): MarketDatum<T> {
  if (!isAvailableMarketDatum(datum)) {
    return remapCapability(datum, capability);
  }
  return { ...datum, capability, value: select(datum.value) };
}

export function deriveEthBtc(
  btc: MarketDatum<PriceQuote>,
  eth: MarketDatum<PriceQuote>,
  now: () => number,
): MarketDatum<EthBtcReading> {
  const capability = "spot.eth-btc" as const;
  if (!isAvailableMarketDatum(btc)) {
    return remapCapability(btc, capability);
  }
  if (!isAvailableMarketDatum(eth)) {
    return remapCapability(eth, capability);
  }

  const source = withSourceComponents(derivedSource, [btc.source, eth.source]);
  const ratio = eth.value.priceUsd / btc.value.priceUsd;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return createErrorDatum(
      capability,
      source,
      { kind: "derived", label: "ETH/USD ÷ BTC/USD" },
      new Error("Invalid derived ETH/BTC ratio."),
      now,
      "invalid_payload",
      false,
    );
  }

  const stale = btc.stale || eth.stale;
  return {
    status: stale ? "stale" : "fresh",
    capability,
    value: { ethBtcRatio: ratio },
    source,
    scope: { kind: "derived", label: "ETH/USD ÷ BTC/USD" },
    updatedAt: olderOf(btc.updatedAt, eth.updatedAt),
    retrievedAt: new Date(now()).toISOString(),
    loading: false,
    stale,
    provenance:
      btc.provenance === "synthetic" || eth.provenance === "synthetic"
        ? "synthetic"
        : "derived",
    cache: {
      status:
        btc.cache.status === "hit" && eth.cache.status === "hit"
          ? "hit"
          : "miss",
      revalidateSeconds: Math.min(
        btc.cache.revalidateSeconds,
        eth.cache.revalidateSeconds,
      ),
      staleIfErrorSeconds: Math.min(
        btc.cache.staleIfErrorSeconds,
        eth.cache.staleIfErrorSeconds,
      ),
    },
    error: btc.error ?? eth.error,
    ...(btc.fallback
      ? { fallback: btc.fallback }
      : eth.fallback
        ? { fallback: eth.fallback }
        : {}),
  };
}

export function remapCapability<T>(
  datum: MarketDatum<T>,
  capability: MarketCapability,
): MarketDatum<T> {
  return { ...datum, capability };
}

export function createErrorDatum(
  capability: MarketCapability,
  source: DataSource | null,
  scope: DataScope,
  error: unknown,
  now: () => number,
  forcedCode?: ErrorMarketDatum["error"]["code"],
  forcedRetryable?: boolean,
): ErrorMarketDatum {
  const normalized = toDataError(error);
  return {
    status: "error",
    capability,
    value: null,
    source,
    scope,
    updatedAt: null,
    retrievedAt: new Date(now()).toISOString(),
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: {
      code: forcedCode ?? normalized.code,
      retryable: forcedRetryable ?? normalized.retryable,
    },
  };
}

export function isAvailableMarketDatum<T>(
  datum: MarketDatum<T>,
): datum is AvailableMarketDatum<T> {
  return datum.status === "fresh" || datum.status === "stale";
}

function withSourceComponents(
  source: DataSource,
  components: readonly DataSource[],
): DataSource {
  const uniqueComponents = Array.from(
    new Map(
      components.map((component) => [component.id, component] as const),
    ).values(),
  );

  return { ...source, components: uniqueComponents };
}

function olderOf(first: string, second: string): string {
  return Date.parse(first) <= Date.parse(second) ? first : second;
}
