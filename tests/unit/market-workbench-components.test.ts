import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketWorkbench, resolveCycleIssueState, resolveHistoryEventSelection, resolveLongHistoryIssueState, resolveResearchIssueState } from "@/components/assets/market-workbench";
import { MarketChartCanvas } from "@/components/assets/market-chart-canvas";
import { MarketResearchPanel } from "@/components/assets/market-research-panel";
import { analyzeKeyLevels, type ComputedKeyLevel } from "@/lib/market/key-levels";
import { buildLiveChartPoints, type ChartCandle } from "@/lib/market/live-chart";
import { analyzeMultiTimeframeCandles } from "@/lib/market/multi-timeframe";
import type { HistoricalContextAnalysis } from "@/lib/market/historical-context";
import type { LongTermHistoryAnalysis, MarketCycleAnalysis } from "@/lib/market/long-term-history";
import {
  expirePublicResearchSnapshot,
  publicResearchExpiresAt,
  type PublicResearchSnapshot,
} from "@/lib/market/public-research";
import {
  unavailableDatum,
  type AvailableMarketDatum,
  type ErrorMarketDatum,
  type MarketCapability,
} from "@/server/data/contracts/market-data";

const SOURCE = { id: "internal-source-sentinel", label: "DO_NOT_RENDER_PROVIDER", url: "https://example.com/internal-provenance" };
const AS_OF = "2026-08-11T00:05:00.000Z";
const START = Date.parse("2026-08-01T00:00:00.000Z");
const candles: readonly ChartCandle[] = Array.from({ length: 241 }, (_, index) => ({
  asset: "btc",
  symbol: "BTCUSDT",
  quoteCurrency: "USDT",
  interval: "1h",
  state: index === 240 ? "forming" : "closed",
  openedAt: new Date(START + index * 3_600_000).toISOString(),
  closedAt: new Date(START + (index + 1) * 3_600_000 - 1).toISOString(),
  open: 100 + index / 10,
  close: 100.5 + index / 10,
  high: 102 + index / 10,
  low: 99 + index / 10,
  volume: 100,
}));
const points = buildLiveChartPoints(candles);
const noop = () => {};

function available<T>(capability: MarketCapability, value: T): AvailableMarketDatum<T> {
  return {
    status: "fresh", capability, value, source: SOURCE,
    scope: { kind: "venue", label: "DO_NOT_RENDER_SCOPE" },
    updatedAt: AS_OF, retrievedAt: AS_OF,
    loading: false, stale: false, error: null, provenance: "live",
    cache: { status: "hit", revalidateSeconds: 5, staleIfErrorSeconds: 300 },
  };
}

function failed(capability: MarketCapability): ErrorMarketDatum {
  return {
    status: "error", capability, value: null, source: SOURCE,
    scope: { kind: "derived", label: "test" }, updatedAt: null,
    retrievedAt: AS_OF, loading: false, stale: false,
    error: { code: "upstream_error", retryable: true },
    cache: { status: "miss", revalidateSeconds: 5, staleIfErrorSeconds: 300 },
  };
}

function snapshot(): PublicResearchSnapshot {
  return {
    asset: "btc",
    interval: "1h",
    levels: available("analysis.btc-key-levels", analyzeKeyLevels(candles)!),
    history: available("analysis.btc-historical-context", historicalContext()),
    longHistory: available("analysis.btc-long-term-history", longTermHistory()),
    cycle: available("analysis.btc-market-cycle", marketCycle()),
    timeframes: [{ interval: "1h", datum: available("analysis.btc-multi-timeframe", analyzeMultiTimeframeCandles(candles)!) }],
  };
}

function marketCycle(): MarketCycleAnalysis {
  const earliest = {
    regime: "transition" as const,
    startedAt: "2026-07-24T23:59:59.999Z",
    endedAt: "2026-07-25T23:59:59.999Z",
    startedBy: "first_classifiable" as const,
    endedBy: "regime_change" as const,
    durationDays: 2,
    closedDailyCandleCount: 2,
    startClose: 100,
    endClose: 101,
    returnPercent: 1,
    peakCloseReturnPercent: 1,
    maxDrawdownPercent: 0,
  };
  const earlierBull = {
    regime: "bull" as const,
    startedAt: "2026-07-26T23:59:59.999Z",
    endedAt: "2026-07-27T23:59:59.999Z",
    startedBy: "regime_change" as const,
    endedBy: "regime_change" as const,
    durationDays: 2,
    closedDailyCandleCount: 2,
    startClose: 101,
    endClose: 105,
    returnPercent: 3.96,
    peakCloseReturnPercent: 3.96,
    maxDrawdownPercent: 0,
  };
  const transition = {
    regime: "transition" as const,
    startedAt: "2026-07-28T23:59:59.999Z",
    endedAt: "2026-07-30T23:59:59.999Z",
    startedBy: "regime_change" as const,
    endedBy: "regime_change" as const,
    durationDays: 3,
    closedDailyCandleCount: 3,
    startClose: 105,
    endClose: 102,
    returnPercent: -2.86,
    peakCloseReturnPercent: 0,
    maxDrawdownPercent: 2.86,
  };
  const bear = {
    regime: "bear" as const,
    startedAt: "2026-07-31T23:59:59.999Z",
    endedAt: "2026-08-02T23:59:59.999Z",
    startedBy: "regime_change" as const,
    endedBy: "regime_change" as const,
    durationDays: 3,
    closedDailyCandleCount: 3,
    startClose: 102,
    endClose: 120,
    returnPercent: 17.65,
    peakCloseReturnPercent: 17.65,
    maxDrawdownPercent: 2,
  };
  const current = {
    regime: "bull" as const,
    startedAt: "2026-08-03T23:59:59.999Z",
    endedAt: "2026-08-10T23:59:59.999Z",
    startedBy: "regime_change" as const,
    endedBy: "coverage_end" as const,
    durationDays: 8,
    closedDailyCandleCount: 8,
    startClose: 120,
    endClose: 130,
    returnPercent: 8.33,
    peakCloseReturnPercent: 10,
    maxDrawdownPercent: 3.5,
  };
  const metric = (median: number, q25: number, q75: number) => ({ median, q25, q75 });
  const distribution = (sampleCount: number) => ({
    sampleCount,
    durationDays: metric(120, 60, 180),
    returnPercent: metric(12, -8, 35),
    peakCloseReturnPercent: metric(28, 10, 70),
    maxDrawdownPercent: metric(18, 9, 30),
  });
  return {
    asset: "btc",
    symbol: "BTCUSDT",
    current,
    timeline: [earliest, earlierBull, transition, bear, current],
    distributions: {
      bull: distribution(3),
      bear: distribution(2),
      transition: distribution(4),
    },
    coverage: {
      archiveFromOpenedAt: "2017-08-01T00:00:00.000Z",
      archiveToClosedAt: "2026-08-01T23:59:59.999Z",
      continuedToClosedAt: current.endedAt,
      archivedEpisodeCount: 11,
      completedEpisodeCount: 9,
    },
    generatedAt: "2026-08-11T02:00:00.000Z",
    versions: {
      artifactSchema: "long-term-historical-artifact-v5",
      dataset: "d".repeat(64),
      dailyDataset: "e".repeat(64),
      regimeAlgorithm: "daily-close-ema50-ema200-v1",
      episodeAlgorithm: "daily-regime-episodes-close-v1",
    },
  };
}

function longTermHistory(options: Readonly<{ sameIndependent?: number; allIndependent?: number }> = {}): LongTermHistoryAnalysis {
  const buildCohort = (eventCount: number, independent24: number): LongTermHistoryAnalysis["cohorts"]["all"] => ({
    status: independent24 >= 20 ? "sufficient" : "insufficient",
    eventCount,
    eventRange: {
      firstEventOpenedAt: "2018-01-01T00:00:00.000Z",
      lastEventOpenedAt: "2026-07-01T00:00:00.000Z",
    },
    horizons: ([6, 12, 24] as const).map((bars) => {
      const independentSampleCount = bars === 24 ? independent24 : Math.min(eventCount, independent24 + (24 - bars) / 3);
      return {
        bars,
        sampleCount: eventCount,
        independentSampleCount,
        medianReturnPercent: bars === 6 ? 0.4 : bars === 12 ? 0.9 : 1.6,
        q25ReturnPercent: bars === 6 ? -0.8 : bars === 12 ? -1.1 : -1.9,
        q75ReturnPercent: bars === 6 ? 1.2 : bars === 12 ? 2.1 : 3.4,
        maxUpsidePercent: 8,
        maxDownsidePercent: -7,
        positiveReturnRatePercent: independentSampleCount >= 20 ? 56 : null,
      };
    }),
  });
  return {
    asset: "btc",
    symbol: "BTCUSDT",
    interval: "1h",
    current: {
      fingerprint: "price:above,above,above|order:short_above_long:EMA10>EMA20>EMA50",
      closedAt: candles[239].closedAt,
      regime: "bull",
      regimeAsOf: "2026-08-10T23:59:59.999Z",
      close: candles[239].close,
      ema50: 110,
      ema200: 90,
    },
    cohorts: {
      sameRegime: buildCohort(18, options.sameIndependent ?? 10),
      all: buildCohort(80, options.allIndependent ?? 35),
    },
    regimeSummary: {
      bull: { dailyCandleCount: 1100, segmentCount: 8, firstClosedAt: "2018-01-01T23:59:59.999Z", lastClosedAt: "2026-08-10T23:59:59.999Z" },
      bear: { dailyCandleCount: 600, segmentCount: 7, firstClosedAt: "2018-02-01T23:59:59.999Z", lastClosedAt: "2025-02-01T23:59:59.999Z" },
      transition: { dailyCandleCount: 400, segmentCount: 14, firstClosedAt: "2018-03-01T23:59:59.999Z", lastClosedAt: "2026-04-01T23:59:59.999Z" },
    },
    coverage: {
      event: { closedCandleCount: 72_000, fromOpenedAt: "2017-08-01T00:00:00.000Z", toClosedAt: "2026-08-01T00:59:59.999Z" },
      daily: { sourceCandleCount: 2300, pointCount: 2101, fromOpenedAt: "2017-08-01T00:00:00.000Z", toClosedAt: "2026-08-01T23:59:59.999Z" },
      continuedToClosedAt: "2026-08-10T23:59:59.999Z",
    },
    generatedAt: "2026-08-11T02:00:00.000Z",
    versions: {
      artifactSchema: "long-term-historical-artifact-v2",
      dataset: "a".repeat(64),
      eventDataset: "b".repeat(64),
      dailyDataset: "c".repeat(64),
      baselineAlgorithm: "ema-fingerprint-daily-regime-v3",
      eventStudyAlgorithm: "closed-ema-context-v2",
      regimeAlgorithm: "daily-close-ema50-ema200-v1",
    },
  };
}

function historicalContext(eventCount = 3, sufficient = false): HistoricalContextAnalysis {
  const cases = (["q25", "median", "q75"] as const).slice(0, Math.min(3, eventCount)).map((representativeOf, index) => ({
    representativeOf,
    eventOpenedAt: candles[60 + index * 50].openedAt,
    eventClosedAt: candles[60 + index * 50].closedAt,
    eventClose: candles[60 + index * 50].close,
    outcomes: ([6, 12, 24] as const).map((bars) => ({ bars, returnPercent: (index - 1) * bars / 20, maxUpsidePercent: bars / 10, maxDownsidePercent: -bars / 12 })),
  }));
  return {
    asset: "btc",
    symbol: "BTCUSDT",
    interval: "1h",
    algorithmVersion: "closed-ema-context-v2",
    latestClosedAt: candles[239].closedAt,
    current: {
      openedAt: candles[239].openedAt,
      closedAt: candles[239].closedAt,
      close: candles[239].close,
      fingerprint: "price:above,above,above|order:short_above_long:EMA10>EMA20>EMA50",
      barsInState: 8,
      ema: { ema10: 123, ema20: 122, ema50: 120 },
      priceRelations: { ema10: "above", ema20: "above", ema50: "above" },
      ordering: { state: "short_above_long", expression: "EMA10 > EMA20 > EMA50" },
    },
    sample: {
      status: sufficient ? "sufficient" : "insufficient",
      closedCandleCount: 240,
      candidateEventCount: eventCount,
      eventCount,
      excludedIncompleteEventCount: 0,
      minimumDirectionSampleCount: 20,
      range: { fromOpenedAt: candles[0].openedAt, toClosedAt: candles[239].closedAt },
      eventRange: eventCount > 0 ? { firstEventOpenedAt: cases[0]?.eventOpenedAt ?? candles[0].openedAt, lastEventOpenedAt: cases.at(-1)?.eventOpenedAt ?? candles[0].openedAt } : null,
    },
    horizons: ([6, 12, 24] as const).map((bars) => ({
      bars,
      sampleCount: eventCount,
      independentSampleCount: eventCount,
      medianReturnPercent: eventCount > 0 ? bars / 100 : null,
      q25ReturnPercent: eventCount > 0 ? -bars / 100 : null,
      q75ReturnPercent: eventCount > 0 ? bars / 50 : null,
      maxUpsidePercent: eventCount > 0 ? bars / 10 : null,
      maxDownsidePercent: eventCount > 0 ? -bars / 12 : null,
      positiveReturnRatePercent: sufficient ? 55 : null,
    })),
    cases,
  };
}

function renderResearch(overrides: Partial<Parameters<typeof MarketResearchPanel>[0]> = {}) {
  return renderToStaticMarkup(createElement(MarketResearchPanel, {
    points, interval: "1h", snapshot: snapshot(), issue: false, delayed: false,
    selectedLevel: null, onSelectLevel: noop, onSelectInterval: noop, onRetry: noop,
    ...overrides,
  }));
}

function levelSnapshot(prices = [80, 90, 100, 110, 130, 140, 150, 160]): PublicResearchSnapshot {
  const levels: ComputedKeyLevel[] = prices.map((price) => ({
    id: `fixture-${price}`, price, lower: price - 0.1, upper: price + 0.1,
    strength: 99, methods: ["swing_high", "pivot"], confirmedAt: AS_OF, evidence: [],
  }));
  return { ...snapshot(), levels: available("analysis.btc-key-levels", { ...analyzeKeyLevels(candles)!, levels }) };
}

describe("public market workbench rendering", () => {
  it("renders the price and chart before research without exposing provider or retired UI clutter", () => {
    const html = renderToStaticMarkup(createElement(MarketWorkbench, {
      asset: "btc", initialDatum: available("historical.btc-chart-candles", candles),
    }));

    expect(html).toContain("124.50");
    expect(html).toContain("价格更新 08-11 08:05:00 北京时间");
    expect(html.indexOf('class="mw-price"')).toBeLessThan(html.indexOf('class="mw-canvas"'));
    expect(html.indexOf('class="mw-canvas"')).toBeLessThan(html.indexOf('class="mw-research"'));
    expect(html).toContain('role="img"');
    expect(html).toContain('tabindex="0"');
    for (const removed of [SOURCE.label, SOURCE.url, "DO_NOT_RENDER_SCOPE", "VIP", "可见区间统计", "查看最近 20", "图表范围与计算口径", 'class="asset-chart__data"']) {
      expect(html).not.toContain(removed);
    }
  });

  it("shows an explicit unavailable chart rather than a zero or fabricated price", () => {
    const html = renderToStaticMarkup(createElement(MarketWorkbench, {
      asset: "btc", initialDatum: unavailableDatum("historical.btc-chart-candles", "no_data"),
    }));
    expect(html).toContain("行情暂不可用");
    expect(html).toContain("重新加载");
    expect(html).not.toContain('class="mw-canvas"');
    expect(html).not.toContain('class="mw-price"><strong>0');
  });

  it("does not render synthetic chart fixtures as public prices", () => {
    const input = available("historical.btc-chart-candles", candles);
    const html = renderToStaticMarkup(createElement(MarketWorkbench, {
      asset: "btc", initialDatum: { ...input, provenance: "synthetic" },
    }));
    expect(html).toContain("行情暂不可用");
    expect(html).not.toContain("124.50");
  });

  it("orders automatic research by stage, history, levels, confirmation, then folded comparison", () => {
    const html = renderResearch();
    for (const title of ["当前阶段", "已闭合量能", "多周期位置", "历史参照", "关键位置", "确认与失效", "多周期对照", "成交密集价", "估算", "计算可承受仓位", "检查风险回报"]) {
      expect(html).toContain(title);
    }
    expect(html.indexOf("当前阶段")).toBeLessThan(html.indexOf("历史参照"));
    expect(html.indexOf("历史参照")).toBeLessThan(html.indexOf("关键位置"));
    expect(html.indexOf("关键位置")).toBeLessThan(html.indexOf("确认与失效"));
    expect(html).not.toContain("当前市场位置");
    expect(html).toContain('<details class="mw-timeframe-details">');
    expect(html).toContain('aria-label="在图表定位');
    expect(html).not.toContain("VIP");
    expect(html).not.toContain(SOURCE.label);
    expect(html).not.toContain(SOURCE.url);
  });

  it("presents the current cycle and timeline before the two long-history cohorts", () => {
    const html = renderResearch();
    for (const text of [
      "当前周期位置",
      "牛市结构",
      "第 8 个已闭合日",
      "阶段收盘变化",
      "+8.33%",
      "最高收盘涨幅",
      "+10.00%",
      "最大收盘回撤",
      "−3.5%",
      "自动客观解读",
      "历史 3 个完整同类阶段持续中位 120 天",
      "本轮低于历史中间区间",
      "阶段收盘变化历史中位 +12.00%",
      "最大收盘回撤幅度历史中位 18%",
      "最近周期时间轴",
      "固定规则形成的历史分段，不是官方牛熊定义，也不是未来预测",
      "当前 EMA 状态的长期对照",
      "事件进入时与当前同阶段 · 牛市结构",
      "全部长期历史",
      "18 次完整事件 · 10 组互不重叠样本",
      "80 次完整事件 · 35 组互不重叠样本",
      "覆盖 2017—2026 · 历史样本截至 2026-08-01 · 基线生成 2026-08-11",
      "中位与中间一半使用完整事件；方向占比仅使用互不重叠样本",
    ]) expect(html).toContain(text);
    expect(html.indexOf("当前周期位置")).toBeLessThan(html.indexOf("事件进入时与当前同阶段 · 牛市结构"));
    expect(html).toContain("查看更早 1 段");
    expect(html).toContain('<ol start="2">');
    expect(html).toContain("2026-07-24");
    expect(html).toContain("2026-07-28");
    expect(html).toContain("至今");
    expect(html.indexOf("事件进入时与当前同阶段 · 牛市结构")).toBeLessThan(html.indexOf("全部长期历史"));
    expect(html).toContain('aria-label="选择长期历史观察窗口"');
    expect(html).toContain('aria-pressed="true">24 根</button>');
    expect(html).toContain("收涨的互不重叠样本占比 56%");
    expect(html).not.toContain("胜率");
    expect(html).not.toContain("预测概率");
    expect(html).not.toContain("long-term-historical-artifact-v2");
    expect(html).not.toContain("aaaaaaaaaaaaaaaa");
    const cycleSection = html.slice(html.indexOf("当前周期位置"), html.indexOf("当前 EMA 状态的长期对照"));
    for (const prohibited of ["接近结束", "可能上涨", "可能下跌", "偏多", "偏空", "目标位", "胜率", "建议开"]) {
      expect(cycleSection).not.toContain(prohibited);
    }
    expect(cycleSection).not.toContain(SOURCE.label);
    expect(cycleSection).not.toContain("long-term-historical-artifact-v5");
    expect(cycleSection).not.toContain("dddddddddddddddd");
  });

  it("keeps plain-language cycle definitions progressive and non-prescriptive", () => {
    const html = renderResearch();
    const guide = html.slice(html.indexOf('class="mw-cycle-terms"'), html.indexOf("最近周期时间轴"));

    expect(html).toContain('<details class="mw-cycle-terms">');
    expect(html).not.toContain('<details class="mw-cycle-terms" open="">');
    expect(guide).toContain("这些词是什么意思？");
    expect(guide).toContain("简明说明");
    for (const term of ["牛市结构", "熊市结构", "过渡结构", "阶段收盘变化", "最高收盘涨幅", "最大收盘回撤", "历史中位数", "中间一半"]) {
      expect(guide).toContain(term);
    }
    expect(guide).toContain("不是盘中最高价");
    expect(guide).toContain("不预测下一阶段，也不提供交易建议");
    expect(html.indexOf('class="mw-cycle-terms"')).toBeLessThan(html.indexOf("最近周期时间轴"));
    expect(guide).not.toContain(SOURCE.label);
    for (const prohibited of ["建议做多", "建议做空", "目标价", "保证", "胜率"]) {
      expect(guide).not.toContain(prohibited);
    }
  });

  it("can emphasize a selected long-history horizon without mixing event and independent counts", () => {
    const html = renderResearch({ historyHorizon: 6 });
    expect(html).toContain('aria-pressed="true">6 根</button>');
    expect(html).toContain("后 6 根 · 约 6 小时");
    expect(html).toContain("全部完整事件");
    expect(html).toContain("中位 +0.40%");
    expect(html).toContain("完整事件的中间一半 -0.80% 至 +1.20%");
    expect(html).toContain("18 次完整事件 · 16 组互不重叠样本");
    expect(html).toContain("该窗口独立样本不足 20 组，不显示方向占比");
  });

  it("does not show a direction share when both long-history cohorts have fewer than 20 independent samples", () => {
    const data = snapshot();
    const html = renderResearch({
      snapshot: {
        ...data,
        longHistory: available("analysis.btc-long-term-history", longTermHistory({ sameIndependent: 8, allIndependent: 12 })),
      },
    });
    expect(html.match(/该窗口独立样本不足 20 组，不显示方向占比/g)).toHaveLength(2);
    expect(html).not.toContain("收涨的互不重叠样本占比");
  });

  it("bases the stage on the latest closed candle and labels the forming price separately", () => {
    const html = renderResearch();
    expect(html).toContain("最新闭合收盘");
    expect(html).toContain("盘中位置");
    expect(html).toContain("124.50 USDT");
    expect(html).toContain("闭合后才进入阶段判断");
    expect(html).toContain("最新闭合收盘相对均线");
  });

  it("places a server-rendered strategy slot after automatic research and before multi-period detail", () => {
    const html = renderResearch({ strategySlot: createElement("section", { "data-private-strategy-slot": true }, "策略边界") });

    expect(html.indexOf("data-private-strategy-slot")).toBeGreaterThan(-1);
    expect(html.indexOf("data-private-strategy-slot")).toBeGreaterThan(html.indexOf("确认与失效"));
    expect(html.indexOf("data-private-strategy-slot")).toBeLessThan(html.indexOf("多周期对照"));
  });

  it("renders an honest small-sample history summary and accessible representative cases", () => {
    const html = renderResearch();
    expect(html).toContain('<details class="mw-recent-history">');
    expect(html).not.toContain('<details class="mw-recent-history" open="">');
    expect(html).toContain("3</strong><span>次匹配事件");
    expect(html).toContain("样本不足");
    expect(html).toContain("仅有 3 组互不重叠样本");
    expect(html).toContain("不形成方向统计");
    expect(html).not.toContain("收涨样本占比");
    expect(html).toContain("数据覆盖 2026-08-01");
    expect(html).toContain("240 根闭合 K 线");
    expect(html).toContain("按后 24 根结果的偏弱、中位、偏强位置选取，不按方向挑选");
    expect(html.match(/aria-label="在图表定位(?:相对偏弱样本|中位样本|相对偏强样本)/g)).toHaveLength(3);
    expect(html).toContain("后 24 根变化 -1.20%");
    expect(html).not.toContain(SOURCE.label);
  });

  it("explains that 15-minute history is unsupported instead of filling zeroes", () => {
    const data = snapshot();
    const html = renderResearch({ interval: "15m", snapshot: { ...data, interval: "15m", history: unavailableDatum("analysis.btc-historical-context", "unsupported"), longHistory: unavailableDatum("analysis.btc-long-term-history", "unsupported") } });
    expect(html).toContain("当前周期位置");
    expect(html).toContain("最近周期时间轴");
    expect(html).toContain('<details class="mw-cycle-terms">');
    expect(html).toContain("15 分钟暂不进行精确 EMA 历史匹配");
    expect(html).not.toContain("0</strong><span>次匹配事件");
    expect(html).not.toContain("长期历史基线暂不可用");
    expect(html).not.toContain("当前 EMA 状态的长期对照");
  });

  it("labels a sufficient observed share as a sample ratio without a change sign", () => {
    const data = snapshot();
    const html = renderResearch({ snapshot: { ...data, history: available("analysis.btc-historical-context", historicalContext(25, true)) } });
    expect(html).toContain("收涨的互不重叠样本占比 55%");
    expect(html).not.toContain("收涨的互不重叠样本占比 +55%");
    expect(html).toContain("仅为历史描述，不能推断下一次方向");
    expect(html).not.toContain("预测概率");
  });

  it("keeps fresh key levels visible when only history needs a retry", () => {
    const data = snapshot();
    const html = renderResearch({
      snapshot: { ...data, history: unavailableDatum("analysis.btc-historical-context", "insufficient_history") },
      historyIssue: true,
    });
    expect(html).toContain("近期历史参照暂不可用");
    expect(html).toContain("重新获取");
    expect(html).toContain("关键位置");
    expect(html).toContain("成交密集价");
  });

  it("keeps history status independent from a level failure and retries a history error independently", () => {
    const data = snapshot();
    const levelFailure = renderResearch({ issue: true, historyIssue: false });
    const historySection = levelFailure.slice(
      levelFailure.indexOf('class="mw-research-section mw-history"'),
      levelFailure.indexOf('class="mw-research-section mw-levels-section"'),
    );
    expect(historySection).toContain("数据覆盖");
    expect(historySection).not.toContain("数据延迟");
    expect(historySection).not.toContain("重新获取");

    const historyFailure = renderResearch({
      snapshot: { ...data, history: failed("analysis.btc-historical-context") },
      issue: false,
      historyIssue: true,
    });
    expect(historyFailure).toContain("近期历史参照暂不可用");
    expect(historyFailure).toContain("重新获取");
    expect(historyFailure).toContain("成交密集价");
  });

  it("keeps recent history and key levels visible when only the long baseline fails", () => {
    const data = snapshot();
    const html = renderResearch({
      snapshot: { ...data, longHistory: failed("analysis.btc-long-term-history") },
      longHistoryIssue: true,
    });
    expect(html).toContain("长期历史基线暂不可用");
    expect(html).toContain("重新获取长期基线");
    expect(html).toContain("近期窗口与代表案例");
    expect(html).toContain("关键位置");
    expect(html).toContain("成交密集价");
  });

  it("keeps other research visible when only the daily cycle fails", () => {
    const data = snapshot();
    const html = renderResearch({
      snapshot: { ...data, cycle: failed("analysis.btc-market-cycle") },
      cycleIssue: true,
    });
    expect(html).toContain("当前日线周期暂不可用");
    expect(html).toContain("重新获取周期分析");
    expect(html).toContain("当前 EMA 状态的长期对照");
    expect(html).toContain("近期窗口与代表案例");
    expect(html).toContain("成交密集价");
  });

  it("invalidates a selected history case when refreshed markers no longer contain it", () => {
    const markers = [{ id: "current", openedAt: candles[60].openedAt, label: "中位样本", tone: "neutral" as const }];
    expect(resolveHistoryEventSelection(candles[60].openedAt, markers)).toBe(candles[60].openedAt);
    expect(resolveHistoryEventSelection(candles[61].openedAt, markers)).toBeNull();
    expect(resolveHistoryEventSelection(null, markers)).toBeNull();
  });

  it("marks both panels for a fetch failure without leaking levels expiry into history", () => {
    expect(resolveResearchIssueState({
      requestIssue: true, levelsExpired: false, historyExpired: false,
      levelsError: false, historyError: false,
    })).toEqual({ levelsIssue: true, historyIssue: true });
    expect(resolveResearchIssueState({
      requestIssue: false, levelsExpired: true, historyExpired: false,
      levelsError: false, historyError: false,
    })).toEqual({ levelsIssue: true, historyIssue: false });
    expect(resolveResearchIssueState({
      requestIssue: false, levelsExpired: false, historyExpired: false,
      levelsError: false, historyError: true,
    })).toEqual({ levelsIssue: false, historyIssue: true });
    expect(resolveLongHistoryIssueState({
      requestIssue: true, longHistoryExpired: false, longHistoryError: false,
    })).toBe(true);
    expect(resolveLongHistoryIssueState({
      requestIssue: false, longHistoryExpired: true, longHistoryError: false,
    })).toBe(true);
    expect(resolveLongHistoryIssueState({
      requestIssue: false, longHistoryExpired: false, longHistoryError: false,
    })).toBe(false);
    expect(resolveCycleIssueState({
      requestIssue: true, cycleExpired: false, cycleError: false,
    })).toBe(true);
    expect(resolveCycleIssueState({
      requestIssue: false, cycleExpired: true, cycleError: false,
    })).toBe(true);
    expect(resolveCycleIssueState({
      requestIssue: false, cycleExpired: false, cycleError: false,
    })).toBe(false);
  });

  it("renders only an explicit history-review notice and no current-fingerprint research", () => {
    const html = renderResearch({ historyReviewMode: true, onReturnToLatest: noop, strategySlot: createElement("section", { "data-private-strategy-slot": true }, "策略边界") });
    expect(html).toContain("历史核对模式");
    expect(html).toContain("正在查看过去的行情窗口");
    expect(html).toContain("今天的阶段、历史统计、关键位置、策略与多周期信息已全部隐藏");
    expect(html).toContain("返回最新行情");
    expect(html).not.toContain("当前阶段");
    expect(html).not.toContain("历史参照");
    expect(html).not.toContain("当前 EMA 状态");
    expect(html).not.toContain("当前周期位置");
    expect(html).not.toContain("最近周期时间轴");
    expect(html).not.toContain('class="mw-cycle-terms"');
    expect(html).not.toContain("近期窗口与代表案例");
    expect(html).not.toContain("成交密集价");
    expect(html).not.toContain("确认与失效");
    expect(html).not.toContain("data-private-strategy-slot");
    expect(html).not.toContain("多周期对照");
  });

  it("routes an expired retained market window through history-review mode", () => {
    const source = readFileSync(
      new URL("../../src/components/assets/market-workbench.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("const historicalView = historyReviewMode || market.expired;");
    expect(source).toContain("historyReviewMode={historicalView}");
  });

  it("keeps the chart controls and research narrative on the same analysis mode", () => {
    const workbench = renderToStaticMarkup(createElement(MarketWorkbench, {
      asset: "btc", initialDatum: available("historical.btc-chart-candles", candles),
    }));
    expect(workbench).toContain('aria-label="分析视角"');
    expect(workbench).toContain('aria-label="短线分析，EMA10 / 20 / 50" aria-pressed="true"');
    expect(workbench).toContain('aria-label="趋势分析，EMA20 / 50 / 200" aria-pressed="false"');

    const trend = renderResearch({ analysisMode: "trend" });
    expect(trend).toContain("趋势视角");
    expect(trend).toContain("EMA200");
    expect(trend).not.toContain("EMA10</span>");
  });

  it("shows three levels per side and keeps all remaining real candidates in native disclosure", () => {
    const html = renderResearch({ snapshot: levelSnapshot(), selectedLevel: "fixture-80" });
    const beforeDetails = html.split('<details class="mw-more-levels">')[0];
    expect(beforeDetails.match(/aria-label="在图表定位压力\d/g)).toHaveLength(3);
    expect(beforeDetails.match(/aria-label="在图表定位支撑\d/g)).toHaveLength(3);
    expect(beforeDetails).toContain("前高 · Pivot");
    expect(html).toContain('class="mw-more-levels"');
    expect(html).toContain("2 个候选");
    expect(html).toContain('aria-label="在图表定位压力4 160.00"');
    expect(html).toContain('aria-pressed="true" aria-label="在图表定位支撑4 80.00"');
    expect(html).toContain('class="mw-level-range">79.90 — 80.10');
    expect(html).toContain("多种依据重合不代表成功率");
    expect(html).not.toContain("99%");
  });

  it("does not manufacture missing ranks or omit a candidate exactly at the live price", () => {
    const sparse = renderResearch({ snapshot: levelSnapshot([110]) });
    expect(sparse).toContain('aria-label="在图表定位支撑1 110.00"');
    expect(sparse).not.toContain('aria-label="在图表定位支撑2');
    expect(sparse).not.toContain('aria-label="在图表定位压力1');
    expect(sparse).toContain("暂未识别");
    const exact = renderResearch({ snapshot: levelSnapshot([124.5]) });
    expect(exact).toContain('aria-label="在图表定位现价附近 124.50"');
    expect(exact).not.toContain('aria-label="在图表定位压力1');
  });

  it("uses zone edges as confirmation and invalidation thresholds", () => {
    const html = renderResearch({ snapshot: levelSnapshot() });

    expect(html).toContain("站上 <button");
    expect(html).toContain(">130.10</button> 压力区上沿");
    expect(html).toContain(">109.90</button> 支撑区下沿");
  });

  it("offers Fibonacci reference and both volume-area boundaries as chart targets", () => {
    const html = renderResearch();
    expect(html).toContain("斐波那契参考");
    expect(html).toContain('aria-label="在图表定位 Fib 61.8%');
    expect(html).toContain('aria-label="在图表定位价值区下沿');
    expect(html).toContain('aria-label="在图表定位价值区上沿');
  });

  it.each([{ delayed: true }, { issue: true }])("marks retained research delayed and suppresses immediate watch conditions: %o", (state) => {
    const html = renderResearch(state);
    expect(html).toContain("数据延迟");
    expect(html).toContain("等待数据恢复后更新观察条件");
    expect(html).toContain(" · 延迟");
    expect(html).not.toContain("观察价格能否站上");
  });

  it("distinguishes initial calculation from a failed request", () => {
    expect(renderResearch({ snapshot: null })).toContain("正在计算关键价位");
    const failed = renderResearch({ snapshot: null, issue: true });
    expect(failed).toContain("关键价位暂不可用");
    expect(failed).toContain("重新获取");
    expect(failed).not.toContain("正在计算关键价位");
  });

  it("expires retained research per datum without hiding a current peer", () => {
    const data = snapshot();
    const retrievedAt = Date.parse(AS_OF);
    const currentTimeframe = data.timeframes[0].datum;
    if (currentTimeframe.status !== "fresh" && currentTimeframe.status !== "stale") throw new Error("Fixture must be available");
    const mixed: PublicResearchSnapshot = {
      ...data,
      timeframes: [{
        ...data.timeframes[0],
        datum: {
          ...currentTimeframe,
          retrievedAt: new Date(retrievedAt + 120_000).toISOString(),
        },
      }],
    };

    expect(publicResearchExpiresAt(mixed)).toBe(retrievedAt + 300_000);
    const current = expirePublicResearchSnapshot(mixed, retrievedAt + 300_001);
    expect(current.levelsExpired).toBe(true);
    expect(current.historyExpired).toBe(true);
    expect(current.longHistoryExpired).toBe(true);
    expect(current.cycleExpired).toBe(true);
    expect(current.snapshot.levels.status).toBe("unavailable");
    expect(current.snapshot.cycle.status).toBe("unavailable");
    expect(current.expiredIntervals).toEqual([]);
    expect(current.snapshot.timeframes[0].datum.status).toBe("fresh");
    expect(publicResearchExpiresAt(mixed, retrievedAt + 300_001)).toBe(
      retrievedAt + 420_000,
    );
  });

  it("does not call a historical window endpoint the latest market price", () => {
    const html = renderToStaticMarkup(createElement(MarketChartCanvas, {
      points: points.slice(0, 80), emaKeys: ["ema10"], overlays: [], selectedLevel: null,
      showVolume: true, historicalView: true, onPan: noop, onZoom: noop, onReset: noop,
    }));
    expect(html).toContain("历史窗口末值");
    expect(html).not.toContain('class="mw-current-price"');
    expect(html).not.toContain('class="mw-current-line"');
  });

  it("does not stretch a historical view to a selected current key level", () => {
    const html = renderToStaticMarkup(createElement(MarketChartCanvas, {
      points: points.slice(0, 80), emaKeys: ["ema10"],
      overlays: [{ id: "far-current-level", price: 10000, label: "压力 4", tone: "resistance", rank: 4 }],
      selectedLevel: "far-current-level", showVolume: true, historicalView: true,
      onPan: noop, onZoom: noop, onReset: noop,
    }));
    expect(html).not.toContain('class="mw-level-line');
    expect(html).not.toContain("压力 4");
  });

  it("hides every current key level in history even when it falls inside the visible price range", () => {
    const html = renderToStaticMarkup(createElement(MarketChartCanvas, {
      points: points.slice(0, 80), emaKeys: ["ema10"],
      overlays: [{ id: "inside-current-level", price: 105, label: "压力 1", tone: "resistance", rank: 1 }],
      selectedLevel: null, showVolume: true, historicalView: true,
      onPan: noop, onZoom: noop, onReset: noop,
    }));
    expect(html).not.toContain('class="mw-level-line');
    expect(html).not.toContain("压力 1");
  });

  it("draws a historical marker only when its event candle is in the visible window", () => {
    const visible = points.slice(0, 80);
    const html = renderToStaticMarkup(createElement(MarketChartCanvas, {
      points: visible, emaKeys: ["ema10"], overlays: [], selectedLevel: null,
      eventMarkers: [
        { id: "visible", openedAt: visible[20].openedAt, label: "中位样本", tone: "neutral" },
        { id: "outside", openedAt: points[120].openedAt, label: "偏强样本", tone: "positive" },
      ],
      selectedEventAt: visible[20].openedAt, showVolume: true, historicalView: true,
      onPan: noop, onZoom: noop, onReset: noop,
    }));
    expect(html.match(/mw-history-marker/g)).toHaveLength(2);
    expect(html).toContain("中位样本");
    expect(html).not.toContain("偏强样本");
  });
});
