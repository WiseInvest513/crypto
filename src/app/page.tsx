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
  HomepageQuoteUpdatedAt,
  KeyMarketIndicators,
  KeyMarketIndicatorsLoading,
  MarketDataNotice,
  MarketDataNoticeLoading,
  MarketPulse,
  MarketPulseLoading,
} from "@/components/home/homepage-market";
import {
  loadHomepageEditorialForAccess,
  type HomepageEditorialPayload,
} from "@/server/editorial/homepage-editorial-service";
import { resolveUserAccess } from "@/server/access/resolve-user-access";
import {
  loadMarketIndicatorSnapshot,
  loadMarketPulseSnapshot,
  loadMarketQuoteSnapshot,
  loadAssetChartSnapshot,
} from "@/server/data/services/market-data-service";
import { WISE_INVEST_CRYPTO_PERKS_URL } from "@/config/site";
import { getToolDefinition, type ToolSlug } from "@/lib/tools/catalog";
import "./home-dashboard.css";

export const dynamic = "force-dynamic";

const homepageToolOrder = [
  "position-size",
  "risk-reward",
  "leverage",
  "dca",
] as const satisfies readonly ToolSlug[];

const actionShortcuts = homepageToolOrder.map((slug, position) => {
  const tool = getToolDefinition(slug);
  return {
    href: tool.href,
    label: tool.shortTitle,
    meta: tool.resultSummary,
    index: String(position + 1).padStart(2, "0"),
  };
});

export default function Home() {
  const access = resolveUserAccess();
  const quoteSnapshot = loadMarketQuoteSnapshot();
  const pulseSnapshot = loadMarketPulseSnapshot();
  const noticeSnapshot = Promise.all([quoteSnapshot, pulseSnapshot]).then(
    ([quotes, pulse]) => ({ ...quotes, ...pulse }),
  );
  const indicatorSnapshot = loadMarketIndicatorSnapshot();
  const btcChartSnapshot = loadAssetChartSnapshot("btc");
  const ethChartSnapshot = loadAssetChartSnapshot("eth");
  const editorial = loadHomepageEditorialForAccess(access);

  return (
    <div className="dashboard-page home-dashboard page-container">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__intro">
          <div>
            <p className="home-hero__eyebrow">Wise Crypto 市场工作台</p>
            <h1 id="home-title">
              今天的加密市场，<span>一眼看清</span>
            </h1>
            <p>
              先看 BTC 与 ETH 的价格和方向，再进入 K 线工作台做自己的判断。
            </p>
          </div>
          <Suspense
            fallback={<span className="home-hero__update">正在获取更新时间</span>}
          >
            <HomepageQuoteUpdatedAt snapshot={quoteSnapshot} />
          </Suspense>
        </div>
        <Suspense fallback={<AssetOverviewLoading />}>
          <AssetOverview snapshot={quoteSnapshot} />
        </Suspense>
      </section>

      <Suspense fallback={<MarketDataNoticeLoading />}>
        <MarketDataNotice snapshot={noticeSnapshot} />
      </Suspense>

      <section className="home-market-now market-now" aria-labelledby="market-now-title">
        <header className="home-section-heading">
          <div>
            <h2 id="market-now-title">市场现在</h2>
            <p>先看方向，再看 BTC 与 ETH 的已闭合日线结构。</p>
          </div>
          <span>3 条客观事实</span>
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

      <section className="home-vip-cta" aria-labelledby="home-vip-title">
        <div className="home-vip-cta__mark" aria-hidden="true">
          W
        </div>
        <div className="home-vip-cta__copy">
          <p>Wise VIP 行情参考</p>
          <h2 id="home-vip-title">从市场事实，到人工策略</h2>
          <p>
            BTC / ETH 工作台承接人工关键位、方向、时间窗口、确认与失效条件。普通用户可继续查看市场事实，策略正文仅向服务端验证后的 VIP 开放。
          </p>
        </div>
        <nav className="home-vip-cta__actions" aria-label="VIP 行情参考入口">
          <Link href="/btc#vip-research">
            查看 BTC 策略台 <ArrowRightIcon />
          </Link>
          <Link href="/eth#vip-research">
            查看 ETH 策略台 <ArrowRightIcon />
          </Link>
          <a
            href={WISE_INVEST_CRYPTO_PERKS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            了解 VIP 权益 <span aria-hidden="true">↗</span>
            <span className="sr-only">（在新标签页打开）</span>
          </a>
        </nav>
      </section>

      <Suspense fallback={null}>
        <StreamedHomepageEditorial editorial={editorial} />
      </Suspense>

      <Suspense fallback={<MarketPulseLoading />}>
        <MarketPulse snapshot={pulseSnapshot} />
      </Suspense>

      <section className="home-tools" aria-labelledby="quick-access-title">
        <div className="home-section-heading">
          <div>
            <h2 id="quick-access-title">交易前，先把风险算清楚</h2>
            <p>四个独立工具，帮你检查仓位、回报、杠杆和投入计划。</p>
          </div>
          <Link href="/tools">查看全部工具</Link>
        </div>
        <div className="action-shortcuts">
          {actionShortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href}>
              <span className="action-shortcuts__index" aria-hidden="true">
                {shortcut.index}
              </span>
              <span>
                <strong>{shortcut.label}</strong>
                <small>{shortcut.meta}</small>
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<KeyMarketIndicatorsLoading />}>
        <KeyMarketIndicators snapshot={indicatorSnapshot} />
      </Suspense>
    </div>
  );
}

async function StreamedHomepageEditorial({
  editorial,
}: {
  editorial: Promise<HomepageEditorialPayload>;
}) {
  const { config, now } = await editorial;

  return <HomepageEditorialPanels config={config} now={now} />;
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
    >
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
