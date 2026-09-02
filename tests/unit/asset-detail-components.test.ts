import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssetDetailPage } from "@/components/assets/asset-detail-page";
import type {
  AssetEditorialEntries,
  AssetEditorialEntry,
} from "@/lib/editorial/asset-editorial";
import { analyzeDailyCandles } from "@/lib/market/technical-analysis";
import type {
  Asset,
  AvailableMarketDatum,
  DailyCandle,
  DataScope,
  DataSource,
  MarketCapability,
} from "@/server/data/contracts/market-data";
import { unavailableDatum } from "@/server/data/contracts/market-data";
import type { AssetDetailSnapshot } from "@/server/data/services/asset-detail-service";

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

describe("asset detail server rendering", () => {
  it("renders a usable BTC workbench with chart, SMA facts and source metadata", async () => {
    const html = renderToStaticMarkup(
      await AssetDetailPage({
        asset: "btc",
        snapshot: Promise.resolve(snapshot("btc")),
        editorial: unpublishedEditorial(),
        editorialNow: NOW,
      }),
    );

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
    expect(html).toContain("人工关键位尚未发布");
    expect(html).toContain("Wise Scenario 尚未发布");
    expect(html).toContain("尚未配置具备展示许可的数据源");
    expect(html).not.toMatch(/买入|卖出|目标价|保证收益/);
  });

  it("renders ETH/BTC on ETH without presenting BTC dominance", async () => {
    const html = renderToStaticMarkup(
      await AssetDetailPage({
        asset: "eth",
        snapshot: Promise.resolve(snapshot("eth")),
        editorial: unpublishedEditorial(),
        editorialNow: NOW,
      }),
    );

    expect(html).toContain("资产工作台 · ETH");
    expect(html).toContain("ETH / BTC");
    expect(html).toContain("成交量（ETH）");
    expect(html).toContain("0.04000 BTC");
    expect(html).not.toContain("BTC 市占率");
  });

  it("falls back to the latest verified Binance closed candle without calling it a USD spot quote", async () => {
    const data = snapshot("btc");
    data.price = unavailableDatum("spot.btc-price", "no_data");

    const html = renderToStaticMarkup(
      await AssetDetailPage({
        asset: "btc",
        snapshot: Promise.resolve(data),
        editorial: unpublishedEditorial(),
        editorialNow: NOW,
      }),
    );

    expect(html).toContain("95,900.00");
    expect(html).toContain("USDT");
    expect(html).toContain("Binance 最新已闭合日线收盘");
    expect(html).toContain("不是实时现货价");
    expect(html).toContain("Binance 现货市场数据");
    expect(html).not.toContain("$95,900.00");
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

    const html = renderToStaticMarkup(
      await AssetDetailPage({
        asset: "btc",
        snapshot: Promise.resolve(data),
        editorial: unpublishedEditorial(),
        editorialNow: NOW,
      }),
    );

    expect(html).toContain("公开页面不会展示开发测试数据");
    expect(html).not.toContain("Mock / Development only");
    expect(html).not.toContain("实时 K 线工作台");
  });

  it("renders reviewed levels and scenario metadata only when active", async () => {
    const editorial: AssetEditorialEntries = {
      keyLevels: {
        publicationStatus: "published",
        effectiveAt: "2026-08-31T00:00:00.000Z",
        validUntil: "2026-09-01T00:00:00.000Z",
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
        effectiveAt: "2026-08-31T00:00:00.000Z",
        validUntil: "2026-09-01T00:00:00.000Z",
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

    const html = renderToStaticMarkup(
      await AssetDetailPage({
        asset: "btc",
        snapshot: Promise.resolve(snapshot("btc")),
        editorial,
        editorialNow: NOW,
      }),
    );

    expect(html).toContain("90,000.00 USDT");
    expect(html).toContain("110,000.00 USDT");
    expect(html).toContain("日线收盘跌破后失效");
    expect(html).toContain("人工测试情景");
    expect(html).toContain("测试情景失效条件");
    expect(html).toContain("审核于 2026-08-30 20:00 UTC");
    expect(html).toContain("人工研究记录");
  });
});
