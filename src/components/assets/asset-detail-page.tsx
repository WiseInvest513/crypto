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
import type { AssetEditorialEntries } from "@/lib/editorial/asset-editorial";
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
import {
  AssetEditorialPanels,
  hasVisibleAssetEditorial,
} from "./asset-editorial-panels";
import { AssetPriceChart } from "./asset-price-chart";

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
  editorialNow,
}: {
  asset: Asset;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
  context: Promise<AssetContextSnapshot>;
  editorial: AssetEditorialEntries;
  editorialNow: number;
}) {
  const copy = assetCopy[asset];
  const showEditorial = hasVisibleAssetEditorial(editorial, editorialNow);

  return (
    <div className="asset-detail-page page-container">
      <header className="asset-detail-header">
        <AssetIdentity copy={copy} />
      </header>

      <AssetCompactSummary copy={copy} price={price} chart={chart} />

      <AssetPageActions
        asset={asset}
        symbol={copy.symbol}
        showEditorial={showEditorial}
      />

      <Suspense fallback={<AssetWorkbenchLoading symbol={copy.symbol} />}>
        <StreamedAssetWorkbench
          asset={asset}
          chart={chart}
          liveChart={liveChart}
          copy={copy}
        />
      </Suspense>

      <Suspense fallback={<AssetFactsLoading symbol={copy.symbol} />}>
        <StreamedAssetContext context={context} symbol={copy.symbol} />
      </Suspense>

      <AssetEditorialPanels entries={editorial} now={editorialNow} />

      <p className="asset-detail-disclaimer">
        图内 EMA 相对位置按所选周期的已闭合 K 线计算；下方 SMA 背景只使用已闭合日线。两者均为客观事实，不构成投资建议；人工关键位与 Wise Scenario 只有在审核并发布后才会显示。
      </p>
    </div>
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
        <TechnicalRail datum={data.technical} symbol={copy.symbol} />
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

function AssetIdentity({ copy }: { copy: AssetCopy }) {
  return (
    <div className="asset-detail-header__identity">
      <span className={`asset-mark ${copy.tone}`} aria-hidden="true">
        {copy.symbol.slice(0, 1)}
      </span>
      <div>
        <p className="page-kicker">资产工作台 · {copy.symbol}</p>
        <h1>{copy.name}</h1>
        <p className="asset-detail-header__description">{copy.description}</p>
      </div>
    </div>
  );
}

function AssetCompactSummary({
  copy,
  price,
  chart,
}: {
  copy: AssetCopy;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
}) {
  const summaryTitleId = `asset-summary-${copy.symbol.toLowerCase()}-title`;

  return (
    <section
      id="price"
      className="asset-summary asset-page-anchor"
      aria-labelledby={summaryTitleId}
    >
      <header className="asset-summary__header">
        <div>
          <p className="panel-kicker">快速摘要</p>
          <h2 id={summaryTitleId}>{copy.symbol} 资产摘要</h2>
        </div>
        <span>价格与日线使用各自标注的独立口径</span>
      </header>
      <div className="asset-summary__segments">
        <Suspense fallback={<AssetSummarySegmentLoading label="价格数据" />}>
          <StreamedAssetSummaryPrice price={price} chart={chart} />
        </Suspense>
        <Suspense
          fallback={<AssetSummarySegmentLoading label="日线技术事实" />}
        >
          <StreamedAssetSummaryTechnical chart={chart} />
        </Suspense>
      </div>
    </section>
  );
}

async function StreamedAssetSummaryPrice({
  price,
  chart,
}: {
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
}) {
  const priceDatum = await price;
  const candles =
    publicAvailableValue(priceDatum) === null
      ? (await chart).candles
      : null;
  const headline = resolveAssetHeadline(priceDatum, candles);

  return (
    <div className="asset-summary__segment">
      <dl className="asset-summary__grid">
        <SummaryMetric
          label="参考价格"
          value={headline.presentation.value.primary}
          unit={headline.currency}
        />
        <SummaryMetric
          label="24 小时"
          value={formatNullablePercent(headline.quote?.change24hPercent ?? null)}
          direction={directionFor(headline.quote?.change24hPercent ?? null)}
        />
        <SummaryMetric
          label="7 天"
          value={formatNullablePercent(headline.quote?.change7dPercent ?? null)}
          direction={directionFor(headline.quote?.change7dPercent ?? null)}
        />
      </dl>
      {headline.note && (
        <p className="asset-summary__notice">{headline.note}</p>
      )}
      <div className="asset-summary__meta">
        <span>价格数据</span>
        <DatumStatus presentation={headline.presentation} compact />
        <DatumMeta presentation={headline.presentation} />
      </div>
    </div>
  );
}

async function StreamedAssetSummaryTechnical({
  chart,
}: {
  chart: Promise<AssetChartSnapshot>;
}) {
  const snapshot = await chart;
  const technical = publicAvailableValue(snapshot.technical);
  const latest = technical?.latest ?? null;
  const presentation = presentMarketDatum(snapshot.technical, (value) => ({
    primary: trendLabel(value.trend.state),
    secondary: "已闭合日线 · SMA20 / SMA50",
  }));

  return (
    <div className="asset-summary__segment">
      <dl className="asset-summary__grid">
        <SummaryMetric label="日线 SMA20" value={formatUsdt(latest?.ma20 ?? null)} />
        <SummaryMetric label="日线 SMA50" value={formatUsdt(latest?.ma50 ?? null)} />
        <SummaryMetric
          label="客观趋势"
          value={technical ? trendLabel(technical.trend.state) : "—"}
          detail={
            technical
              ? trendDescription(technical)
              : presentation.note ?? "日线技术事实暂不可用。"
          }
          emphasized
        />
      </dl>
      <div className="asset-summary__meta">
        <span>日线技术事实</span>
        <DatumStatus presentation={presentation} compact />
        <DatumMeta presentation={presentation} />
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  unit,
  direction = "neutral",
  detail,
  emphasized = false,
}: {
  label: string;
  value: string;
  unit?: string;
  direction?: "positive" | "negative" | "flat" | "neutral";
  detail?: string;
  emphasized?: boolean;
}) {
  return (
    <div className={emphasized ? "asset-summary__metric--emphasized" : undefined}>
      <dt>{label}</dt>
      <dd className={`value-direction--${direction}`}>
        {value}
        {unit && <small>{unit}</small>}
      </dd>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function AssetPageActions({
  asset,
  symbol,
  showEditorial,
}: {
  asset: Asset;
  symbol: "BTC" | "ETH";
  showEditorial: boolean;
}) {
  return (
    <div className="asset-page-actions">
      <nav className="asset-section-nav" aria-label={`${symbol} 页面章节`}>
        <span>页面导览</span>
        <a href="#price">价格</a>
        <a href="#trend">趋势</a>
        <a href="#derivatives">衍生品</a>
        {showEditorial && <a href="#editorial">人工情景</a>}
      </nav>

      <section
        className="asset-tool-shortcuts"
        aria-labelledby={`asset-tools-${asset}-title`}
      >
        <div className="asset-tool-shortcuts__intro">
          <div>
            <p className="panel-kicker">下一步</p>
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
    </div>
  );
}

function AssetSummarySegmentLoading({ label }: { label: string }) {
  return (
    <div
      className="asset-summary__segment asset-summary__segment--loading"
      aria-label={`${label}正在加载`}
      aria-busy="true"
      role="status"
    >
      <div className="asset-summary__grid" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span className="asset-summary__skeleton" key={index} />
        ))}
      </div>
      <span className="sr-only">{label}正在加载。</span>
    </div>
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

  if (
    liveCandles === undefined &&
    (candles === null || candles.length === 0)
  ) {
    return (
      <section className="asset-workbench__chart asset-chart-state" aria-labelledby="asset-chart-state-title">
        <div>
          <p className="panel-kicker">价格图表</p>
          <h2 id="asset-chart-state-title">日线数据暂不可用</h2>
          <p>{candlePresentation.note ?? "没有可用于绘制图表的可靠日线数据。"}</p>
          <DatumStatus presentation={candlePresentation} />
          <DatumMeta presentation={candlePresentation} />
        </div>
      </section>
    );
  }

  const chartDatum =
    liveCandles ?? dailyCandlesAsChartDatum(snapshot.candles);
  return (
    <section className="asset-workbench__chart">
      <AssetPriceChart
        asset={asset}
        assetLabel={copy.name}
        initialDatum={chartDatum}
      />
    </section>
  );
}

function TechnicalRail({
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
    <aside className="asset-workbench__rail" aria-labelledby="technical-title">
      <header className="asset-rail-header">
        <div>
          <p className="panel-kicker">Closed Daily</p>
          <h2 id="technical-title">{symbol} 日线背景</h2>
        </div>
        <DatumStatus presentation={presentation} compact />
      </header>

      <section className="asset-trend-state">
        <span>已闭合日线 SMA 结构</span>
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
        <p>独立日线背景：收盘价 &gt; SMA20 &gt; SMA50 为向上排列；反向为向下排列；其他情况为交错。不会跟随上方图表周期切换。</p>
        <DatumMeta presentation={presentation} />
      </footer>
    </aside>
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
