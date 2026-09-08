import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
} from "@/server/data/contracts/market-data";
import { assertChartSeries, chartIntervalMilliseconds } from "./live-chart";

export const KEY_LEVEL_ALGORITHM_VERSION = "ohlcv-key-levels-v1" as const;
export const KEY_LEVEL_REQUIRED_CLOSED_CANDLES = 200;
export const KEY_LEVEL_WINDOW_CANDLES = 500;
export const KEY_LEVEL_SWING_CONFIRMATION_BARS = 5;
export const KEY_LEVEL_CLUSTER_PRICE_RATIO = 0.005;
export const VOLUME_PROFILE_MAX_BINS = 100;
export const VOLUME_PROFILE_VALUE_AREA_COVERAGE = 0.7;

export type KeyLevelMethod =
  | "swing_high"
  | "swing_low"
  | "pivot"
  | "fibonacci"
  | "hvn";

export type KeyLevelEvidence = Readonly<{
  method: KeyLevelMethod;
  label: string;
  price: number;
  /** An algorithm weight, never a probability, confidence or win rate. */
  weight: number;
  /** Source bar time; for a profile this is the start of its fixed window. */
  anchorAt: string;
  /** Earliest completed bar at which this candidate was knowable. */
  confirmedAt: string;
}>;

export type ComputedKeyLevel = Readonly<{
  id: string;
  price: number;
  lower: number;
  upper: number;
  /** Sum of heuristic input weights, not a recommendation or probability. */
  strength: number;
  methods: readonly KeyLevelMethod[];
  confirmedAt: string;
  evidence: readonly KeyLevelEvidence[];
}>;

export type EstimatedVolumeProfile = Readonly<{
  estimated: true;
  poc: number;
  /** Outer bucket edges, not the centres of the boundary buckets. */
  val: number;
  vah: number;
  totalVolume: number;
  valueAreaVolume: number;
  /** Target coverage; actual coverage may be larger by whole buckets. */
  valueAreaCoverage: typeof VOLUME_PROFILE_VALUE_AREA_COVERAGE;
  actualCoverage: number;
  binCount: number;
  binWidth: number;
  bins: readonly Readonly<{
    lower: number;
    upper: number;
    price: number;
    volume: number;
  }>[];
  hvn: readonly number[];
}>;

export type KeyLevelAnalysis = Readonly<{
  algorithmVersion: typeof KEY_LEVEL_ALGORITHM_VERSION;
  asset: Asset;
  symbol: ChartCandle["symbol"];
  interval: ChartCandleInterval;
  quoteCurrency: ChartCandle["quoteCurrency"];
  sampleCount: number;
  windowStartAt: string;
  confirmedAt: string;
  /** Price-ordered candidates; classify against the current price at display time. */
  levels: readonly ComputedKeyLevel[];
  volumeProfile: EstimatedVolumeProfile | null;
}>;

/**
 * Objective OHLCV estimates, independent of the visible chart and live price.
 *
 * Validate the entire input before selecting the most recent 500 completed
 * candles. A single forming tail is accepted but contributes to no calculation.
 * Missing history (<200 completed bars) returns null; malformed or discontinuous
 * history throws. Providers remain responsible for validating the candle state
 * against their observation time. This function never invents an event history,
 * an editorial strategy or a claim about where actual trades occurred.
 */
export function analyzeKeyLevels(
  candles: readonly ChartCandle[],
): KeyLevelAnalysis | null {
  assertInput(candles);
  const window = candles
    .filter((candle) => candle.state === "closed")
    .slice(-KEY_LEVEL_WINDOW_CANDLES);
  if (window.length < KEY_LEVEL_REQUIRED_CLOSED_CANDLES) {
    return null;
  }

  const latest = window.at(-1)!;
  const volumeProfile = buildVolumeProfile(window);
  const candidates: KeyLevelEvidence[] = [
    ...swingCandidates(window),
    ...pivotCandidates(latest),
    ...fibonacciCandidates(window),
    ...(volumeProfile?.hvn ?? []).map((price) => ({
      method: "hvn" as const,
      label: "volume_high_node",
      price,
      weight: 2.5,
      anchorAt: window[0].openedAt,
      confirmedAt: latest.closedAt,
    })),
  ];

  return {
    algorithmVersion: KEY_LEVEL_ALGORITHM_VERSION,
    asset: latest.asset,
    symbol: latest.symbol,
    interval: latest.interval,
    quoteCurrency: latest.quoteCurrency,
    sampleCount: window.length,
    windowStartAt: window[0].openedAt,
    confirmedAt: latest.closedAt,
    levels: clusterCandidates(candidates, latest),
    volumeProfile,
  };
}

function assertInput(candles: readonly ChartCandle[]): void {
  assertChartSeries(candles);
  const first = candles[0];
  for (const [index, candle] of candles.entries()) {
    if (
      (candle.asset !== "btc" && candle.asset !== "eth") ||
      candle.symbol !== (candle.asset === "btc" ? "BTCUSDT" : "ETHUSDT") ||
      candle.quoteCurrency !== "USDT" ||
      candle.asset !== first.asset ||
      candle.symbol !== first.symbol ||
      candle.interval !== first.interval ||
      candle.quoteCurrency !== first.quoteCurrency ||
      (index > 0 &&
        Date.parse(candle.openedAt) - Date.parse(candles[index - 1].openedAt) !==
          chartIntervalMilliseconds[candle.interval])
    ) {
      throw new TypeError("Key-level candles must be contiguous and share one valid scope.");
    }
  }
}

function swingCandidates(window: readonly ChartCandle[]): KeyLevelEvidence[] {
  const lookback = KEY_LEVEL_SWING_CONFIRMATION_BARS;
  const highs: KeyLevelEvidence[] = [];
  const lows: KeyLevelEvidence[] = [];
  let previousHighIndex = -1;
  let previousLowIndex = -1;

  for (let index = lookback; index < window.length - lookback; index += 1) {
    const candle = window[index];
    const left = window.slice(index - lookback, index);
    const right = window.slice(index + 1, index + lookback + 1);
    const neighbours = [...left, ...right];
    // A wholly flat plateau is not repeated evidence of a turning point.
    const isHigh =
      neighbours.every((item) => item.high <= candle.high) &&
      left.some((item) => item.high < candle.high) &&
      right.some((item) => item.high < candle.high);
    const isLow =
      neighbours.every((item) => item.low >= candle.low) &&
      left.some((item) => item.low > candle.low) &&
      right.some((item) => item.low > candle.low);
    const evidence = {
      weight: 2,
      anchorAt: candle.openedAt,
      confirmedAt: window[index + lookback].closedAt,
    };

    if (
      isHigh &&
      !(previousHighIndex >= 0 &&
        index - previousHighIndex <= lookback &&
        highs.at(-1)!.price === candle.high)
    ) {
      highs.push({ ...evidence, method: "swing_high", label: "swing_high", price: candle.high });
      previousHighIndex = index;
    }
    if (
      isLow &&
      !(previousLowIndex >= 0 &&
        index - previousLowIndex <= lookback &&
        lows.at(-1)!.price === candle.low)
    ) {
      lows.push({ ...evidence, method: "swing_low", label: "swing_low", price: candle.low });
      previousLowIndex = index;
    }
  }

  return [...highs.slice(-10), ...lows.slice(-10)];
}

function pivotCandidates(latest: ChartCandle): KeyLevelEvidence[] {
  // The input is already closed-only: -2 would incorrectly skip a full candle.
  const { high, low, close } = latest;
  const pivot = finite((high + low + close) / 3);
  const range = finite(high - low);
  const raw: readonly (readonly [string, number])[] = range === 0
    ? [["P", pivot]]
    : [
        ["P", pivot],
        ["R1", 2 * pivot - low],
        ["S1", 2 * pivot - high],
        ["R2", pivot + range],
        ["S2", pivot - range],
        ["R3", high + 2 * (pivot - low)],
        ["S3", low - 2 * (high - pivot)],
      ];

  return raw.flatMap(([label, value]) => {
    const price = finite(value);
    // Wide ranges can produce negative classic pivots; these are not prices.
    return price > 0 ? [{
      method: "pivot" as const,
      label,
      price,
      weight: label === "P" ? 1.5 : 1,
      anchorAt: latest.openedAt,
      confirmedAt: latest.closedAt,
    }] : [];
  });
}

function fibonacciCandidates(window: readonly ChartCandle[]): KeyLevelEvidence[] {
  let highIndex = 0;
  let lowIndex = 0;
  for (let index = 1; index < window.length; index += 1) {
    if (window[index].high >= window[highIndex].high) highIndex = index;
    if (window[index].low <= window[lowIndex].low) lowIndex = index;
  }
  const high = window[highIndex].high;
  const low = window[lowIndex].low;
  const span = finite(high - low);
  // A single bar containing both extremes has no knowable intrabar direction.
  if (span === 0 || highIndex === lowIndex) return [];
  const upswing = lowIndex < highIndex;

  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => {
    // Use the observed endpoints exactly: high - (high - low) can otherwise
    // round a very small, positive low down to zero.
    const price = ratio === 0
      ? (upswing ? high : low)
      : ratio === 1
        ? (upswing ? low : high)
        : (upswing ? high - span * ratio : low + span * ratio);
    return {
      method: "fibonacci",
      label: `${upswing ? "upswing" : "downswing"}_${ratio}`,
      price: finite(price),
      weight: 1,
      anchorAt: window[Math.max(lowIndex, highIndex)].openedAt,
      confirmedAt: window.at(-1)!.closedAt,
    };
  });
}

function clusterCandidates(
  candidates: readonly KeyLevelEvidence[],
  latest: ChartCandle,
): ComputedKeyLevel[] {
  const tolerance = finite(latest.close * KEY_LEVEL_CLUSTER_PRICE_RATIO);
  const sorted = [...candidates].sort((left, right) => left.price - right.price);
  const clusters: KeyLevelEvidence[][] = [];
  for (const candidate of sorted) {
    const current = clusters.at(-1);
    // Bound the WHOLE cluster. Neighbour-only chaining can join distant levels.
    if (current && candidate.price - current[0].price <= tolerance) {
      current.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  return clusters.map((evidence, index) => {
    const strength = finite(evidence.reduce((sum, item) => sum + item.weight, 0));
    const price = finite(evidence.reduce(
      (sum, item) => sum + item.price * (item.weight / strength),
      0,
    ));
    const lower = evidence[0].price;
    const upper = evidence.at(-1)!.price;
    return {
      id: `${latest.asset}-${latest.interval}-${Date.parse(latest.closedAt)}-${index}`,
      // Floating-point weighted means must remain within the candidate bounds.
      price: Math.min(upper, Math.max(lower, price)),
      lower,
      upper,
      strength,
      methods: [...new Set(evidence.map((item) => item.method))],
      confirmedAt: evidence.reduce(
        (latestTime, item) => item.confirmedAt > latestTime ? item.confirmedAt : latestTime,
        evidence[0].confirmedAt,
      ),
      evidence,
    };
  });
}

function buildVolumeProfile(window: readonly ChartCandle[]): EstimatedVolumeProfile | null {
  const totalVolume = finite(window.reduce((sum, item) => finite(sum + item.volume), 0));
  if (totalVolume === 0) return null;

  const priceMin = Math.min(...window.map((candle) => candle.low));
  const priceMax = Math.max(...window.map((candle) => candle.high));
  const span = finite(priceMax - priceMin);
  // Reduce the bin count for very narrow ranges where adjacent double-precision
  // prices would otherwise collapse to the same edge. A flat price is one bin.
  let binCount = span === 0 ? 1 : VOLUME_PROFILE_MAX_BINS;
  let edges: number[];
  while (true) {
    edges = Array.from({ length: binCount + 1 }, (_, index) =>
      index === binCount ? priceMax : priceMin + span * (index / binCount),
    );
    if (span === 0 || edges.every((edge, index) => index === 0 || edge > edges[index - 1])) {
      break;
    }
    binCount = Math.max(1, Math.floor(binCount / 2));
  }

  const volumes = Array<number>(binCount).fill(0);
  for (const candle of window) {
    if (candle.volume === 0) continue;
    // [lower, upper), except the final bin includes the maximum price. Flat
    // candles exactly on an interior edge go to its upper bin; at max they go
    // to the final bin, never outside the array or silently lose their volume.
    const first = Math.min(binCount - 1, Math.max(0, upperBound(edges, candle.low) - 1));
    const last = candle.high === candle.low
      ? first
      : Math.min(binCount - 1, Math.max(first, lowerBound(edges, candle.high) - 1));
    const count = last - first + 1;
    const share = finite(candle.volume / count);
    if (share === 0) throw new TypeError("Volume profile precision is insufficient.");
    for (let index = first; index <= last; index += 1) {
      const allocation = index === last ? candle.volume - share * (count - 1) : share;
      volumes[index] = finite(volumes[index] + allocation);
    }
  }

  const bins = volumes.map((volume, index) => ({
    lower: edges[index],
    upper: edges[index + 1],
    price: finite(edges[index] + (edges[index + 1] - edges[index]) / 2),
    volume,
  }));
  let pocIndex = 0;
  for (let index = 1; index < bins.length; index += 1) {
    if (bins[index].volume > bins[pocIndex].volume) pocIndex = index;
  }
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let valueAreaVolume = bins[pocIndex].volume;
  const target = totalVolume * VOLUME_PROFILE_VALUE_AREA_COVERAGE;
  while (valueAreaVolume < target && (lowIndex > 0 || highIndex < bins.length - 1)) {
    const below = lowIndex > 0 ? bins[lowIndex - 1].volume : -1;
    const above = highIndex < bins.length - 1 ? bins[highIndex + 1].volume : -1;
    if (above >= below) {
      highIndex += 1;
      valueAreaVolume = finite(valueAreaVolume + bins[highIndex].volume);
    } else {
      lowIndex -= 1;
      valueAreaVolume = finite(valueAreaVolume + bins[lowIndex].volume);
    }
  }

  const hvn: number[] = [];
  const threshold = totalVolume / bins.length * 1.5;
  for (let index = 1; index < bins.length - 1; index += 1) {
    let end = index;
    while (end + 1 < bins.length && bins[end + 1].volume === bins[index].volume) end += 1;
    if (
      end < bins.length - 1 &&
      bins[index].volume > threshold &&
      bins[index].volume > bins[index - 1].volume &&
      bins[end].volume > bins[end + 1].volume
    ) {
      // One high-volume plateau is one node, not repeated weighted evidence.
      hvn.push(bins[Math.floor((index + end) / 2)].price);
    }
    index = end;
  }

  return {
    estimated: true,
    poc: bins[pocIndex].price,
    val: bins[lowIndex].lower,
    vah: bins[highIndex].upper,
    totalVolume,
    valueAreaVolume,
    valueAreaCoverage: VOLUME_PROFILE_VALUE_AREA_COVERAGE,
    actualCoverage: Math.min(1, finite(valueAreaVolume / totalVolume)),
    binCount,
    binWidth: finite(span / binCount),
    bins,
    hvn,
  };
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Key-level calculations must be finite.");
  }
  return value;
}
