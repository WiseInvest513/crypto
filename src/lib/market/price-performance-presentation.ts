import type { Asset } from "./live-chart";
import { pricePerformanceWindows, type PricePerformanceSnapshot } from "./price-performance";
import {
  earliestClientMarketExpiryAt,
  expireClientMarketDatum,
} from "./client-market-freshness";

export function parsePricePerformance(value: unknown, asset: Asset): PricePerformanceSnapshot {
  if (!value || typeof value !== "object") throw new TypeError("Invalid performance response");
  const snapshot = value as PricePerformanceSnapshot;
  if (snapshot.asset !== asset || !Array.isArray(snapshot.windows) || snapshot.windows.length !== 3) throw new TypeError("Performance scope mismatch");
  for (const window of pricePerformanceWindows) {
    const entries = snapshot.windows.filter((entry) => entry.window === window);
    if (entries.length !== 1) throw new TypeError("Invalid performance windows");
    const datum = entries[0].datum;
    if (!datum || !["fresh", "stale", "error", "unavailable"].includes(datum.status) || !datum.cache) throw new TypeError("Invalid performance state");
    if (datum.status !== "fresh" && datum.status !== "stale") continue;
    const reading = datum.value;
    if (datum.provenance === "synthetic" || !datum.source || !datum.scope || !Number.isFinite(Date.parse(datum.updatedAt)) || !Number.isFinite(Date.parse(datum.retrievedAt)) || !reading || reading.asset !== asset || reading.symbol !== `${asset.toUpperCase()}USDT` || reading.quoteCurrency !== "USDT" || reading.window !== window || !Number.isFinite(reading.openPrice) || reading.openPrice <= 0 || !Number.isFinite(reading.latestPrice) || reading.latestPrice <= 0 || !Number.isFinite(reading.changePercent) || !Number.isFinite(Date.parse(reading.openTime)) || !Number.isFinite(Date.parse(reading.closeTime)) || Date.parse(reading.closeTime) <= Date.parse(reading.openTime)) throw new TypeError("Invalid performance reading");
  }
  return snapshot;
}

export function performanceRows(snapshot: PricePerformanceSnapshot | null, issue: boolean, now: number) {
  return pricePerformanceWindows.map((window) => {
    const datum = snapshot?.windows.find((entry) => entry.window === window)?.datum;
    const available = datum && (datum.status === "fresh" || datum.status === "stale") && datum.provenance !== "synthetic";
    const age = available && now > 0 ? now - Date.parse(datum.retrievedAt) : 0;
    const expired = age > 300_000;
    const value = available && !expired ? datum.value : null;
    return {
      window,
      label: window === "1d" ? "近 1 天" : window === "7d" ? "近 7 天" : "近 30 天",
      change: value?.changePercent ?? null,
      reading: value,
      state: value ? issue || datum?.status === "stale" || age > 90_000 ? "delayed" : "ready" : !snapshot && !issue ? "loading" : "unavailable",
    };
  });
}

export function expirePricePerformanceSnapshot(
  snapshot: PricePerformanceSnapshot,
  now: number,
): Readonly<{ snapshot: PricePerformanceSnapshot; expired: boolean }> {
  let expired = false;
  const windows = snapshot.windows.map((entry) => {
    const current = expireClientMarketDatum(entry.datum, now);
    expired ||= current.expired;
    return current.datum === entry.datum
      ? entry
      : { ...entry, datum: current.datum };
  });
  return {
    snapshot: expired ? { ...snapshot, windows } : snapshot,
    expired,
  };
}

export function pricePerformanceExpiresAt(
  snapshot: PricePerformanceSnapshot,
  after?: number,
): number | null {
  return earliestClientMarketExpiryAt(
    snapshot.windows.map((entry) => entry.datum),
    after,
  );
}
