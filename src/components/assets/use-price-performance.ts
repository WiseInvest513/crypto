"use client";

import { useEffect, useState } from "react";
import { CLIENT_MARKET_LAST_GOOD_MILLISECONDS } from "@/lib/market/client-market-freshness";
import type { Asset } from "@/lib/market/live-chart";
import type { PricePerformanceSnapshot } from "@/lib/market/price-performance";
import {
  expirePricePerformanceSnapshot,
  parsePricePerformance,
  pricePerformanceExpiresAt,
} from "@/lib/market/price-performance-presentation";

/** Separate from chart interval: switching candles must not reset rolling returns. */
export function usePricePerformance(asset: Asset) {
  const [result, setResult] = useState<PricePerformanceSnapshot | null>(null);
  const [failedAsset, setFailedAsset] = useState<Asset | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [freshnessNow, setFreshnessNow] = useState(0);
  useEffect(() => {
    let disposed = false;
    let active: AbortController | null = null;
    const update = async () => {
      if (active || document.hidden) return;
      const controller = new AbortController();
      active = controller;
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(`/api/market/performance?asset=${asset}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Performance request failed");
        const snapshot = parsePricePerformance(await response.json(), asset);
        if (!disposed) {
          setResult(snapshot);
          setFreshnessNow(Date.now());
          setFailedAsset(null);
        }
      } catch {
        if (!disposed) {
          setFreshnessNow(Date.now());
          setFailedAsset(asset);
        }
      } finally {
        clearTimeout(timer);
        active = null;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 60_000);
    const resume = () => { if (!document.hidden) void update(); };
    document.addEventListener("visibilitychange", resume);
    return () => { disposed = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [asset, requestId]);
  const rawSnapshot = result?.asset === asset ? result : null;
  const expiresAt = rawSnapshot
    ? pricePerformanceExpiresAt(rawSnapshot, freshnessNow)
    : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const delay = Math.min(
      CLIENT_MARKET_LAST_GOOD_MILLISECONDS + 1,
      Math.max(0, expiresAt - Date.now() + 1),
    );
    const timer = setTimeout(() => setFreshnessNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const current = rawSnapshot && freshnessNow > 0
    ? expirePricePerformanceSnapshot(rawSnapshot, freshnessNow)
    : null;
  return {
    snapshot: current?.snapshot ?? rawSnapshot,
    issue: failedAsset === asset,
    expired: Boolean(current?.expired),
    refresh: () => setRequestId((value) => value + 1),
  };
}
