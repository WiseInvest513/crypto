import { describe, expect, it, vi } from "vitest";
import type {
  AvailableMarketDatum,
  DataSource,
  ErrorMarketDatum,
  GlobalMarket,
  MarketDatum,
  PriceQuote,
  SentimentReading,
} from "../../src/server/data/contracts/market-data";
import { unavailableDatum } from "../../src/server/data/contracts/market-data";
import type {
  SentimentProvider,
  SpotMarketProvider,
} from "../../src/server/data/contracts/providers";
import { FallbackMarketProvider } from "../../src/server/data/providers/fallback-market-provider";

const NOW = Date.parse("2026-08-31T18:00:00.000Z");
const UPDATED_AT = "2026-08-31T17:59:00.000Z";

const primarySource: DataSource = {
  id: "primary",
  label: "Primary",
  url: "https://primary.example",
};
const secondarySource: DataSource = {
  id: "secondary",
  label: "Secondary",
  url: "https://secondary.example",
};

function availableGlobal(
  source: DataSource,
): AvailableMarketDatum<GlobalMarket> {
  return {
    status: "fresh",
    capability: "spot.market-cap",
    value: {
      totalMarketCapUsd: 3_000_000_000_000,
      btcDominancePercent: 58,
    },
    source,
    scope: { kind: "global", label: `${source.label} market` },
    updatedAt: UPDATED_AT,
    retrievedAt: UPDATED_AT,
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 600,
      staleIfErrorSeconds: 3_600,
    },
    error: null,
  };
}

function staleGlobal(
  source: DataSource,
): AvailableMarketDatum<GlobalMarket> {
  return {
    ...availableGlobal(source),
    status: "stale",
    stale: true,
    error: { code: "timeout", retryable: true },
  };
}

function errorGlobal(source: DataSource): ErrorMarketDatum {
  return {
    status: "error",
    capability: "spot.market-cap",
    value: null,
    source,
    scope: { kind: "global", label: `${source.label} market` },
    updatedAt: null,
    retrievedAt: UPDATED_AT,
    loading: false,
    stale: false,
    cache: {
      status: "miss",
      revalidateSeconds: 600,
      staleIfErrorSeconds: 3_600,
    },
    error: { code: "timeout", retryable: true },
  };
}

class StubPublicMarketProvider
  implements SpotMarketProvider, SentimentProvider
{
  readonly mode = "live" as const;
  readonly getGlobalMarket: () => Promise<MarketDatum<GlobalMarket>>;
  readonly getFearAndGreed: () => Promise<MarketDatum<SentimentReading>>;

  constructor(
    readonly id: string,
    readonly source: DataSource,
    globalResult: MarketDatum<GlobalMarket>,
    sentimentResult: MarketDatum<SentimentReading> = unavailableDatum(
      "sentiment.fear-and-greed",
      "unsupported",
    ),
  ) {
    this.getGlobalMarket = vi.fn(async () => globalResult);
    this.getFearAndGreed = vi.fn(async () => sentimentResult);
  }

  async getQuotes(): Promise<MarketDatum<readonly PriceQuote[]>> {
    return unavailableDatum("spot.core-prices", "unsupported");
  }

}

function staleSentiment(source: DataSource): AvailableMarketDatum<SentimentReading> {
  return {
    status: "stale",
    capability: "sentiment.fear-and-greed",
    value: { value: 42, classification: "Fear" },
    source,
    scope: { kind: "global", label: `${source.label} sentiment index` },
    updatedAt: UPDATED_AT,
    retrievedAt: UPDATED_AT,
    loading: false,
    stale: true,
    provenance: "live",
    cache: {
      status: "hit",
      revalidateSeconds: 600,
      staleIfErrorSeconds: 3_600,
    },
    error: { code: "timeout", retryable: true },
  };
}

function freshSentiment(source: DataSource): AvailableMarketDatum<SentimentReading> {
  return {
    ...staleSentiment(source),
    status: "fresh",
    stale: false,
    error: null,
  };
}

describe("fallback market provider", () => {
  it("returns a healthy primary result without calling the secondary", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      availableGlobal(primarySource),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      availableGlobal(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getGlobalMarket();

    expect(result).toMatchObject({
      status: "fresh",
      source: { id: "primary" },
    });
    expect(secondary.getGlobalMarket).not.toHaveBeenCalled();
  });

  it("preserves the actual secondary source and discloses the primary error", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      errorGlobal(primarySource),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      availableGlobal(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getGlobalMarket();

    expect(result).toMatchObject({
      status: "fresh",
      source: { id: "secondary" },
      fallback: {
        primarySource: { id: "primary" },
        primaryStatus: "error",
        primaryError: { code: "timeout", retryable: true },
        primaryReason: null,
      },
    });
  });

  it("prefers a fresh secondary over stale primary data and discloses the switch", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      staleGlobal(primarySource),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      availableGlobal(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getGlobalMarket();

    expect(result).toMatchObject({
      status: "fresh",
      source: { id: "secondary" },
      fallback: {
        primarySource: { id: "primary" },
        primaryStatus: "stale",
        primaryError: { code: "timeout", retryable: true },
        primaryReason: null,
      },
    });
  });

  it("retains stale primary data when the secondary is not fresh", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      staleGlobal(primarySource),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      errorGlobal(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getGlobalMarket();

    expect(result).toMatchObject({
      status: "stale",
      source: { id: "primary" },
    });
  });

  it("does not replace a stale sentiment series with a different provider index", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      availableGlobal(primarySource),
      staleSentiment(primarySource),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      availableGlobal(secondarySource),
      freshSentiment(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getFearAndGreed();

    expect(result).toMatchObject({
      status: "stale",
      source: { id: "primary" },
    });
    expect(secondary.getFearAndGreed).not.toHaveBeenCalled();
  });

  it("discloses why an unavailable primary was bypassed", async () => {
    const primary = new StubPublicMarketProvider(
      "primary",
      primarySource,
      unavailableDatum("spot.market-cap", "not_configured"),
    );
    const secondary = new StubPublicMarketProvider(
      "secondary",
      secondarySource,
      availableGlobal(secondarySource),
    );
    const provider = new FallbackMarketProvider(primary, secondary, () => NOW);

    const result = await provider.getGlobalMarket();

    expect(result).toMatchObject({
      status: "fresh",
      source: { id: "secondary" },
      fallback: {
        primarySource: { id: "primary" },
        primaryStatus: "unavailable",
        primaryError: null,
        primaryReason: "not_configured",
      },
    });
  });
});
