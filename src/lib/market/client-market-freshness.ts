import type { MarketDatum } from "@/server/data/contracts/market-data";

export const CLIENT_MARKET_LAST_GOOD_MILLISECONDS = 300_000;

export type ClientDatumFreshness<T> = Readonly<{
  datum: MarketDatum<T>;
  expired: boolean;
}>;

function isAvailable<T>(
  datum: MarketDatum<T>,
): datum is Extract<MarketDatum<T>, { status: "fresh" | "stale" }> {
  return datum.status === "fresh" || datum.status === "stale";
}

/**
 * The browser may retain a last-known-good response while the API is offline.
 * Its absolute lifetime is anchored to the server retrieval time, never to a
 * later client response or retry, so repeated failures cannot extend it.
 */
export function clientMarketDatumExpiresAt<T>(
  datum: MarketDatum<T>,
  maximumAgeMilliseconds = CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
): number | null {
  if (!isAvailable(datum)) return null;
  const retrievedAt = Date.parse(datum.retrievedAt);
  if (!Number.isFinite(retrievedAt)) return Number.NEGATIVE_INFINITY;
  return retrievedAt + maximumAgeMilliseconds;
}

export function expireClientMarketDatum<T>(
  datum: MarketDatum<T>,
  now: number,
  maximumAgeMilliseconds = CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
): ClientDatumFreshness<T> {
  const expiresAt = clientMarketDatumExpiresAt(
    datum,
    maximumAgeMilliseconds,
  );
  const retrievedAt = isAvailable(datum)
    ? Date.parse(datum.retrievedAt)
    : null;
  const invalidTimestamp =
    retrievedAt !== null &&
    (!Number.isFinite(retrievedAt) || retrievedAt > now);
  const expired =
    expiresAt !== null && (invalidTimestamp || now > expiresAt);
  if (!expired || !isAvailable(datum)) return { datum, expired };

  return {
    expired: true,
    datum: {
      status: "unavailable",
      capability: datum.capability,
      value: null,
      source: datum.source,
      scope: datum.scope,
      updatedAt: null,
      retrievedAt: datum.retrievedAt,
      loading: false,
      stale: false,
      cache: datum.cache,
      error: null,
      reason: "no_data",
    },
  };
}

export function earliestClientMarketExpiryAt(
  data: readonly MarketDatum<unknown>[],
  after?: number,
): number | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const datum of data) {
    const expiresAt = clientMarketDatumExpiresAt(datum);
    if (
      expiresAt !== null &&
      (after === undefined || expiresAt > after)
    ) {
      earliest = Math.min(earliest, expiresAt);
    }
  }
  return earliest === Number.POSITIVE_INFINITY ? null : earliest;
}
