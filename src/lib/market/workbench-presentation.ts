import { assertChartSeries, liveEmaDefinitions, summarizeLiveTrend, type Asset, type ChartCandle, type ChartCandleInterval, type LiveChartPoint, type LiveEmaKey, type MarketDatum } from "./live-chart";
import type { ComputedKeyLevel, KeyLevelAnalysis, KeyLevelMethod } from "./key-levels";

export const analysisModes = {
  short: {
    label: "短线",
    description: "EMA10 / 20 / 50",
    emaKeys: ["ema10", "ema20", "ema50"],
    orderingLabel: "短期均线",
  },
  trend: {
    label: "趋势",
    description: "EMA20 / 50 / 200",
    emaKeys: ["ema20", "ema50", "ema200"],
    orderingLabel: "趋势均线",
  },
} as const satisfies Record<string, {
  label: string;
  description: string;
  emaKeys: readonly LiveEmaKey[];
  orderingLabel: string;
}>;
export type AnalysisMode = keyof typeof analysisModes;
export const analysisModeKeys = Object.keys(analysisModes) as readonly AnalysisMode[];
export const researchEmaKeys = analysisModes.short.emaKeys;
export const workbenchIntervals = ["15m", "1h", "4h", "1d"] as const;
export const periodLabels: Record<ChartCandleInterval, string> = { "15m": "15 分", "1h": "1 小时", "4h": "4 小时", "1d": "日线" };
const prices = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const beijingMarketHeaderTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export const formatPrice = (value: number | null | undefined) => value != null && Number.isFinite(value) ? prices.format(value) : "—";
export const formatChange = (value: number | null | undefined) => value != null && Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "—";
export const changeTone = (value: number | null | undefined) => value == null || value === 0 ? "neutral" : value > 0 ? "up" : "down";
export function formatUpdate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? `${value.slice(5, 10)} ${value.slice(11, 19)} UTC` : "等待更新";
}
export function formatMarketHeaderUpdate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "等待更新";
  const parts = Object.fromEntries(
    beijingMarketHeaderTime
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} 北京时间`;
}

/** Live price is compared with the EMA at the SAME chart point. Closed movement is separate. */
export function summarizeCurrentPosition(
  points: readonly LiveChartPoint[],
  mode: AnalysisMode = "short",
) {
  const latest = points.at(-1);
  if (!latest) return null;
  const definition = analysisModes[mode];
  const comparisons = definition.emaKeys.map((key) => ({ key, value: latest[key], distance: latest[key] == null ? null : (latest.close / latest[key]! - 1) * 100 }));
  const above = comparisons.filter((entry) => entry.distance !== null && entry.distance > 0);
  const below = comparisons.filter((entry) => entry.distance !== null && entry.distance < 0);
  const equal = comparisons.filter((entry) => entry.distance === 0);
  const label = (entries: typeof comparisons) => entries.map((entry) => liveEmaDefinitions[entry.key].label).join("、");
  const facts = [above.length ? `高于 ${label(above)}` : "", below.length ? `低于 ${label(below)}` : "", equal.length ? `位于 ${label(equal)}` : ""].filter(Boolean);
  const closed = summarizeLiveTrend(points, definition.emaKeys);
  const movement = closed?.recentThreeChangePercent ?? null;
  const values = definition.emaKeys.map((key) => latest[key]);
  const ordering = values.every((value) => value !== null)
    ? values.every((value, index) => index === 0 || values[index - 1]! > value!)
      ? `${definition.orderingLabel}向上排列`
      : values.every((value, index) => index === 0 || values[index - 1]! < value!)
        ? `${definition.orderingLabel}向下排列`
        : `${definition.orderingLabel}交错`
    : "均线样本尚未完整";
  return {
    latest,
    comparisons,
    movement,
    ordering,
    headline: facts.length ? `当前价格${facts.join("，")}。` : "等待足够行情样本",
    movementLabel: movement == null
      ? "最近 3 根变化暂不可用"
      : movement > 0
        ? "最近 3 根已确认上行"
        : movement < 0
          ? "最近 3 根已确认回落"
          : "最近 3 根暂时持平",
  };
}

export type MechanicalMarketConclusion = Readonly<{
  status: "available" | "unavailable";
  stance: "strong" | "weak" | "wait" | "unavailable";
  label: "结构偏强" | "结构偏弱" | "震荡等待确认" | "暂不形成结论";
  rationale: string;
  current: ReturnType<typeof summarizeCurrentPosition>;
  priceZone: ComputedKeyLevel | null;
  support: ComputedKeyLevel | null;
  resistance: ComputedKeyLevel | null;
}>;

/**
 * Turns auditable, closed-candle facts into a deliberately strict observation
 * state. This is a presentation rule, not a forecast: any conflicting EMA,
 * movement or key-zone evidence falls back to waiting for confirmation.
 */
export function buildMechanicalMarketConclusion(
  points: readonly LiveChartPoint[],
  analysis: KeyLevelAnalysis | null,
  mode: AnalysisMode = "short",
  unavailable = false,
): MechanicalMarketConclusion {
  const closedPoints = points.filter((point) => point.state === "closed");
  const current = summarizeCurrentPosition(closedPoints, mode);
  const trend = closedPoints.length
    ? summarizeLiveTrend(closedPoints, analysisModes[mode].emaKeys)
    : null;
  const matchingScope = Boolean(
    analysis &&
    current &&
    analysis.asset === current.latest.asset &&
    analysis.symbol === current.latest.symbol &&
    analysis.interval === current.latest.interval &&
    analysis.quoteCurrency === current.latest.quoteCurrency &&
    Date.parse(analysis.confirmedAt) <= Date.parse(current.latest.closedAt),
  );
  if (
    unavailable ||
    !analysis ||
    !current ||
    !trend ||
    !matchingScope ||
    trend.recentThreeChangePercent === null ||
    trend.comparisons.some((comparison) => comparison.relation === "unavailable")
  ) {
    return {
      status: "unavailable",
      stance: "unavailable",
      label: "暂不形成结论",
      rationale: unavailable
        ? "行情或关键位置数据正在延迟，恢复后再根据已闭合 K 线形成结论。"
        : "已闭合 K 线、均线或关键位置样本还不完整，暂时不补写方向。",
      current,
      priceZone: null,
      support: null,
      resistance: null,
    };
  }

  const closedPrice = current.latest.close;
  const priceZone = keyLevelsContainingPrice(analysis, closedPrice)[0] ?? null;
  const nearest = nearestKeyLevels(analysis, closedPrice);
  const support = nearest.supports[0] ?? null;
  const resistance = nearest.resistances[0] ?? null;
  const allAbove = trend.comparisons.every((comparison) => comparison.relation === "above");
  const allBelow = trend.comparisons.every((comparison) => comparison.relation === "below");
  const upwardOrdering = trend.ordering?.state === "short_above_long";
  const downwardOrdering = trend.ordering?.state === "short_below_long";

  if (!priceZone && allAbove && upwardOrdering && trend.recentThreeChangePercent > 0) {
    return {
      status: "available",
      stance: "strong",
      label: "结构偏强",
      rationale: "闭合收盘、均线排列与最近 3 根变化方向一致，当前偏强证据占优；这不代表下一根必然上涨。",
      current,
      priceZone,
      support,
      resistance,
    };
  }
  if (!priceZone && allBelow && downwardOrdering && trend.recentThreeChangePercent < 0) {
    return {
      status: "available",
      stance: "weak",
      label: "结构偏弱",
      rationale: "闭合收盘、均线排列与最近 3 根变化方向一致，当前偏弱证据占优；这不代表下一根必然下跌。",
      current,
      priceZone,
      support,
      resistance,
    };
  }
  return {
    status: "available",
    stance: "wait",
    label: "震荡等待确认",
    rationale: priceZone
      ? "最新闭合收盘仍在关键价格区域内，方向尚未脱离边界，等待本周期收盘确认。"
      : "闭合收盘、均线排列或最近 3 根变化存在冲突，当前没有单一方向形成完整确认。",
    current,
    priceZone,
    support,
    resistance,
  };
}

export function summarizeModeOrdering(
  comparisons: readonly Readonly<{ key: LiveEmaKey; value: number | null }>[],
  mode: AnalysisMode,
): "向上排列" | "向下排列" | "均线交错" | "样本不足" {
  const values = analysisModes[mode].emaKeys.map(
    (key) => comparisons.find((comparison) => comparison.key === key)?.value ?? null,
  );
  if (values.some((value) => value === null)) return "样本不足";
  if (values.every((value, index) => index === 0 || values[index - 1]! > value!)) {
    return "向上排列";
  }
  if (values.every((value, index) => index === 0 || values[index - 1]! < value!)) {
    return "向下排列";
  }
  return "均线交错";
}

/** Reclassify the same confirmed candidates against the current price, never the viewport. */
export function nearestKeyLevels(analysis: KeyLevelAnalysis | null, price: number | null, limit: number | "all" = 3) {
  if (!analysis || price === null || !Number.isFinite(price) || price <= 0) return { supports: [] as ComputedKeyLevel[], resistances: [] as ComputedKeyLevel[] };
  const count = limit === "all" ? undefined : Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return {
    supports: analysis.levels.filter((level) => level.upper < price).sort((a, b) => b.upper - a.upper).slice(0, count),
    resistances: analysis.levels.filter((level) => level.lower > price).sort((a, b) => a.lower - b.lower).slice(0, count),
  };
}

export function keyLevelsContainingPrice(
  analysis: KeyLevelAnalysis | null,
  price: number | null,
): ComputedKeyLevel[] {
  if (!analysis || price === null || !Number.isFinite(price) || price <= 0) {
    return [];
  }
  return analysis.levels
    .filter((level) => level.lower <= price && level.upper >= price)
    .sort((left, right) => {
      const leftWidth = left.upper - left.lower;
      const rightWidth = right.upper - right.lower;
      return leftWidth - rightWidth || right.strength - left.strength;
    });
}

const keyLevelMethodLabels: Record<KeyLevelMethod, string> = { swing_high: "前高", swing_low: "前低", pivot: "Pivot", fibonacci: "斐波那契", hvn: "成交密集节点" };

/** Names of actual input methods, not heuristic weights or inferred win rates. */
export function keyLevelBasis(level: ComputedKeyLevel, compact = false) {
  const methods = [...new Set(level.methods)].map((method) => keyLevelMethodLabels[method]);
  return compact && methods.length > 2 ? `${methods.slice(0, 2).join(" · ")} +${methods.length - 2}` : methods.join(" · ");
}

export type ChartOverlay = {
  id: string;
  price: number;
  label: string;
  tone: "support" | "resistance" | "profile" | "area" | "fibonacci";
  rank?: number;
  lower?: number;
  upper?: number;
};
export type KeyLevelOverlayOptions = { supportResistance?: boolean; profile?: boolean; fibonacci?: boolean };

/** Extract existing Fibonacci evidence, never calculate a second set from the viewport. */
export function fibonacciOverlays(analysis: KeyLevelAnalysis | null): ChartOverlay[] {
  const unique = new Map<string, ChartOverlay>();
  for (const level of analysis?.levels ?? []) {
    for (const evidence of level.evidence) {
      if (evidence.method !== "fibonacci" || !Number.isFinite(evidence.price) || evidence.price <= 0) continue;
      const match = /^(?:upswing|downswing)_(0(?:\.\d+)?|1)$/.exec(evidence.label);
      if (!match) continue;
      const id = `fib:${evidence.label}:${evidence.price}`;
      unique.set(id, { id, price: evidence.price, label: `Fib ${Math.round(Number(match[1]) * 1000) / 10}%`, tone: "fibonacci" });
    }
  }
  return [...unique.values()].sort((left, right) => left.price - right.price);
}

export function keyLevelOverlays(analysis: KeyLevelAnalysis | null, price: number | null, selectedId: string | null, options: KeyLevelOverlayOptions = {}): ChartOverlay[] {
  if (!analysis) return [];
  const result: ChartOverlay[] = [];
  if (options.supportResistance !== false) {
    const { supports, resistances } = nearestKeyLevels(analysis, price, "all");
    for (const [levels, name, tone] of [[supports, "支撑", "support"], [resistances, "压力", "resistance"]] as const) {
      levels.forEach((level, index) => {
        if (index >= 3 && level.id !== selectedId) return;
        result.push({ id: level.id, price: level.price, lower: level.lower, upper: level.upper, rank: index + 1, label: `${name} ${index + 1}`, tone });
      });
    }
    const atPrice = keyLevelsContainingPrice(analysis, price);
    const visibleAtPrice = [
      atPrice[0],
      atPrice.find((level) => level.id === selectedId),
    ].filter((level, index, levels): level is ComputedKeyLevel =>
      level !== undefined && levels.findIndex((candidate) => candidate?.id === level.id) === index,
    );
    for (const level of visibleAtPrice) {
      result.push({ id: level.id, price: level.price, lower: level.lower, upper: level.upper, label: "现价区域", tone: "area" });
    }
  }
  if (options.profile !== false && analysis.volumeProfile) {
    const profile = analysis.volumeProfile;
    result.push({ id: "poc", price: profile.poc, label: "密集价 POC", tone: "profile" }, { id: "vah", price: profile.vah, label: "价值区上沿", tone: "area" }, { id: "val", price: profile.val, label: "价值区下沿", tone: "area" });
  }
  if (options.fibonacci === true) result.push(...fibonacciOverlays(analysis));
  return result;
}

export function publicCandles(datum: MarketDatum<readonly ChartCandle[]>) {
  return (datum.status === "fresh" || datum.status === "stale") && datum.provenance !== "synthetic" ? datum.value : [];
}

export function parseWorkbenchCandles(value: unknown, asset: Asset, interval: ChartCandleInterval): MarketDatum<readonly ChartCandle[]> {
  if (!value || typeof value !== "object") throw new TypeError("Invalid chart response");
  const datum = value as MarketDatum<readonly ChartCandle[]>;
  if (!["fresh", "stale", "error", "unavailable"].includes(datum.status) || !datum.cache || typeof datum.cache.revalidateSeconds !== "number") throw new TypeError("Invalid chart metadata");
  if (datum.status === "fresh" || datum.status === "stale") {
    if (datum.provenance === "synthetic" || !datum.source || !datum.scope || !Number.isFinite(Date.parse(datum.updatedAt)) || !Number.isFinite(Date.parse(datum.retrievedAt)) || !Array.isArray(datum.value) || datum.value.length === 0) throw new TypeError("Invalid public chart data");
    assertChartSeries(datum.value);
    if (datum.value.some((candle) => candle.asset !== asset || candle.interval !== interval || candle.symbol !== `${asset.toUpperCase()}USDT` || candle.quoteCurrency !== "USDT")) throw new TypeError("Chart scope mismatch");
  }
  return datum;
}

export const emaColors: Record<LiveEmaKey, string> = { ema10: "#c78508", ema20: "#8b5cf6", ema50: "#2563eb", ema200: "#6e6e73" };
