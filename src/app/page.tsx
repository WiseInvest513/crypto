import Link from "next/link";
import { Suspense } from "react";
import { HomepageEditorialPanels } from "@/components/home/homepage-editorial";
import {
  MarketNowDailyFact,
  MarketNowFactLoading,
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
import { wiseIdentityAdapter } from "@/server/auth/wise-identity-adapter";
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
  const access = resolveUserAccess(wiseIdentityAdapter);
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
            <h2 id="market-now-title">价格之外，再看日线结构</h2>
            <p>24 小时与 7 天变化已在上方；这里补充已闭合日线的均线和区间位置。</p>
          </div>
          <span>BTC · ETH</span>
        </header>
        <div className="market-now__grid">
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
          <p>继续分析</p>
          <h2 id="home-vip-title">从价格，进入 K 线与关键位</h2>
          <p>
            BTC / ETH 工作台已提供持续更新的 K 线、EMA、客观支撑压力与多周期对照。人工策略尚未在此发布；未来 VIP 内容只会在服务端验证身份后开放。
          </p>
        </div>
        <nav
          className="home-vip-cta__actions"
          aria-label="行情工作台与主站权益入口"
        >
          <Link href="/btc">
            查看 BTC 行情工作台 <ArrowRightIcon />
          </Link>
          <Link href="/eth">
            查看 ETH 行情工作台 <ArrowRightIcon />
          </Link>
          <a
            href={WISE_INVEST_CRYPTO_PERKS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            了解主站 VIP 权益 <span aria-hidden="true">↗</span>
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

      <Suspense fallback={<KeyMarketIndicatorsLoading />}>
        <KeyMarketIndicators snapshot={indicatorSnapshot} />
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
