"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  marketAnalytics,
  type MarketKeyLevelKind,
} from "@/lib/analytics/market-analytics";
import type { KeyLevelAnalysis } from "@/lib/market/key-levels";
import { buildLiveChartPoints, liveEmaDefinitions, liveEmaKeys, type Asset, type ChartCandle, type ChartCandleInterval, type LiveEmaKey, type MarketDatum } from "@/lib/market/live-chart";
import type { HistoricalContextHorizon } from "@/lib/market/historical-context";
import { analysisModeKeys, analysisModes, emaColors, formatMarketHeaderUpdate, formatPrice, keyLevelOverlays, keyLevelsContainingPrice, nearestKeyLevels, periodLabels, workbenchIntervals, type AnalysisMode } from "@/lib/market/workbench-presentation";
import { useMarketCandles, usePublicResearch } from "./use-market-workbench";
import { MarketChartCanvas, type HistoricalEventMarker } from "./market-chart-canvas";
import { availableResearch, MarketResearchPanel } from "./market-research-panel";
import { usePricePerformance } from "./use-price-performance";
import { MarketPricePerformance } from "./market-price-performance";
import { DismissibleDetails } from "@/components/ui/dismissible-details";

const mobileQuery = "(max-width: 680px)";
const subscribeMobile = (callback: () => void) => { const query = window.matchMedia(mobileQuery); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const desktopSnapshot = () => false;

export function resolveHistoryEventSelection(
  selectedEventAt: string | null,
  markers: readonly HistoricalEventMarker[],
): string | null {
  return selectedEventAt && markers.some((marker) => marker.openedAt === selectedEventAt)
    ? selectedEventAt
    : null;
}

export function resolveResearchIssueState(input: Readonly<{
  requestIssue: boolean;
  levelsExpired: boolean;
  historyExpired: boolean;
  levelsError: boolean;
  historyError: boolean;
}>): Readonly<{ levelsIssue: boolean; historyIssue: boolean }> {
  return {
    levelsIssue: input.requestIssue || input.levelsExpired || input.levelsError,
    historyIssue: input.requestIssue || input.historyExpired || input.historyError,
  };
}

export function resolveLongHistoryIssueState(input: Readonly<{
  requestIssue: boolean;
  longHistoryExpired: boolean;
  longHistoryError: boolean;
}>): boolean {
  return input.requestIssue || input.longHistoryExpired || input.longHistoryError;
}

export function resolveCycleIssueState(input: Readonly<{
  requestIssue: boolean;
  cycleExpired: boolean;
  cycleError: boolean;
}>): boolean {
  return input.requestIssue || input.cycleExpired || input.cycleError;
}

export function resolveKeyLevelAnalyticsSelection(
  id: string,
  analysis: KeyLevelAnalysis | null,
  price: number | null,
): Readonly<{ levelKind: MarketKeyLevelKind; rank?: number }> | null {
  if (id === "poc") return { levelKind: "volume_poc" };
  if (id === "val") return { levelKind: "volume_value_area_low" };
  if (id === "vah") return { levelKind: "volume_value_area_high" };
  if (id.startsWith("fib:")) return { levelKind: "fibonacci" };
  if (!analysis || price === null) return null;

  if (keyLevelsContainingPrice(analysis, price).some((level) => level.id === id)) {
    return { levelKind: "at_price" };
  }

  const levels = nearestKeyLevels(analysis, price, "all");
  const resistanceRank = levels.resistances.findIndex((level) => level.id === id);
  if (resistanceRank >= 0) {
    return { levelKind: "resistance", rank: resistanceRank + 1 };
  }

  const supportRank = levels.supports.findIndex((level) => level.id === id);
  return supportRank >= 0
    ? { levelKind: "support", rank: supportRank + 1 }
    : null;
}

export function MarketWorkbench({ asset, initialDatum, strategySlot }: { asset: Asset; initialDatum: MarketDatum<readonly ChartCandle[]>; strategySlot?: ReactNode }) {
  const market = useMarketCandles(asset, initialDatum);
  const research = usePublicResearch(asset, market.interval);
  const performance = usePricePerformance(asset);
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, desktopSnapshot);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("short");
  const [emaKeys, setEmaKeys] = useState<readonly LiveEmaKey[]>(["ema10", "ema20", "ema50"]);
  const [showLevels, setShowLevels] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFibonacci, setShowFibonacci] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showHistoryEvents, setShowHistoryEvents] = useState(false);
  const [historyHorizon, setHistoryHorizon] = useState<HistoricalContextHorizon>(24);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedHistoryEventAt, setSelectedHistoryEventAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState<{ interval: ChartCandleInterval; count: number; endAt: string | null } | null>(null);
  const settings = useRef<HTMLDetailsElement>(null);
  const chartPanel = useRef<HTMLElement>(null);
  const points = useMemo(() => buildLiveChartPoints(market.candles), [market.candles]);
  const latest = points.at(-1);
  const latestCurrent = market.currentPriceAvailable ? latest : undefined;
  const analysis = availableResearch(research.snapshot?.levels);
  const historicalContext = availableResearch(research.snapshot?.history);
  const historyMarkers = useMemo<readonly HistoricalEventMarker[]>(() => historicalContext?.cases.map((entry) => {
    const outcome = entry.outcomes.find((item) => item.bars === 24);
    return {
      id: `${entry.representativeOf}-${entry.eventOpenedAt}`,
      openedAt: entry.eventOpenedAt,
      label: entry.representativeOf === "median" ? "中位样本" : entry.representativeOf === "q25" ? "偏弱样本" : "偏强样本",
      tone: !outcome || outcome.returnPercent === 0 ? "neutral" : outcome.returnPercent > 0 ? "positive" : "negative",
    };
  }) ?? [], [historicalContext]);
  const activeSelectedHistoryEventAt = resolveHistoryEventSelection(selectedHistoryEventAt, historyMarkers);
  const historySelectionInvalid = selectedHistoryEventAt !== null && activeSelectedHistoryEventAt === null;
  const activeView = viewport?.interval === market.interval && !historySelectionInvalid ? viewport : null;
  const count = activeView?.count ?? (mobile ? 80 : 160);
  const historicalEnd = activeView?.endAt ? points.findIndex((point) => point.openedAt === activeView.endAt) : -1;
  const end = historicalEnd < 0 ? points.length : historicalEnd + 1;
  const visiblePoints = points.slice(Math.max(0, end - count), end);
  const overlays = useMemo(() => keyLevelOverlays(market.currentPriceAvailable ? analysis : null, latestCurrent?.close ?? null, selectedLevel, { supportResistance: showLevels, profile: showProfile, fibonacci: showFibonacci }), [showLevels, showProfile, showFibonacci, analysis, market.currentPriceAvailable, latestCurrent?.close, selectedLevel]);
  const researchDelayed = research.receivedAt > 0 && market.now - research.receivedAt > 90_000;
  const { levelsIssue, historyIssue } = resolveResearchIssueState({
    requestIssue: research.requestIssue,
    levelsExpired: research.expired,
    historyExpired: research.historyExpired,
    levelsError: research.snapshot?.levels.status === "error",
    historyError: research.snapshot?.history.status === "error",
  });
  const longHistoryIssue = resolveLongHistoryIssueState({
    requestIssue: research.requestIssue,
    longHistoryExpired: research.longHistoryExpired,
    longHistoryError: research.snapshot?.longHistory.status === "error",
  });
  const cycleIssue = resolveCycleIssueState({
    requestIssue: research.requestIssue,
    cycleExpired: research.cycleExpired,
    cycleError: research.snapshot?.cycle.status === "error",
  });
  const pan = (bars: number) => setViewport((previous) => {
    const previousEnd = previous?.interval === market.interval && previous.endAt ? points.findIndex((point) => point.openedAt === previous.endAt) + 1 : points.length;
    const nextEnd = Math.max(Math.min(count, points.length), Math.min(points.length, previousEnd - bars));
    return { interval: market.interval, count, endAt: nextEnd === points.length ? null : points[nextEnd - 1]?.openedAt ?? null };
  });
  const zoom = (factor: number) => setViewport({ interval: market.interval, count: Math.min(1000, Math.max(30, Math.round(count * factor))), endAt: activeView?.endAt ?? null });
  const historyReviewMode = historicalEnd >= 0 || activeSelectedHistoryEventAt !== null;
  const historicalView = historyReviewMode || market.expired;
  const reset = () => { setViewport(null); setSelectedLevel(null); setSelectedHistoryEventAt(null); };
  const revealChart = () => {
    requestAnimationFrame(() => {
      const panel = chartPanel.current;
      if (!panel) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      panel.querySelector<HTMLElement>(".mw-canvas")?.focus({ preventScroll: true });
    });
  };
  const selectLevel = (id: string) => {
    const analyticsSelection = resolveKeyLevelAnalyticsSelection(
      id,
      analysis,
      latestCurrent?.close ?? null,
    );
    if (analyticsSelection) {
      marketAnalytics.trackKeyLevelSelect({
        asset,
        interval: market.interval,
        ...analyticsSelection,
      });
    }
    setSelectedHistoryEventAt(null);
    setSelectedLevel((previous) => previous === id ? null : id);
    if (id.startsWith("fib:")) setShowFibonacci(true);
    else if (["poc", "vah", "val"].includes(id)) setShowProfile(true);
    else setShowLevels(true);
    setViewport({ interval: market.interval, count, endAt: null });
    revealChart();
  };
  const selectHistoryEvent = (eventOpenedAt: string) => {
    const eventIndex = points.findIndex((point) => point.openedAt === eventOpenedAt);
    if (eventIndex < 0) return;
    const viewCount = Math.max(30, Math.min(count, 160));
    const nextEnd = Math.min(points.length, eventIndex + 25);
    setSelectedLevel(null);
    setShowHistoryEvents(true);
    setSelectedHistoryEventAt(eventOpenedAt);
    setViewport({ interval: market.interval, count: viewCount, endAt: nextEnd === points.length ? null : points[nextEnd - 1]?.openedAt ?? null });
    revealChart();
  };
  const selectInterval = (interval: ChartCandleInterval) => {
    if (market.interval !== interval) {
      marketAnalytics.trackIntervalChange({
        asset,
        from: market.interval,
        to: interval,
      });
      setSelectedLevel(null);
      setSelectedHistoryEventAt(null);
      setShowHistoryEvents(false);
      void market.refresh(interval, true);
    }
  };
  const trackCycleTimelineToggle = (open: boolean, hiddenCount: number) => {
    marketAnalytics.trackCycleTimelineToggle({
      asset,
      action: open ? "expand" : "collapse",
      hiddenCount,
    });
  };
  const selectAnalysisMode = (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    setEmaKeys(analysisModes[mode].emaKeys);
  };
  const refreshAll = () => { void market.refresh(market.interval, true); research.refresh(); performance.refresh(); };
  const name = asset === "btc" ? "比特币" : "以太坊";

  return <div className={`market-workbench${expanded ? " market-workbench--expanded" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") setExpanded(false); }}>
    <header className="mw-asset-bar">
      <div className="mw-asset-identity">
        <nav className="mw-asset-switch" aria-label="切换行情资产"><Link href="/btc" aria-current={asset === "btc" ? "page" : undefined}>BTC</Link><Link href="/eth" aria-current={asset === "eth" ? "page" : undefined}>ETH</Link></nav>
        <span className={`mw-coin mw-coin--${asset}`} aria-hidden="true">{asset === "btc" ? "₿" : "Ξ"}</span><h1>{asset.toUpperCase()}<span>{name}</span></h1>
      </div>
      <div className="mw-price"><strong>{formatPrice(latestCurrent?.close)}</strong><span>USDT</span></div>
      <div className="mw-market-summary">
        <MarketPricePerformance snapshot={performance.snapshot} issue={performance.issue} now={market.now} />
        <div className="mw-updated"><time dateTime={market.datum.updatedAt ?? undefined}>{market.expired ? "历史记录" : "价格更新"} {formatMarketHeaderUpdate(market.datum.updatedAt)}</time>{market.delayed && <span role="status">{market.expired ? "实时价格不可用" : "数据延迟"}</span>}</div>
      </div>
    </header>

    <div className="mw-workspace">
      <section ref={chartPanel} className="mw-chart-panel" aria-label={`${name}行情图表`}>
        <div className="mw-toolbar">
          <div className="mw-toolbar-primary">
            <div className="mw-periods" role="group" aria-label="时间周期">{workbenchIntervals.map((interval) => <button key={interval} aria-pressed={market.interval === interval} onClick={() => selectInterval(interval)}>{periodLabels[interval]}</button>)}</div>
            <div className="mw-analysis-modes" role="group" aria-label="分析视角">{analysisModeKeys.map((mode) => <button key={mode} aria-label={`${analysisModes[mode].label}分析，${analysisModes[mode].description}`} aria-pressed={analysisMode === mode} onClick={() => selectAnalysisMode(mode)}><strong>{analysisModes[mode].label}</strong><small>{analysisModes[mode].description}</small></button>)}</div>
          </div>
          <div className="mw-toolbar-actions">
            <DismissibleDetails className="mw-settings" detailsRef={settings}><summary>图层 <WorkbenchIcon name="chevron" /></summary><div className="mw-settings-menu"><p>显示均线</p>{liveEmaKeys.map((key) => <label key={key}><input type="checkbox" checked={emaKeys.includes(key)} onChange={() => setEmaKeys((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key])} />{liveEmaDefinitions[key].label}</label>)}<p>价格参考</p><label><input type="checkbox" checked={showProfile} onChange={(event) => setShowProfile(event.target.checked)} />成交密集区 · 估算</label><label><input type="checkbox" checked={showFibonacci} onChange={(event) => setShowFibonacci(event.target.checked)} />斐波那契参考线</label></div></DismissibleDetails>
            <button className="mw-icon-button" aria-label="刷新行情与分析" title="刷新行情与分析" onClick={refreshAll} disabled={market.pending !== null}><WorkbenchIcon name="refresh" /></button>
            <button className="mw-icon-button mw-expand-button" aria-label={expanded ? "退出专注模式" : "进入专注模式"} aria-pressed={expanded} title="专注模式" onClick={() => setExpanded((value) => !value)}><WorkbenchIcon name="expand" /></button>
          </div>
        </div>
        <div className="mw-layers"><div className="mw-ema-legend">{emaKeys.map((key) => <span key={key}><i style={{ background: emaColors[key] }} />{liveEmaDefinitions[key].label}</span>)}</div><div className="mw-layer-toggles"><label><input type="checkbox" checked={showLevels} onChange={(event) => setShowLevels(event.target.checked)} />关键位</label>{historyMarkers.length > 0 && <label><input type="checkbox" checked={showHistoryEvents} onChange={(event) => { setShowHistoryEvents(event.target.checked); if (!event.target.checked) { if (selectedHistoryEventAt !== null) setViewport(null); setSelectedHistoryEventAt(null); } }} />历史案例</label>}<label><input type="checkbox" checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} />成交量</label></div></div>
        {market.pending && market.pending !== market.interval && <p className="mw-inline-status" role="status">正在切换到 {periodLabels[market.pending]}…</p>}
        {market.issue && <p className="mw-inline-status mw-inline-status--warning" role="status">{market.issue} <button onClick={refreshAll}>重试</button></p>}
        {points.length ? <MarketChartCanvas points={visiblePoints} emaKeys={emaKeys} overlays={overlays} eventMarkers={showHistoryEvents ? historyMarkers : []} selectedEventAt={activeSelectedHistoryEventAt} selectedLevel={selectedLevel} showVolume={showVolume} historicalView={historicalView} onPan={pan} onZoom={zoom} onReset={reset} /> : <div className="mw-chart-empty"><WorkbenchIcon name="chart" /><h2>行情暂不可用</h2><p>连接恢复后，将自动显示价格走势。</p><button onClick={refreshAll}>重新加载</button></div>}
        <div className="mw-chart-navigation"><span>{market.expired ? "当前为历史记录，实时行情恢复后自动更新" : activeSelectedHistoryEventAt ? "正在核对历史案例 · 当前关键位已隐藏" : historicalEnd >= 0 ? "正在查看历史，当前关键位已隐藏" : "拖动查看历史 · 使用 ＋ / − 缩放"}</span><div><button className="mw-icon-button" aria-label="查看更早行情" onClick={() => pan(Math.round(count * 0.5))} disabled={!points.length || end <= count}><WorkbenchIcon name="left" /></button><button className="mw-icon-button" aria-label="缩小图表" onClick={() => zoom(1.35)} disabled={count >= 1000}>−</button><button className="mw-icon-button" aria-label="放大图表" onClick={() => zoom(0.75)} disabled={count <= 30}>＋</button><button className="mw-reset" onClick={reset}>回到最新</button></div></div>
      </section>
      <MarketResearchPanel points={market.currentPriceAvailable ? points : []} interval={market.interval} analysisMode={analysisMode} snapshot={research.snapshot} issue={levelsIssue} historyIssue={historyIssue} longHistoryIssue={longHistoryIssue} cycleIssue={cycleIssue} delayed={market.delayed} levelsDelayed={researchDelayed || research.snapshot?.levels.status === "stale"} historyDelayed={researchDelayed || research.snapshot?.history.status === "stale"} longHistoryDelayed={researchDelayed || research.snapshot?.longHistory.status === "stale"} cycleDelayed={researchDelayed || research.snapshot?.cycle.status === "stale"} historyHorizon={historyHorizon} historyReviewMode={historicalView} selectedLevel={selectedLevel} selectedHistoryEventAt={activeSelectedHistoryEventAt} onSelectLevel={selectLevel} onSelectHistoryEvent={selectHistoryEvent} onSelectHistoryHorizon={setHistoryHorizon} onSelectInterval={selectInterval} onCycleTimelineToggle={trackCycleTimelineToggle} onReturnToLatest={reset} onRetry={research.refresh} strategySlot={strategySlot} />
    </div>
    <p className="mw-disclaimer">关键位是行情样本推算的价格区域，成交密集区为估算；不代表价格必然反转。以上为客观参考，不构成交易建议。</p>
  </div>;
}

function WorkbenchIcon({ name }: { name: "chevron" | "refresh" | "expand" | "chart" | "left" }) {
  const paths = { chevron: "m6 9 6 6 6-6", refresh: "M20 7v5h-5M4 17v-5h5M6.2 6.2a8 8 0 0 1 13 2.6M4.8 15.2a8 8 0 0 0 13 2.6", expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5", chart: "M3 3v18h18M7 14l4-5 4 3 5-7", left: "m14 6-6 6 6 6" };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
