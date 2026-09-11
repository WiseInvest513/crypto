import { describe, expect, it } from "vitest";
import {
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  type Asset,
  type ChartCandle,
  type ChartCandleInterval,
} from "@/lib/market/live-chart";
import {
  buildMechanicalMarketConclusion,
  formatChange,
  formatMarketHeaderUpdate,
  formatPrice,
  fibonacciOverlays,
  keyLevelsContainingPrice,
  keyLevelBasis,
  keyLevelOverlays,
  nearestKeyLevels,
  parseWorkbenchCandles,
  publicCandles,
  summarizeCurrentPosition,
  summarizeModeOrdering,
} from "@/lib/market/workbench-presentation";
import {
  KEY_LEVEL_ALGORITHM_VERSION,
  type ComputedKeyLevel,
  type KeyLevelAnalysis,
} from "@/lib/market/key-levels";
import {
  chartCandleCapability,
  unavailableDatum,
  type AvailableMarketDatum,
} from "@/server/data/contracts/market-data";

const START = Date.parse("2026-08-01T00:00:00.000Z");
const AS_OF = "2026-08-03T12:05:00.000Z";

describe("formatMarketHeaderUpdate", () => {
  it("converts UTC instants to Beijing time across a date boundary", () => {
    expect(formatMarketHeaderUpdate("2026-09-08T16:43:12.000Z")).toBe("09-09 00:43:12 北京时间");
  });

  it("converts UTC instants across a year boundary", () => {
    expect(formatMarketHeaderUpdate("2026-12-31T16:01:02.000Z")).toBe("01-01 00:01:02 北京时间");
  });

  it("does not invent a time when the value is unavailable", () => {
    expect(formatMarketHeaderUpdate(null)).toBe("等待更新");
    expect(formatMarketHeaderUpdate("not-a-date")).toBe("等待更新");
  });
});

function candles(count = 61, asset: Asset = "btc", interval: ChartCandleInterval = "1h"): ChartCandle[] {
  const duration = chartIntervalMilliseconds[interval];
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state: index === count - 1 ? "forming" : "closed",
      openedAt: new Date(START + duration * index).toISOString(),
      closedAt: new Date(START + duration * (index + 1) - 1).toISOString(),
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: index + 1,
    };
  });
}

function datum(value = candles()): AvailableMarketDatum<readonly ChartCandle[]> {
  return {
    status: "fresh",
    capability: chartCandleCapability(value[0]?.asset ?? "btc"),
    value,
    source: { id: "fixture-only", label: "Test-only provider", url: "https://example.com/fixture" },
    scope: { kind: "venue", label: "Test-only BTCUSDT" },
    updatedAt: AS_OF,
    updatedAtKind: "observed",
    retrievedAt: AS_OF,
    loading: false,
    stale: false,
    provenance: "live",
    error: null,
    cache: { status: "hit", revalidateSeconds: 5, staleIfErrorSeconds: 300 },
  };
}

function level(price: number, strength = 1): ComputedKeyLevel {
  return {
    id: `test-${price}`,
    price,
    lower: price - 0.1,
    upper: price + 0.1,
    strength,
    methods: ["pivot"],
    confirmedAt: AS_OF,
    evidence: [],
  };
}

function analysis(): KeyLevelAnalysis {
  return {
    algorithmVersion: KEY_LEVEL_ALGORITHM_VERSION,
    asset: "btc",
    symbol: "BTCUSDT",
    interval: "1h",
    quoteCurrency: "USDT",
    sampleCount: 200,
    windowStartAt: new Date(START).toISOString(),
    confirmedAt: AS_OF,
    levels: [level(180, 99), level(95), level(60, 99), level(110), level(90), level(105), level(40), level(220)],
    volumeProfile: {
      estimated: true,
      poc: 100,
      val: 85,
      vah: 115,
      totalVolume: 100,
      valueAreaVolume: 75,
      valueAreaCoverage: 0.7,
      actualCoverage: 0.75,
      binCount: 4,
      binWidth: 10,
      bins: [],
      hvn: [100],
    },
  };
}

function fallingCandles(count = 61): ChartCandle[] {
  const duration = chartIntervalMilliseconds["1h"];
  return Array.from({ length: count }, (_, index) => {
    const close = 200 - index;
    return {
      asset: "btc",
      symbol: "BTCUSDT",
      interval: "1h",
      quoteCurrency: "USDT",
      state: index === count - 1 ? "forming" : "closed",
      openedAt: new Date(START + duration * index).toISOString(),
      closedAt: new Date(START + duration * (index + 1) - 1).toISOString(),
      open: close + 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: index + 1,
    };
  });
}

function conclusionAnalysis(
  input: ReturnType<typeof buildLiveChartPoints>,
  prices: readonly number[],
  overrides: Partial<KeyLevelAnalysis> = {},
): KeyLevelAnalysis {
  const latestClosed = input.filter((point) => point.state === "closed").at(-1)!;
  return {
    ...analysis(),
    confirmedAt: latestClosed.closedAt,
    levels: prices.map((price) => level(price)),
    ...overrides,
  };
}

describe("current-price workbench presentation", () => {
  it("compares the forming price with EMAs from that same live point", () => {
    const points = buildLiveChartPoints(candles());
    const result = summarizeCurrentPosition(points)!;
    const latest = points.at(-1)!;
    const previous = points.at(-2)!;

    expect(result.latest).toBe(latest);
    expect(result.latest.state).toBe("forming");
    expect(result.comparisons).toHaveLength(3);
    for (const comparison of result.comparisons) {
      expect(comparison.value).toBe(latest[comparison.key]);
      expect(comparison.value).not.toBe(previous[comparison.key]);
      expect(comparison.distance).toBeCloseTo((latest.close / latest[comparison.key]! - 1) * 100);
    }
    expect(result.headline).toBe("当前价格高于 EMA10、EMA20、EMA50。");
  });

  it("updates live position without allowing the forming candle to change confirmed movement", () => {
    const source = candles();
    const baseline = summarizeCurrentPosition(buildLiveChartPoints(source))!;
    const changed = source.map((candle, index) => index === source.length - 1
      ? { ...candle, close: 80, low: 79 }
      : candle);
    const result = summarizeCurrentPosition(buildLiveChartPoints(changed))!;

    expect(result.latest.close).toBe(80);
    expect(result.headline).toBe("当前价格低于 EMA10、EMA20、EMA50。");
    expect(result.comparisons).not.toEqual(baseline.comparisons);
    expect(result.movement).toBe(baseline.movement);
    expect(result.movementLabel).toBe(baseline.movementLabel);
    expect(result.movement).toBeCloseTo((159 / 156.5 - 1) * 100);
  });

  it("reports exact equality and flat confirmed movement without inventing a direction", () => {
    const flat = candles().map((candle) => ({ ...candle, open: 100, close: 100, high: 100, low: 100 }));
    const result = summarizeCurrentPosition(buildLiveChartPoints(flat))!;

    expect(result.headline).toBe("当前价格位于 EMA10、EMA20、EMA50。");
    expect(result.comparisons.every((entry) => entry.distance === 0)).toBe(true);
    expect(result.movement).toBe(0);
    expect(result.movementLabel).toBe("最近 3 根暂时持平");
    expect(result.ordering).toBe("短期均线交错");
  });

  it("uses the selected trend EMA set for both the headline and ordering", () => {
    const result = summarizeCurrentPosition(
      buildLiveChartPoints(candles(241)),
      "trend",
    )!;

    expect(result.comparisons.map((entry) => entry.key)).toEqual([
      "ema20",
      "ema50",
      "ema200",
    ]);
    expect(result.headline).toBe("当前价格高于 EMA20、EMA50、EMA200。");
    expect(result.ordering).toBe("趋势均线向上排列");
  });

  it("classifies multi-timeframe rows using the selected EMA mode", () => {
    const comparisons = [
      { key: "ema10" as const, value: 110 },
      { key: "ema20" as const, value: 105 },
      { key: "ema50" as const, value: 100 },
      { key: "ema200" as const, value: 120 },
    ];

    expect(summarizeModeOrdering(comparisons, "short")).toBe("向上排列");
    expect(summarizeModeOrdering(comparisons, "trend")).toBe("均线交错");
    expect(summarizeModeOrdering(comparisons.slice(0, 3), "trend")).toBe("样本不足");
  });

  it("keeps missing EMA samples null and an empty chart unavailable", () => {
    expect(summarizeCurrentPosition([])).toBeNull();
    const result = summarizeCurrentPosition(buildLiveChartPoints(candles(2)))!;
    expect(result.comparisons.every((entry) => entry.value === null && entry.distance === null)).toBe(true);
    expect(result.movement).toBeNull();
    expect(result.headline).toBe("等待足够行情样本");
    expect(result.ordering).toBe("均线样本尚未完整");
  });

  it("rejects mixed asset scopes rather than deriving a combined narrative", () => {
    const points = buildLiveChartPoints(candles());
    expect(() => summarizeCurrentPosition([
      { ...points[0], asset: "eth", symbol: "ETHUSDT" },
      ...points.slice(1),
    ])).toThrow("Cannot summarize mixed-scope chart points.");
  });
});

describe("closed-candle mechanical market conclusion", () => {
  it("reports a strong structure only when close, EMA ordering, movement, and price-zone evidence agree", () => {
    const input = buildLiveChartPoints(candles());
    const result = buildMechanicalMarketConclusion(
      input,
      conclusionAnalysis(input, [120, 180]),
    );

    expect(result).toMatchObject({
      status: "available",
      stance: "strong",
      label: "结构偏强",
      priceZone: null,
    });
    expect(result.current?.latest.state).toBe("closed");
    expect(result.rationale).toContain("不代表下一根必然上涨");
    for (const prohibited of ["买入", "卖出", "做多", "做空", "目标价", "胜率"]) {
      expect(result.rationale).not.toContain(prohibited);
    }
  });

  it("reports a weak structure only when the same closed-candle evidence agrees downward", () => {
    const input = buildLiveChartPoints(fallingCandles());
    const result = buildMechanicalMarketConclusion(
      input,
      conclusionAnalysis(input, [120, 160]),
    );

    expect(result).toMatchObject({
      status: "available",
      stance: "weak",
      label: "结构偏弱",
      priceZone: null,
    });
    expect(result.current?.latest.state).toBe("closed");
    expect(result.rationale).toContain("不代表下一根必然下跌");
  });

  it("waits for confirmation when the latest closed price remains inside a key zone", () => {
    const input = buildLiveChartPoints(candles());
    const latestClosed = input.filter((point) => point.state === "closed").at(-1)!;
    const result = buildMechanicalMarketConclusion(
      input,
      conclusionAnalysis(input, [120, latestClosed.close, 180]),
    );

    expect(result).toMatchObject({
      status: "available",
      stance: "wait",
      label: "震荡等待确认",
    });
    expect(result.priceZone?.price).toBe(latestClosed.close);
    expect(result.rationale).toContain("仍在关键价格区域内");
  });

  it("fails closed when data is delayed, incomplete, or scoped to another market", () => {
    const input = buildLiveChartPoints(candles());
    const matching = conclusionAnalysis(input, [120, 180]);

    expect(buildMechanicalMarketConclusion(input, matching, "short", true)).toMatchObject({
      status: "unavailable",
      stance: "unavailable",
      label: "暂不形成结论",
    });
    expect(buildMechanicalMarketConclusion(input, null)).toMatchObject({
      status: "unavailable",
      stance: "unavailable",
    });
    expect(buildMechanicalMarketConclusion(input, { ...matching, interval: "4h" })).toMatchObject({
      status: "unavailable",
      stance: "unavailable",
    });
    expect(buildMechanicalMarketConclusion(input, { ...matching, asset: "eth", symbol: "ETHUSDT" })).toMatchObject({
      status: "unavailable",
      stance: "unavailable",
    });
  });

  it("does not let a forming-candle spike change the mechanical conclusion", () => {
    const source = candles();
    const baselinePoints = buildLiveChartPoints(source);
    const scope = conclusionAnalysis(baselinePoints, [120, 180]);
    const baseline = buildMechanicalMarketConclusion(baselinePoints, scope);
    const spikedPoints = buildLiveChartPoints(source.map((candle, index) => index === source.length - 1
      ? { ...candle, open: 159, high: 260, low: 70, close: 80 }
      : candle));

    expect(buildMechanicalMarketConclusion(spikedPoints, scope)).toEqual(baseline);
  });
});

describe("current-price key-level selection", () => {
  it("selects three nearest levels per side, not the strongest or the input order", () => {
    const input = analysis();
    const originalOrder = input.levels.map((item) => item.id);
    const result = nearestKeyLevels(input, 100);

    expect(result.supports.map((item) => item.price)).toEqual([95, 90, 60]);
    expect(result.resistances.map((item) => item.price)).toEqual([105, 110, 180]);
    expect(input.levels.map((item) => item.id)).toEqual(originalOrder);
  });

  it("reclassifies the same confirmed candidates when the current price crosses one", () => {
    const input = analysis();
    expect(nearestKeyLevels(input, 100).resistances[0].price).toBe(105);
    expect(nearestKeyLevels(input, 108).supports[0].price).toBe(105);
    expect(nearestKeyLevels(input, 108).resistances[0].price).toBe(110);
  });

  it("does not call a level at exactly the current price above or below", () => {
    const result = nearestKeyLevels(analysis(), 105);
    expect([...result.supports, ...result.resistances].some((item) => item.price === 105)).toBe(false);
  });

  it("treats the whole merged range as the current zone instead of using its center as a threshold", () => {
    const currentPrice = 105.05;
    const result = nearestKeyLevels(analysis(), currentPrice);

    expect([...result.supports, ...result.resistances].some((item) => item.id === "test-105")).toBe(false);
    expect(keyLevelsContainingPrice(analysis(), currentPrice).map((item) => item.id)).toEqual(["test-105"]);
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("does not select levels for an invalid current price: %s", (price) => {
    expect(nearestKeyLevels(analysis(), price)).toEqual({ supports: [], resistances: [] });
  });

  it("returns no levels for unavailable analysis", () => {
    expect(nearestKeyLevels(null, 100)).toEqual({ supports: [], resistances: [] });
    expect(keyLevelOverlays(null, 100, null)).toEqual([]);
  });

  it("returns all real candidates on request and never pads a side to three", () => {
    expect(nearestKeyLevels(analysis(), 100, "all").supports.map((item) => item.price)).toEqual([95, 90, 60, 40]);
    expect(nearestKeyLevels(analysis(), 100, "all").resistances.map((item) => item.price)).toEqual([105, 110, 180, 220]);
    expect(nearestKeyLevels(analysis(), 100, 1).supports.map((item) => item.price)).toEqual([95]);
    expect(nearestKeyLevels({ ...analysis(), levels: [level(95)] }, 100)).toEqual({ supports: [level(95)], resistances: [] });
  });

  it("draws three ranked support and resistance zones plus the exact profile boundaries", () => {
    expect(keyLevelOverlays(analysis(), 100, null)).toEqual([
      { id: "test-95", price: 95, lower: 94.9, upper: 95.1, rank: 1, label: "支撑 1", tone: "support" },
      { id: "test-90", price: 90, lower: 89.9, upper: 90.1, rank: 2, label: "支撑 2", tone: "support" },
      { id: "test-60", price: 60, lower: 59.9, upper: 60.1, rank: 3, label: "支撑 3", tone: "support" },
      { id: "test-105", price: 105, lower: 104.9, upper: 105.1, rank: 1, label: "压力 1", tone: "resistance" },
      { id: "test-110", price: 110, lower: 109.9, upper: 110.1, rank: 2, label: "压力 2", tone: "resistance" },
      { id: "test-180", price: 180, lower: 179.9, upper: 180.1, rank: 3, label: "压力 3", tone: "resistance" },
      { id: "poc", price: 100, label: "密集价 POC", tone: "profile" },
      { id: "vah", price: 115, label: "价值区上沿", tone: "area" },
      { id: "val", price: 85, label: "价值区下沿", tone: "area" },
    ]);
  });

  it("includes a selected farther level once without duplicating an already visible level", () => {
    const far = keyLevelOverlays(analysis(), 100, "test-220");
    expect(far.filter((item) => item.id === "test-220")).toEqual([
      { id: "test-220", price: 220, lower: 219.9, upper: 220.1, rank: 4, label: "压力 4", tone: "resistance" },
    ]);
    expect(keyLevelOverlays(analysis(), 100, "test-95").filter((item) => item.id === "test-95")).toHaveLength(1);
    expect(keyLevelOverlays(analysis(), 100, "poc").filter((item) => item.id === "poc")).toHaveLength(1);
  });

  it("updates line semantics with price and omits missing volume estimates", () => {
    const input = { ...analysis(), volumeProfile: null };
    const lines = keyLevelOverlays(input, 108, null);
    expect(lines.find((line) => line.id === "test-105")).toMatchObject({ label: "支撑 1", tone: "support" });
    expect(lines.find((line) => line.id === "test-110")).toMatchObject({ label: "压力 1", tone: "resistance" });
    expect(lines).toHaveLength(6);
    expect(lines.some((line) => line.tone === "profile" || line.tone === "area")).toBe(false);
  });

  it("always shows the current price zone without misclassifying it as resistance", () => {
    expect(keyLevelOverlays(analysis(), 105.05, null).find((line) => line.id === "test-105")).toMatchObject({ label: "现价区域", tone: "area" });
  });

  it("honors layer visibility even when a hidden level was selected", () => {
    const input = analysis();
    expect(keyLevelOverlays(input, 100, "test-220", { supportResistance: false }).map((line) => line.id)).toEqual(["poc", "vah", "val"]);
    expect(keyLevelOverlays(input, 100, "poc", { profile: false }).every((line) => line.rank !== undefined)).toBe(true);
    expect(keyLevelOverlays(input, 100, "test-220", { supportResistance: false, profile: false, fibonacci: false })).toEqual([]);
  });

  it("extracts and deduplicates only existing Fibonacci evidence and leaves that layer off by default", () => {
    const evidence = { method: "fibonacci" as const, label: "upswing_0.618", price: 88.24, weight: 1, anchorAt: AS_OF, confirmedAt: AS_OF };
    const input = { ...analysis(), levels: [
      { ...level(90), methods: ["fibonacci" as const], evidence: [evidence, evidence] },
      { ...level(95), evidence: [evidence, { ...evidence, method: "pivot" as const, label: "R1", price: 120 }] },
    ] };
    const expected = { id: "fib:upswing_0.618:88.24", price: 88.24, label: "Fib 61.8%", tone: "fibonacci" };
    expect(fibonacciOverlays(input)).toEqual([expected]);
    expect(keyLevelOverlays(input, 100, expected.id).some((line) => line.tone === "fibonacci")).toBe(false);
    expect(keyLevelOverlays(input, 100, expected.id, { supportResistance: false, profile: false, fibonacci: true })).toEqual([expected]);
    expect(fibonacciOverlays(null)).toEqual([]);
    expect(fibonacciOverlays(analysis())).toEqual([]);
  });

  it("labels the actual methods without exposing algorithm weights as confidence", () => {
    const candidate = { ...level(95, 99), methods: ["swing_high", "swing_low", "pivot", "fibonacci", "hvn"] as const };
    expect(keyLevelBasis(candidate)).toBe("前高 · 前低 · Pivot · 斐波那契 · 成交密集节点");
    expect(keyLevelBasis(candidate, true)).toBe("前高 · 前低 +3");
    expect(keyLevelBasis(candidate)).not.toContain("99");
  });
});

describe("same-origin chart response boundary", () => {
  it.each(["fresh", "stale"] as const)("preserves complete metadata for a verified %s response", (status) => {
    const input = { ...datum(), status, stale: status === "stale" };
    expect(parseWorkbenchCandles(input, "btc", "1h")).toBe(input);
    expect(publicCandles(input)).toBe(input.value);
  });

  it.each(["fresh", "stale"] as const)("blocks synthetic %s responses in parsing and rendering", (status) => {
    const input = { ...datum(), status, provenance: "synthetic" as const };
    expect(() => parseWorkbenchCandles(input, "btc", "1h")).toThrow("Invalid public chart data");
    expect(publicCandles(input)).toEqual([]);
  });

  it("accepts unavailable data without manufacturing a candle or zero price", () => {
    const input = unavailableDatum(chartCandleCapability("btc"), "no_data");
    expect(parseWorkbenchCandles(input, "btc", "1h")).toBe(input);
    expect(publicCandles(input)).toEqual([]);
  });

  it("rejects a valid series for a different asset or timeframe", () => {
    expect(() => parseWorkbenchCandles(datum(candles(61, "eth")), "btc", "1h")).toThrow("Chart scope mismatch");
    expect(() => parseWorkbenchCandles(datum(candles(61, "btc", "15m")), "btc", "1h")).toThrow("Chart scope mismatch");
  });

  it.each([
    ["mixed asset", { asset: "eth", symbol: "ETHUSDT" }],
    ["symbol", { symbol: "ETHUSDT" }],
    ["quote currency", { quoteCurrency: "USD" }],
  ])("rejects %s contamination within a series", (_label, fields) => {
    const input = datum();
    const invalid = { ...input, value: [{ ...input.value[0], ...fields }, ...input.value.slice(1)] };
    expect(() => parseWorkbenchCandles(invalid, "btc", "1h")).toThrow("Chart scope mismatch");
  });

  it.each([
    ["missing source", { source: null }],
    ["missing scope", { scope: null }],
    ["bad update timestamp", { updatedAt: "not-a-date" }],
    ["bad retrieval timestamp", { retrievedAt: "not-a-date" }],
    ["empty candles", { value: [] }],
  ])("rejects %s rather than losing the data contract", (_label, fields) => {
    expect(() => parseWorkbenchCandles({ ...datum(), ...fields }, "btc", "1h")).toThrow("Invalid public chart data");
  });

  it("rejects invalid OHLC values and malformed envelopes", () => {
    const input = datum();
    expect(() => parseWorkbenchCandles({ ...input, value: [{ ...input.value[0], close: Number.NaN }] }, "btc", "1h")).toThrow();
    for (const invalid of [null, "invalid", {}, { ...input, cache: null }, { ...input, status: "ready" }]) {
      expect(() => parseWorkbenchCandles(invalid, "btc", "1h")).toThrow();
    }
  });

  it("renders absent and non-finite values as unavailable, retaining a real zero change", () => {
    for (const missing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatPrice(missing)).toBe("—");
      expect(formatChange(missing)).toBe("—");
    }
    expect(formatChange(0)).toBe("0.00%");
    expect(formatChange(1.25)).toBe("+1.25%");
    expect(formatChange(-1.25)).toBe("-1.25%");
  });
});
