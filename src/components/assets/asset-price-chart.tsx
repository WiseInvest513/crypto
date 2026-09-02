"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  assertChartSeries,
  buildLiveChartPoints,
  chartIntervalLabels,
  chartTailNeedsFullRefresh,
  liveEmaDefinitions,
  liveEmaKeys,
  LIVE_CHART_MAX_CANDLES,
  LIVE_CHART_REFRESH_MILLISECONDS,
  mergeChartCandles,
  summarizeLiveTrend,
  summarizeVisibleChart,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
  type LiveEmaKey,
  type LiveChartPoint,
  type LiveTrendSummary,
  type MarketDatum,
  type VisibleChartSummary,
} from "@/lib/market/live-chart";
import { presentMarketDatum } from "@/lib/market/homepage-presentation";
import { DatumMeta, DatumStatus } from "@/components/market/datum-presentation";

type ChartViewCount = 200 | 500 | 1_000;
type ChartRequestMode = "full" | "tail";
type EmaPresetId = "short" | "trend";

const CHART_WIDTH = 1_200;
const CHART_HEIGHT = 560;
const PRICE_PLOT = {
  left: 76,
  right: 86,
  top: 22,
  bottom: 408,
} as const;
const VOLUME_PLOT = { top: 434, bottom: 510 } as const;
const chartIntervals = ["15m", "1h", "4h", "1d"] as const;
const viewCounts = [200, 500, 1_000] as const satisfies readonly ChartViewCount[];
const emaPresets = [
  {
    id: "short",
    label: "短线",
    description: "EMA10 / 20 / 50",
    keys: ["ema10", "ema20", "ema50"],
  },
  {
    id: "trend",
    label: "趋势",
    description: "EMA20 / 50 / 200",
    keys: ["ema20", "ema50", "ema200"],
  },
] as const satisfies readonly {
  id: EmaPresetId;
  label: string;
  description: string;
  keys: readonly LiveEmaKey[];
}[];

const defaultEmaKeys: readonly LiveEmaKey[] = emaPresets[0].keys;

export function AssetPriceChart({
  asset,
  assetLabel,
  initialDatum,
}: {
  asset: Asset;
  assetLabel: string;
  initialDatum: MarketDatum<readonly ChartCandle[]>;
}) {
  const initialCandles = publicChartCandles(initialDatum);
  const [datum, setDatum] = useState(initialDatum);
  const datumRef = useRef(initialDatum);
  const [interval, setInterval] = useState<ChartCandleInterval>(
    initialCandles?.at(-1)?.interval ?? "1h",
  );
  const [viewCount, setViewCount] = useState<ChartViewCount>(500);
  const [selectedEmaKeys, setSelectedEmaKeys] =
    useState<readonly LiveEmaKey[]>(defaultEmaKeys);
  const [endOffset, setEndOffset] = useState(0);
  const [selectedOpenedAt, setSelectedOpenedAt] = useState<string | null>(null);
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshIssue, setRefreshIssue] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const chartViewportRef = useRef<HTMLDivElement | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointerOpenedAtRef = useRef<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const factsId = useId();

  const commitDatum = useCallback(
    (next: MarketDatum<readonly ChartCandle[]>) => {
      datumRef.current = next;
      setDatum(next);
    },
    [],
  );

  const refresh = useCallback(
    async (
      requestedInterval: ChartCandleInterval,
      mode: ChartRequestMode,
      force = false,
    ) => {
      if (inFlightRef.current && !force) {
        return;
      }
      if (force) {
        controllerRef.current?.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      inFlightRef.current = true;
      setIsRefreshing(true);

      try {
        let next = await fetchChartDatum(
          asset,
          requestedInterval,
          mode,
          controller.signal,
        );
        const current = datumRef.current;
        const currentCandles = publicChartCandles(current);
        const nextCandles = publicChartCandles(next);
        const intervalChanged =
          currentCandles?.at(-1)?.interval !== requestedInterval;

        if (
          mode === "tail" &&
          nextCandles &&
          (currentCandles === null ||
            chartTailNeedsFullRefresh(currentCandles, nextCandles))
        ) {
          next = await fetchChartDatum(
            asset,
            requestedInterval,
            "full",
            controller.signal,
          );
        }

        const resolvedCandles = publicChartCandles(next);
        if (resolvedCandles === null) {
          if (currentCandles === null) {
            commitDatum(next);
          }
          setRefreshIssue(refreshFailureLabel(next));
          return;
        }

        if (
          mode === "tail" &&
          currentCandles !== null &&
          (next.status === "fresh" || next.status === "stale")
        ) {
          const merged = mergeChartCandles(
            currentCandles,
            resolvedCandles,
            LIVE_CHART_MAX_CANDLES,
          );
          next = { ...next, value: merged };
        }

        commitDatum(next);
        setInterval(requestedInterval);
        if (intervalChanged) {
          setEndOffset(0);
          setSelectedOpenedAt(null);
        }
        setRefreshIssue(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setRefreshIssue("实时 K 线刷新失败，正在保留上一次可用数据。");
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          inFlightRef.current = false;
          setIsRefreshing(false);
        }
      }
    },
    [asset, commitDatum],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refresh(interval, "tail");
      }
    }, LIVE_CHART_REFRESH_MILLISECONDS);
    const handleVisibility = () => {
      if (!document.hidden) {
        void refresh(interval, "full", true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      controllerRef.current?.abort();
    };
  }, [interval, refresh]);

  const candles = useMemo(() => publicChartCandles(datum), [datum]);
  const points = useMemo(() => {
    if (candles === null) {
      return [];
    }
    try {
      return buildLiveChartPoints(candles);
    } catch {
      return [];
    }
  }, [candles]);
  const safeEndOffset = Math.min(
    endOffset,
    Math.max(0, points.length - 1),
  );
  const endIndex = Math.max(0, points.length - safeEndOffset);
  const startIndex = Math.max(0, endIndex - viewCount);
  const visible = useMemo(
    () => points.slice(startIndex, endIndex),
    [endIndex, points, startIndex],
  );
  const geometry = useMemo(
    () => chartGeometry(visible, selectedEmaKeys),
    [selectedEmaKeys, visible],
  );
  const visibleSummary = useMemo(() => {
    try {
      return summarizeVisibleChart(visible);
    } catch {
      return null;
    }
  }, [visible]);
  const trendSummary = useMemo(() => {
    try {
      return summarizeLiveTrend(visible, selectedEmaKeys);
    } catch {
      return null;
    }
  }, [selectedEmaKeys, visible]);
  const latest = visible.at(-1) ?? null;
  const selected =
    visible.find((point) => point.openedAt === selectedOpenedAt) ?? latest;
  const selectedIndex = selected
    ? visible.findIndex((point) => point.openedAt === selected.openedAt)
    : -1;
  const presentation = presentMarketDatum(datum, (value) => ({
    primary: `${value.length} 根 ${chartIntervalLabels[interval]} K 线`,
  }));
  const hasEarlier = startIndex > 0;
  const hasLater = safeEndOffset > 0;
  const summary = chartSummary(assetLabel, visible, interval, hasLater);
  const baseAssetUnit = asset.toUpperCase();
  const activeEmaPreset = emaPresets.find((preset) =>
    sameEmaSelection(preset.keys, selectedEmaKeys),
  )?.id ?? null;

  const toggleEma = (key: LiveEmaKey) => {
    setSelectedEmaKeys((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : liveEmaKeys.filter(
            (candidate) => candidate === key || current.includes(candidate),
          ),
    );
  };

  useEffect(() => {
    if (safeEndOffset !== 0 || points.length === 0) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const viewport = chartViewportRef.current;
      if (viewport) {
        viewport.scrollLeft = Math.max(
          0,
          viewport.scrollWidth - viewport.clientWidth,
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [interval, points.length, safeEndOffset, viewCount]);

  useEffect(
    () => () => {
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
      }
    },
    [],
  );

  const inspectAtPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (geometry === null || visible.length === 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    const ratio =
      (chartX - PRICE_PLOT.left) /
      (CHART_WIDTH - PRICE_PLOT.left - PRICE_PLOT.right);
    const index = Math.max(
      0,
      Math.min(visible.length - 1, Math.floor(ratio * visible.length)),
    );
    pendingPointerOpenedAtRef.current = visible[index].openedAt;
    if (pointerFrameRef.current !== null) {
      return;
    }
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = null;
      setSelectedOpenedAt(pendingPointerOpenedAtRef.current);
    });
  };

  const clearPointerSelection = () => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pendingPointerOpenedAtRef.current = null;
    setSelectedOpenedAt(null);
  };

  const handleChartKey = (direction: -1 | 1) => {
    if (visible.length === 0) {
      return;
    }
    const current = selectedIndex < 0 ? visible.length - 1 : selectedIndex;
    const next = Math.max(0, Math.min(visible.length - 1, current + direction));
    const nextPoint = visible[next];
    setSelectedOpenedAt(nextPoint.openedAt);
    setKeyboardAnnouncement(
      `${formatChartTime(nextPoint.openedAt)}，窗口第 ${next + 1} / ${visible.length} 根，${nextPoint.state === "forming" ? "形成中" : "已闭合"}，${nextPoint.state === "forming" ? "最新" : "收盘"} ${formatChartPrice(nextPoint.close)} USDT。${keyboardEmaFacts(nextPoint, selectedEmaKeys)}`,
    );

    const viewport = chartViewportRef.current;
    const svg = viewport?.querySelector("svg");
    if (viewport && svg && geometry) {
      const targetX =
        (geometry.xForIndex(next) / CHART_WIDTH) * svg.clientWidth;
      const safePadding = Math.min(72, viewport.clientWidth * 0.2);
      if (targetX < viewport.scrollLeft + safePadding) {
        viewport.scrollLeft = Math.max(0, targetX - safePadding);
      } else if (
        targetX >
        viewport.scrollLeft + viewport.clientWidth - safePadding
      ) {
        viewport.scrollLeft = Math.min(
          viewport.scrollWidth - viewport.clientWidth,
          targetX - viewport.clientWidth + safePadding,
        );
      }
    }
  };

  return (
    <figure className="asset-chart" aria-labelledby={titleId}>
      <div className="asset-chart__toolbar">
        <div className="asset-chart__heading">
          <div className="asset-chart__title-row">
            <h2 id={titleId}>实时 K 线工作台</h2>
            <span className="asset-chart__live-badge">
              <i aria-hidden="true" />5 秒检查
            </span>
            {hasLater && (
              <span className="asset-chart__history-badge">历史浏览中</span>
            )}
          </div>
          <p>
            {candles?.at(-1)?.symbol ?? `${asset.toUpperCase()}USDT`} · {chartIntervalLabels[interval]} ·
            USDT · 已载入 {candles?.length ?? 0} 根
          </p>
        </div>

        <div className="asset-chart__controls">
          <div className="asset-chart__ranges" role="group" aria-label="选择 K 线周期">
            {chartIntervals.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={candidate === interval}
                disabled={isRefreshing && candidate !== interval}
                onClick={() => void refresh(candidate, "full", true)}
              >
                {candidate === "15m" ? "15 分" : candidate === "1h" ? "1 小时" : candidate === "4h" ? "4 小时" : "日线"}
              </button>
            ))}
          </div>
          <button
            className="asset-chart__refresh"
            type="button"
            disabled={isRefreshing}
            onClick={() => void refresh(interval, "full", true)}
          >
            {isRefreshing ? "刷新中…" : "立即刷新"}
          </button>
        </div>
      </div>

      <div className="asset-chart__subtoolbar">
        <div className="asset-chart__view-counts" role="group" aria-label="选择可见 K 线数量">
          <span>可见数量</span>
          {viewCounts.map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={count === viewCount}
              onClick={() => {
                setViewCount(count);
                setEndOffset(0);
                setSelectedOpenedAt(null);
                setKeyboardAnnouncement("");
              }}
            >
              {count === 1_000 ? "全部" : `${count} 根`}
            </button>
          ))}
        </div>
        <div className="asset-chart__navigation" role="group" aria-label="浏览更早或更新的 K 线">
          <button
            type="button"
            disabled={!hasEarlier}
            onClick={() => {
              setEndOffset((value) => Math.min(points.length - 1, value + Math.floor(viewCount / 2)));
              setSelectedOpenedAt(null);
              setKeyboardAnnouncement("");
            }}
          >
            ← 更早
          </button>
          <button
            type="button"
            disabled={!hasLater}
            onClick={() => {
              setEndOffset(0);
              setSelectedOpenedAt(null);
              setKeyboardAnnouncement("");
            }}
          >
            回到最新
          </button>
        </div>
      </div>

      <div className="asset-chart__indicator-toolbar">
        <div className="asset-chart__presets" role="group" aria-label="选择均线分析视角">
          <span>分析视角 <small>只切换 EMA，不改变 K 线周期</small></span>
          {emaPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activeEmaPreset === preset.id}
              onClick={() => setSelectedEmaKeys(preset.keys)}
            >
              <strong>{preset.label}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
          {activeEmaPreset === null && <em>自定义</em>}
        </div>
        <div className="asset-chart__indicator-toggles" role="group" aria-label="选择图表 EMA 指标">
          <span>图表指标</span>
          {liveEmaKeys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={selectedEmaKeys.includes(key)}
              onClick={() => toggleEma(key)}
            >
              <i className={`chart-key chart-key--${key}`} aria-hidden="true" />
              {liveEmaDefinitions[key].label}
            </button>
          ))}
        </div>
      </div>

      {refreshIssue && (
        <div className="asset-chart__refresh-issue" role="status">
          {refreshIssue}
        </div>
      )}

      {visible.length === 0 || geometry === null || selected === null || latest === null ? (
        <div className="asset-chart-empty" role="status">
          <strong>实时 K 线暂不可用</strong>
          <p>{presentation.note ?? "数据源当前没有返回可绘制的 K 线，页面不会用测试数据补齐。"}</p>
          <DatumStatus presentation={presentation} />
          <button type="button" onClick={() => void refresh(interval, "full", true)}>
            重新获取
          </button>
        </div>
      ) : (
        <>
          <ChartReadout
            point={selected}
            interval={interval}
            position={selectedIndex + 1}
            selectedKeys={selectedEmaKeys}
            total={visible.length}
            volumeUnit={baseAssetUnit}
          />
          <p className="sr-only" role="status" aria-live="polite">
            {keyboardAnnouncement}
          </p>

          <div className="asset-chart__visual-workspace">
            <div className="asset-chart__plot-area">
              <div className="asset-chart__legend" aria-label="图表图例">
                <span><i className="chart-key chart-key--candle" />K 线</span>
                <span><i className="chart-key chart-key--forming" />形成中</span>
                {selectedEmaKeys.map((key) => (
                  <span key={key}>
                    <i className={`chart-key chart-key--${key}`} />
                    {liveEmaDefinitions[key].label}（当前周期）
                  </span>
                ))}
                <span><i className="chart-key chart-key--volume" />成交量（{baseAssetUnit}）</span>
              </div>

              <div
                ref={chartViewportRef}
                className="asset-chart__viewport"
                role="region"
                tabIndex={0}
                aria-label={`${assetLabel} K 线图；左右方向键可逐根查看`}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    handleChartKey(event.key === "ArrowLeft" ? -1 : 1);
                  }
                }}
              >
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  role="img"
                  aria-labelledby={`${titleId} ${descriptionId}`}
                  preserveAspectRatio="none"
                  onPointerMove={inspectAtPointer}
                  onPointerLeave={clearPointerSelection}
                >
                  <title>{`${assetLabel} ${chartIntervalLabels[interval]} K 线、${selectedEmaKeys.length > 0 ? selectedEmaKeys.map((key) => liveEmaDefinitions[key].label).join("、") : "未选择 EMA"}与成交量`}</title>
                  <desc id={descriptionId}>{summary}</desc>
                  <rect
                className="asset-chart__plot"
                x={PRICE_PLOT.left}
                y={PRICE_PLOT.top}
                width={geometry.plotWidth}
                height={geometry.pricePlotHeight}
              />
              <rect
                className="asset-chart__volume-plot"
                x={PRICE_PLOT.left}
                y={VOLUME_PLOT.top}
                width={geometry.plotWidth}
                height={geometry.volumePlotHeight}
              />
              {geometry.yTicks.map((tick) => (
                <g key={tick.value}>
                  <line
                    className="asset-chart__grid"
                    x1={PRICE_PLOT.left}
                    x2={PRICE_PLOT.left + geometry.plotWidth}
                    y1={tick.y}
                    y2={tick.y}
                  />
                  <text
                    className="asset-chart__axis-label asset-chart__axis-label--y"
                    x={PRICE_PLOT.left - 12}
                    y={tick.y + 4}
                    textAnchor="end"
                  >
                    {compactAxisPrice(tick.value)}
                  </text>
                </g>
              ))}
              <text className="asset-chart__volume-label" x={PRICE_PLOT.left} y={VOLUME_PLOT.top - 10}>
                成交量（{baseAssetUnit}）
              </text>
              {geometry.xTicks.map((tick) => (
                <text
                  className="asset-chart__axis-label"
                  key={`${tick.label}-${tick.x}`}
                  x={tick.x}
                  y={CHART_HEIGHT - 16}
                  textAnchor={tick.anchor}
                >
                  {tick.label}
                </text>
              ))}
              <ChartSeries geometry={geometry} selectedKeys={selectedEmaKeys} />
              <line
                className="asset-chart__last-price-line"
                x1={PRICE_PLOT.left}
                x2={PRICE_PLOT.left + geometry.plotWidth}
                y1={geometry.latestPriceY}
                y2={geometry.latestPriceY}
              />
              <rect
                className="asset-chart__last-price-label"
                x={PRICE_PLOT.left + geometry.plotWidth + 4}
                y={geometry.latestPriceY - 11}
                width={PRICE_PLOT.right - 8}
                height={22}
                rx="3"
              />
              <text
                className="asset-chart__last-price-text"
                x={CHART_WIDTH - 6}
                y={geometry.latestPriceY + 4}
                textAnchor="end"
              >
                {compactLatestPrice(latest.close)}
              </text>
                  {selectedIndex >= 0 && (
                    <line
                  className="asset-chart__crosshair"
                  x1={geometry.xForIndex(selectedIndex)}
                  x2={geometry.xForIndex(selectedIndex)}
                  y1={PRICE_PLOT.top}
                  y2={VOLUME_PLOT.bottom}
                    />
                  )}
                </svg>
              </div>
            </div>

            <LiveTrendPanel
              historicalWindow={hasLater}
              interval={interval}
              selectedKeys={selectedEmaKeys}
              summary={trendSummary}
              symbol={latest.symbol}
            />
          </div>

          {visibleSummary && (
            <VisibleWindowFacts
              id={factsId}
              interval={interval}
              pointCount={visible.length}
              summary={visibleSummary}
              volumeUnit={baseAssetUnit}
              latestIsForming={latest.state === "forming"}
            />
          )}

          <p className="asset-chart__summary">
            {summary}
          </p>

          <details className="asset-chart__data">
            <summary>
              {hasLater
                ? "查看当前历史窗口末端 20 根 K 线数据"
                : "查看最近 20 根 K 线数据"}
            </summary>
            <div
              className="asset-chart__table-scroll"
              role="region"
              tabIndex={0}
              aria-label={`${assetLabel}${hasLater ? "当前历史窗口末端" : "最近"} K 线数据表，可横向滚动`}
            >
              <table>
                <caption className="sr-only">
                  {assetLabel}
                  {hasLater ? "当前历史窗口末端二十根" : "最近二十根"} K 线数据
                </caption>
                <thead>
                  <tr>
                    <th scope="col">时间（UTC）</th>
                    <th scope="col">状态</th>
                    <th scope="col">开盘</th>
                    <th scope="col">最高</th>
                    <th scope="col">最低</th>
                    <th scope="col">收盘 / 最新</th>
                    <th scope="col">成交量（{baseAssetUnit}）</th>
                    {selectedEmaKeys.map((key) => (
                      <th key={key} scope="col">{liveEmaDefinitions[key].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(-20).reverse().map((point) => (
                    <tr key={point.openedAt}>
                      <th scope="row">{formatChartTime(point.openedAt)}</th>
                      <td>{point.state === "forming" ? "形成中" : "已闭合"}</td>
                      <td>{formatChartPrice(point.open)}</td>
                      <td>{formatChartPrice(point.high)}</td>
                      <td>{formatChartPrice(point.low)}</td>
                      <td>{formatChartPrice(point.close)}</td>
                      <td>{formatVolume(point.volume)}</td>
                      {selectedEmaKeys.map((key) => (
                        <td key={key}>{formatChartPrice(point[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <footer className="asset-chart__meta">
        <div className="asset-chart__meta-status">
          <DatumStatus presentation={presentation} compact />
          <span>{isRefreshing ? "正在获取最新 K 线" : `每 ${LIVE_CHART_REFRESH_MILLISECONDS / 1_000} 秒检查更新`}</span>
          <span>图内 EMA 与相对位置按当前周期计算；形成中 K 线不进入分析结论</span>
        </div>
        <DatumMeta presentation={presentation} />
      </footer>
    </figure>
  );
}

const LiveTrendPanel = memo(function LiveTrendPanel({
  historicalWindow,
  interval,
  selectedKeys,
  summary,
  symbol,
}: {
  historicalWindow: boolean;
  interval: ChartCandleInterval;
  selectedKeys: readonly LiveEmaKey[];
  summary: LiveTrendSummary | null;
  symbol: string;
}) {
  const scopeLabel = historicalWindow ? "历史窗口末端" : "当前窗口";
  const latestClosed = summary?.point ?? null;

  return (
    <section
      className="asset-chart__trend-analysis"
      aria-label="当前图表周期 EMA 相对位置分析"
    >
      <header>
        <div>
          <p>当前周期分析</p>
          <h3>先看价格与均线的位置</h3>
        </div>
        <span>
          {symbol} · {chartIntervalLabels[interval]} · {scopeLabel} · 最新已闭合 K 线
        </span>
      </header>

      {selectedKeys.length === 0 ? (
        <div className="asset-chart__trend-empty">
          <strong>当前没有选择 EMA</strong>
          <p>可从上方选择短线或趋势视角，也可以逐条打开 EMA10 / 20 / 50 / 200。</p>
        </div>
      ) : summary === null || latestClosed === null ? (
        <div className="asset-chart__trend-empty">
          <strong>当前窗口没有可分析的已闭合 K 线</strong>
          <p>形成中的 K 线只在图上动态展示，不会被当作已完成的技术事实。</p>
        </div>
      ) : (
        <div className="asset-chart__trend-body">
          <div className="asset-chart__trend-lead">
            <span>截至 {formatChartTime(latestClosed.closedAt)}</span>
            <strong>{trendPositionHeadline(summary)}</strong>
            <p>{trendOrderingLabel(summary.ordering)}</p>
            <dl>
              <div>
                <dt>已闭合收盘</dt>
                <dd>{formatChartPrice(latestClosed.close)} USDT</dd>
              </div>
              <div>
                <dt>近 3 根累计</dt>
                <dd>{summary.recentThreeChangePercent === null ? "样本不足" : formatSignedPercent(summary.recentThreeChangePercent)}</dd>
              </div>
            </dl>
          </div>

          <dl className="asset-chart__ema-comparisons">
            {summary.comparisons.map((comparison) => (
              <div key={comparison.key}>
                <dt>
                  <i className={`chart-key chart-key--${comparison.key}`} aria-hidden="true" />
                  {liveEmaDefinitions[comparison.key].label}
                </dt>
                <dd>
                  <strong>{formatChartPrice(comparison.value)}</strong>
                  <span>{emaRelationLabel(comparison)}</span>
                  <small>{emaSlopeLabel(comparison)}</small>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <footer>
        以上只比较当前周期最新已闭合 K 线与所选 EMA；图上形成中 K 线会继续变化。机械指标事实不代表价格将延续，也不构成买卖建议。
      </footer>
    </section>
  );
});

function ChartReadout({
  point,
  interval,
  position,
  selectedKeys,
  total,
  volumeUnit,
}: {
  point: LiveChartPoint;
  interval: ChartCandleInterval;
  position: number;
  selectedKeys: readonly LiveEmaKey[];
  total: number;
  volumeUnit: string;
}) {
  const changePercent = ((point.close - point.open) / point.open) * 100;
  return (
    <div className="asset-chart__readout">
      <div className="asset-chart__readout-time">
        <strong>{formatChartTime(point.openedAt)}</strong>
        <span>{chartIntervalLabels[interval]}</span>
        <span>窗口第 {position} / {total} 根</span>
        <span className={point.state === "forming" ? "is-forming" : ""}>
          {point.state === "forming" ? "当前形成中" : "已闭合"}
        </span>
      </div>
      <dl style={{ gridTemplateColumns: `repeat(${6 + selectedKeys.length}, minmax(4.5rem, 1fr))` }}>
        <div><dt>开</dt><dd>{formatChartPrice(point.open)}</dd></div>
        <div><dt>高</dt><dd>{formatChartPrice(point.high)}</dd></div>
        <div><dt>低</dt><dd>{formatChartPrice(point.low)}</dd></div>
        <div><dt>{point.state === "forming" ? "最新" : "收"}</dt><dd>{formatChartPrice(point.close)}</dd></div>
        <div><dt>涨跌</dt><dd className={changePercent > 0 ? "is-positive" : changePercent < 0 ? "is-negative" : ""}>{formatSignedPercent(changePercent)}</dd></div>
        <div><dt>量（{volumeUnit}）</dt><dd>{formatVolume(point.volume)}</dd></div>
        {selectedKeys.map((key) => (
          <div key={key}>
            <dt>{liveEmaDefinitions[key].label}</dt>
            <dd>{formatChartPrice(point[key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const VisibleWindowFacts = memo(function VisibleWindowFacts({
  id,
  interval,
  latestIsForming,
  pointCount,
  summary,
  volumeUnit,
}: {
  id: string;
  interval: ChartCandleInterval;
  latestIsForming: boolean;
  pointCount: number;
  summary: VisibleChartSummary;
  volumeUnit: string;
}) {
  const rangePosition =
    summary.latestCloseRangePercentile === null
      ? "区间无价差"
      : `${summary.latestCloseRangePercentile.toFixed(1)}%`;
  const formingComparison = summary.formingVolumeComparison;

  return (
    <section className="asset-chart__window-facts" aria-labelledby={id}>
      <header>
        <div>
          <p>可见窗口</p>
          <h3 id={id}>可见区间事实</h3>
        </div>
        <span>
          {pointCount} 根 · {chartIntervalLabels[interval]}
          {latestIsForming ? " · 含形成中 K 线" : " · 全部已闭合"}
        </span>
      </header>
      <dl>
        <div>
          <dt>区间涨跌</dt>
          <dd>
            <span className={`asset-chart__fact-value ${summary.openToCloseChangePercent > 0 ? "is-positive" : summary.openToCloseChangePercent < 0 ? "is-negative" : ""}`}>
              {formatSignedPercent(summary.openToCloseChangePercent)}
            </span>
            <small>首根开盘 → 末根收盘 / 最新</small>
          </dd>
        </div>
        <div>
          <dt>区间最高</dt>
          <dd>
            <span className="asset-chart__fact-value">{formatChartPrice(summary.highestPrice)}</span>
            <small>USDT</small>
          </dd>
        </div>
        <div>
          <dt>区间最低</dt>
          <dd>
            <span className="asset-chart__fact-value">{formatChartPrice(summary.lowestPrice)}</span>
            <small>USDT</small>
          </dd>
        </div>
        <div>
          <dt>区间振幅</dt>
          <dd>
            <span className="asset-chart__fact-value">{summary.amplitudePercent.toFixed(2)}%</span>
            <small>（最高 − 最低）÷ 首根开盘</small>
          </dd>
        </div>
        <div>
          <dt>末值区间位置</dt>
          <dd>
            <span className="asset-chart__fact-value">{rangePosition}</span>
            <small>最低为 0%，最高为 100%</small>
          </dd>
        </div>
        <div>
          <dt>区间总成交量</dt>
          <dd>
            <span className="asset-chart__fact-value">{formatVolume(summary.totalVolume)}</span>
            <small>{volumeUnit} 基础资产成交量</small>
          </dd>
        </div>
      </dl>
      <footer>
        <p>
          以上均为所选可见窗口的机械统计，不构成支撑位、阻力位或投资判断。
          {latestIsForming && " 窗口末端包含形成中 K 线，价格、振幅及成交量等相关数值会继续变化。"}
        </p>
        {formingComparison && (
          <p className="asset-chart__forming-volume">
            当前形成中成交量 {formatVolume(formingComparison.formingVolume)} {volumeUnit}；
            {formingComparison.ratioToAverage === null
              ? "前 20 根已闭合 K 线平均量为 0，暂不计算倍数。"
              : `约为前 20 根已闭合 K 线平均量的 ${formingComparison.ratioToAverage.toFixed(2)} 倍；当前周期尚未闭合，不可与完整周期直接等同。`}
          </p>
        )}
      </footer>
    </section>
  );
});

type ChartGeometry = {
  plotWidth: number;
  pricePlotHeight: number;
  volumePlotHeight: number;
  candles: readonly {
    openedAt: string;
    state: ChartCandle["state"];
    x: number;
    highY: number;
    lowY: number;
    bodyY: number;
    bodyHeight: number;
    bodyWidth: number;
    direction: "up" | "down" | "flat";
  }[];
  volumeBars: readonly {
    openedAt: string;
    state: ChartCandle["state"];
    x: number;
    y: number;
    height: number;
    width: number;
    direction: "up" | "down" | "flat";
  }[];
  emaPaths: Readonly<Partial<Record<LiveEmaKey, string | null>>>;
  latestPriceY: number;
  yTicks: readonly { value: number; y: number }[];
  xTicks: readonly { x: number; label: string; anchor: "start" | "middle" | "end" }[];
  xForIndex: (index: number) => number;
};

const ChartSeries = memo(function ChartSeries({
  geometry,
  selectedKeys,
}: {
  geometry: ChartGeometry;
  selectedKeys: readonly LiveEmaKey[];
}) {
  return (
    <>
      <g aria-hidden="true">
        {geometry.candles.map((candle) => (
          <g
            className={`asset-chart__candle asset-chart__candle--${candle.direction}${candle.state === "forming" ? " asset-chart__candle--forming" : ""}`}
            key={candle.openedAt}
          >
            <line
              x1={candle.x}
              x2={candle.x}
              y1={candle.highY}
              y2={candle.lowY}
            />
            <rect
              x={candle.x - candle.bodyWidth / 2}
              y={candle.bodyY}
              width={candle.bodyWidth}
              height={candle.bodyHeight}
              rx="0.55"
            />
          </g>
        ))}
        {geometry.volumeBars.map((bar) => (
          <rect
            className={`asset-chart__volume-bar asset-chart__volume-bar--${bar.direction}${bar.state === "forming" ? " asset-chart__volume-bar--forming" : ""}`}
            key={bar.openedAt}
            x={bar.x - bar.width / 2}
            y={bar.y}
            width={bar.width}
            height={bar.height}
          />
        ))}
      </g>
      {selectedKeys.map((key) => {
        const path = geometry.emaPaths[key];
        return path ? (
          <path
            className={`asset-chart__line asset-chart__line--${key}`}
            d={path}
            key={key}
          />
        ) : null;
      })}
    </>
  );
});

function chartGeometry(
  points: readonly LiveChartPoint[],
  selectedKeys: readonly LiveEmaKey[],
): ChartGeometry | null {
  const values = points.flatMap((point) => [
    point.low,
    point.high,
    ...selectedKeys.flatMap((key) =>
      point[key] === null ? [] : [point[key]],
    ),
  ]);
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin;
  const padding = spread > 0 ? spread * 0.055 : Math.max(rawMax * 0.02, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const plotWidth = CHART_WIDTH - PRICE_PLOT.left - PRICE_PLOT.right;
  const pricePlotHeight = PRICE_PLOT.bottom - PRICE_PLOT.top;
  const volumePlotHeight = VOLUME_PLOT.bottom - VOLUME_PLOT.top;
  const xStep = plotWidth / points.length;
  const bodyWidth = Math.max(0.8, Math.min(7, xStep * 0.68));
  const xForIndex = (index: number) => PRICE_PLOT.left + xStep * (index + 0.5);
  const yFor = (value: number) => PRICE_PLOT.top + ((max - value) / (max - min)) * pricePlotHeight;
  const directionFor = (point: LiveChartPoint) =>
    point.close > point.open ? "up" as const : point.close < point.open ? "down" as const : "flat" as const;

  const candles = points.map((point, index) => {
    const openY = yFor(point.open);
    const closeY = yFor(point.close);
    return {
      openedAt: point.openedAt,
      state: point.state,
      x: xForIndex(index),
      highY: yFor(point.high),
      lowY: yFor(point.low),
      bodyY: Math.min(openY, closeY),
      bodyHeight: Math.max(1.35, Math.abs(openY - closeY)),
      bodyWidth,
      direction: directionFor(point),
    };
  });
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const volumeBars = points.map((point, index) => {
    const height = Math.max(1, (point.volume / maxVolume) * volumePlotHeight);
    return {
      openedAt: point.openedAt,
      state: point.state,
      x: xForIndex(index),
      y: VOLUME_PLOT.bottom - height,
      height,
      width: bodyWidth,
      direction: directionFor(point),
    };
  });
  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return {
      value: max - (max - min) * ratio,
      y: PRICE_PLOT.top + pricePlotHeight * ratio,
    };
  });
  const tickIndexes = Array.from(new Set(
    Array.from({ length: 6 }, (_, index) =>
      Math.round(((points.length - 1) * index) / 5),
    ),
  ));
  const xTicks = tickIndexes.map((index, tickIndex) => ({
    x: xForIndex(index),
    label: formatAxisDate(points[index].openedAt, points[index].interval),
    anchor: tickIndex === 0 ? "start" as const : tickIndex === tickIndexes.length - 1 ? "end" as const : "middle" as const,
  }));

  return {
    plotWidth,
    pricePlotHeight,
    volumePlotHeight,
    candles,
    volumeBars,
    emaPaths: Object.fromEntries(
      selectedKeys.map((key) => [
        key,
        seriesPath(points, xForIndex, yFor, key),
      ]),
    ),
    latestPriceY: yFor(points.at(-1)!.close),
    yTicks,
    xTicks,
    xForIndex,
  };
}

function seriesPath(
  points: readonly LiveChartPoint[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
  key: LiveEmaKey,
): string | null {
  const commands: string[] = [];
  let drawing = false;
  points.forEach((point, index) => {
    const value = point[key];
    if (value === null || !Number.isFinite(value)) {
      drawing = false;
      return;
    }
    commands.push(`${drawing ? "L" : "M"}${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`);
    drawing = true;
  });
  return commands.length > 0 ? commands.join(" ") : null;
}

async function fetchChartDatum(
  asset: Asset,
  interval: ChartCandleInterval,
  mode: ChartRequestMode,
  signal: AbortSignal,
): Promise<MarketDatum<readonly ChartCandle[]>> {
  const params = new URLSearchParams({ asset, interval, mode });
  const response = await fetch(`/api/market/candles?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Chart request failed with ${response.status}.`);
  }
  return parseChartDatum(await response.json(), asset, interval);
}

function parseChartDatum(
  value: unknown,
  asset: Asset,
  interval: ChartCandleInterval,
): MarketDatum<readonly ChartCandle[]> {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Invalid chart response.");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.status === "fresh" || candidate.status === "stale") {
    if (!Array.isArray(candidate.value)) {
      throw new TypeError("Invalid chart response value.");
    }
    const candles = candidate.value as readonly ChartCandle[];
    assertChartSeries(candles);
    const expectedSymbol = `${asset.toUpperCase()}USDT`;
    if (
      candles.some(
        (candle) =>
          candle.asset !== asset ||
          candle.symbol !== expectedSymbol ||
          candle.interval !== interval ||
          candle.quoteCurrency !== "USDT",
      )
    ) {
      throw new TypeError("Chart response scope does not match the request.");
    }
    return value as MarketDatum<readonly ChartCandle[]>;
  }
  if (candidate.status === "error" || candidate.status === "unavailable") {
    return value as MarketDatum<readonly ChartCandle[]>;
  }
  throw new TypeError("Invalid chart response status.");
}

function publicChartCandles(
  datum: MarketDatum<readonly ChartCandle[]>,
): readonly ChartCandle[] | null {
  return (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic"
    ? datum.value
    : null;
}

function refreshFailureLabel(
  datum: MarketDatum<readonly ChartCandle[]>,
): string {
  if (datum.status === "error") {
    const labels = {
      timeout: "Binance K 线响应超时，正在保留上一次可用数据。",
      rate_limited: "Binance 暂时限制请求，正在保留上一次可用数据。",
      upstream_error: "Binance K 线暂时异常，正在保留上一次可用数据。",
      invalid_payload: "K 线数据未通过校验，正在保留上一次可用数据。",
      no_data: "Binance 暂未返回 K 线，正在保留上一次可用数据。",
    } as const;
    return labels[datum.error.code];
  }
  return "实时 K 线暂不可用，正在保留上一次可用数据。";
}

function chartSummary(
  assetLabel: string,
  points: readonly LiveChartPoint[],
  interval: ChartCandleInterval,
  historicalWindow: boolean,
): string {
  const first = points[0];
  const latest = points.at(-1);
  if (!first || !latest) {
    return `${assetLabel}图表暂无可用 K 线。`;
  }
  const scopeLabel = historicalWindow ? "所选历史窗口" : "当前窗口";
  const priceLabel = historicalWindow ? "窗口末端价格" : "最新价格";
  const candleLabel = historicalWindow ? "窗口末端 K 线" : "最新一根";
  return `${assetLabel}${scopeLabel}显示 ${points.length} 根 ${chartIntervalLabels[interval]} K 线，从 ${formatChartTime(first.openedAt)} 到 ${formatChartTime(latest.openedAt)}；${priceLabel} ${formatChartPrice(latest.close)} USDT，${candleLabel}${latest.state === "forming" ? "仍在形成中" : "已经闭合"}。`;
}

function sameEmaSelection(
  left: readonly LiveEmaKey[],
  right: readonly LiveEmaKey[],
): boolean {
  return (
    left.length === right.length &&
    left.every((key, index) => key === right[index])
  );
}

function trendPositionHeadline(summary: LiveTrendSummary): string {
  const above = summary.comparisons.filter(
    (comparison) => comparison.relation === "above",
  );
  const below = summary.comparisons.filter(
    (comparison) => comparison.relation === "below",
  );
  const equal = summary.comparisons.filter(
    (comparison) => comparison.relation === "equal",
  );
  const unavailable = summary.comparisons.filter(
    (comparison) => comparison.relation === "unavailable",
  );
  const availableCount = summary.comparisons.length - unavailable.length;

  if (availableCount === 0) {
    return `所选 EMA 样本尚未完整，最长周期至少需要 ${Math.max(...summary.comparisons.map((comparison) => liveEmaDefinitions[comparison.key].period))} 根 K 线`;
  }
  if (
    unavailable.length === 0 &&
    above.length === availableCount &&
    equal.length === 0
  ) {
    return `已闭合收盘位于 ${emaLabelList(above)} 上方`;
  }
  if (
    unavailable.length === 0 &&
    below.length === availableCount &&
    equal.length === 0
  ) {
    return `已闭合收盘位于 ${emaLabelList(below)} 下方`;
  }

  const facts = [
    above.length > 0 ? `高于 ${emaLabelList(above)}` : null,
    below.length > 0 ? `低于 ${emaLabelList(below)}` : null,
    equal.length > 0 ? `等于 ${emaLabelList(equal)}` : null,
    unavailable.length > 0 ? `${emaLabelList(unavailable)} 样本不足` : null,
  ].filter((part): part is string => part !== null).join("；");
  return `已闭合收盘${facts}`;
}

function emaLabelList(
  comparisons: readonly LiveTrendSummary["comparisons"][number][],
): string {
  return comparisons
    .map((comparison) => liveEmaDefinitions[comparison.key].label)
    .join("、");
}

function trendOrderingLabel(
  ordering: LiveTrendSummary["ordering"],
): string {
  if (ordering === null) {
    return "均线排列暂不可比较：至少选择两条且都需要足够样本。";
  }
  const description = {
    short_above_long: "短周期均线依次高于长周期均线",
    short_below_long: "短周期均线依次低于长周期均线",
    mixed: "均线顺序交错",
  }[ordering.state];
  return `均线排列：${ordering.expression}；${description}。`;
}

function emaRelationLabel(
  comparison: LiveTrendSummary["comparisons"][number],
): string {
  if (comparison.relation === "unavailable" || comparison.distancePercent === null) {
    return `至少需要 ${liveEmaDefinitions[comparison.key].period} 根 K 线`;
  }
  if (comparison.relation === "equal") {
    return "收盘与该线相等";
  }
  return `收盘${comparison.relation === "above" ? "高于" : "低于"}该线 ${Math.abs(comparison.distancePercent).toFixed(2)}%`;
}

function emaSlopeLabel(
  comparison: LiveTrendSummary["comparisons"][number],
): string {
  if (comparison.slope === null) {
    return "近 3 根斜率样本不足";
  }
  const direction = {
    rising: "向上",
    falling: "向下",
    flat: "走平",
  }[comparison.slope.direction];
  return `近 3 根已闭合 K 线：${direction} ${Math.abs(comparison.slope.changePercent).toFixed(2)}%`;
}

function keyboardEmaFacts(
  point: LiveChartPoint,
  selectedKeys: readonly LiveEmaKey[],
): string {
  if (selectedKeys.length === 0) {
    return "当前未选择 EMA。";
  }
  return selectedKeys.map((key) => {
    const label = liveEmaDefinitions[key].label;
    const value = point[key];
    if (value === null) {
      return `${label} 样本不足`;
    }
    const relation =
      point.close > value
        ? "价格在其上方"
        : point.close < value
          ? "价格在其下方"
          : "价格与其相等";
    return `${label} ${formatChartPrice(value)}，${relation}`;
  }).join("；") + "。";
}

function formatChartPrice(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}

function compactAxisPrice(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function compactLatestPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1_000 ? 0 : 2,
  }).format(value);
}

function formatVolume(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatChartTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function formatAxisDate(value: string, interval: ChartCandleInterval): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  const iso = date.toISOString();
  return interval === "1d" ? iso.slice(0, 10) : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}
