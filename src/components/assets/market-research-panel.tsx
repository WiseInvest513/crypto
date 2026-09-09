import Link from "next/link";
import type { ReactNode } from "react";
import type { LiveChartPoint, ChartCandleInterval, MarketDatum } from "@/lib/market/live-chart";
import type { PublicResearchSnapshot } from "@/lib/market/public-research";
import type { ComputedKeyLevel } from "@/lib/market/key-levels";
import type { HistoricalContextAnalysis, HistoricalContextCase, HistoricalContextCurrent, HistoricalContextHorizon } from "@/lib/market/historical-context";
import { HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES } from "@/lib/market/historical-context";
import type { LongTermHistoryAnalysis, MarketCycleAnalysis } from "@/lib/market/long-term-history";
import { analysisModes, changeTone, emaColors, fibonacciOverlays, formatChange, formatPrice, formatUpdate, keyLevelBasis, keyLevelsContainingPrice, nearestKeyLevels, periodLabels, summarizeCurrentPosition, summarizeModeOrdering, type AnalysisMode } from "@/lib/market/workbench-presentation";
import { liveEmaDefinitions } from "@/lib/market/live-chart";
import { buildPublicStrategyEvidence } from "@/lib/strategy/public-strategy-observations";

export function availableResearch<T>(datum: MarketDatum<T> | undefined): T | null {
  return datum && (datum.status === "fresh" || datum.status === "stale") && datum.provenance !== "synthetic" ? datum.value : null;
}

function KeyLevelRow({ level, name, rank, price, selectedLevel, expanded = false, groupStart = false, onSelectLevel }: {
  level: ComputedKeyLevel;
  name: "压力" | "支撑" | "现价附近";
  rank?: number;
  price: number;
  selectedLevel: string | null;
  expanded?: boolean;
  groupStart?: boolean;
  onSelectLevel: (id: string) => void;
}) {
  const label = rank ? `${name} ${rank}` : name;
  const basis = keyLevelBasis(level);
  const range = formatLevelRange(level);
  return <button type="button" className={`mw-level-row${groupStart ? " mw-level-row--group-start" : ""}${selectedLevel === level.id ? " is-selected" : ""}`} onClick={() => onSelectLevel(level.id)} aria-pressed={selectedLevel === level.id} aria-label={`在图表定位${name}${rank ?? ""} ${formatPrice(level.price)}`} title={`${basis}；区域 ${range} USDT`}>
    <span className="mw-level-name"><span className={`mw-${name === "支撑" ? "up" : name === "压力" ? "down" : "neutral"}`}><i />{label}</span><small className="mw-level-basis">{keyLevelBasis(level, !expanded)}</small>{expanded && <small className="mw-level-range">{range}</small>}</span>
    <strong>≈ {formatPrice(level.price)}</strong><small>{formatChange((level.price / price - 1) * 100)}</small>
  </button>;
}

function formatLevelRange(level: ComputedKeyLevel): string {
  return level.lower === level.upper
    ? formatPrice(level.price)
    : `${formatPrice(level.lower)} — ${formatPrice(level.upper)}`;
}

function formatHistoryDate(value: string): string {
  return value.slice(0, 10);
}

function formatHistoryRate(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatHistoryCoverageYears(from: string, to: string): string {
  const fromYear = new Date(from).getUTCFullYear();
  const toYear = new Date(to).getUTCFullYear();
  return fromYear === toYear ? String(fromYear) : `${fromYear}—${toYear}`;
}

function formatHistoryHorizonDuration(interval: ChartCandleInterval, bars: HistoricalContextHorizon): string {
  if (interval === "1h") return bars === 24 ? "约 1 天" : `约 ${bars} 小时`;
  if (interval === "4h") return `约 ${bars / 6} 天`;
  if (interval === "1d") return `约 ${bars} 天`;
  return `${bars} 根`;
}

function summarizeHistoryState(current: HistoricalContextCurrent): string {
  const groups = (["above", "below", "equal"] as const).map((relation) => ({
    relation,
    labels: (["ema10", "ema20", "ema50"] as const)
      .filter((key) => current.priceRelations[key] === relation)
      .map((key) => key.toUpperCase()),
  })).filter((group) => group.labels.length > 0);
  const relationCopy = { above: "上方", below: "下方", equal: "线上" } as const;
  return groups.map((group) => `价格位于 ${group.labels.join("、")} ${relationCopy[group.relation]}`).join("；");
}

function representativeLabel(value: HistoricalContextCase["representativeOf"]): string {
  return value === "q25" ? "相对偏弱样本" : value === "q75" ? "相对偏强样本" : "中位样本";
}

function regimeCopy(regime: LongTermHistoryAnalysis["current"]["regime"]): Readonly<{ label: string; detail: string }> {
  if (regime === "bull") return { label: "牛市结构", detail: "日线收盘与 EMA50 均位于 EMA200 上方" };
  if (regime === "bear") return { label: "熊市结构", detail: "日线收盘与 EMA50 均位于 EMA200 下方" };
  return { label: "过渡结构", detail: "日线收盘与 EMA50 尚未同时位于 EMA200 同一侧" };
}

function formatCycleDrawdown(value: number): string {
  return value === 0 ? "0%" : `−${formatHistoryRate(value)}`;
}

function describeCycleDuration(analysis: MarketCycleAnalysis): string {
  const distribution = analysis.distributions[analysis.current.regime];
  const { q25, median, q75 } = distribution.durationDays;
  if (distribution.sampleCount === 0 || q25 === null || median === null || q75 === null) {
    return "历史完整同类阶段不足，暂不比较持续时间";
  }
  const position = analysis.current.durationDays < q25
    ? "低于历史中间区间"
    : analysis.current.durationDays > q75
      ? "超过历史中间区间上沿"
      : "位于历史中间区间";
  return `历史 ${distribution.sampleCount} 个完整同类阶段持续中位 ${Math.round(median)} 天，中间一半为 ${Math.round(q25)}—${Math.round(q75)} 天；本轮${position}`;
}

function describeCycleReturn(analysis: MarketCycleAnalysis): string | null {
  const distribution = analysis.distributions[analysis.current.regime].returnPercent;
  const { q25, median, q75 } = distribution;
  if (q25 === null || median === null || q75 === null) return null;
  const position = analysis.current.returnPercent < q25
    ? "低于历史中间区间"
    : analysis.current.returnPercent > q75
      ? "超过历史中间区间上沿"
      : "位于历史中间区间";
  return `阶段收盘变化历史中位 ${formatChange(median)}，中间一半为 ${formatChange(q25)} 至 ${formatChange(q75)}；本轮${position}`;
}

function describeCycleDrawdown(analysis: MarketCycleAnalysis): string | null {
  const distribution = analysis.distributions[analysis.current.regime].maxDrawdownPercent;
  const { q25, median, q75 } = distribution;
  if (q25 === null || median === null || q75 === null) return null;
  const position = analysis.current.maxDrawdownPercent < q25
    ? "低于历史中间区间"
    : analysis.current.maxDrawdownPercent > q75
      ? "超过历史中间区间上沿"
      : "位于历史中间区间";
  return `最大收盘回撤幅度历史中位 ${formatHistoryRate(median)}，中间一半为 ${formatHistoryRate(q25)} 至 ${formatHistoryRate(q75)}；本轮${position}`;
}

function CycleTimelineItems({ episodes }: { episodes: MarketCycleAnalysis["timeline"] }) {
  return <>{episodes.map((episode) => {
    const regime = regimeCopy(episode.regime);
    const current = episode.endedBy === "coverage_end";
    return <li className={`mw-cycle-item mw-cycle-item--${episode.regime}`} key={`${episode.regime}-${episode.startedAt}`}>
      <i aria-hidden="true" />
      <div>
        <p><strong>{regime.label}</strong>{current && <span>当前</span>}</p>
        <time dateTime={episode.startedAt}>{formatHistoryDate(episode.startedAt)}</time><b aria-hidden="true">—</b><time dateTime={episode.endedAt}>{current ? "至今" : formatHistoryDate(episode.endedAt)}</time>
      </div>
      <p><strong>{episode.closedDailyCandleCount} 日</strong><span className={`mw-${changeTone(episode.returnPercent)}`}>{formatChange(episode.returnPercent)}</span></p>
    </li>;
  })}</>;
}

function CycleTermGuide() {
  return <details className="mw-cycle-terms">
    <summary><span>这些词是什么意思？</span><small>简明说明</small></summary>
    <div className="mw-cycle-terms-body">
      <section>
        <h4>结构怎么分</h4>
        <p>EMA 是更重视近期收盘价的移动平均线；这里的周期规则只比较日线收盘、EMA50 与 EMA200。</p>
        <ul>
          <li><strong>牛市结构</strong><span>已闭合日线收盘与 EMA50 都高于 EMA200。</span></li>
          <li><strong>熊市结构</strong><span>已闭合日线收盘与 EMA50 都低于 EMA200。</span></li>
          <li><strong>过渡结构</strong><span>不满足上面两种完整排列，收盘与 EMA50 没有同时位于 EMA200 同一侧。</span></li>
        </ul>
      </section>
      <section>
        <h4>数字怎么看</h4>
        <ul>
          <li><strong>阶段收盘变化</strong><span>从本阶段第一根到最新一根已闭合日线，收盘价一共变化了多少。</span></li>
          <li><strong>最高收盘涨幅</strong><span>本阶段最高的日线收盘，相对阶段起点收盘的涨幅；不是盘中最高价。</span></li>
          <li><strong>最大收盘回撤</strong><span>本阶段某个最高收盘到其后最低收盘的最大跌幅；不是盘中跌幅。</span></li>
          <li><strong>历史中位数</strong><span>把同类完整阶段排序后位于中间的水平，不等于平均值。</span></li>
          <li><strong>中间一半</strong><span>同类完整阶段第 25% 至第 75% 所在范围，不代表本轮一定落在其中。</span></li>
        </ul>
      </section>
      <p className="mw-cycle-terms-note">这些说明只解释已经发生的闭合日线数据，不预测下一阶段，也不提供交易建议。</p>
    </div>
  </details>;
}

function MarketCycleReference({ analysis, loading, issue, stale, updatedAt, onRetry, onTimelineToggle }: {
  analysis: MarketCycleAnalysis | null;
  loading: boolean;
  issue: boolean;
  stale: boolean;
  updatedAt: string | null;
  onRetry: () => void;
  onTimelineToggle?: (open: boolean, hiddenCount: number) => void;
}) {
  if (!analysis) {
    return <div className="mw-research-empty mw-cycle-empty" aria-live="polite"><p>{loading ? "正在定位当前日线周期…" : "当前日线周期暂不可用"}</p><span>没有经过闭合日线验证的结果时，不用占位判断补齐。</span>{issue && <button type="button" onClick={onRetry}>重新获取周期分析</button>}</div>;
  }
  const regime = regimeCopy(analysis.current.regime);
  const visible = analysis.timeline.slice(-4);
  const earlier = analysis.timeline.slice(0, -4);
  const durationLabel = analysis.current.startedBy === "first_classifiable"
    ? `已记录 ${analysis.current.closedDailyCandleCount} 个已闭合日`
    : `第 ${analysis.current.closedDailyCandleCount} 个已闭合日`;
  const returnComparison = describeCycleReturn(analysis);
  const drawdownComparison = describeCycleDrawdown(analysis);
  return <div className="mw-cycle-reference">
    <article className={`mw-cycle-card mw-cycle-card--${analysis.current.regime}`}>
      <div className="mw-cycle-heading"><p>当前周期位置</p><span>{stale ? "数据延迟" : `更新 ${formatUpdate(updatedAt)}`}</span></div>
      <h3>{regime.label}<span>{durationLabel}</span></h3>
      <p className="mw-cycle-rule">{regime.detail}。本阶段自 {formatHistoryDate(analysis.current.startedAt)} 起，所有统计只使用已闭合日线收盘。</p>
      <dl>
        <div><dt>阶段收盘变化</dt><dd className={`mw-${changeTone(analysis.current.returnPercent)}`}>{formatChange(analysis.current.returnPercent)}</dd></div>
        <div><dt>最高收盘涨幅</dt><dd className={`mw-${changeTone(analysis.current.peakCloseReturnPercent)}`}>{formatChange(analysis.current.peakCloseReturnPercent)}</dd></div>
        <div><dt>最大收盘回撤</dt><dd className="mw-down">{formatCycleDrawdown(analysis.current.maxDrawdownPercent)}</dd></div>
      </dl>
      <div className="mw-cycle-reading"><strong>自动客观解读</strong><p>{describeCycleDuration(analysis)}。</p>{returnComparison && <p>{returnComparison}。</p>}{drawdownComparison && <p>{drawdownComparison}。</p>}</div>
      <small>这是固定规则形成的历史分段，不是官方牛熊定义，也不是未来预测。</small>
      <CycleTermGuide />
    </article>
    <div className="mw-cycle-timeline">
      <div><h3>最近周期时间轴</h3><span>当前与最近 {analysis.timeline.length - 1} 段</span></div>
      {earlier.length > 0 && <details onToggle={(event) => onTimelineToggle?.(event.currentTarget.open, earlier.length)}><summary>查看更早 {earlier.length} 段</summary><ol><CycleTimelineItems episodes={earlier} /></ol></details>}
      <ol start={earlier.length + 1}><CycleTimelineItems episodes={visible} /></ol>
    </div>
  </div>;
}

function LongHistoryCohort({ title, cohort, horizon, interval }: {
  title: string;
  cohort: LongTermHistoryAnalysis["cohorts"]["all"];
  horizon: HistoricalContextHorizon;
  interval: ChartCandleInterval;
}) {
  const outcome = cohort.horizons.find((entry) => entry.bars === horizon) ?? null;
  if (!outcome) return <article className="mw-long-cohort"><div><h3>{title}</h3><span>该观察窗口暂不可用</span></div></article>;
  return <article className="mw-long-cohort">
    <div><h3>{title}</h3><span>{cohort.eventCount} 次完整事件 · {outcome.independentSampleCount} 组互不重叠样本</span></div>
    <p><span>后 {horizon} 根 · {formatHistoryHorizonDuration(interval, horizon)} · 全部完整事件</span><strong className={`mw-${changeTone(outcome.medianReturnPercent)}`}>中位 {formatChange(outcome.medianReturnPercent)}</strong><small>{outcome.q25ReturnPercent === null || outcome.q75ReturnPercent === null ? "完整事件的中间区间暂不可用" : `完整事件的中间一半 ${formatChange(outcome.q25ReturnPercent)} 至 ${formatChange(outcome.q75ReturnPercent)}`}</small></p>
    {outcome.independentSampleCount >= HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES && outcome.positiveReturnRatePercent !== null
      ? <small className="mw-long-direction">收涨的互不重叠样本占比 {formatHistoryRate(outcome.positiveReturnRatePercent)}；仅为历史描述，不能推断下一次方向。</small>
      : <small className="mw-long-direction">该窗口独立样本不足 {HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES} 组，不显示方向占比。</small>}
  </article>;
}

function LongHistoryReference({ analysis, interval, loading, issue, stale, horizon, onSelectHorizon, onRetry }: {
  analysis: LongTermHistoryAnalysis | null;
  interval: ChartCandleInterval;
  loading: boolean;
  issue: boolean;
  stale: boolean;
  horizon: HistoricalContextHorizon;
  onSelectHorizon: (horizon: HistoricalContextHorizon) => void;
  onRetry: () => void;
}) {
  if (!analysis) {
    return <div className="mw-research-empty mw-long-history-empty" aria-live="polite"><p>{loading ? "正在读取长期历史基线…" : "长期历史基线暂不可用"}</p><span>当前图表与近期窗口仍可继续查看。</span>{issue && <button type="button" onClick={onRetry}>重新获取长期基线</button>}</div>;
  }
  const regime = regimeCopy(analysis.current.regime);
  return <div className="mw-long-history">
    <div className="mw-history-horizon-heading">
      <p><strong>当前 EMA 状态的长期对照</strong><span>中位与中间一半使用完整事件；方向占比仅使用互不重叠样本</span></p>
      <div className="mw-history-horizon-tabs" role="group" aria-label="选择长期历史观察窗口">
        {([6, 12, 24] as const).map((bars) => <button type="button" key={bars} aria-pressed={horizon === bars} onClick={() => onSelectHorizon(bars)}>{bars} 根</button>)}
      </div>
    </div>
    <div className="mw-long-cohorts" aria-live="polite" aria-label={`${horizon} 根长期历史对照`}>
      <LongHistoryCohort title={`事件进入时与当前同阶段 · ${regime.label}`} cohort={analysis.cohorts.sameRegime} horizon={horizon} interval={interval} />
      <LongHistoryCohort title="全部长期历史" cohort={analysis.cohorts.all} horizon={horizon} interval={interval} />
    </div>
    <p className="mw-long-meta">覆盖 {formatHistoryCoverageYears(analysis.coverage.event.fromOpenedAt, analysis.coverage.event.toClosedAt)} · 历史样本截至 {formatHistoryDate(analysis.coverage.event.toClosedAt)} · 基线生成 {formatHistoryDate(analysis.generatedAt)}{stale ? " · 数据延迟" : ""}</p>
  </div>;
}

function RecentHistoryReference({ analysis, loading, issue, stale, selectedEventAt, onSelectEvent, onRetry }: {
  analysis: HistoricalContextAnalysis | null;
  loading: boolean;
  issue: boolean;
  stale: boolean;
  selectedEventAt: string | null;
  onSelectEvent: (eventOpenedAt: string) => void;
  onRetry: () => void;
}) {
  if (!analysis) {
    return <details className="mw-recent-history"><summary><span>近期窗口与代表案例</span><small>暂不可用</small></summary><div className="mw-recent-history-body"><div className="mw-research-empty" aria-live="polite"><p>{loading ? "正在计算近期窗口…" : "近期历史参照暂不可用"}</p><span>没有可验证结果时，不用占位数字补齐。</span>{issue && <button type="button" onClick={onRetry}>重新获取近期参照</button>}</div></div></details>;
  }

  const enough = analysis.sample.status === "sufficient";
  const longestHorizon = analysis.horizons.find((horizon) => horizon.bars === 24) ?? null;
  return <details className="mw-recent-history">
    <summary><span>近期窗口与代表案例</span><small>{analysis.sample.eventCount} 次匹配</small></summary>
    <div className="mw-recent-history-body">
    <p className="mw-history-state">{summarizeHistoryState(analysis.current)}；均线排列 {analysis.current.ordering.expression}。</p>
    <div className="mw-history-sample">
      <p><strong>{analysis.sample.eventCount}</strong><span>次匹配事件</span></p>
      <p><strong>{analysis.current.barsInState}</strong><span>根延续当前状态</span></p>
    </div>
    <p className="mw-history-range">数据覆盖 {formatHistoryDate(analysis.sample.range.fromOpenedAt)} — {formatHistoryDate(analysis.sample.range.toClosedAt)} · {analysis.sample.closedCandleCount} 根闭合 K 线{stale ? " · 数据延迟" : ""}</p>
    <div className="mw-history-horizons" aria-label="历史匹配事件后续变化中位数">
      {analysis.horizons.map((horizon) => <div key={horizon.bars}>
        <span>后 {horizon.bars} 根</span>
        <strong className={`mw-${changeTone(horizon.medianReturnPercent)}`}>{formatChange(horizon.medianReturnPercent)}</strong>
        <small>{horizon.q25ReturnPercent === null || horizon.q75ReturnPercent === null ? "区间暂不可用" : `中间一半 ${formatChange(horizon.q25ReturnPercent)} 至 ${formatChange(horizon.q75ReturnPercent)}`}</small>
      </div>)}
    </div>
    {!enough ? <p className="mw-history-quality"><strong>样本不足</strong> 24 根观察窗口仅有 {longestHorizon?.independentSampleCount ?? 0} 组互不重叠样本，达到 {analysis.sample.minimumDirectionSampleCount} 组前不形成方向统计。</p> : <p className="mw-history-quality">24 根观察窗口包含 {longestHorizon?.independentSampleCount ?? 0} 组互不重叠样本；这是历史观察分布，不代表下一次一定重复。</p>}
    {analysis.cases.length > 0 ? <div className="mw-history-cases">
      <h3>代表案例 <span>最多 3 个</span></h3>
      <p className="mw-history-case-method">按后 24 根结果的偏弱、中位、偏强位置选取，不按方向挑选。</p>
      <div>{analysis.cases.slice(0, 3).map((entry) => {
        const outcome = entry.outcomes.find((item) => item.bars === 24);
        const caseLabel = representativeLabel(entry.representativeOf);
        return <button type="button" key={`${entry.representativeOf}-${entry.eventOpenedAt}`} aria-pressed={selectedEventAt === entry.eventOpenedAt} onClick={() => onSelectEvent(entry.eventOpenedAt)} aria-label={`在图表定位${caseLabel}，${formatHistoryDate(entry.eventOpenedAt)}，后 24 根变化 ${formatChange(outcome?.returnPercent)}`}>
          <span><strong>{caseLabel}</strong><small>{formatHistoryDate(entry.eventOpenedAt)} · 当时 {formatPrice(entry.eventClose)}</small></span>
          <em className={`mw-${changeTone(outcome?.returnPercent)}`}>24 根 {formatChange(outcome?.returnPercent)}</em>
        </button>;
      })}</div>
      {enough && longestHorizon?.positiveReturnRatePercent !== null ? <p>24 根后收涨的互不重叠样本占比 {formatHistoryRate(longestHorizon?.positiveReturnRatePercent)}；仅为历史描述，不能推断下一次方向。</p> : null}
    </div> : null}
    </div>
  </details>;
}

export function MarketResearchPanel({ points, interval, analysisMode = "short", snapshot, issue, historyIssue = false, longHistoryIssue = false, cycleIssue = false, delayed, levelsDelayed = false, historyDelayed = false, longHistoryDelayed = false, cycleDelayed = false, historyHorizon = 24, historyReviewMode = false, selectedLevel, selectedHistoryEventAt, onSelectLevel, onSelectHistoryEvent, onSelectHistoryHorizon, onSelectInterval, onCycleTimelineToggle, onReturnToLatest, onRetry, strategySlot }: {
  points: readonly LiveChartPoint[];
  interval: ChartCandleInterval;
  analysisMode?: AnalysisMode;
  snapshot: PublicResearchSnapshot | null;
  issue: boolean;
  historyIssue?: boolean;
  longHistoryIssue?: boolean;
  cycleIssue?: boolean;
  delayed: boolean;
  levelsDelayed?: boolean;
  historyDelayed?: boolean;
  longHistoryDelayed?: boolean;
  cycleDelayed?: boolean;
  historyHorizon?: HistoricalContextHorizon;
  historyReviewMode?: boolean;
  selectedLevel: string | null;
  selectedHistoryEventAt?: string | null;
  onSelectLevel: (id: string) => void;
  onSelectHistoryEvent?: (eventOpenedAt: string) => void;
  onSelectHistoryHorizon?: (horizon: HistoricalContextHorizon) => void;
  onSelectInterval: (interval: ChartCandleInterval) => void;
  onCycleTimelineToggle?: (open: boolean, hiddenCount: number) => void;
  onReturnToLatest?: () => void;
  onRetry: () => void;
  strategySlot?: ReactNode;
}) {
  if (historyReviewMode) {
    return <aside className="mw-research mw-research--history-review" aria-label="历史行情核对">
      <section className="mw-research-section mw-history-review" role="status">
        <p>历史核对模式</p><h2>正在查看过去的行情窗口</h2>
        <span>今天的阶段、历史统计、关键位置、策略与多周期信息已全部隐藏，避免把后来形成的信息带回历史。</span>
        <button type="button" onClick={onReturnToLatest ?? noopHistorySelection}>返回最新行情</button>
      </section>
    </aside>;
  }
  const latestPoint = points.at(-1) ?? null;
  const current = summarizeCurrentPosition(points.filter((point) => point.state === "closed"), analysisMode);
  const intrabar = latestPoint?.state === "forming" ? summarizeCurrentPosition(points, analysisMode) : null;
  const mode = analysisModes[analysisMode];
  const analysis = availableResearch(snapshot?.levels);
  const price = latestPoint?.close ?? current?.latest.close ?? null;
  const nearest = nearestKeyLevels(analysis, price);
  const allLevels = nearestKeyLevels(analysis, price, "all");
  const remainingResistance = allLevels.resistances.slice(nearest.resistances.length);
  const remainingSupport = allLevels.supports.slice(nearest.supports.length);
  const atPrice = keyLevelsContainingPrice(analysis, price);
  const moreCount = remainingResistance.length + remainingSupport.length;
  const fibonacci = fibonacciOverlays(analysis);
  const stale = delayed || levelsDelayed || issue || snapshot?.levels.status === "stale";
  const profile = analysis?.volumeProfile;
  const support = nearest.supports[0];
  const resistance = nearest.resistances[0];
  const strategyEvidence = buildPublicStrategyEvidence(snapshot, interval);
  const history = availableResearch(snapshot?.history);
  const historyStale = historyDelayed || historyIssue || snapshot?.history.status === "stale";
  const longHistory = availableResearch(snapshot?.longHistory);
  const longHistoryStale = longHistoryDelayed || longHistoryIssue || snapshot?.longHistory.status === "stale";
  const cycle = availableResearch(snapshot?.cycle);
  const cycleStale = cycleDelayed || cycleIssue || snapshot?.cycle.status === "stale";
  return <>
    <aside className="mw-research mw-research--summary" aria-label="当前行情摘要">
      <section className="mw-research-section mw-interpretation">
        <div className="mw-section-heading"><h2>当前阶段</h2><span>{periodLabels[interval]} · {mode.label}视角</span></div>
        {current ? <>
          <h3>{current.headline.replace("当前价格", delayed ? "最近记录的闭合收盘" : "最新闭合收盘")}<span>{current.ordering}</span></h3>
          <p className="mw-position-summary">{current.movementLabel} <b className={`mw-${changeTone(current.movement)}`}>{formatChange(current.movement)}</b></p>
          <div className="mw-ema-facts">{current.comparisons.map((entry) => <div key={entry.key} title={`最新闭合收盘相对均线 ${formatChange(entry.distance)}`}><span><i style={{ background: emaColors[entry.key] }} />{liveEmaDefinitions[entry.key].label}</span><strong>{entry.distance === null ? "样本不足" : entry.distance > 0 ? "上方" : entry.distance < 0 ? "下方" : "线上"}</strong><small>{entry.distance === null ? "—" : `相差 ${formatChange(entry.distance)}`}</small></div>)}</div>
          {intrabar ? <div className="mw-intrabar-position"><span>盘中位置</span><strong>{formatPrice(latestPoint?.close)} USDT</strong><small>{intrabar.headline.replace("当前价格", "盘中价格")} 仅供观察，闭合后才进入阶段判断。</small></div> : null}
        </> : <p className="mw-empty-copy">行情暂不可用，恢复后将显示价格与均线的位置。</p>}
      </section>
    </aside>

    <section className="mw-research-details" aria-labelledby="mw-research-details-title">
      <header className="mw-research-details__header">
        <div><p>深入参考</p><h2 id="mw-research-details-title">历史、关键位与周期</h2></div>
        <span>点击价格或案例，可在上方图表定位</span>
      </header>
      <div className="mw-research-details__grid">
        <section className="mw-research-section mw-history">
          <div className="mw-section-heading"><h2>历史参照</h2><span>机械统计 · 非预测</span></div>
          <MarketCycleReference analysis={cycle} loading={!snapshot && !cycleIssue} issue={cycleIssue} stale={cycleStale} updatedAt={snapshot?.cycle.updatedAt ?? null} onRetry={onRetry} onTimelineToggle={onCycleTimelineToggle} />
          {interval === "15m" ? <p className="mw-empty-copy mw-history-interval-note">15 分钟暂不进行精确 EMA 历史匹配；可切换至 1 小时、4 小时或日线查看。</p> : <>
            <LongHistoryReference analysis={longHistory} interval={interval} loading={!snapshot && !longHistoryIssue} issue={longHistoryIssue} stale={longHistoryStale} horizon={historyHorizon} onSelectHorizon={onSelectHistoryHorizon ?? noopHistoryHorizonSelection} onRetry={onRetry} />
            <RecentHistoryReference analysis={history} loading={!snapshot && !historyIssue} issue={historyIssue} stale={historyStale} selectedEventAt={selectedHistoryEventAt ?? null} onSelectEvent={onSelectHistoryEvent ?? noopHistorySelection} onRetry={onRetry} />
          </>}
        </section>

        <section className="mw-research-section mw-levels-section">
          <div className="mw-section-heading"><h2>关键位置</h2><span>{stale && analysis ? "数据延迟" : "点击定位"}</span></div>
          {analysis && price ? <>
            <div className="mw-key-levels">
              {atPrice.map((level) => <KeyLevelRow key={level.id} level={level} name="现价附近" price={price} selectedLevel={selectedLevel} onSelectLevel={onSelectLevel} />)}
              {([
                { name: "压力", levels: nearest.resistances },
                { name: "支撑", levels: nearest.supports },
              ] as const).map((group) => group.levels.length ? group.levels.map((level, index) => <KeyLevelRow key={level.id} level={level} name={group.name} rank={index + 1} price={price} selectedLevel={selectedLevel} groupStart={group.name === "支撑" && index === 0} onSelectLevel={onSelectLevel} />) : <div className={`mw-level-row${group.name === "支撑" ? " mw-level-row--group-start" : ""}`} key={group.name}><span>{group.name}</span><strong>暂未识别</strong><small>—</small></div>)}
            </div>
            {profile ? <div className="mw-profile">
              <button onClick={() => onSelectLevel("poc")} aria-pressed={selectedLevel === "poc"}><span><i className="mw-poc-dot" />成交密集价 <small>估算</small></span><strong>≈ {formatPrice(profile.poc)}</strong></button>
              <div><span>价值区间</span><span className="mw-profile-range"><button onClick={() => onSelectLevel("val")} aria-pressed={selectedLevel === "val"} aria-label={`在图表定位价值区下沿 ${formatPrice(profile.val)}`}>{formatPrice(profile.val)}</button><span>—</span><button onClick={() => onSelectLevel("vah")} aria-pressed={selectedLevel === "vah"} aria-label={`在图表定位价值区上沿 ${formatPrice(profile.vah)}`}>{formatPrice(profile.vah)}</button></span></div>
            </div> : <p className="mw-quiet">成交量样本不足，密集区暂不可用。</p>}
            {moreCount > 0 || fibonacci.length > 0 ? <details className="mw-more-levels">
              <summary>更多关键位<span>{moreCount > 0 ? `${moreCount} 个候选` : "斐波那契参考"}</span></summary>
              <div className="mw-more-levels-content">
                {([
                  { name: "压力", levels: remainingResistance, offset: nearest.resistances.length },
                  { name: "支撑", levels: remainingSupport, offset: nearest.supports.length },
                ] as const).map((group) => group.levels.map((level, index) => <KeyLevelRow key={level.id} level={level} name={group.name} rank={group.offset + index + 1} price={price} selectedLevel={selectedLevel} expanded onSelectLevel={onSelectLevel} />))}
                {fibonacci.length > 0 && <div className="mw-fibonacci-levels"><h3>斐波那契参考</h3>{fibonacci.map((line) => <button type="button" key={line.id} className={`mw-level-row${selectedLevel === line.id ? " is-selected" : ""}`} onClick={() => onSelectLevel(line.id)} aria-pressed={selectedLevel === line.id} aria-label={`在图表定位 ${line.label} ${formatPrice(line.price)}`}><span>{line.label}</span><strong>{formatPrice(line.price)}</strong><small>{formatChange((line.price / price - 1) * 100)}</small></button>)}</div>}
                <p className="mw-more-levels-note">相近价位已合并为区域，多种依据重合不代表成功率。图表默认显示最近三档，点击其他价位可定位。</p>
              </div>
            </details> : null}
          </> : <div className="mw-research-empty" aria-live="polite"><p>{!snapshot && !issue ? "正在计算关键价位…" : "关键价位暂不可用"}</p><span>有足够行情样本后显示，不用占位数字替代。</span>{issue && <button onClick={onRetry}>重新获取</button>}</div>}
        </section>

        <section className="mw-research-section mw-watch">
          <div className="mw-section-heading"><h2>确认与失效</h2></div>
          {stale ? <p className="mw-empty-copy">等待数据恢复后更新观察条件，当前不提供即时判断。</p> : analysis ? <ul>
            {atPrice[0] ? <li><i className="mw-watch-zone" /><p>现价正在 <button onClick={() => onSelectLevel(atPrice[0].id)}>{formatLevelRange(atPrice[0])}</button> 关键区域内，先等待本周期收盘离开区域再确认。</p></li> : null}
            <li><i className="mw-watch-up" /><p>{resistance ? <>站上 <button onClick={() => onSelectLevel(resistance.id)}>{formatPrice(resistance.upper)}</button> 压力区上沿后，观察本周期收盘能否守住。</> : "上方尚未识别出有效关键位，继续观察价格与均线的位置。"}</p></li>
            <li><i className="mw-watch-down" /><p>{support ? <>若本周期收盘跌破 <button onClick={() => onSelectLevel(support.id)}>{formatPrice(support.lower)}</button> 支撑区下沿，需重新评估当前结构。</> : "下方尚未识别出有效关键位，不推测支撑价格。"}</p></li>
          </ul> : <p className="mw-empty-copy">等待关键位计算完成后，显示对应的观察条件。</p>}
          <div className="mw-risk-next">
            <p><strong>确认条件后，再核算风险</strong><span>只计算计划，不替你决定开多或开空。</span></p>
            <div><Link href="/tools/position-size">计算可承受仓位</Link><Link href="/tools/risk-reward">检查风险回报</Link></div>
          </div>
        </section>

        {strategySlot ? <div className="mw-research-details__strategy">{strategySlot}</div> : null}

        <section className="mw-research-section mw-timeframes">
          <div className="mw-section-heading"><h2>量能与周期</h2><span>闭合数据</span></div>
          <div className="mw-confirmation-facts" aria-label="通用策略确认证据">
            <div><span>已闭合量能</span><strong>{strategyEvidence.closedVolume.headline}</strong><small>{stale ? "数据延迟 · " : ""}{strategyEvidence.closedVolume.detail}</small></div>
            <div><span>多周期位置</span><strong>{strategyEvidence.multiTimeframe.headline}</strong><small>{stale ? "数据延迟 · " : ""}{strategyEvidence.multiTimeframe.detail}</small></div>
          </div>
          <details className="mw-timeframe-details"><summary><span>多周期对照</span><small>确认结构</small></summary>
          <div><table><thead><tr><th>周期</th><th>{mode.label}结构</th><th>距 EMA20</th></tr></thead><tbody>{(["15m", "1h", "4h", "1d"] as const).map((timeframe) => {
            const datum = snapshot?.timeframes.find((entry) => entry.interval === timeframe)?.datum;
            const value = availableResearch(datum);
            const comparison = value?.comparisons.find((entry) => entry.key === "ema20");
            const label = value ? summarizeModeOrdering(value.comparisons, analysisMode) : !snapshot && !issue ? "计算中" : "暂不可用";
            return <tr key={timeframe} className={timeframe === interval ? "is-current" : undefined} title={value ? `数据更新 ${formatUpdate(value.latestClosedAt)}；${mode.description}` : undefined}><th><button aria-pressed={timeframe === interval} onClick={() => onSelectInterval(timeframe)}>{periodLabels[timeframe]}</button></th><td>{label}{value && (stale || datum?.status === "stale") && <small> · 延迟</small>}</td><td className={`mw-${changeTone(comparison?.distancePercent)}`}>{formatChange(comparison?.distancePercent)}</td></tr>;
          })}</tbody></table>
          <p className="mw-quiet">研究更新 {formatUpdate(snapshot?.levels.updatedAt)}</p></div></details>
        </section>
      </div>
    </section>
  </>;
}

function noopHistorySelection(): void {}
function noopHistoryHorizonSelection(): void {}
