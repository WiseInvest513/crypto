"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLIENT_MARKET_LAST_GOOD_MILLISECONDS,
  expireClientMarketDatum,
} from "@/lib/market/client-market-freshness";
import { chartTailNeedsFullRefresh, mergeChartCandles, type Asset, type ChartCandle, type ChartCandleInterval, type MarketDatum } from "@/lib/market/live-chart";
import { parseWorkbenchCandles, publicCandles } from "@/lib/market/workbench-presentation";
import {
  expirePublicResearchSnapshot,
  parsePublicResearchSnapshot,
  publicResearchExpiresAt,
  type PublicResearchSnapshot,
} from "@/lib/market/public-research";

export function useMarketCandles(asset: Asset, initialDatum: MarketDatum<readonly ChartCandle[]>) {
  const [state, setState] = useState(() => ({ datum: initialDatum, interval: publicCandles(initialDatum).at(-1)?.interval ?? "1h" as ChartCandleInterval, candles: publicCandles(initialDatum), issue: "", pending: null as ChartCandleInterval | null, checkedAt: 0 }));
  const current = useRef(state);
  const active = useRef<AbortController | null>(null);
  const [now, setNow] = useState(0);
  const refresh = useCallback(async (requestedInterval: ChartCandleInterval, full = false) => {
    if (active.current && !full) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState((previous) => ({ ...previous, pending: requestedInterval }));
    const timer = setTimeout(() => controller.abort("timeout"), 15_000);
    try {
      const previous = current.current;
      let mode = full || !previous.candles.length || previous.interval !== requestedInterval ? "full" : "tail";
      const request = async () => {
        const query = new URLSearchParams({ asset, interval: requestedInterval, mode });
        const response = await fetch(`/api/market/candles?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("request failed");
        return parseWorkbenchCandles(await response.json(), asset, requestedInterval);
      };
      let datum = await request();
      const oldLast = previous.candles.at(-1);
      const incomingFirst = publicCandles(datum)[0];
      if (mode === "tail" && (previous.datum.source?.id !== datum.source?.id || chartTailNeedsFullRefresh(previous.candles, publicCandles(datum)) || (oldLast?.state === "forming" && incomingFirst && incomingFirst.openedAt > oldLast.openedAt))) { mode = "full"; datum = await request(); }
      const incoming = publicCandles(datum);
      if (!incoming.length) throw new Error("no public candles");
      if (previous.interval === requestedInterval && previous.candles.length && datum.retrievedAt && previous.datum.retrievedAt && datum.retrievedAt < previous.datum.retrievedAt) throw new Error("older observation");
      const candles = mode === "tail" ? mergeChartCandles(previous.candles, incoming) : incoming;
      if (controller.signal.aborted) return;
      const observedAt = Date.now();
      const next = { datum, interval: requestedInterval, candles, issue: "", pending: null, checkedAt: observedAt };
      current.current = next;
      setState(next);
      setNow(observedAt);
    } catch {
      if (active.current !== controller) return;
      setState((previous) => ({ ...previous, issue: "行情更新暂时中断，已保留最近数据。", pending: null }));
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setState((previous) => ({ ...previous, pending: null })); }
    }
  }, [asset]);

  useEffect(() => {
    const tick = () => { setNow(Date.now()); if (!document.hidden) void refresh(current.current.interval); };
    tick();
    const timer = setInterval(tick, 5_000);
    const resume = () => { if (!document.hidden) void refresh(current.current.interval, true); };
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); active.current?.abort(); active.current = null; };
  }, [refresh]);
  const lastObserved = Date.parse(state.datum.retrievedAt ?? "");
  const expired = now > 0 && expireClientMarketDatum(state.datum, now).expired;
  const delayed = expired || Boolean(state.issue) || state.datum.status === "stale" || (now > 0 && Number.isFinite(lastObserved) && now - lastObserved > 25_000);
  const issue = expired
    ? "实时行情已中断，图表仅保留历史记录。"
    : state.issue;
  return {
    ...state,
    issue,
    now,
    delayed,
    expired,
    currentPriceAvailable: state.candles.length > 0 && !expired,
    refresh,
  };
}

export function usePublicResearch(asset: Asset, interval: ChartCandleInterval) {
  const [result, setResult] = useState<{ snapshot: PublicResearchSnapshot; receivedAt: number } | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
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
        const query = new URLSearchParams({ asset, interval });
        const response = await fetch(`/api/market/research?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("request failed");
        const snapshot = parsePublicResearchSnapshot(
          await response.json(),
          asset,
          interval,
        );
        if (!disposed) {
          const receivedAt = Date.now();
          setResult({ snapshot, receivedAt });
          setFreshnessNow(receivedAt);
          setIssue(null);
        }
      } catch {
        if (!disposed) {
          setFreshnessNow(Date.now());
          setIssue(`${asset}:${interval}`);
        }
      }
      finally { clearTimeout(timer); active = null; }
    };
    void update();
    const timer = setInterval(() => void update(), 60_000);
    const resume = () => { if (!document.hidden) void update(); };
    document.addEventListener("visibilitychange", resume);
    return () => { disposed = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [asset, interval, requestId]);
  const rawSnapshot = result?.snapshot.asset === asset && result.snapshot.interval === interval ? result.snapshot : null;
  const expiresAt = rawSnapshot
    ? publicResearchExpiresAt(rawSnapshot, freshnessNow)
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
    ? expirePublicResearchSnapshot(rawSnapshot, freshnessNow)
    : null;
  return {
    snapshot: current?.snapshot ?? rawSnapshot,
    receivedAt: rawSnapshot ? result!.receivedAt : 0,
    requestIssue: issue === `${asset}:${interval}`,
    issue: issue === `${asset}:${interval}` || Boolean(current?.levelsExpired),
    expired: Boolean(current?.levelsExpired),
    historyExpired: Boolean(current?.historyExpired),
    longHistoryExpired: Boolean(current?.longHistoryExpired),
    cycleExpired: Boolean(current?.cycleExpired),
    refresh: () => setRequestId((value) => value + 1),
  };
}
