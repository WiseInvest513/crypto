import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HomepageEditorialPanels,
  MarketStatusPanel,
  TodayInCryptoPanel,
  WiseTakePanel,
} from "@/components/home/homepage-editorial";
import {
  AssetOverview,
  HomepageQuoteUpdatedAt,
  KeyMarketIndicators,
  MarketPulse,
} from "@/components/home/homepage-market";
import {
  MarketNowDailyFact,
  MarketNowQuoteFact,
} from "@/components/home/homepage-facts";
import type {
  AvailableMarketDatum,
  DataScope,
  DataSource,
  MarketCapability,
} from "@/server/data/contracts/market-data";
import { unavailableDatum } from "@/server/data/contracts/market-data";
import type { AssetChartSnapshot } from "@/server/data/services/asset-detail-service";
import type { MarketSnapshot } from "@/server/data/services/market-snapshot-service";
import type {
  EditorialEntry,
  MarketStatusContent,
  TodayInCryptoContent,
  WiseTakeContent,
} from "@/lib/editorial/homepage-editorial";
import { ANONYMOUS_USER_ACCESS } from "@/lib/access/user-access";
import { restrictHomepageEditorialForAccess } from "@/server/editorial/homepage-editorial-service";

const UPDATED_AT = "2026-08-29T12:00:00.000Z";
const RETRIEVED_AT = "2026-08-29T12:00:05.000Z";
const EFFECTIVE_AT = "2026-08-29T00:00:00.000Z";
const VALID_UNTIL = "2026-08-29T23:59:59.000Z";
const REVIEWED_AT = "2026-08-28T18:00:00.000Z";
const ACTIVE_NOW = Date.parse("2026-08-29T12:30:00.000Z");

const MARKET_SOURCE: DataSource = {
  id: "verified-market-source",
  label: "已核验市场来源",
  url: "https://example.com/verified-market-data",
};

const EDITORIAL_SOURCE = {
  id: "verified-editorial-source",
  label: "已核验编辑来源",
  url: "https://example.com/verified-editorial-source",
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
    source: MARKET_SOURCE,
    scope,
    updatedAt: UPDATED_AT,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 60,
      staleIfErrorSeconds: 300,
    },
    error: null,
    ...overrides,
  };
}

function liveSnapshot(): MarketSnapshot {
  return {
    btcPrice: available(
      "spot.btc-price",
      {
        asset: "btc",
        quoteCurrency: "USD",
        priceUsd: 104_321.25,
        change24hPercent: 2.5,
        change7dPercent: -1.25,
        marketCapUsd: 2_080_000_000_000,
      },
      { kind: "asset", label: "BTC/USD aggregate" },
    ),
    ethPrice: available(
      "spot.eth-price",
      {
        asset: "eth",
        quoteCurrency: "USD",
        priceUsd: 3_456.78,
        change24hPercent: -0.75,
        change7dPercent: 4,
        marketCapUsd: 417_000_000_000,
      },
      { kind: "asset", label: "ETH/USD aggregate" },
    ),
    marketCap: available(
      "spot.market-cap",
      { totalMarketCapUsd: 3_420_000_000_000 },
      { kind: "global", label: "Global cryptocurrency market" },
    ),
    fearAndGreed: available(
      "sentiment.fear-and-greed",
      { value: 64, classification: "Greed" },
      { kind: "global", label: "Crypto Fear and Greed Index" },
    ),
    btcDominance: available(
      "spot.btc-dominance",
      { btcDominancePercent: 57.25 },
      { kind: "global", label: "Global cryptocurrency market" },
    ),
    ethBtc: available(
      "spot.eth-btc",
      { ethBtcRatio: 0.03314 },
      { kind: "derived", label: "ETH/USD divided by BTC/USD" },
      {
        source: {
          id: "wise-crypto-derived",
          label: "Wise Crypto 派生指标",
          url: "https://crypto.wise-invest.org",
        },
        provenance: "derived",
      },
    ),
    btcFunding: available(
      "derivatives.btc-funding",
      {
        asset: "btc",
        symbol: "BTCUSDT",
        rate: 0.0001,
        intervalHours: 8,
      },
      { kind: "venue", label: "BTC derivatives venue" },
    ),
    ethFunding: available(
      "derivatives.eth-funding",
      {
        asset: "eth",
        symbol: "ETHUSDT",
        rate: -0.000075,
        intervalHours: null,
      },
      { kind: "venue", label: "ETH derivatives venue" },
    ),
    btcOpenInterest: available(
      "derivatives.btc-open-interest",
      {
        asset: "btc",
        symbol: "BTCUSDT",
        notional: 1_250_000_000,
        quoteCurrency: "USDT",
        samplingPeriod: "5m",
      },
      { kind: "venue", label: "BTC derivatives venue" },
    ),
    ethOpenInterest: available(
      "derivatives.eth-open-interest",
      {
        asset: "eth",
        symbol: "ETHUSDT",
        notional: 780_000_000,
        quoteCurrency: "USDT",
        samplingPeriod: "5m",
      },
      { kind: "venue", label: "ETH derivatives venue" },
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
    btcEtfFlow: available(
      "fund-flows.btc-etf",
      {
        asset: "btc",
        netFlowUsd: 125_000_000,
        tradingDate: "2026-08-29",
      },
      { kind: "asset", label: "US spot Bitcoin ETFs" },
    ),
    ethEtfFlow: unavailableDatum(
      "fund-flows.eth-etf",
      "license_restricted",
    ),
  };
}

function editorialEntry<T>(
  content: T,
  overrides: Partial<EditorialEntry<T>> = {},
): EditorialEntry<T> {
  return {
    publicationStatus: "published",
    effectiveAt: EFFECTIVE_AT,
    validUntil: VALID_UNTIL,
    lastReviewedAt: REVIEWED_AT,
    sources: [EDITORIAL_SOURCE],
    content,
    ...overrides,
  };
}

const marketStatusContent: MarketStatusContent = {
  headline: "震荡等待确认",
  summary: "当前仅陈述人工审核后的观察结论。",
  watchItems: ["等待流动性方向更加清晰"],
};

const todayContentFixture = {
  date: "2026-08-29",
  items: [
    {
      title: "已核验市场事件",
      summary: "这是一条带有逐项来源的事实摘要。",
      sourceIds: [EDITORIAL_SOURCE.id],
    },
  ],
};

const wiseTakeContent: WiseTakeContent = {
  headline: "保持耐心",
  body: "观点由编辑人工维护，不根据行情自动生成。",
  watchItems: ["观察市场结构是否改善"],
};

describe("homepage server-rendered market components", () => {
  it("renders Market Pulse values with update time but without source details", async () => {
    const html = renderToStaticMarkup(
      await MarketPulse({ snapshot: Promise.resolve(liveSnapshot()) }),
    );

    expect(html).toContain("市场脉搏");
    expect(html).toContain("加密市场总市值");
    expect(html).toContain("$3.42 万亿");
    expect(html).toContain("恐慌与贪婪指数");
    expect(html).toContain("贪婪");
    expect(html).toContain("57.25%");
    expect(html).toContain("0.03314 BTC");
    expect(html).toContain("更新于 2026-08-29 12:00 UTC");
    expect(html).toContain("数据更新时间：");
    expect(html).not.toContain("已核验市场来源");
    expect(html).not.toContain("数据来源、范围与时间");
    expect(html).not.toContain("查看数据口径");
    expect(html).not.toContain("获取于 2026-08-29 12:00 UTC");
    expect(html).not.toContain("最新获取");
  });

  it("renders BTC and ETH overview without losing price-change semantics", async () => {
    const html = renderToStaticMarkup(
      await AssetOverview({ snapshot: Promise.resolve(liveSnapshot()) }),
    );

    expect(html).toContain("BTC 与 ETH 市场概览");
    expect(html).toContain('href="/btc"');
    expect(html).toContain('href="/eth"');
    expect(html).toContain("$104,321.25");
    expect(html).toContain("$3,456.78");
    expect(html).toContain("+2.50%");
    expect(html).toContain("-0.75%");
    expect(html).toContain("更新于 2026-08-29 12:00 UTC");
    expect(html).not.toContain("BTC/USD 多市场聚合现货");
    expect(html).not.toContain("ETH/USD 多市场聚合现货");
    expect(html).not.toContain("已核验市场来源");
    expect(html).not.toContain("数据来源、范围与时间");
    expect(html).not.toContain("查看数据口径");
  });

  it("marks the homepage quote layer as partial when only one asset is usable", async () => {
    const snapshot = liveSnapshot();
    snapshot.ethPrice = unavailableDatum("spot.eth-price", "no_data");

    const updateHtml = renderToStaticMarkup(
      await HomepageQuoteUpdatedAt({ snapshot: Promise.resolve(snapshot) }),
    );
    const factHtml = renderToStaticMarkup(
      await MarketNowQuoteFact({ snapshot: Promise.resolve(snapshot) }),
    );

    expect(updateHtml).toContain("行情 1/2 项可用");
    expect(updateHtml).toContain("最后更新 2026-08-29 12:00 UTC");
    expect(factHtml).toContain("BTC 短期变化");
    expect(factHtml).toContain("1/2 项可用");
    expect(factHtml).not.toContain("ETH 24 小时");
    expect(`${updateHtml}${factHtml}`).not.toContain("已核验市场来源");
  });

  it("renders derivatives units accurately and leaves unavailable data empty", async () => {
    const html = renderToStaticMarkup(
      await KeyMarketIndicators({
        snapshot: Promise.resolve(liveSnapshot()),
      }),
    );

    expect(html).toContain("关键市场数据");
    expect(html).toContain("BTC 资金费率");
    expect(html).toContain("0.0100%");
    expect(html).toContain("12.50 亿 USDT");
    expect(html).not.toContain("$12.50 亿 USDT");
    expect(html).toContain("24 小时合计");
    expect(html).toContain("+$1.25 亿");
    expect(html).toContain("ETH ETF 净流量");
    expect(html).toContain("暂不可用");
    expect(html).toContain("尚未配置具备展示许可的数据源。");
    expect(html).toContain("暂不可用的数据");
    expect(html).toContain("6/7");
    expect(html).toContain("项可用");
    expect(html).toContain("coverage-row--unavailable");
    expect(html).not.toContain("indicator-item--unavailable");
    expect(html).not.toContain("已核验市场来源");
    expect(html).not.toContain("数据来源、范围与时间");
    expect(html).not.toContain("查看数据口径");
  });

  it("renders an explicit unavailable daily-fact card without source details", async () => {
    const snapshot = {
      candles: unavailableDatum(
        "historical.btc-daily-candles",
        "no_data",
      ),
      technical: unavailableDatum(
        "historical.btc-daily-candles",
        "insufficient_history",
      ),
    } satisfies AssetChartSnapshot;
    const html = renderToStaticMarkup(
      await MarketNowDailyFact({
        asset: "btc",
        snapshot: Promise.resolve(snapshot),
      }),
    );

    expect(html).toContain("BTC 已闭合日线");
    expect(html).toContain("日线事实暂不可用");
    expect(html).toContain("数据源当前未返回可用数据。");
    expect(html).toContain("暂不可用");
    expect(html).not.toContain("已核验市场来源");
    expect(html).not.toContain("查看数据口径");
  });

  it("never renders synthetic values or their development-only source", async () => {
    const snapshot = liveSnapshot();
    snapshot.ethFunding = available(
      "derivatives.eth-funding",
      {
        asset: "eth",
        symbol: "ETHUSDT",
        rate: 9.87654,
        intervalHours: 8,
      },
      { kind: "venue", label: "Synthetic venue" },
      {
        provenance: "synthetic",
        source: {
          id: "mock-development-only",
          label: "Mock / Development only",
          url: "https://example.invalid/mock-market-data",
        },
      },
    );

    const html = renderToStaticMarkup(
      await KeyMarketIndicators({ snapshot: Promise.resolve(snapshot) }),
    );

    expect(html).toContain("公开页面不会展示开发测试数据。");
    expect(html).not.toContain("987.6540%");
    expect(html).not.toContain("Mock / Development only");
    expect(html).not.toContain("Synthetic venue");
  });

  it("keeps a fully unavailable supporting layer compact instead of rendering seven empty cards", async () => {
    const snapshot = liveSnapshot();
    snapshot.btcFunding = unavailableDatum("derivatives.btc-funding", "no_data");
    snapshot.ethFunding = unavailableDatum("derivatives.eth-funding", "no_data");
    snapshot.btcOpenInterest = unavailableDatum(
      "derivatives.btc-open-interest",
      "no_data",
    );
    snapshot.ethOpenInterest = unavailableDatum(
      "derivatives.eth-open-interest",
      "no_data",
    );
    snapshot.liquidations24h = unavailableDatum(
      "derivatives.total-liquidations",
      "no_reliable_source",
    );
    snapshot.btcEtfFlow = unavailableDatum(
      "fund-flows.btc-etf",
      "license_restricted",
    );
    snapshot.ethEtfFlow = unavailableDatum(
      "fund-flows.eth-etf",
      "license_restricted",
    );

    const html = renderToStaticMarkup(
      await KeyMarketIndicators({ snapshot: Promise.resolve(snapshot) }),
    );

    expect(html).toContain("扩展市场数据当前 0/7 项可用");
    expect(html).toContain("0/7 项可用");
    expect(html).toContain("<details");
    expect(html).not.toContain("open=\"\"");
    expect(html).not.toContain("class=\"indicator-item");
  });
});

describe("homepage server-rendered editorial panels", () => {
  it("does not serialize subjective judgment for regular access", () => {
    const config = restrictHomepageEditorialForAccess(
      {
        marketStatus: editorialEntry(marketStatusContent),
        todayInCrypto: editorialEntry<TodayInCryptoContent>(
          todayContentFixture,
        ),
        wiseTake: editorialEntry(wiseTakeContent),
      },
      ANONYMOUS_USER_ACCESS,
    );
    const html = renderToStaticMarkup(
      HomepageEditorialPanels({ config, now: ACTIVE_NOW }),
    );

    expect(html).toContain("已核验市场事件");
    expect(html).not.toContain("震荡等待确认");
    expect(html).not.toContain("保持耐心");
    expect(html).not.toContain("观点由编辑人工维护");
  });

  it("renders active editorial content with review timing but without source links", () => {
    const marketStatusHtml = renderToStaticMarkup(
      MarketStatusPanel({
        entry: editorialEntry(marketStatusContent),
        now: ACTIVE_NOW,
      }),
    );
    const todayHtml = renderToStaticMarkup(
      TodayInCryptoPanel({
        entry: editorialEntry<TodayInCryptoContent>(todayContentFixture),
        now: ACTIVE_NOW,
      }),
    );
    const wiseTakeHtml = renderToStaticMarkup(
      WiseTakePanel({
        entry: editorialEntry(wiseTakeContent),
        now: ACTIVE_NOW,
      }),
    );

    expect(marketStatusHtml).toContain("当前有效");
    expect(marketStatusHtml).toContain("震荡等待确认");
    expect(marketStatusHtml).toContain("最近审核 2026-08-28 18:00 UTC");
    expect(marketStatusHtml).toContain("有效期至 2026-08-29 23:59 UTC");
    expect(marketStatusHtml).not.toContain("已核验编辑来源");

    expect(todayHtml).toContain("今日加密市场");
    expect(todayHtml).toContain("2026-08-29");
    expect(todayHtml).toContain("已核验市场事件");
    expect(todayHtml).toContain("最近审核 2026-08-28 18:00 UTC");
    expect(todayHtml).not.toContain("本条来源");
    expect(todayHtml).not.toContain("已核验编辑来源");

    expect(wiseTakeHtml).toContain("Wise Take");
    expect(wiseTakeHtml).toContain("保持耐心");
    expect(wiseTakeHtml).toContain("观点由编辑人工维护");
    expect(wiseTakeHtml).toContain("最近审核 2026-08-28 18:00 UTC");
    expect(wiseTakeHtml).not.toContain("已核验编辑来源");
  });

  it("hides scheduled content and its review metadata", () => {
    const html = renderToStaticMarkup(
      MarketStatusPanel({
        entry: editorialEntry(marketStatusContent),
        now: Date.parse("2026-08-28T23:59:59.000Z"),
      }),
    );

    expect(html).toBe("");
    expect(html).not.toContain("震荡等待确认");
    expect(html).not.toContain("已核验编辑来源");
    expect(html).not.toContain("最近审核");
  });

  it("hides an expired daily brief instead of presenting it as today's news", () => {
    const html = renderToStaticMarkup(
      TodayInCryptoPanel({
        entry: editorialEntry<TodayInCryptoContent>(todayContentFixture),
        now: Date.parse("2026-08-30T00:00:00.000Z"),
      }),
    );

    expect(html).toContain("今日简报已过期");
    expect(html).toContain("过期简报不会继续作为今日内容展示");
    expect(html).not.toContain("已核验市场事件");
    expect(html).not.toContain("已核验编辑来源");
  });

  it("omits the entire editorial region when every entry is unpublished", () => {
    const unpublished = <T,>(content: T): EditorialEntry<T> => ({
      publicationStatus: "unpublished",
      effectiveAt: null,
      validUntil: null,
      lastReviewedAt: null,
      sources: [],
      content,
    });

    const html = renderToStaticMarkup(
      HomepageEditorialPanels({
        config: {
          marketStatus: unpublished(marketStatusContent),
          todayInCrypto: unpublished<TodayInCryptoContent>(todayContentFixture),
          wiseTake: unpublished(wiseTakeContent),
        },
        now: ACTIVE_NOW,
      }),
    );

    expect(html).toBe("");
  });
});
