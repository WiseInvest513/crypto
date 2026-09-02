import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssetDetailStreamPage } from "@/components/assets/asset-detail-page";
import type {
  AssetEditorialEntries,
  AssetEditorialEntry,
} from "@/lib/editorial/asset-editorial";
import { analyzeDailyCandles } from "@/lib/market/technical-analysis";
import type {
  Asset,
  AvailableMarketDatum,
  ChartCandle,
  DailyCandle,
  DataScope,
  DataSource,
  MarketDatum,
  MarketCapability,
} from "@/server/data/contracts/market-data";
import {
  chartCandleCapability,
  unavailableDatum,
} from "@/server/data/contracts/market-data";
import type {
  AssetChartSnapshot,
  AssetDetailSnapshot,
} from "@/server/data/services/asset-detail-service";

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
        headline: "人工测试情景",
        summary: "仅验证已审核情景的展示结构。",
        confirmationConditions: ["测试确认条件"],
        invalidationConditions: ["测试情景失效条件"],
        watchItems: ["测试观察项"],
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

async function renderAssetDetail(
  data: AssetDetailSnapshot,
  editorial: AssetEditorialEntries = unpublishedEditorial(),
  editorialNow = NOW,
): Promise<string> {
  const stream = await renderToReadableStream(
    AssetDetailStreamPage({
      asset: data.asset,
      price: Promise.resolve(data.price),
      chart: Promise.resolve({
        candles: data.candles,
        technical: data.technical,
      }),
      liveChart: Promise.resolve(liveChartDatum(data)),
      context: Promise.resolve({
        funding: data.funding,
        openInterest: data.openInterest,
        liquidations24h: data.liquidations24h,
        etfFlow: data.etfFlow,
        comparison: data.comparison,
      }),
      editorial,
      editorialNow,
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
  it("renders a usable BTC workbench with chart, SMA facts and source metadata", async () => {
    const html = await renderAssetDetail(snapshot("btc"));

    expect(html).toContain("资产工作台 · BTC");
    expect(html).toContain("$100,000.00");
    expect(html).toContain("实时 K 线工作台");
    expect(html).toContain("BTCUSDT · 1 日 · USDT");
    expect(html).toContain('role="img"');
    expect(html).toContain("查看最近 20 根 K 线数据");
    expect(html).toContain("5 秒检查");
    expect(html).toContain("分析视角");
    expect(html).toContain("短线");
    expect(html).toContain("EMA10 / 20 / 50");
    expect(html).toContain("当前周期分析");
    expect(html).toContain("先看价格与均线的位置");
    expect(html).toContain("最新已闭合 K 线");
    expect(html).toContain("EMA10");
    expect(html).toContain("EMA20");
    expect(html).toContain("EMA50");
    expect(html).toContain("近 3 根累计");
    expect(html).toContain("成交量（BTC）");
    expect(html).toContain("可见区间事实");
    expect(html).toContain("区间涨跌");
    expect(html).toContain("区间最高");
    expect(html).toContain("区间最低");
    expect(html).toContain("区间振幅");
    expect(html).toContain("末值区间位置");
    expect(html).toContain("机械统计");
    expect(html).toContain("全部已闭合");
    expect(html).toContain("均线向上排列");
    expect(html).toContain("BTC 日线背景");
    expect(html).toContain("SMA20");
    expect(html).toContain("SMA50");
    expect(html).toContain("全市场 24 小时强平");
    expect(html).toContain("BTC 市占率");
    expect(html).toContain("57.25%");
    expect(html).toContain("Binance 现货市场数据");
    expect(html).toContain("BTC 资产摘要");
    expect(html).toContain("24 小时");
    expect(html).toContain("7 天");
    expect(html).toContain("日线 SMA20");
    expect(html).toContain("日线 SMA50");
    expect(html).toContain("客观趋势");
    expect(html).toContain('href="#price"');
    expect(html).toContain('href="#trend"');
    expect(html).toContain('href="#derivatives"');
    expect(html).toContain('href="/tools/position-size?asset=btc"');
    expect(html).toContain('href="/tools/risk-reward?asset=btc"');
    expect(html).toContain('href="/tools/leverage?asset=btc"');
    expect(html).toContain('href="/tools/dca?asset=btc"');
    expect(html).toContain("链接只携带 BTC 资产标识");
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
        editorial: unpublishedEditorial(),
        editorialNow: NOW,
      }),
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let initialHtml = "";
    for (let index = 0; index < 8 && !initialHtml.includes("$100,000.00"); index += 1) {
      const chunk = await readStreamChunk(reader);
      initialHtml += decoder.decode(chunk.value, { stream: !chunk.done });
      if (chunk.done) {
        break;
      }
    }
    initialHtml = initialHtml.replace(/<!--[\s\S]*?-->/g, "");

    expect(initialHtml).toContain("$100,000.00");
    expect(initialHtml).toContain("+2.50%");
    expect(initialHtml).toContain("-1.25%");
    expect(initialHtml).toContain("asset-summary__segment--loading");

    resolveChart({ candles: data.candles, technical: data.technical });
    while (!(await reader.read()).done) {
      // Drain the completed response so React can close the stream cleanly.
    }
  });

  it("renders ETH/BTC on ETH without presenting BTC dominance", async () => {
    const html = await renderAssetDetail(snapshot("eth"));

    expect(html).toContain("资产工作台 · ETH");
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
    expect(html).toContain("实时 K 线暂不可用");
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
    }
  });

  it("reduces expired editorial content to a compact review notice", async () => {
    const html = await renderAssetDetail(
      snapshot("btc"),
      publishedEditorial({
        effectiveAt: "2026-08-30T21:00:00.000Z",
        validUntil: "2026-08-31T11:00:00.000Z",
      }),
    );

    expect(html).toContain("asset-editorial-expired");
    expect(html).toContain("人工关键位已过期");
    expect(html).toContain("Wise Scenario已过期");
    expect(html).toContain('href="#editorial"');
    expect(html).not.toContain("90,000.00 USDT");
    expect(html).not.toContain("人工测试情景");
    expect(html).not.toContain("asset-editorial-panel");
  });

  it("renders reviewed levels and scenario metadata only when active", async () => {
    const editorial = publishedEditorial();

    const html = await renderAssetDetail(snapshot("btc"), editorial);

    expect(html).toContain("90,000.00 USDT");
    expect(html).toContain("110,000.00 USDT");
    expect(html).toContain("日线收盘跌破后失效");
    expect(html).toContain("人工测试情景");
    expect(html).toContain("测试情景失效条件");
    expect(html).toContain("审核于 2026-08-30 20:00 UTC");
    expect(html).toContain("人工研究记录");
    expect(html).toContain('href="#editorial"');
  });
});
