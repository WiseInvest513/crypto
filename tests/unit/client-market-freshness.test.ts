import { describe, expect, it } from "vitest";
import {
  CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
  clientMarketDatumExpiresAt,
  earliestClientMarketExpiryAt,
  expireClientMarketDatum,
} from "@/lib/market/client-market-freshness";
import {
  unavailableDatum,
  type AvailableMarketDatum,
} from "@/server/data/contracts/market-data";

const retrievedAt = "2026-09-05T00:00:00.000Z";
const retrievedAtMilliseconds = Date.parse(retrievedAt);

function availableDatum(
  retrieved = retrievedAt,
): AvailableMarketDatum<number> {
  return {
    status: "fresh",
    capability: "spot.btc-price",
    value: 100,
    source: {
      id: "test-source",
      label: "Test source",
      url: "https://example.com",
    },
    scope: { kind: "asset", label: "BTC / USD" },
    updatedAt: retrieved,
    retrievedAt: retrieved,
    loading: false,
    stale: false,
    cache: {
      status: "hit",
      revalidateSeconds: 60,
      staleIfErrorSeconds: 300,
    },
    error: null,
    provenance: "live",
  };
}

describe("client market freshness", () => {
  it("uses an absolute 300 second lifetime anchored to retrievedAt", () => {
    const datum = availableDatum();
    const boundary = expireClientMarketDatum(
      datum,
      retrievedAtMilliseconds + CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
    );
    expect(boundary).toEqual({ datum, expired: false });

    const expired = expireClientMarketDatum(
      datum,
      retrievedAtMilliseconds + CLIENT_MARKET_LAST_GOOD_MILLISECONDS + 1,
    );
    expect(expired.expired).toBe(true);
    expect(expired.datum).toMatchObject({
      status: "unavailable",
      value: null,
      reason: "no_data",
      retrievedAt,
    });
    expect(datum.status).toBe("fresh");
  });

  it("fails closed for invalid or future server retrieval timestamps", () => {
    expect(
      expireClientMarketDatum(
        availableDatum("not-a-time"),
        retrievedAtMilliseconds,
      ).expired,
    ).toBe(true);
    expect(
      expireClientMarketDatum(
        availableDatum("2026-09-05T00:01:00.000Z"),
        retrievedAtMilliseconds,
      ).expired,
    ).toBe(true);
  });

  it("finds the earliest available deadline and ignores unavailable values", () => {
    const later = availableDatum("2026-09-05T00:01:00.000Z");
    const unavailable = unavailableDatum("spot.btc-price", "no_data");
    expect(clientMarketDatumExpiresAt(availableDatum())).toBe(
      retrievedAtMilliseconds + CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
    );
    expect(
      earliestClientMarketExpiryAt([unavailable, later, availableDatum()]),
    ).toBe(retrievedAtMilliseconds + CLIENT_MARKET_LAST_GOOD_MILLISECONDS);
    expect(
      earliestClientMarketExpiryAt(
        [unavailable, later, availableDatum()],
        retrievedAtMilliseconds + CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
      ),
    ).toBe(
      retrievedAtMilliseconds + 60_000 + CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
    );
  });
});
