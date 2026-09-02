import Link from "next/link";
import { Suspense } from "react";
import type {
  Asset,
  ChartCandle,
  DailyCandle,
  MarketDatum,
  PriceQuote,
} from "@/server/data/contracts/market-data";
import type {
  AssetChartSnapshot,
  AssetContextSnapshot,
  AssetDetailSnapshot,
} from "@/server/data/services/asset-detail-service";
import type { UserAccess } from "@/lib/access/user-access";
import type { AssetEditorialPayload } from "@/server/editorial/asset-editorial-service";
import type { MultiTimeframeAccessPayload } from "@/server/data/services/multi-timeframe-service";
import type { TechnicalAnalysisResult } from "@/lib/market/technical-analysis";
import {
  directionFor,
  formatEthBtcRatio,
  formatPercent,
  formatUsdPrice,
} from "@/lib/market/formatters";
import {
  presentMarketDatum,
  summarizeMarketData,
  type DatumPresentation,
} from "@/lib/market/homepage-presentation";
import {
  formatEtfFlowReading,
  formatFundingReading,
  formatLiquidationsReading,
  formatOpenInterestReading,
} from "@/lib/market/reading-formatters";
import { DatumMeta, DatumStatus } from "@/components/market/datum-presentation";
import { AssetLivePrice } from "./asset-live-price";
import { AssetPriceChart } from "./asset-price-chart";
import { AssetVipResearch } from "./asset-vip-research";

const assetCopy = {
  btc: {
    symbol: "BTC",
    name: "比特币",
    description: "聚合现货价格、已闭合日线、衍生品口径与人工审核情景。",
    tone: "asset-mark--bitcoin",
  },
  eth: {
    symbol: "ETH",
    name: "以太坊",
    description: "聚合现货价格、ETH/BTC 对比、衍生品口径与人工审核情景。",
    tone: "asset-mark--ethereum",
  },
} as const;

type AssetCopy = (typeof assetCopy)[Asset];

const assetToolActions = [
  {
    pathname: "/tools/position-size",
    label: "计算仓位",
    description: "按风险预算反推数量",
  },
  {
    pathname: "/tools/risk-reward",
    label: "检查风险回报",
    description: "核对计划的价格关系",
  },
  {
    pathname: "/tools/leverage",
    label: "估算保证金",
    description: "查看杠杆下的资金占用",
  },
  {
    pathname: "/tools/dca",
    label: "查看 DCA",
    description: "回看同资产定投路径",
  },
] as const;

export function AssetDetailStreamPage({
  asset,
  price,
  chart,
  liveChart,
  context,
  editorial,
  access,
  multiTimeframe,
}: {
  asset: Asset;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
  context: Promise<AssetContextSnapshot>;
  editorial: Promise<AssetEditorialPayload>;
  access: Promise<UserAccess>;
  multiTimeframe: Promise<MultiTimeframeAccessPayload>;
}) {
  const copy = assetCopy[asset];

  return (
    <div className="asset-detail-page asset-detail-page--focus page-container">
      <AssetMarketHeader
        asset={asset}
        chart={chart}
        copy={copy}
        liveChart={liveChart}
        price={price}
      />

      <Suspense fallback={<AssetWorkbenchLoading symbol={copy.symbol} />}>
        <StreamedAssetWorkbench
          asset={asset}
          chart={chart}
          liveChart={liveChart}
          copy={copy}
        />
      </Suspense>

      <Suspense fallback={<AssetVipResearchLoading symbol={copy.symbol} />}>
        <StreamedAssetVipResearch
          access={access}
          editorial={editorial}
          multiTimeframe={multiTimeframe}
          symbol={copy.symbol}
        />
      </Suspense>

      <Suspense fallback={<AssetFactsLoading symbol={copy.symbol} />}>
        <StreamedAssetContext context={context} symbol={copy.symbol} />
      </Suspense>

      <AssetToolShortcuts asset={asset} symbol={copy.symbol} />

      <p className="asset-detail-disclaimer">
        图内 EMA 相对位置按所选周期的已闭合 K 线计算；下方 SMA 背景只使用已闭合日线。两者均为客观事实，不构成投资建议；VIP 人工关键位与 Wise Scenario 只有在身份校验、人工审核并处于有效期内时才会显示。
      </p>
    </div>
  );
}

async function StreamedAssetVipResearch({
  access,
  editorial,
  multiTimeframe,
  symbol,
}: {
  access: Promise<UserAccess>;
  editorial: Promise<AssetEditorialPayload>;
  multiTimeframe: Promise<MultiTimeframeAccessPayload>;
  symbol: "BTC" | "ETH";
}) {
  const [resolvedAccess, editorialPayload] = await Promise.all([
    access,
    editorial,
  ]);

  return (
    <AssetVipResearch
      access={resolvedAccess}
      editorial={editorialPayload.config}
      editorialNow={editorialPayload.now}
      multiTimeframe={multiTimeframe}
      symbol={symbol}
    />
  );
}

async function StreamedAssetWorkbench({
  asset,
  chart,
  liveChart,
  copy,
}: {
  asset: Asset;
  chart: Promise<AssetChartSnapshot>;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
  copy: AssetCopy;
}) {
  const [data, liveCandles] = await Promise.all([chart, liveChart]);

  return (
    <div id="trend" className="asset-page-anchor">
      <AssetDataNotice
        datums={[liveCandles, data.candles, data.technical]}
        titleId="asset-chart-data-notice-title"
      />
      <div className="asset-workbench">
        <ChartWorkspace
          asset={asset}
          snapshot={data}
          liveCandles={liveCandles}
          copy={copy}
        />
        <AssetDailyContext datum={data.technical} symbol={copy.symbol} />
      </div>
    </div>
  );
}

async function StreamedAssetContext({
  context,
  symbol,
}: {
  context: Promise<AssetContextSnapshot>;
  symbol: "BTC" | "ETH";
}) {
  const data = await context;

  return <AssetMarketFacts snapshot={data} symbol={symbol} />;
}

function AssetMarketHeader({
  asset,
  copy,
  price,
  chart,
  liveChart,
}: {
  asset: Asset;
  copy: AssetCopy;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
}) {
  const otherAsset = asset === "btc" ? "eth" : "btc";
  const otherCopy = assetCopy[otherAsset];
  const titleId = `asset-market-${asset}-title`;

  return (
    <section
      id="price"
      className="asset-market-header asset-page-anchor"
      aria-labelledby={titleId}
    >
      <div className="asset-market-header__identity">
        <nav className="asset-switcher" aria-label="切换资产工作台">
          <Link href={`/${asset}`} aria-current="page">
            {copy.symbol}
          </Link>
          <Link href={`/${otherAsset}`}>{otherCopy.symbol}</Link>
        </nav>
        <div className="asset-market-header__title">
          <span className={`asset-mark ${copy.tone}`} aria-hidden="true">
            {copy.symbol.slice(0, 1)}
          </span>
          <div>
            <p>资产工作台</p>
            <h1 id={titleId}>
              {copy.symbol} <span>{copy.name}</span>
            </h1>
          </div>
        </div>
      </div>
      <Suspense fallback={<AssetMarketPriceLoading />}>
        <StreamedAssetMarketPrice
          asset={asset}
          chart={chart}
          liveChart={liveChart}
          price={price}
        />
      </Suspense>
    </section>
  );
}

async function StreamedAssetMarketPrice({
  asset,
  price,
  chart,
  liveChart,
}: {
  asset: Asset;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
}) {
  const [priceDatum, liveDatum] = await Promise.all([price, liveChart]);
  const liveCandles = publicAvailableValue(liveDatum);
  const latestChartCandle = liveCandles?.at(-1) ?? null;
  const fallbackCandles =
    latestChartCandle === null && publicAvailableValue(priceDatum) === null
      ? (await chart).candles
      : null;
  const aggregateHeadline = resolveAssetHeadline(priceDatum, fallbackCandles);
  const primaryPresentation = latestChartCandle
    ? presentMarketDatum(liveDatum, (value) => ({
        primary: formatPriceNumber(value.at(-1)?.close ?? Number.NaN),
        secondary:
          value.at(-1)?.state === "forming"
            ? "Binance 最新价 · 当前 K 线形成中"
            : value.at(-1)?.interval === "1d"
              ? "Binance 最新已闭合日线收盘"
              : "Binance 最新已闭合价",
      }))
    : aggregateHeadline.presentation;
  const primaryCurrency = latestChartCandle ? "USDT" : aggregateHeadline.currency;
  const quote = publicAvailableValue(priceDatum);

  return (
    <div className="asset-market-header__market">
      <AssetLivePrice
        key={asset}
        asset={asset}
        initialCurrency={primaryCurrency}
        initialFormatted={primaryPresentation.value.primary}
        initialLabel={
          primaryPresentation.value.secondary ??
          (aggregateHeadline.currency === "USDT"
            ? "Binance 最新已闭合日线收盘"
            : "聚合市场参考价")
        }
        initialNote={
          latestChartCandle?.state === "closed" &&
          latestChartCandle.interval === "1d"
            ? "不是实时现货价"
            : aggregateHeadline.note
        }
        initialPresentation={primaryPresentation}
        aggregatePresentation={aggregateHeadline.presentation}
        showAggregateProvenance={latestChartCandle !== null}
      />
      <div className="asset-market-header__change-block">
        <dl className="asset-market-header__changes" aria-label="聚合市场涨跌">
          <div>
            <dt>24 小时</dt>
            <dd className={`value-direction--${directionFor(quote?.change24hPercent ?? null)}`}>
              {formatNullablePercent(quote?.change24hPercent ?? null)}
            </dd>
          </div>
          <div>
            <dt>7 天</dt>
            <dd className={`value-direction--${directionFor(quote?.change7dPercent ?? null)}`}>
              {formatNullablePercent(quote?.change7dPercent ?? null)}
            </dd>
          </div>
        </dl>
        {aggregateHeadline.presentation.state !== "fresh" && (
          <div className="asset-market-header__change-state">
            <DatumStatus presentation={aggregateHeadline.presentation} compact />
            <span>{aggregateHeadline.presentation.statusLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AssetMarketPriceLoading() {
  return (
    <div
      className="asset-market-header__market asset-market-header__market--loading"
      aria-label="价格数据正在加载"
      aria-busy="true"
      role="status"
    >
      <span className="asset-market-header__price-skeleton" aria-hidden="true" />
      <span className="sr-only">价格数据正在加载。</span>
    </div>
  );
}

function AssetToolShortcuts({
  asset,
  symbol,
}: {
  asset: Asset;
  symbol: "BTC" | "ETH";
}) {
  return (
    <section
      className="asset-tool-shortcuts asset-tool-shortcuts--standalone"
      aria-labelledby={`asset-tools-${asset}-title`}
    >
      <div className="asset-tool-shortcuts__intro">
        <div>
          <p className="panel-kicker">风险工具</p>
          <h2 id={`asset-tools-${asset}-title`}>把观察带入计算</h2>
        </div>
        <p>链接只携带 {symbol} 资产标识，不传递价格或金融输入。</p>
      </div>
      <div className="asset-tool-shortcuts__links">
        {assetToolActions.map((action) => (
          <Link
            key={action.pathname}
            href={{ pathname: action.pathname, query: { asset } }}
          >
            <span>
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className="row-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AssetWorkbenchLoading({ symbol }: { symbol: "BTC" | "ETH" }) {
  return (
    <div
      id="trend"
      className="asset-workbench asset-workbench--loading asset-page-anchor"
      aria-busy="true"
      role="status"
    >
      <div className="asset-workbench__chart" aria-hidden="true">
        <span className="skeleton-line skeleton-line--label" />
        <span className="asset-chart-skeleton" />
      </div>
      <div className="asset-workbench__rail" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="asset-rail-skeleton" key={index}>
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line skeleton-line--value" />
          </div>
        ))}
      </div>
      <span className="sr-only">{symbol} 日线与技术事实正在加载。</span>
    </div>
  );
}

function AssetFactsLoading({ symbol }: { symbol: "BTC" | "ETH" }) {
  return (
    <section
      id="derivatives"
      className="asset-facts asset-page-anchor"
      aria-labelledby="asset-facts-loading-title"
      aria-busy="true"
      role="status"
    >
      <div className="section-bar">
        <div>
          <p className="panel-kicker">Derivatives &amp; Context</p>
          <h2 id="asset-facts-loading-title">衍生品与市场背景</h2>
        </div>
        <span className="section-context">正在连接已配置的数据源</span>
      </div>
      <div
        className="asset-facts-grid asset-facts-grid--loading"
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span className="asset-fact-skeleton" key={index} />
        ))}
      </div>
      <span className="sr-only">{symbol} 衍生品与市场背景正在加载。</span>
    </section>
  );
}

function AssetVipResearchLoading({ symbol }: { symbol: "BTC" | "ETH" }) {
  return (
    <section
      id="vip-research"
      className="asset-vip-research asset-vip-research--loading asset-page-anchor"
      aria-busy="true"
      aria-label={`${symbol} VIP 行情策略台正在确认访问权限`}
      role="status"
    >
      <div aria-hidden="true">
        <span className="skeleton-line skeleton-line--label" />
        <span className="skeleton-line skeleton-line--value" />
      </div>
      <span className="sr-only">{symbol} VIP 行情策略台正在确认访问权限。</span>
    </section>
  );
}

function AssetDataNotice({
  datums,
  titleId,
}: {
  datums: readonly MarketDatum<unknown>[];
  titleId: string;
}) {
  const summary = summarizeMarketData(datums);
  if (summary.kind === "healthy") {
    return null;
  }

  return (
    <section
      className={`data-notice data-notice--${summary.kind}`}
      aria-labelledby={titleId}
      role="status"
    >
      <span className="data-notice__icon" aria-hidden="true">i</span>
      <div>
        <strong id={titleId}>{summary.title}</strong>
        <p>{summary.description}</p>
      </div>
      <div className="data-notice__meta">
        {summary.sources.length > 0 && <span>来源 {summary.sources.join("、")}</span>}
        {summary.retrievedAt && summary.retrievedAtLabel && (
          <time dateTime={summary.retrievedAt}>获取于 {summary.retrievedAtLabel}</time>
        )}
      </div>
    </section>
  );
}

function ChartWorkspace({
  asset,
  snapshot,
  liveCandles,
  copy,
}: {
  asset: Asset;
  snapshot: Pick<AssetDetailSnapshot, "candles" | "technical">;
  liveCandles?: MarketDatum<readonly ChartCandle[]>;
  copy: AssetCopy;
}) {
  const candles = publicAvailableValue(snapshot.candles);
  const candlePresentation = presentMarketDatum(snapshot.candles, (value) => ({
    primary: `${value.length} 根已闭合日线`,
  }));
  const liveValues = liveCandles
    ? publicAvailableValue(liveCandles)
    : null;
  const hasLiveCandles = Boolean(liveValues && liveValues.length > 0);
  const hasDailyCandles = Boolean(candles && candles.length > 0);

  if (!hasLiveCandles && !hasDailyCandles) {
    return (
      <section className="asset-workbench__chart asset-chart-state" aria-labelledby="asset-chart-state-title">
        <div>
          <p className="panel-kicker">价格图表</p>
          <h2 id="asset-chart-state-title">K 线数据暂不可用</h2>
          <p>{candlePresentation.note ?? "实时与已闭合日线当前都没有可用于绘图的可靠数据。"}</p>
          <DatumStatus presentation={candlePresentation} />
          <DatumMeta presentation={candlePresentation} />
        </div>
      </section>
    );
  }

  const chartDatum = hasLiveCandles
    ? liveCandles!
    : dailyCandlesAsChartDatum(snapshot.candles);
  return (
    <section className="asset-workbench__chart">
      {!hasLiveCandles && (
        <div className="asset-chart__fallback-note" role="status">
          实时 K 线暂不可用；当前显示 Binance 已闭合日线，不是实时现货走势。
        </div>
      )}
      <AssetPriceChart
        asset={asset}
        assetLabel={copy.name}
        initialDatum={chartDatum}
      />
    </section>
  );
}

function AssetDailyContext({
  datum,
  symbol,
}: {
  datum: AssetDetailSnapshot["technical"];
  symbol: "BTC" | "ETH";
}) {
  const presentation = presentMarketDatum(datum, (value) => ({
    primary: trendLabel(value.trend.state),
    secondary: `${value.movingAverageMethod === "simple" ? "简单移动平均" : "移动平均"} · ${value.algorithmVersion}`,
  }));
  const technical = publicAvailableValue(datum);
  const latest = technical?.latest ?? null;

  return (
    <details className="asset-daily-context">
      <summary>
        <div>
          <span className="panel-kicker">大周期背景 · 已闭合日线</span>
          <strong>{symbol} SMA 结构：{technical ? trendLabel(technical.trend.state) : "暂不可用"}</strong>
        </div>
        <DatumStatus presentation={presentation} compact />
      </summary>
      <div className="asset-daily-context__body">
        <section className="asset-trend-state">
          <span>当前客观事实</span>
          <strong>{technical ? trendLabel(technical.trend.state) : "—"}</strong>
          <p>{technical ? trendDescription(technical) : presentation.note ?? "技术数据暂不可用。"}</p>
        </section>

        <dl className="asset-ma-grid">
          <div>
            <dt>最新日线收盘</dt>
            <dd>{formatUsdt(latest?.price ?? null)}</dd>
          </div>
          <div>
            <dt>SMA20</dt>
            <dd>{formatUsdt(latest?.ma20 ?? null)}</dd>
          </div>
          <div>
            <dt>SMA50</dt>
            <dd>{formatUsdt(latest?.ma50 ?? null)}</dd>
          </div>
        </dl>

        <section className="asset-trend-facts" aria-labelledby="trend-facts-title">
          <h3 id="trend-facts-title">相对位置</h3>
          {latest ? (
            <ul>
              <li>{relativeFact("最新日线收盘", "SMA20", latest.priceVsMa20)}</li>
              <li>{relativeFact("最新日线收盘", "SMA50", latest.priceVsMa50)}</li>
              <li>{relativeFact("SMA20", "SMA50", latest.ma20VsMa50)}</li>
            </ul>
          ) : (
            <p>至少需要 50 根已闭合日线才能形成完整的 SMA20 / SMA50 对比。</p>
          )}
        </section>

        <footer className="asset-technical-meta">
          <p>日线背景独立于上方所选图表周期，不会跟随 15 分钟、1 小时或 4 小时切换。</p>
          <DatumMeta presentation={presentation} />
        </footer>
      </div>
    </details>
  );
}

function AssetMarketFacts({
  snapshot,
  symbol,
}: {
  snapshot: AssetContextSnapshot;
  symbol: "BTC" | "ETH";
}) {
  const comparison: AssetFactDescriptor =
    snapshot.comparison.kind === "btc-dominance"
      ? {
          label: "BTC 市占率",
          presentation: presentMarketDatum(
            snapshot.comparison.datum,
            (value) => ({
              primary: formatPercent(value.btcDominancePercent),
            }),
          ),
        }
      : {
          label: "ETH / BTC",
          presentation: presentMarketDatum(
            snapshot.comparison.datum,
            (value) => ({ primary: formatEthBtcRatio(value.ethBtcRatio) }),
          ),
        };
  const facts: readonly AssetFactDescriptor[] = [
    {
      label: `${symbol} 资金费率`,
      presentation: presentMarketDatum(
        snapshot.funding,
        formatFundingReading,
      ),
    },
    {
      label: `${symbol} 未平仓合约名义价值`,
      presentation: presentMarketDatum(
        snapshot.openInterest,
        formatOpenInterestReading,
      ),
    },
    {
      label: "全市场 24 小时强平",
      presentation: presentMarketDatum(
        snapshot.liquidations24h,
        formatLiquidationsReading,
      ),
    },
    {
      label: `${symbol} ETF 净流量`,
      presentation: presentMarketDatum(snapshot.etfFlow, formatEtfFlowReading),
    },
    comparison,
  ];
  const visibleFacts = facts.filter(({ presentation }) =>
    presentation.state === "fresh" || presentation.state === "stale",
  );
  const coverageNotes = facts.filter(({ presentation }) =>
    presentation.state !== "fresh" && presentation.state !== "stale",
  );

  return (
    <section
      id="derivatives"
      className="asset-facts asset-page-anchor"
      aria-labelledby="asset-facts-title"
    >
      <div className="section-bar">
        <div>
          <p className="panel-kicker">Derivatives & Context</p>
          <h2 id="asset-facts-title">衍生品与市场背景</h2>
        </div>
        <span className="section-context">单场所与聚合口径分开标注</span>
      </div>
      {visibleFacts.length > 0 ? (
        <div className="asset-facts-grid">
          {visibleFacts.map((fact) => (
            <MarketFact key={fact.label} {...fact} />
          ))}
        </div>
      ) : (
        <p className="asset-facts-empty">
          衍生品与市场背景当前 0/{facts.length} 项可用；刷新页面或后续访问时会重新检查。
        </p>
      )}
      {coverageNotes.length > 0 && (
        <details className="coverage-details asset-facts-coverage">
          <summary>
            <span>数据覆盖说明</span>
            <span>
              {visibleFacts.length}/{facts.length} 项可用 · 查看{" "}
              {coverageNotes.length} 项说明
            </span>
          </summary>
          <div className="coverage-list">
            {coverageNotes.map((fact) => (
              <AssetFactCoverageRow key={fact.label} {...fact} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

type AssetFactDescriptor = {
  label: string;
  presentation: DatumPresentation;
};

function MarketFact({
  label,
  presentation,
}: AssetFactDescriptor) {
  return (
    <article className={`asset-fact asset-fact--${presentation.state}`}>
      <div className="datum-heading">
        <h3>{label}</h3>
        <DatumStatus presentation={presentation} compact />
      </div>
      <strong className={`asset-fact__value value-direction--${presentation.value.direction ?? "neutral"}`}>
        {presentation.value.primary}
      </strong>
      {presentation.value.secondary && <p>{presentation.value.secondary}</p>}
      {presentation.note && <p className="datum-note">{presentation.note}</p>}
      <DatumMeta presentation={presentation} />
    </article>
  );
}

function AssetFactCoverageRow({
  label,
  presentation,
}: AssetFactDescriptor) {
  return (
    <article
      className={`coverage-row coverage-row--${presentation.state}`}
      aria-label={`${label}：${presentation.statusLabel}`}
    >
      <div>
        <h3>{label}</h3>
        {presentation.note && <p>{presentation.note}</p>}
      </div>
      <div className="coverage-row__status">
        <DatumStatus presentation={presentation} compact />
        <DatumMeta presentation={presentation} />
      </div>
    </article>
  );
}

function resolveAssetHeadline(
  priceDatum: MarketDatum<PriceQuote>,
  candlesDatum: MarketDatum<readonly DailyCandle[]> | null,
): {
  presentation: DatumPresentation;
  quote: PriceQuote | null;
  currency: "USD" | "USDT";
  note: string | null;
} {
  const quote = publicAvailableValue(priceDatum);
  const pricePresentation = presentMarketDatum(priceDatum, (value) => ({
    primary: formatUsdPrice(value.priceUsd),
  }));

  if (quote !== null) {
    return {
      presentation: pricePresentation,
      quote,
      currency: "USD",
      note: pricePresentation.note,
    };
  }

  const candles = candlesDatum ? publicAvailableValue(candlesDatum) : null;
  const latestClosedCandle = candles?.at(-1) ?? null;
  if (latestClosedCandle === null || candlesDatum === null) {
    return {
      presentation: pricePresentation,
      quote: null,
      currency: "USD",
      note: pricePresentation.note,
    };
  }

  return {
    presentation: presentMarketDatum(candlesDatum, (value) => ({
      primary: formatPriceNumber(value.at(-1)?.close ?? Number.NaN),
    })),
    quote: null,
    currency: "USDT",
    note:
      "聚合 USD 报价暂不可用；当前显示 Binance 最新已闭合日线收盘，不是实时现货价。",
  };
}

function dailyCandlesAsChartDatum(
  datum: MarketDatum<readonly DailyCandle[]>,
): MarketDatum<readonly ChartCandle[]> {
  if (datum.status !== "fresh" && datum.status !== "stale") {
    return datum as MarketDatum<readonly ChartCandle[]>;
  }
  return {
    ...datum,
    value: datum.value.map((candle) => ({
      ...candle,
      state: "closed" as const,
    })),
  };
}

function publicAvailableValue<T>(datum: MarketDatum<T>): T | null {
  return (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic"
    ? datum.value
    : null;
}

function formatNullablePercent(value: number | null): string {
  return value === null ? "—" : formatPercent(value, true);
}

function formatUsdt(value: number | null): string {
  const formatted = formatPriceNumber(value);
  return formatted === "—" ? formatted : `${formatted} USDT`;
}

function formatPriceNumber(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
}

function trendLabel(state: TechnicalAnalysisResult["trend"]["state"]): string {
  const labels = {
    upward_alignment: "均线向上排列",
    downward_alignment: "均线向下排列",
    mixed: "均线结构交错",
    insufficient_data: "历史数据不足",
  } as const;
  return labels[state];
}

function trendDescription(value: TechnicalAnalysisResult): string {
  if (value.trend.state === "upward_alignment") {
    return "最新日线收盘高于 SMA20，且 SMA20 高于 SMA50。";
  }
  if (value.trend.state === "downward_alignment") {
    return "最新日线收盘低于 SMA20，且 SMA20 低于 SMA50。";
  }
  if (value.trend.state === "mixed") {
    return "价格与两条均线没有形成同方向的严格排列。";
  }
  return `当前有 ${value.sampleSize} 根已闭合日线，完整比较至少需要 ${value.trend.minimumClosedCandles} 根。`;
}

function relativeFact(
  left: string,
  right: string,
  position: "above" | "below" | "equal" | null,
): string {
  if (position === null) {
    return `${left}与${right}：数据不足`;
  }
  const relation = position === "above" ? "高于" : position === "below" ? "低于" : "等于";
  return `${left}${relation}${right}`;
}
