import Link from "next/link";
import { Suspense } from "react";
import { HomepageEditorialPanels } from "@/components/home/homepage-editorial";
import {
  MarketNowDailyFact,
  MarketNowFactLoading,
  MarketNowQuoteFact,
} from "@/components/home/homepage-facts";
import {
  AssetOverview,
  AssetOverviewLoading,
  KeyMarketIndicators,
  KeyMarketIndicatorsLoading,
  MarketDataNotice,
  MarketDataNoticeLoading,
  MarketPulse,
  MarketPulseLoading,
} from "@/components/home/homepage-market";
import { loadHomepageEditorial } from "@/server/editorial/homepage-editorial-service";
import {
  loadMarketIndicatorSnapshot,
  loadMarketPulseSnapshot,
  loadMarketQuoteSnapshot,
  loadAssetChartSnapshot,
} from "@/server/data/services/market-data-service";

export const dynamic = "force-dynamic";

const actionShortcuts = [
  { href: "/btc", label: "BTC 详情", meta: "价格与日线" },
  { href: "/eth", label: "ETH 详情", meta: "价格与日线" },
  { href: "/tools/position-size", label: "仓位计算", meta: "按风险预算" },
  { href: "/tools/risk-reward", label: "风险回报", meta: "检查计划" },
  { href: "/tools/leverage", label: "杠杆计算", meta: "估算保证金" },
  { href: "/tools/dca", label: "DCA 定投", meta: "定期投入" },
] as const;

export default function Home() {
  const quoteSnapshot = loadMarketQuoteSnapshot();
  const pulseSnapshot = loadMarketPulseSnapshot();
  const noticeSnapshot = Promise.all([quoteSnapshot, pulseSnapshot]).then(
    ([quotes, pulse]) => ({ ...quotes, ...pulse }),
  );
  const indicatorSnapshot = loadMarketIndicatorSnapshot();
  const btcChartSnapshot = loadAssetChartSnapshot("btc");
  const ethChartSnapshot = loadAssetChartSnapshot("eth");
  const { config: editorial, now } = loadHomepageEditorial();

  return (
    <div className="dashboard-page page-container">
      <section className="page-heading" aria-labelledby="home-title">
        <div>
          <p className="page-kicker">市场总览</p>
          <h1 id="home-title">加密市场</h1>
          <p>
            查看经过验证的市场数据、明确的数据口径，以及由人工审核的市场背景。
          </p>
        </div>
        <div
          className="page-heading__utility"
          aria-label="计价单位 USD，时间标准 UTC"
        >
          <span>计价：USD</span>
          <span aria-hidden="true">·</span>
          <span>时间：UTC</span>
        </div>
      </section>

      <Suspense fallback={<AssetOverviewLoading />}>
        <AssetOverview snapshot={quoteSnapshot} />
      </Suspense>

      <section className="product-panel market-now" aria-labelledby="market-now-title">
        <header className="panel-header">
          <div>
            <p className="panel-kicker">可验证事实</p>
            <h2 id="market-now-title">市场现在</h2>
          </div>
          <span className="panel-count">
            最多 3 条
            <span className="market-now__mobile-hint"> · 横向查看</span>
          </span>
        </header>
        <div className="market-now__grid">
          <Suspense fallback={<MarketNowFactLoading label="短期变化" />}>
            <MarketNowQuoteFact snapshot={quoteSnapshot} />
          </Suspense>
          <Suspense fallback={<MarketNowFactLoading label="BTC 日线事实" />}>
            <MarketNowDailyFact asset="btc" snapshot={btcChartSnapshot} />
          </Suspense>
          <Suspense fallback={<MarketNowFactLoading label="ETH 日线事实" />}>
            <MarketNowDailyFact asset="eth" snapshot={ethChartSnapshot} />
          </Suspense>
        </div>
        <p className="market-now__disclaimer">
          区间与均线来自历史价格的机械计算，不是人工支撑、阻力或投资建议。
        </p>
      </section>

      <Suspense fallback={<MarketDataNoticeLoading />}>
        <MarketDataNotice snapshot={noticeSnapshot} />
      </Suspense>

      <Suspense fallback={<MarketPulseLoading />}>
        <MarketPulse snapshot={pulseSnapshot} />
      </Suspense>

      <section className="quick-access" aria-labelledby="quick-access-title">
        <div className="section-bar">
          <div>
            <p className="panel-kicker">下一步</p>
            <h2 id="quick-access-title">查看详情或开始计算</h2>
          </div>
        </div>
        <div className="action-shortcuts">
          {actionShortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href}>
              <span>
                <strong>{shortcut.label}</strong>
                <small>{shortcut.meta}</small>
              </span>
              <span className="row-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HomepageEditorialPanels config={editorial} now={now} />

      <Suspense fallback={<KeyMarketIndicatorsLoading />}>
        <KeyMarketIndicators snapshot={indicatorSnapshot} />
      </Suspense>

      <section className="home-products-cta" aria-labelledby="products-cta-title">
        <div>
          <p className="panel-kicker">客观产品指南</p>
          <h2 id="products-cta-title">按事实、适用场景和限制了解产品</h2>
          <p>查看已经核验来源的产品资料，并同时阅读优点与限制。</p>
        </div>
        <Link href="/products">
          浏览产品目录 <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
