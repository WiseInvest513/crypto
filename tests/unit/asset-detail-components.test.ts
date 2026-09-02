import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssetDetailStreamPage } from "@/components/assets/asset-detail-page";
import type {
  AssetEditorialEntries,
  AssetEditorialEntry,
} from "@/lib/editorial/asset-editorial";
import {
  ANONYMOUS_USER_ACCESS,
  type UserAccess,
} from "@/lib/access/user-access";
import { analyzeDailyCandles } from "@/lib/market/technical-analysis";
import {
  analyzeMultiTimeframeCandles,
  MULTI_TIMEFRAME_INTERVALS,
} from "@/lib/market/multi-timeframe";
import type {
  Asset,
  AvailableMarketDatum,
  ChartCandle,
  ChartCandleInterval,
  DailyCandle,
  DataScope,
  DataSource,
  MarketDatum,
  MarketCapability,
} from "@/server/data/contracts/market-data";
import {
  chartCandleCapability,
  multiTimeframeCapability,
  unavailableDatum,
} from "@/server/data/contracts/market-data";
import type {
  AssetChartSnapshot,
  AssetDetailSnapshot,
} from "@/server/data/services/asset-detail-service";
import type { MultiTimeframeAccessPayload } from "@/server/data/services/multi-timeframe-service";

const UPDATED_AT = "2026-08-30T23:59:59.999Z";
const RETRIEVED_AT = "2026-08-31T00:05:00.000Z";
const NOW = Date.parse("2026-08-31T12:00:00.000Z");
const SOURCE: DataSource = {
  id: "verified-market",
  label: "已核验市场来源",
  url: "https://example.com/verified-market",
};
const CANDLE_SOURCE: DataSource = {
  id: "binance-spot",
  label: "Binance 现货市场数据",
  url: "https://example.com/binance-spot",
};
const EDITORIAL_SOURCE = {
  id: "research-note",
  label: "人工研究记录",
  url: "https://example.com/research-note",
};
const VIP_ACCESS = Object.freeze({
  tier: "vip",
  isAuthenticated: true,
  source: "verified-identity",
} satisfies UserAccess);

function available<T>(
  capability: MarketCapability,
  value: T,
  scope: DataScope,
  overrides: Partial<AvailableMarketDatum<T>> = {},
): AvailableMarketDatum<T> {
  return {
    status: "fresh",
    capability,
    value,
    source: SOURCE,
    scope,
    updatedAt: UPDATED_AT,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 900,
      staleIfErrorSeconds: 604_800,
    },
    error: null,
    ...overrides,
  };
}

function candles(asset: Asset, count = 60): readonly DailyCandle[] {
  const start = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 86_400_000;
  const base = asset === "btc" ? 90_000 : 3_000;
  return Array.from({ length: count }, (_, index) => {
    const close = base + index * (asset === "btc" ? 100 : 5);
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" as const : "ETHUSDT" as const,
      interval: "1d" as const,
      quoteCurrency: "USDT" as const,
      openedAt: new Date(start + index * day).toISOString(),
      closedAt: new Date(start + (index + 1) * day - 1).toISOString(),
      open: close - 20,
      high: close + 50,
      low: close - 60,
      close,
      volume: 10_000 + index,
    };
  });
}

function snapshot(asset: Asset): AssetDetailSnapshot {
  const history = candles(asset);
  const symbol = asset.toUpperCase();
  const technical = analyzeDailyCandles(history);
  return {
    asset,
    price: available(
      `spot.${asset}-price`,
      {
        asset,
        quoteCurrency: "USD",
        priceUsd: asset === "btc" ? 100_000 : 4_000,
        change24hPercent: 2.5,
        change7dPercent: -1.25,
        marketCapUsd: null,
      },
      { kind: "asset", label: `${symbol}/USD aggregate` },
    ),
    candles: available(
      `historical.${asset}-daily-candles`,
      history,
      { kind: "venue", label: `Binance ${symbol}USDT 日线` },
      { source: CANDLE_SOURCE },
    ),
    technical: available(
      `historical.${asset}-daily-candles`,
      technical,
      { kind: "derived", label: `SMA20 / SMA50 from ${symbol}USDT` },
      {
        source: {
          id: "wise-crypto-sma",
          label: "Wise Crypto 均线计算",
          url: "https://crypto.wise-invest.org",
          components: [CANDLE_SOURCE],
        },
        provenance: "derived",
      },
    ),
    funding: available(
      `derivatives.${asset}-funding`,
      {
        asset,
        symbol: `${symbol}USDT`,
        rate: 0.0001,
        intervalHours: 8,
      },
      { kind: "venue", label: `${symbol} derivatives venue` },
    ),
    openInterest: available(
      `derivatives.${asset}-open-interest`,
      {
        asset,
        symbol: `${symbol}USDT`,
        notional: 1_250_000_000,
        quoteCurrency: "USDT",
        samplingPeriod: "5m",
      },
      { kind: "venue", label: `${symbol} derivatives venue` },
    ),
    liquidations24h: available(
      "derivatives.total-liquidations",
      {
        asset: "all",
        totalUsd: 380_000_000,
        longUsd: 210_000_000,
        shortUsd: 170_000_000,
        window: "24h",
      },
      { kind: "global", label: "Global derivatives liquidations" },
    ),
    etfFlow: unavailableDatum(
      asset === "btc" ? "fund-flows.btc-etf" : "fund-flows.eth-etf",
      "license_restricted",
    ),
    comparison:
      asset === "btc"
        ? {
            kind: "btc-dominance",
            datum: available(
              "spot.btc-dominance",
              { btcDominancePercent: 57.25 },
              { kind: "global", label: "Global cryptocurrency market" },
            ),
          }
        : {
            kind: "eth-btc",
            datum: available(
              "spot.eth-btc",
              { ethBtcRatio: 0.04 },
              { kind: "derived", label: "ETH/USD ÷ BTC/USD" },
              { provenance: "derived" },
            ),
          },
  };
}

function unpublishedEditorial(): AssetEditorialEntries {
  const unpublished = <T,>(): AssetEditorialEntry<T> => ({
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: [],
    content: null,
  });
  return {
    keyLevels: unpublished(),
    wiseScenario: unpublished(),
  };
}

function publishedEditorial({
  effectiveAt = "2026-08-31T00:00:00.000Z",
  validUntil = "2026-09-01T00:00:00.000Z",
}: {
  effectiveAt?: string;
  validUntil?: string;
} = {}): AssetEditorialEntries {
  return {
    keyLevels: {
      publicationStatus: "published",
      effectiveAt,
      validUntil,
      lastReviewedAt: "2026-08-30T20:00:00.000Z",
      sources: [EDITORIAL_SOURCE],
      content: {
        quoteCurrency: "USDT",
        levels: [
          {
            id: "support-one",
            role: "support",
            price: 90_000,
            label: "测试支撑",
            rationale: "仅用于渲染测试的人工说明。",
            invalidationCondition: "日线收盘跌破后失效。",
            sourceIds: [EDITORIAL_SOURCE.id],
          },
          {
            id: "resistance-one",
            role: "resistance",
            price: 110_000,
            label: "测试阻力",
            rationale: "仅用于渲染测试的人工说明。",
            invalidationCondition: "日线收盘突破后失效。",
            sourceIds: [EDITORIAL_SOURCE.id],
          },
        ],
      },
    },
    wiseScenario: {
      publicationStatus: "published",
      effectiveAt,
      validUntil,
      lastReviewedAt: "2026-08-30T20:00:00.000Z",
      sources: [EDITORIAL_SOURCE],
      content: {
        stance: "wait",
        author: "Wise 测试研究员",
        timeframe: "未来 24 小时",
        headline: "人工测试情景",
        summary: "仅验证已审核情景的展示结构。",
        rationale: ["测试判断依据"],
        confirmationConditions: ["测试确认条件"],
        invalidationConditions: ["测试情景失效条件"],
        watchItems: ["测试观察项"],
        riskDisclosure: "测试风险说明",
        sourceIds: [EDITORIAL_SOURCE.id],
      },
    },
  };
}

function liveChartDatum(
  data: AssetDetailSnapshot,
): MarketDatum<readonly ChartCandle[]> {
  if (data.candles.status !== "fresh" && data.candles.status !== "stale") {
    return {
      ...data.candles,
      capability: chartCandleCapability(data.asset),
    } as MarketDatum<readonly ChartCandle[]>;
  }

  return {
    ...data.candles,
    capability: chartCandleCapability(data.asset),
    value: data.candles.value.map((candle) => ({
      ...candle,
      state: "closed" as const,
    })),
  };
}

function multiTimeframePayload(asset: Asset): MultiTimeframeAccessPayload {
  const intervalMilliseconds = {
    "15m": 15 * 60 * 1_000,
    "1h": 60 * 60 * 1_000,
    "4h": 4 * 60 * 60 * 1_000,
    "1d": 24 * 60 * 60 * 1_000,
  } as const satisfies Record<ChartCandleInterval, number>;
  const intervalBase = {
    "15m": 1_000,
    "1h": 2_000,
    "4h": 3_000,
    "1d": 4_000,
  } as const satisfies Record<ChartCandleInterval, number>;
  const start = Date.parse("2026-01-01T00:00:00.000Z");

  return {
    status: "granted",
    asset,
    intervals: MULTI_TIMEFRAME_INTERVALS.map((interval) => {
      const duration = intervalMilliseconds[interval];
      const source = Array.from({ length: 221 }, (_, index) => {
        const close = intervalBase[interval] + index;
        const openedAt = start + index * duration;
        return {
          asset,
          symbol: asset === "btc" ? "BTCUSDT" as const : "ETHUSDT" as const,
          interval,
          quoteCurrency: "USDT" as const,
          state: index === 220 ? "forming" as const : "closed" as const,
          openedAt: new Date(openedAt).toISOString(),
          closedAt: new Date(openedAt + duration - 1).toISOString(),
          open: close - 0.5,
          high: close + 1,
          low: close - 1,
          close,
          volume: 100 + index,
        } satisfies ChartCandle;
      });
      const analysis = analyzeMultiTimeframeCandles(source);
      if (analysis === null) {
        throw new Error("Multi-timeframe fixture requires sufficient history.");
      }

      return {
        interval,
        datum: available(
          multiTimeframeCapability(asset),
          analysis,
          {
            kind: "derived",
            label: `${asset.toUpperCase()}USDT ${interval} closed-candle facts`,
          },
          {
            source: {
              id: "wise-mtf-test",
              label: "Wise 多周期测试计算",
              url: "https://example.com/wise-mtf",
              components: [CANDLE_SOURCE],
            },
            updatedAt: analysis.latestClosedAt,
            provenance: "derived",
          },
        ),
      };
    }),
  };
}

async function renderAssetDetail(
  data: AssetDetailSnapshot,
  editorial: AssetEditorialEntries = unpublishedEditorial(),
  editorialNow = NOW,
  access: UserAccess = ANONYMOUS_USER_ACCESS,
  multiTimeframe: MultiTimeframeAccessPayload = {
    status: "locked",
    asset: data.asset,
  },
  liveChart: MarketDatum<readonly ChartCandle[]> = liveChartDatum(data),
): Promise<string> {
  const stream = await renderToReadableStream(
    AssetDetailStreamPage({
      asset: data.asset,
      price: Promise.resolve(data.price),
      chart: Promise.resolve({
        candles: data.candles,
        technical: data.technical,
      }),
      liveChart: Promise.resolve(liveChart),
      context: Promise.resolve({
        funding: data.funding,
        openInterest: data.openInterest,
        liquidations24h: data.liquidations24h,
        etfFlow: data.etfFlow,
        comparison: data.comparison,
      }),
      editorial: Promise.resolve({
        asset: data.asset,
        config: editorial,
        now: editorialNow,
      }),
      access: Promise.resolve(access),
      multiTimeframe: Promise.resolve(multiTimeframe),
    }),
  );
  await stream.allReady;
  const html = await new Response(stream).text();
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Timed out while waiting for streamed HTML.")),
          1_000,
        );
      }),
    ]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

describe("asset detail server rendering", () => {
  it("renders a chart-first BTC workbench with a compact market header and progressive details", async () => {
    const html = await renderAssetDetail(snapshot("btc"));

    expect(html).toContain('class="asset-switcher"');
    expect(html).toContain('aria-label="切换资产工作台"');
    expect(html).toContain('<a aria-current="page" href="/btc">BTC</a>');
    expect(html).toContain('<a href="/eth">ETH</a>');
    expect(html).toContain("BTC <span>比特币</span>");
    expect(html).toContain("95,900.00");
    expect(html).toContain("USDT");
    expect(html).toContain("Binance 最新已闭合日线收盘");
    expect(html).not.toContain("$100,000.00");
    expect(html).toContain("比特币行情图表");
    expect(html).toContain("BTCUSDT · Binance 现货 · USDT");
    expect(html).toContain('role="img"');
    expect(html).toContain("每 5 秒更新");
    expect(html).toContain("时间周期");
    expect(html).toContain("15 分");
    expect(html).toContain("1 小时");
    expect(html).toContain("4 小时");
    expect(html).toContain("日线");
    expect(html).toContain("分析视角");
    expect(html).toContain("价格");
    expect(html).toContain("短线");
    expect(html).toContain("趋势");
    expect(html).toContain("EMA 10 · 20 · 50");
    expect(html).toContain("EMA 20 · 50 · 200");
    expect(html).toContain("指标与范围");
    expect(html).toContain("单独选择 EMA");
    expect(html).toContain("可见数量");
    expect(html).toContain("历史窗口");
    expect(html).toContain("开盘");
    expect(html).toContain("最高");
    expect(html).toContain("最低");
    expect(html).toContain("收盘");
    expect(html).toContain("涨跌");
    expect(html).toContain("一眼结论");
    expect(html).toContain("已闭合 K 线区间位置");
    expect(html).toContain("下一次要确认什么");
    expect(html).toContain("事实会改变");
    expect(html).toContain("查看全部 EMA 对比");
    expect(html).toContain("EMA10");
    expect(html).toContain("EMA20");
    expect(html).toContain("EMA50");
    expect(html).toContain("近 3 根累计");
    expect(html).toContain("成交量（BTC）");
    expect(html).toContain("可见区间统计");
    expect(html).toContain("区间涨跌");
    expect(html).toContain("区间最高");
    expect(html).toContain("区间最低");
    expect(html).toContain("区间振幅");
    expect(html).toContain("末值区间位置");
    expect(html).toContain("机械统计");
    expect(html).toContain("全部已闭合");
    expect(html).toContain("图表范围与计算口径");
    expect(html).toContain("查看最近 20 根 K 线数据");
    expect(html).toContain("均线向上排列");
    expect(html).toContain("大周期背景 · 已闭合日线");
    expect(html).toContain("BTC SMA 结构");
    expect(html).toContain("SMA20");
    expect(html).toContain("SMA50");
    expect(html).toContain("全市场 24 小时强平");
    expect(html).toContain("BTC 市占率");
    expect(html).toContain("57.25%");
    expect(html).toContain("Binance 现货市场数据");
    expect(html).toContain("24 小时");
    expect(html).toContain("7 天");
    expect(html).not.toContain("BTC 资产摘要");
    expect(html).not.toContain("asset-summary");
    expect(html).not.toContain('href="#price"');
    expect(html).not.toContain('href="#trend"');
    expect(html).not.toContain('href="#vip-research"');
    expect(html).not.toContain('href="#derivatives"');
    expect(html).toContain('href="/tools/position-size?asset=btc"');
    expect(html).toContain('href="/tools/risk-reward?asset=btc"');
    expect(html).toContain('href="/tools/leverage?asset=btc"');
    expect(html).toContain('href="/tools/dca?asset=btc"');
    expect(html).toContain("链接只携带 BTC 资产标识");
    expect(html).toContain("BTC 行情策略台");
    expect(html).toContain("普通权限 · 内容已锁定");
    expect(html).toContain("查看 Wise Crypto VIP 权益");
    expect(html).toContain(
      'href="https://www.wise-invest.org/perk/crypto"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('href="#editorial"');
    expect(html).not.toContain("人工关键位尚未发布");
    expect(html).not.toContain("Wise Scenario 尚未发布");
    expect(html).toContain("尚未配置具备展示许可的数据源");
    expect(html).not.toMatch(/买入|卖出|目标价|保证收益/);
  });

  it("streams price and change data without waiting for the daily chart promise", async () => {
    const data = snapshot("btc");
    let resolveChart!: (value: AssetChartSnapshot) => void;
    const chart = new Promise<AssetChartSnapshot>((resolve) => {
      resolveChart = resolve;
    });
    const stream = await renderToReadableStream(
      AssetDetailStreamPage({
        asset: "btc",
        price: Promise.resolve(data.price),
        chart,
        liveChart: Promise.resolve(liveChartDatum(data)),
        context: Promise.resolve({
          funding: data.funding,
          openInterest: data.openInterest,
          liquidations24h: data.liquidations24h,
          etfFlow: data.etfFlow,
          comparison: data.comparison,
        }),
        editorial: Promise.resolve({
          asset: "btc",
          config: unpublishedEditorial(),
          now: NOW,
        }),
        access: Promise.resolve(ANONYMOUS_USER_ACCESS),
        multiTimeframe: Promise.resolve({
          status: "locked",
          asset: "btc",
        }),
      }),
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let initialHtml = "";
    const streamedMarketFacts = ["95,900.00", "+2.50%", "-1.25%"];
    for (
      let index = 0;
      index < 16 &&
      !streamedMarketFacts.every((fact) => initialHtml.includes(fact));
      index += 1
    ) {
      const chunk = await readStreamChunk(reader);
      initialHtml += decoder.decode(chunk.value, { stream: !chunk.done });
      if (chunk.done) {
        break;
      }
    }
    initialHtml = initialHtml.replace(/<!--[\s\S]*?-->/g, "");

    expect(initialHtml).toContain("95,900.00");
    expect(initialHtml).toContain("USDT");
    expect(initialHtml).toContain("Binance 最新已闭合日线收盘");
    expect(initialHtml).not.toContain("$100,000.00");
    expect(initialHtml).toContain("+2.50%");
    expect(initialHtml).toContain("-1.25%");
    expect(initialHtml).toContain("asset-workbench--loading");
    expect(initialHtml).not.toContain("BTC SMA 结构");

    resolveChart({ candles: data.candles, technical: data.technical });
    while (!(await reader.read()).done) {
      // Drain the completed response so React can close the stream cleanly.
    }
  });

  it("renders ETH/BTC on ETH without presenting BTC dominance", async () => {
    const html = await renderAssetDetail(snapshot("eth"));

    expect(html).toContain('<a aria-current="page" href="/eth">ETH</a>');
    expect(html).toContain('<a href="/btc">BTC</a>');
    expect(html).toContain("ETH <span>以太坊</span>");
    expect(html).toContain("ETH / BTC");
    expect(html).toContain("成交量（ETH）");
    expect(html).toContain("0.04000 BTC");
    expect(html).toContain('href="/tools/dca?asset=eth"');
    expect(html).not.toContain("BTC 市占率");
  });

  it("falls back to the latest verified Binance closed candle without calling it a USD spot quote", async () => {
    const data = snapshot("btc");
    data.price = unavailableDatum("spot.btc-price", "no_data");

    const html = await renderAssetDetail(data);

    expect(html).toContain("95,900.00");
    expect(html).toContain("USDT");
    expect(html).toContain("Binance 最新已闭合日线收盘");
    expect(html).toContain("不是实时现货价");
    expect(html).toContain("Binance 现货市场数据");
    expect(html).not.toContain("$95,900.00");
  });

  it("uses the verified closed daily chart when both live K-lines and aggregate price are unavailable", async () => {
    const data = snapshot("btc");
    data.price = unavailableDatum("spot.btc-price", "no_data");
    const liveUnavailable = unavailableDatum(
      chartCandleCapability("btc"),
      "no_data",
    );

    const html = await renderAssetDetail(
      data,
      unpublishedEditorial(),
      NOW,
      ANONYMOUS_USER_ACCESS,
      { status: "locked", asset: "btc" },
      liveUnavailable,
    );

    expect(html).toContain("Binance 最新已闭合日线收盘");
    expect(html).toContain(
      "聚合 USD 报价暂不可用；当前显示 Binance 最新已闭合日线收盘，不是实时现货价。",
    );
    expect(html).toContain(
      "实时 K 线暂不可用；当前显示 Binance 已闭合日线，不是实时现货走势。",
    );
    expect(html).toContain("95,900.00");
    expect(html).toContain('aria-pressed="true">日线</button>');
  });

  it("keeps forming-candle extremes out of the closed-only analysis range", async () => {
    const data = snapshot("btc");
    const baseLive = liveChartDatum(data);
    if (baseLive.status !== "fresh" && baseLive.status !== "stale") {
      throw new Error("Fixture live chart must be available.");
    }
    const lastClosed = baseLive.value.at(-1)!;
    const forming: ChartCandle = {
      ...lastClosed,
      state: "forming",
      openedAt: "2026-07-31T00:00:00.000Z",
      closedAt: "2026-07-31T23:59:59.999Z",
      high: 200_000,
      low: 1_000,
      close: 95_000,
    };
    const liveWithOutlier: MarketDatum<readonly ChartCandle[]> = {
      ...baseLive,
      value: [...baseLive.value, forming],
      updatedAt: "2026-07-31T12:00:00.000Z",
      updatedAtKind: "observed",
    };

    const html = await renderAssetDetail(
      data,
      unpublishedEditorial(),
      NOW,
      ANONYMOUS_USER_ACCESS,
      { status: "locked", asset: "btc" },
      liveWithOutlier,
    );

    expect(html).toContain("已闭合 K 线区间位置");
    expect(html).toContain(
      "<small>89,940.00</small><small>95,950.00</small>",
    );
    expect(html).toContain('<span class="asset-chart__fact-value">200,000.00</span>');
  });

  it("preserves stale, observation, retrieval and cache metadata in the asset summary", async () => {
    const data = snapshot("btc");
    if (data.price.status !== "fresh") {
      throw new Error("Fixture price must be available.");
    }
    data.price = {
      ...data.price,
      status: "stale",
      stale: true,
      updatedAtKind: "observed",
      cache: {
        ...data.price.cache,
        status: "hit",
      },
    };

    const html = await renderAssetDetail(data);

    expect(html).toContain("数据延迟");
    expect(html).toContain("服务器观测于 2026-08-30 23:59 UTC");
    expect(html).toContain("获取于 2026-08-31 00:05 UTC");
    expect(html).toContain("缓存命中");
  });

  it("blocks synthetic candles and technical values from public markup", async () => {
    const data = snapshot("btc");
    if (data.candles.status !== "fresh" || data.technical.status !== "fresh") {
      throw new Error("Fixture must be available.");
    }
    data.candles = {
      ...data.candles,
      provenance: "synthetic",
      source: {
        id: "mock-development-only",
        label: "Mock / Development only",
        url: "https://example.invalid/mock",
      },
    };
    data.technical = {
      ...data.technical,
      provenance: "synthetic",
      source: {
        id: "mock-development-only",
        label: "Mock / Development only",
        url: "https://example.invalid/mock",
      },
    };

    const html = await renderAssetDetail(data);

    expect(html).toContain("公开页面不会展示开发测试数据");
    expect(html).toContain("K 线数据暂不可用");
    expect(html).not.toContain("Mock / Development only");
    expect(html).not.toContain("95,900.00");
  });

  it("keeps unavailable derivatives in one compact coverage disclosure", async () => {
    const data = snapshot("btc");
    data.funding = unavailableDatum("derivatives.btc-funding", "no_data");
    data.openInterest = unavailableDatum(
      "derivatives.btc-open-interest",
      "no_data",
    );
    data.liquidations24h = unavailableDatum(
      "derivatives.total-liquidations",
      "no_reliable_source",
    );
    data.etfFlow = unavailableDatum(
      "fund-flows.btc-etf",
      "license_restricted",
    );
    data.comparison = {
      kind: "btc-dominance",
      datum: unavailableDatum("spot.btc-dominance", "no_data"),
    };

    const html = await renderAssetDetail(data);

    expect(html).toContain("衍生品与市场背景当前 0/5 项可用");
    expect(html).toContain("0/5 项可用 · 查看 5 项说明");
    expect(html).toContain("asset-facts-coverage");
    expect(html).toContain("coverage-row--unavailable");
    expect(html).not.toContain('class="asset-fact asset-fact--');
  });

  it("hides unpublished and scheduled editorial content from the main flow", async () => {
    const unpublishedHtml = await renderAssetDetail(snapshot("btc"));
    const scheduledHtml = await renderAssetDetail(
      snapshot("btc"),
      publishedEditorial({
        effectiveAt: "2026-09-02T00:00:00.000Z",
        validUntil: "2026-09-03T00:00:00.000Z",
      }),
    );

    for (const html of [unpublishedHtml, scheduledHtml]) {
      expect(html).not.toContain("asset-editorial-section");
      expect(html).not.toContain('href="#editorial"');
      expect(html).not.toContain("人工测试情景");
      expect(html).toContain("普通权限 · 内容已锁定");
    }
  });

  it("does not serialize active strategy content for a regular user", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      publishedEditorial(),
    );

    expect(html).toContain("普通权限 · 内容已锁定");
    expect(html).toContain("人工关键位与主观策略");
    expect(html).not.toContain("90,000.00 USDT");
    expect(html).not.toContain("110,000.00 USDT");
    expect(html).not.toContain("人工测试情景");
    expect(html).not.toContain("测试情景失效条件");
    expect(html).not.toContain("测试确认条件");
    expect(html).not.toContain("测试观察项");
    expect(html).not.toContain("仅用于渲染测试的人工说明");
    expect(html).not.toContain("人工研究记录");
    expect(html).not.toContain("审核于 2026-08-30 20:00 UTC");
    expect(html).not.toContain("Wise 测试研究员");
    expect(html).not.toContain("未来 24 小时");
    expect(html).not.toContain("测试判断依据");
    expect(html).not.toContain("测试风险说明");
  });

  it("does not render multi-timeframe facts when a regular response receives a forged granted payload", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      unpublishedEditorial(),
      NOW,
      ANONYMOUS_USER_ACCESS,
      multiTimeframePayload("btc"),
    );

    expect(html).toContain("多周期客观参考");
    expect(html).toContain("VIP 内容");
    expect(html).not.toContain("asset-mtf__grid");
    expect(html).not.toContain("Wise 多周期测试计算");
    expect(html).not.toContain("1,219.00");
    expect(html).not.toContain("closed-ema-v1");
  });

  it("renders four closed-candle multi-timeframe fact sets only for a verified VIP", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      unpublishedEditorial(),
      NOW,
      VIP_ACCESS,
      multiTimeframePayload("btc"),
    );

    expect(html).toContain("数据能力已上线");
    expect(html).toContain("4/4 个周期可用");
    expect(html).toContain("15 分钟");
    expect(html).toContain("1 小时");
    expect(html).toContain("4 小时");
    expect(html).toContain("1 日");
    expect(html).toContain("1,219.00");
    expect(html).toContain("2,219.00");
    expect(html).toContain("3,219.00");
    expect(html).toContain("4,219.00");
    expect(html).toContain("EMA10 &gt; EMA20 &gt; EMA50 &gt; EMA200");
    expect(html).toContain("收盘在上");
    expect(html).toContain("距近 20 根高点");
    expect(html).toContain("此前 20 根均量");
    expect(html).toContain("查看计算口径");
    expect(html).toContain("closed-ema-v1");
    expect(html).toContain("本次输入已发现并排除");
    expect(html).toContain("最低为 0%，最高为 100%");
    expect(html).toContain("Wise 多周期测试计算");
    expect(html).toContain("底层来源");
    expect(html).not.toMatch(/买入|卖出|目标价|保证收益/);
  });

  it("blocks synthetic multi-timeframe values while retaining honest coverage", async () => {
    const payload = multiTimeframePayload("btc");
    if (payload.status !== "granted") {
      throw new Error("Fixture must be granted.");
    }
    const syntheticPayload: MultiTimeframeAccessPayload = {
      ...payload,
      intervals: payload.intervals.map((item, index) =>
        index === 0 &&
        (item.datum.status === "fresh" || item.datum.status === "stale")
          ? {
              ...item,
              datum: {
                ...item.datum,
                provenance: "synthetic" as const,
              },
            }
          : item,
      ),
    };

    const html = await renderAssetDetail(
      snapshot("btc"),
      unpublishedEditorial(),
      NOW,
      VIP_ACCESS,
      syntheticPayload,
    );

    expect(html).toContain("3/4 个周期可用");
    expect(html).toContain("公开页面不会展示开发测试数据");
    expect(html).not.toContain("1,219.00");
    expect(html).toContain("2,219.00");
  });

  it("keeps stale data visible while isolating multi-timeframe error and unavailable states", async () => {
    const payload = multiTimeframePayload("btc");
    if (payload.status !== "granted") {
      throw new Error("Fixture must be granted.");
    }
    const [staleItem, errorItem, unavailableItem, freshItem] = payload.intervals;
    if (
      staleItem.datum.status !== "fresh" &&
      staleItem.datum.status !== "stale"
    ) {
      throw new Error("Fixture interval must be available.");
    }
    const mixedPayload: MultiTimeframeAccessPayload = {
      ...payload,
      intervals: [
        {
          ...staleItem,
          datum: {
            ...staleItem.datum,
            status: "stale",
            stale: true,
            error: { code: "timeout", retryable: true },
          },
        },
        {
          interval: errorItem.interval,
          datum: {
            status: "error",
            capability: multiTimeframeCapability("btc"),
            value: null,
            source: CANDLE_SOURCE,
            scope: { kind: "derived", label: "BTCUSDT 1h 测试口径" },
            updatedAt: null,
            retrievedAt: RETRIEVED_AT,
            loading: false,
            stale: false,
            cache: errorItem.datum.cache,
            error: { code: "timeout", retryable: true },
          },
        },
        {
          interval: unavailableItem.interval,
          datum: {
            status: "unavailable",
            capability: multiTimeframeCapability("btc"),
            value: null,
            source: CANDLE_SOURCE,
            scope: { kind: "derived", label: "BTCUSDT 4h 测试口径" },
            updatedAt: null,
            retrievedAt: RETRIEVED_AT,
            loading: false,
            stale: false,
            cache: unavailableItem.datum.cache,
            error: null,
            reason: "insufficient_history",
          },
        },
        freshItem,
      ],
    };

    const html = await renderAssetDetail(
      snapshot("btc"),
      unpublishedEditorial(),
      NOW,
      VIP_ACCESS,
      mixedPayload,
    );

    expect(html).toContain("2/4 个周期可用");
    expect(html).toContain("数据延迟");
    expect(html).toContain("更新失败");
    expect(html).toContain("暂不可用");
    expect(html).toContain("历史数据不足，暂无法完成计算。");
    expect(html).toContain("Binance 现货市场数据");
  });

  it("shows an honest unpublished state to a verified VIP", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      unpublishedEditorial(),
      NOW,
      VIP_ACCESS,
    );

    expect(html).toContain("VIP 权限已验证");
    expect(html).toContain("本期人工策略尚未发布");
    expect(html).toContain("不复用过期内容");
    expect(html).not.toContain("asset-editorial-section");
    expect(html).not.toContain("查看 Wise Crypto VIP 权益");
  });

  it("distinguishes scheduled VIP strategy from unpublished content", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      publishedEditorial({
        effectiveAt: "2026-09-02T00:00:00.000Z",
        validUntil: "2026-09-03T00:00:00.000Z",
      }),
      NOW,
      VIP_ACCESS,
    );

    expect(html).toContain("本期人工策略已排期，尚未生效");
    expect(html).toContain("当前不会提前披露");
    expect(html).not.toContain("本期人工策略尚未发布");
    expect(html).not.toContain("人工测试情景");
  });

  it("reduces expired editorial content to a compact review notice", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      publishedEditorial({
        effectiveAt: "2026-08-30T21:00:00.000Z",
        validUntil: "2026-08-31T11:00:00.000Z",
      }),
      NOW,
      VIP_ACCESS,
    );

    expect(html).toContain("asset-editorial-expired");
    expect(html).toContain("人工关键位已过期");
    expect(html).toContain("Wise Scenario已过期");
    expect(html).not.toContain('href="#vip-research"');
    expect(html).not.toContain("90,000.00 USDT");
    expect(html).not.toContain("人工测试情景");
    expect(html).not.toContain("asset-editorial-panel");
  });

  it("renders reviewed levels and scenario metadata only when active", async () => {
    const editorial = publishedEditorial();

    const html = await renderAssetDetail(
      snapshot("btc"),
      editorial,
      NOW,
      VIP_ACCESS,
    );

    expect(html).toContain("VIP 权限已验证");
    expect(html).toContain("90,000.00 USDT");
    expect(html).toContain("110,000.00 USDT");
    expect(html).toContain("日线收盘跌破后失效");
    expect(html).toContain("人工测试情景");
    expect(html).toContain("人工倾向");
    expect(html).toContain("等待确认");
    expect(html).toContain("适用窗口");
    expect(html).toContain("未来 24 小时");
    expect(html).toContain("Wise 测试研究员");
    expect(html).toContain("判断依据");
    expect(html).toContain("测试判断依据");
    expect(html).toContain("风险说明");
    expect(html).toContain("测试风险说明");
    expect(html).toContain("测试情景失效条件");
    expect(html).toContain("审核于 2026-08-30 20:00 UTC");
    expect(html).toContain("人工研究记录");
    expect(html).not.toContain('href="#vip-research"');
  });
});
