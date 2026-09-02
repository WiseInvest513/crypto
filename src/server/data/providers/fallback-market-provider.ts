import "server-only";

import type {
  Asset,
  DataScope,
  DataSource,
  FallbackMetadata,
  GlobalMarket,
  MarketCapability,
  MarketDatum,
  PriceQuote,
  SentimentReading,
} from "../contracts/market-data";
import type {
  SentimentProvider,
  SpotMarketProvider,
} from "../contracts/providers";
import { toDataError } from "../errors/provider-error";

type PublicMarketProvider = SpotMarketProvider & SentimentProvider;

export class FallbackMarketProvider implements PublicMarketProvider {
  readonly id: string;
  readonly mode = "live" as const;
  readonly source = null;

  constructor(
    private readonly primary: PublicMarketProvider,
    private readonly secondary: PublicMarketProvider,
    private readonly now: () => number = Date.now,
  ) {
    this.id = `fallback:${primary.id}->${secondary.id}`;
  }

  getQuotes(
    assets: readonly Asset[],
  ): Promise<MarketDatum<readonly PriceQuote[]>> {
    const symbols = assets.map((asset) => asset.toUpperCase()).join("/");
    return this.readWithFallback(
      assets.length === 1
        ? (`spot.${assets[0]}-price` as MarketCapability)
        : "spot.core-prices",
      { kind: "asset", label: `${symbols || "BTC/ETH"}/USD` },
      () => this.primary.getQuotes(assets),
      () => this.secondary.getQuotes(assets),
      true,
    );
  }

  getGlobalMarket(): Promise<MarketDatum<GlobalMarket>> {
    return this.readWithFallback(
      "spot.market-cap",
      { kind: "global", label: "Global cryptocurrency market" },
      () => this.primary.getGlobalMarket(),
      () => this.secondary.getGlobalMarket(),
      true,
    );
  }

  getFearAndGreed(): Promise<MarketDatum<SentimentReading>> {
    return this.readWithFallback(
      "sentiment.fear-and-greed",
      { kind: "global", label: "Crypto Fear and Greed Index" },
      () => this.primary.getFearAndGreed(),
      () => this.secondary.getFearAndGreed(),
      false,
    );
  }

  private async readWithFallback<T>(
    capability: MarketCapability,
    defaultScope: DataScope,
    readPrimary: () => Promise<MarketDatum<T>>,
    readSecondary: () => Promise<MarketDatum<T>>,
    replaceStaleWithFreshSecondary: boolean,
  ): Promise<MarketDatum<T>> {
    const primary = await this.safeRead(
      this.primary,
      capability,
      defaultScope,
      readPrimary,
    );
    if (primary.status === "fresh") {
      return primary;
    }

    // Sentiment providers publish distinct indices. A stale reading remains
    // the same series; replacing it with another provider would silently
    // change methodology. Comparable spot/global capabilities may fail over.
    if (primary.status === "stale" && !replaceStaleWithFreshSecondary) {
      return primary;
    }

    const secondary = await this.safeRead(
      this.secondary,
      capability,
      defaultScope,
      readSecondary,
    );
    if (secondary.status === "fresh") {
      return {
        ...secondary,
        fallback: fallbackMetadata(primary, this.primary.source),
      };
    }

    // A stale primary is still preferable to another stale value or a total
    // outage. We only switch away from it when the secondary is fresh.
    if (primary.status === "stale") {
      return primary;
    }

    if (secondary.status === "stale") {
      return {
        ...secondary,
        fallback: fallbackMetadata(primary, this.primary.source),
      };
    }

    if (primary.status === "unavailable" && secondary.status === "error") {
      return secondary;
    }
    return primary;
  }

  private async safeRead<T>(
    provider: PublicMarketProvider,
    capability: MarketCapability,
    defaultScope: DataScope,
    read: () => Promise<MarketDatum<T>>,
  ): Promise<MarketDatum<T>> {
    try {
      return await read();
    } catch (error) {
      const dataError = toDataError(error);
      return {
        status: "error",
        capability,
        value: null,
        source: provider.source,
        scope: defaultScope,
        updatedAt: null,
        retrievedAt: new Date(this.now()).toISOString(),
        loading: false,
        stale: false,
        cache: {
          status: "bypass",
          revalidateSeconds: 0,
          staleIfErrorSeconds: 0,
        },
        error: dataError,
      };
    }
  }
}

function fallbackMetadata<T>(
  datum: MarketDatum<T>,
  providerSource: DataSource | null,
): FallbackMetadata {
  if (datum.status === "error") {
    return {
      primarySource: datum.source ?? providerSource,
      primaryStatus: "error",
      primaryError: datum.error,
      primaryReason: null,
    };
  }
  if (datum.status === "unavailable") {
    return {
      primarySource: providerSource,
      primaryStatus: "unavailable",
      primaryError: null,
      primaryReason: datum.reason,
    };
  }
  if (datum.status === "stale") {
    return {
      primarySource: datum.source,
      primaryStatus: "stale",
      primaryError: datum.error,
      primaryReason: null,
    };
  }
  throw new Error("Fallback metadata requires a non-fresh primary datum.");
}
