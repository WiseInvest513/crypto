"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { liveEmaDefinitions, type LiveChartPoint, type LiveEmaKey } from "@/lib/market/live-chart";
import { emaColors, formatPrice, formatUpdate, type ChartOverlay } from "@/lib/market/workbench-presentation";
import { layoutChartLevelLabels } from "@/lib/market/chart-level-labels";

export type HistoricalEventMarker = Readonly<{
  id: string;
  openedAt: string;
  label: string;
  tone: "positive" | "negative" | "neutral";
}>;

type Props = {
  points: readonly LiveChartPoint[];
  emaKeys: readonly LiveEmaKey[];
  overlays: readonly ChartOverlay[];
  eventMarkers?: readonly HistoricalEventMarker[];
  selectedEventAt?: string | null;
  selectedLevel: string | null;
  showVolume: boolean;
  historicalView: boolean;
  onPan: (bars: number) => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
};

export function MarketChartCanvas({ points, emaKeys, overlays, eventMarkers = [], selectedEventAt = null, selectedLevel, showVolume, historicalView, onPan, onZoom, onReset }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1040, height: 610 });
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; bars: number } | null>(null);
  const clipId = useId().replaceAll(":", "");
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const geometry = useMemo(() => {
    const effectiveOverlays = historicalView ? [] : overlays;
    const left = 14, right = size.width < 600 ? 64 : 84, top = 18;
    const bottom = size.height - (showVolume ? 120 : 36);
    const plotWidth = Math.max(100, size.width - left - right);
    const labelWidth = size.width < 600 ? 124 : 163;
    // Leave a price-label lane so additional levels never cover the latest bars.
    const dataWidth = Math.max(60, plotWidth - (effectiveOverlays.length ? labelWidth + 8 : 0));
    const rawLow = Math.min(...points.map((point) => point.low), ...points.flatMap((point) => emaKeys.flatMap((key) => point[key] === null ? [] : [point[key]!])));
    const rawHigh = Math.max(...points.map((point) => point.high), ...points.flatMap((point) => emaKeys.flatMap((key) => point[key] === null ? [] : [point[key]!])));
    const focused = effectiveOverlays.find((level) => level.id === selectedLevel);
    const nearby = effectiveOverlays.filter((level) => (level.tone === "support" || level.tone === "resistance") && (level.rank ?? Infinity) <= 3).flatMap((level) => [level.lower ?? level.price, level.upper ?? level.price]);
    const low = Math.min(rawLow, focused?.price ?? rawLow, ...nearby), high = Math.max(rawHigh, focused?.price ?? rawHigh, ...nearby);
    const padding = Math.max((high - low) * 0.12, high * 0.001);
    const min = low - padding, max = high + padding;
    const step = dataWidth / Math.max(points.length, 1);
    const y = (price: number) => top + (max - price) / (max - min) * (bottom - top);
    const x = (index: number) => left + step * (index + 0.5);
    const paths = emaKeys.map((key) => ({ key, d: points.map((point, index) => point[key] === null ? "" : `${index === 0 || points[index - 1][key] === null ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]!).toFixed(1)}`).join(" ") }));
    const visibleLevels = effectiveOverlays.filter((level) => level.price >= min && level.price <= max).sort((a, b) => b.price - a.price);
    const labels = layoutChartLevelLabels(visibleLevels, { min, max, top, bottom, selectedId: selectedLevel });
    return { left, right, top, bottom, plotWidth, dataWidth, labelWidth, step, x, y, min, max, paths, labels, visibleLevels, maxVolume: Math.max(1, ...points.map((point) => point.volume)) };
  }, [points, emaKeys, overlays, selectedLevel, showVolume, historicalView, size]);
  const selected = hover === null ? null : points[Math.min(hover, points.length - 1)];
  const latest = points.at(-1);
  const visibleEventMarkers = useMemo(() => eventMarkers.flatMap((marker) => {
    const pointIndex = points.findIndex((point) => point.openedAt === marker.openedAt);
    return pointIndex < 0 ? [] : [{ ...marker, pointIndex }];
  }), [eventMarkers, points]);
  const tickCount = geometry.dataWidth < 240 ? 2 : size.width < 600 ? 3 : 5;
  const pick = (clientX: number) => {
    const rect = host.current?.getBoundingClientRect();
    if (rect) setHover(Math.max(0, Math.min(points.length - 1, Math.round((clientX - rect.left - geometry.left) / geometry.step - 0.5))));
  };
  return (
    <div className="mw-canvas" ref={host} tabIndex={0} role="region" aria-label="交互行情图表。拖动查看历史，方向键检查价格，加减键缩放，End 返回最新。"
      onPointerMove={(event) => {
        if (drag.current) { const bars = Math.round((event.clientX - drag.current.x) / geometry.step); if (bars !== drag.current.bars) { onPan(bars - drag.current.bars); drag.current.bars = bars; } }
        else pick(event.clientX);
      }}
      onPointerDown={(event) => { if (event.button !== 0) return; drag.current = { x: event.clientX, bars: 0 }; event.currentTarget.setPointerCapture(event.pointerId); pick(event.clientX); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => { if (!drag.current) setHover(null); }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setHover((value) => Math.max(0, Math.min(points.length - 1, (value ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1)))); }
        if (event.key === "+" || event.key === "=") { event.preventDefault(); onZoom(0.75); }
        if (event.key === "-") { event.preventDefault(); onZoom(1.3); }
        if (event.key === "End") { event.preventDefault(); onReset(); setHover(null); }
        if (event.key === "Escape") setHover(null);
      }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`价格走势，${historicalView ? "历史窗口末值" : "最新"} ${formatPrice(latest?.close)} USDT`}>
        <defs><clipPath id={clipId}><rect x={geometry.left} y={geometry.top} width={geometry.plotWidth} height={geometry.bottom - geometry.top + (showVolume ? 94 : 0)} /></clipPath></defs>
        {Array.from({ length: 6 }, (_, index) => {
          const value = geometry.max - (geometry.max - geometry.min) * index / 5;
          return <g key={index}><line className="mw-grid-line" x1={geometry.left} x2={size.width - geometry.right} y1={geometry.y(value)} y2={geometry.y(value)} /><text className="mw-axis" x={size.width - geometry.right + 10} y={geometry.y(value) + 4}>{new Intl.NumberFormat("en-US", { maximumFractionDigits: value > 1000 ? 0 : 2 }).format(value)}</text></g>;
        })}
        <g clipPath={`url(#${clipId})`}>
          {geometry.visibleLevels.map((level) => level.lower !== undefined && level.upper !== undefined && level.upper > level.lower ? <rect key={`zone-${level.id}`} className={`mw-level-zone mw-level--${level.tone}`} x={geometry.left} width={geometry.plotWidth} y={geometry.y(level.upper)} height={geometry.y(level.lower) - geometry.y(level.upper)} /> : null)}
          {points.map((point, index) => {
            const tone = point.close >= point.open ? "up" : "down";
            const bodyWidth = Math.max(1, Math.min(8, geometry.step * 0.65));
            const volumeHeight = point.volume / geometry.maxVolume * 68;
            return <g key={point.openedAt} className={`mw-candle mw-candle--${tone}`}><line x1={geometry.x(index)} x2={geometry.x(index)} y1={geometry.y(point.high)} y2={geometry.y(point.low)} /><rect x={geometry.x(index) - bodyWidth / 2} y={geometry.y(Math.max(point.open, point.close))} width={bodyWidth} height={Math.max(1.2, Math.abs(geometry.y(point.open) - geometry.y(point.close)))} />{showVolume && <rect className="mw-volume" x={geometry.x(index) - bodyWidth / 2} y={geometry.bottom + 88 - volumeHeight} width={bodyWidth} height={volumeHeight} />}</g>;
          })}
          {visibleEventMarkers.map((marker) => {
            const markerX = geometry.x(marker.pointIndex);
            const focused = marker.openedAt === selectedEventAt;
            return <g key={marker.id} className={`mw-history-marker mw-history-marker--${marker.tone}${focused ? " is-focused" : ""}`} aria-hidden="true">
              <line x1={markerX} x2={markerX} y1={geometry.top} y2={geometry.bottom} />
              <circle cx={markerX} cy={geometry.top + 12} r={focused ? 6 : 4} />
              {focused && <text x={Math.min(markerX + 8, geometry.left + geometry.dataWidth - 64)} y={geometry.top + 16}>{marker.label}</text>}
            </g>;
          })}
          {geometry.paths.map(({ key, d }) => <path key={key} d={d} fill="none" stroke={emaColors[key]} strokeWidth={key === "ema200" ? 1.6 : 1.8} strokeDasharray={key === "ema200" ? "4 3" : undefined} />)}
          {geometry.visibleLevels.map((level) => <line key={level.id} data-rank={level.rank} className={`mw-level-line mw-level--${level.tone}${level.id === selectedLevel ? " is-focused" : ""}`} x1={geometry.left} x2={size.width - geometry.right} y1={geometry.y(level.price)} y2={geometry.y(level.price)} />)}
          {latest && !historicalView && <line className="mw-current-line" x1={geometry.left} x2={size.width - geometry.right} y1={geometry.y(latest.close)} y2={geometry.y(latest.close)} />}
          {selected && hover !== null && <line className="mw-crosshair" x1={geometry.x(hover)} x2={geometry.x(hover)} y1={geometry.top} y2={geometry.bottom + (showVolume ? 88 : 0)} />}
        </g>
        {geometry.labels.map((level) => <g key={level.id} className={`mw-level-label mw-level--${level.tone}`}><line x1={size.width - geometry.right - 8} x2={size.width - geometry.right - 8} y1={level.actualY} y2={level.labelY} /><rect x={size.width - geometry.right - geometry.labelWidth} y={level.labelY - 13} width={geometry.labelWidth} height={19} rx={3} /><text x={size.width - geometry.right - 10} y={level.labelY} textAnchor="end">{level.label} {formatPrice(level.price)}</text></g>)}
        {latest && !historicalView && <g><rect className="mw-current-price" x={size.width - geometry.right} y={geometry.y(latest.close) - 12} width={geometry.right - 2} height={24} rx={4} /><text className="mw-current-price-text" x={size.width - geometry.right / 2} y={geometry.y(latest.close) + 4} textAnchor="middle">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(latest.close)}</text></g>}
        {showVolume && <><line className="mw-grid-line" x1={geometry.left} x2={size.width - geometry.right} y1={geometry.bottom + 13} y2={geometry.bottom + 13} /><text className="mw-axis" x={geometry.left + 4} y={geometry.bottom + 30}>成交量</text></>}
        {Array.from({ length: tickCount }, (_, index) => { const pointIndex = Math.round((points.length - 1) * index / (tickCount - 1)); const point = points[pointIndex]; return point ? <text key={index} className="mw-axis" x={geometry.x(pointIndex)} y={size.height - 12} textAnchor={index === 0 ? "start" : index === tickCount - 1 ? "end" : "middle"}>{point.openedAt.slice(5, 10)} {point.interval === "1d" ? "" : point.openedAt.slice(11, 16)}</text> : null; })}
      </svg>
      {selected && <div className="mw-readout" aria-live="off"><time>{formatUpdate(selected.openedAt)}</time><div>{[["开", selected.open], ["高", selected.high], ["低", selected.low], ["收", selected.close]].map(([label, value]) => <span key={label}>{label} <b>{formatPrice(value as number)}</b></span>)}<span>量 <b>{formatPrice(selected.volume)} {selected.asset.toUpperCase()}</b></span></div><div>{emaKeys.map((key) => <span key={key} style={{ color: emaColors[key] }}>{liveEmaDefinitions[key].label} <b>{formatPrice(selected[key])}</b></span>)}</div></div>}
      <span className="sr-only" aria-live="polite">{selected ? `${formatUpdate(selected.openedAt)}，开盘 ${formatPrice(selected.open)}，最高 ${formatPrice(selected.high)}，最低 ${formatPrice(selected.low)}，收盘 ${formatPrice(selected.close)}，成交量 ${formatPrice(selected.volume)} ${selected.asset.toUpperCase()}` : ""}</span>
    </div>
  );
}
