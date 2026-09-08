import {
  KEY_LEVEL_ALGORITHM_VERSION,
  type KeyLevelAnalysis,
} from "./key-levels";
import {
  HISTORICAL_CONTEXT_ALGORITHM_VERSION,
  type HistoricalContextAnalysis,
} from "./historical-context";
import {
  assertMarketCycleAnalysis,
  assertLongTermHistoryAnalysis,
  type LongTermHistoryAnalysis,
  type MarketCycleAnalysis,
} from "./long-term-history";
import {
  MULTI_TIMEFRAME_ALGORITHM_VERSION,
  MULTI_TIMEFRAME_INTERVALS,
  type MultiTimeframeIntervalAnalysis,
} from "./multi-timeframe";
import type {
  Asset,
  ChartCandleInterval,
  MarketDatum,
} from "@/server/data/contracts/market-data";
import {
  earliestClientMarketExpiryAt,
  expireClientMarketDatum,
} from "./client-market-freshness";

/** Serializable public facts; no identity or editorial fields by design. */
export type PublicResearchSnapshot = Readonly<{
  asset: Asset;
  interval: ChartCandleInterval;
  levels: MarketDatum<KeyLevelAnalysis>;
  history: MarketDatum<HistoricalContextAnalysis>;
  longHistory: MarketDatum<LongTermHistoryAnalysis>;
  cycle: MarketDatum<MarketCycleAnalysis>;
  timeframes: readonly Readonly<{
    interval: ChartCandleInterval;
    datum: MarketDatum<MultiTimeframeIntervalAnalysis>;
  }>[];
}>;

export type CurrentPublicResearch = Readonly<{
  snapshot: PublicResearchSnapshot;
  levelsExpired: boolean;
  historyExpired: boolean;
  longHistoryExpired: boolean;
  cycleExpired: boolean;
  expiredIntervals: readonly ChartCandleInterval[];
}>;

/**
 * Treats the same-origin API as an untrusted JSON boundary. This intentionally
 * validates the public projection, not the large server-only archive artifact.
 */
export function parsePublicResearchSnapshot(
  value: unknown,
  expectedAsset: Asset,
  expectedInterval: ChartCandleInterval,
): PublicResearchSnapshot {
  if (!isRecord(value)) throw new TypeError("Invalid public research response.");
  assertExactKeys(value, [
    "asset",
    "cycle",
    "history",
    "interval",
    "levels",
    "longHistory",
    "timeframes",
  ]);
  if (
    value.asset !== expectedAsset ||
    value.interval !== expectedInterval ||
    !Array.isArray(value.timeframes) ||
    value.timeframes.length !== MULTI_TIMEFRAME_INTERVALS.length
  ) {
    throw new TypeError("Public research response scope mismatch.");
  }

  assertDatum(
    value.levels,
    `analysis.${expectedAsset}-key-levels`,
    (analysis) => assertScopedAnalysis(
      analysis,
      expectedAsset,
      expectedInterval,
      KEY_LEVEL_ALGORITHM_VERSION,
      "confirmedAt",
    ),
  );
  assertDatum(
    value.history,
    `analysis.${expectedAsset}-historical-context`,
    (analysis) => {
      assertScopedAnalysis(
        analysis,
        expectedAsset,
        expectedInterval,
        HISTORICAL_CONTEXT_ALGORITHM_VERSION,
        "latestClosedAt",
      );
      if (
        !isRecord(analysis.current) ||
        typeof analysis.current.fingerprint !== "string" ||
        analysis.current.fingerprint.length === 0 ||
        analysis.current.closedAt !== analysis.latestClosedAt
      ) {
        throw new TypeError("Invalid recent history analysis.");
      }
    },
  );
  assertDatum(
    value.longHistory,
    `analysis.${expectedAsset}-long-term-history`,
    (analysis) => assertLongTermHistoryAnalysis(analysis, {
      asset: expectedAsset,
      interval: expectedInterval === "15m" ? "1h" : expectedInterval,
    }),
    expectedInterval === "15m",
  );
  assertDatum(
    value.cycle,
    `analysis.${expectedAsset}-market-cycle`,
    (analysis) => assertMarketCycleAnalysis(analysis, expectedAsset),
  );

  value.timeframes.forEach((entry, index) => {
    if (!isRecord(entry)) throw new TypeError("Invalid timeframe entry.");
    assertExactKeys(entry, ["datum", "interval"]);
    const interval = MULTI_TIMEFRAME_INTERVALS[index];
    if (entry.interval !== interval) {
      throw new TypeError("Public research timeframes must be complete and ordered.");
    }
    assertDatum(
      entry.datum,
      `analysis.${expectedAsset}-multi-timeframe`,
      (analysis) => assertScopedAnalysis(
        analysis,
        expectedAsset,
        interval,
        MULTI_TIMEFRAME_ALGORITHM_VERSION,
        "latestClosedAt",
        false,
      ),
    );
  });

  return value as unknown as PublicResearchSnapshot;
}

/** Expires each independent research result without hiding still-current peers. */
export function expirePublicResearchSnapshot(
  snapshot: PublicResearchSnapshot,
  now: number,
): CurrentPublicResearch {
  const levels = expireClientMarketDatum(snapshot.levels, now);
  const history = expireClientMarketDatum(snapshot.history, now);
  const longHistory = expireClientMarketDatum(snapshot.longHistory, now);
  const cycle = expireClientMarketDatum(snapshot.cycle, now);
  const expiredIntervals: ChartCandleInterval[] = [];
  const timeframes = snapshot.timeframes.map((entry) => {
    const current = expireClientMarketDatum(entry.datum, now);
    if (current.expired) expiredIntervals.push(entry.interval);
    return current.datum === entry.datum
      ? entry
      : { ...entry, datum: current.datum };
  });
  const changed =
    levels.datum !== snapshot.levels ||
    history.datum !== snapshot.history ||
    longHistory.datum !== snapshot.longHistory ||
    cycle.datum !== snapshot.cycle ||
    timeframes.some((entry, index) => entry !== snapshot.timeframes[index]);

  return {
    snapshot: changed
      ? {
          ...snapshot,
          levels: levels.datum,
          history: history.datum,
          longHistory: longHistory.datum,
          cycle: cycle.datum,
          timeframes,
        }
      : snapshot,
    levelsExpired: levels.expired,
    historyExpired: history.expired,
    longHistoryExpired: longHistory.expired,
    cycleExpired: cycle.expired,
    expiredIntervals,
  };
}

export function publicResearchExpiresAt(
  snapshot: PublicResearchSnapshot,
  after?: number,
): number | null {
  return earliestClientMarketExpiryAt([
    snapshot.levels,
    snapshot.history,
    snapshot.longHistory,
    snapshot.cycle,
    ...snapshot.timeframes.map((entry) => entry.datum),
  ], after);
}

function assertDatum(
  value: unknown,
  capability: string,
  assertValue: (analysis: Record<string, unknown>) => void,
  requireUnavailable = false,
): void {
  if (!isRecord(value) || value.capability !== capability) {
    throw new TypeError("Invalid public research datum.");
  }
  if (
    !isRecord(value.cache) ||
    (value.cache.status !== "hit" &&
      value.cache.status !== "miss" &&
      value.cache.status !== "bypass") ||
    !isNonNegativeInteger(value.cache.revalidateSeconds) ||
    !isNonNegativeInteger(value.cache.staleIfErrorSeconds) ||
    value.loading !== false ||
    typeof value.stale !== "boolean"
  ) {
    throw new TypeError("Invalid public research datum metadata.");
  }

  if (requireUnavailable && value.status !== "unavailable") {
    throw new TypeError("This research interval must be unavailable.");
  }

  if (value.status === "fresh" || value.status === "stale") {
    if (
      !isRecord(value.value) ||
      !isSource(value.source) ||
      !isScope(value.scope) ||
      !isTimestamp(value.updatedAt) ||
      !isTimestamp(value.retrievedAt) ||
      (value.updatedAtKind !== undefined &&
        value.updatedAtKind !== "source" &&
        value.updatedAtKind !== "observed") ||
      (value.provenance !== "live" && value.provenance !== "derived") ||
      value.stale !== (value.status === "stale") ||
      !isNullableError(value.error)
    ) {
      throw new TypeError("Invalid available public research datum.");
    }
    assertValue(value.value);
    return;
  }

  if (value.status === "error") {
    if (
      value.value !== null ||
      value.updatedAt !== null ||
      !isNullableSource(value.source) ||
      !isNullableScope(value.scope) ||
      !isTimestamp(value.retrievedAt) ||
      value.stale !== false ||
      !isError(value.error)
    ) {
      throw new TypeError("Invalid failed public research datum.");
    }
    return;
  }

  if (value.status === "unavailable") {
    if (
      value.value !== null ||
      value.updatedAt !== null ||
      !isNullableSource(value.source) ||
      !isNullableScope(value.scope) ||
      (value.retrievedAt !== null && !isTimestamp(value.retrievedAt)) ||
      value.stale !== false ||
      value.error !== null ||
      !isUnavailableReason(value.reason)
    ) {
      throw new TypeError("Invalid unavailable public research datum.");
    }
    return;
  }

  throw new TypeError("Unexpected public research datum status.");
}

function assertScopedAnalysis(
  value: Record<string, unknown>,
  asset: Asset,
  interval: ChartCandleInterval,
  algorithmVersion: string,
  timestampKey: "confirmedAt" | "latestClosedAt",
  includesAsset = true,
): void {
  if (
    (includesAsset &&
      (value.asset !== asset || value.symbol !== `${asset.toUpperCase()}USDT`)) ||
    value.interval !== interval ||
    value.algorithmVersion !== algorithmVersion ||
    !isTimestamp(value[timestampKey])
  ) {
    throw new TypeError("Invalid public research analysis scope.");
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError("Unexpected public research response fields.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isSource(value: unknown, depth = 0): boolean {
  if (!isRecord(value) || depth > 4) return false;
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.label !== "string" ||
    value.label.length === 0 ||
    typeof value.url !== "string" ||
    !/^https:\/\//.test(value.url)
  ) {
    return false;
  }
  return value.components === undefined ||
    (Array.isArray(value.components) &&
      value.components.every((component) => isSource(component, depth + 1)));
}

function isNullableSource(value: unknown): boolean {
  return value === null || isSource(value);
}

function isScope(value: unknown): boolean {
  return isRecord(value) &&
    (value.kind === "global" ||
      value.kind === "asset" ||
      value.kind === "venue" ||
      value.kind === "derived") &&
    typeof value.label === "string" &&
    value.label.length > 0;
}

function isNullableScope(value: unknown): boolean {
  return value === null || isScope(value);
}

function isError(value: unknown): boolean {
  return isRecord(value) &&
    (value.code === "timeout" ||
      value.code === "rate_limited" ||
      value.code === "upstream_error" ||
      value.code === "invalid_payload" ||
      value.code === "no_data") &&
    typeof value.retryable === "boolean";
}

function isNullableError(value: unknown): boolean {
  return value === null || isError(value);
}

function isUnavailableReason(value: unknown): boolean {
  return value === "not_configured" ||
    value === "unsupported" ||
    value === "license_restricted" ||
    value === "no_reliable_source" ||
    value === "no_data" ||
    value === "insufficient_history";
}
