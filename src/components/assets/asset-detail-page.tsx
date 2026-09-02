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
  type FormattedDatumValue,
} from "@/lib/market/homepage-presentation";
import {
  formatEtfFlowReading,
  formatFundingReading,
  formatLiquidationsReading,
  formatOpenInterestReading,
} from "@/lib/market/reading-formatters";
import { DatumMeta, DatumStatus } from "@/components/market/datum-presentation";
import { AssetEditorialPanels } from "./asset-editorial-panels";
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

  return (
    <div className="asset-detail-page page-container">
      <header className="asset-detail-header">
        <AssetIdentity copy={copy} />
        <Suspense fallback={<AssetQuoteLoading symbol={copy.symbol} />}>
          <StreamedAssetQuote copy={copy} price={price} chart={chart} />
        </Suspense>
      </header>

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

export async function AssetDetailPage({
  asset,
  snapshot,
  editorial,
  editorialNow,
}: {
  asset: Asset;
  snapshot: Promise<AssetDetailSnapshot>;
  editorial: AssetEditorialEntries;
  editorialNow: number;
}) {
  const data = await snapshot;
  const copy = assetCopy[asset];

  return (
    <div className="asset-detail-page page-container">
      <AssetDetailHeader copy={copy} price={data.price} candles={data.candles} />

      <AssetDataNotice
        datums={[
          data.price,
          data.candles,
          data.technical,
          data.funding,
          data.openInterest,
          data.liquidations24h,
          data.etfFlow,
          data.comparison.datum,
        ]}
        titleId="asset-data-notice-title"
      />

      <div className="asset-workbench">
        <ChartWorkspace asset={asset} snapshot={data} copy={copy} />
        <TechnicalRail datum={data.technical} symbol={copy.symbol} />
      </div>

      <AssetMarketFacts snapshot={data} symbol={copy.symbol} />

      <AssetEditorialPanels entries={editorial} now={editorialNow} />

      <p className="asset-detail-disclaimer">
        均线与相对位置是基于已闭合日线的客观计算，不构成投资建议；人工关键位与 Wise Scenario 只有在审核并发布后才会显示。
      </p>
    </div>
  );
}

async function StreamedAssetQuote({
  copy,
  price,
  chart,
}: {
  copy: AssetCopy;
  price: Promise<MarketDatum<PriceQuote>>;
  chart: Promise<AssetChartSnapshot>;
}) {
  const priceDatum = await price;
  const candles =
    publicAvailableValue(priceDatum) === null
      ? (await chart).candles
      : null;

  return <AssetQuotePanel copy={copy} price={priceDatum} candles={candles} />;
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
    <>
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
    </>
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

  return (
    <>
      <AssetDataNotice
        datums={[
          data.funding,
          data.openInterest,
          data.liquidations24h,
          data.etfFlow,
          data.comparison.datum,
        ]}
        titleId="asset-context-data-notice-title"
      />
      <AssetMarketFacts snapshot={data} symbol={symbol} />
    </>
  );
}

function AssetDetailHeader({
  copy,
  price,
  candles,
}: {
  copy: AssetCopy;
  price: MarketDatum<PriceQuote>;
  candles: MarketDatum<readonly DailyCandle[]>;
}) {
  return (
    <header className="asset-detail-header">
      <AssetIdentity copy={copy} />
      <AssetQuotePanel copy={copy} price={price} candles={candles} />
    </header>
  );
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

function AssetQuotePanel({
  copy,
  price: priceDatum,
  candles,
}: {
  copy: AssetCopy;
  price: MarketDatum<PriceQuote>;
  candles: MarketDatum<readonly DailyCandle[]> | null;
}) {
  const price = presentMarketDatum(priceDatum, (value) => ({
    primary: formatUsdPrice(value.priceUsd),
  }));
  const publicQuote = publicAvailableValue(priceDatum);
  const publicCandles = candles ? publicAvailableValue(candles) : null;
  const latestClosedCandle = publicCandles?.at(-1) ?? null;
  const binanceClosePrice =
    publicQuote === null && candles !== null && latestClosedCandle !== null
      ? presentMarketDatum(candles, (value) => ({
          primary: formatPriceNumber(value.at(-1)?.close ?? Number.NaN),
        }))
      : null;
  const headlinePrice = binanceClosePrice ?? price;
  const headlineCurrency = binanceClosePrice ? "USDT" : "USD";
  const headlineNote = binanceClosePrice
    ? "聚合 USD 报价暂不可用；当前显示 Binance 最新已闭合日线收盘，不是实时现货价。"
    : price.note;

  return (
    <div className="asset-quote" aria-label={`${copy.symbol} 价格参考`}>
      <div className="asset-quote__value">
        <strong>{headlinePrice.value.primary}</strong>
        <span className="asset-quote__currency">{headlineCurrency}</span>
      </div>
      <div className="asset-quote__changes">
        <span
          className={`value-direction--${directionFor(publicQuote?.change24hPercent ?? null)}`}
        >
          24 小时 {formatNullablePercent(publicQuote?.change24hPercent ?? null)}
        </span>
        <span
          className={`value-direction--${directionFor(publicQuote?.change7dPercent ?? null)}`}
        >
          7 天 {formatNullablePercent(publicQuote?.change7dPercent ?? null)}
        </span>
        <DatumStatus presentation={headlinePrice} compact />
      </div>
      {headlineNote && <p className="datum-note">{headlineNote}</p>}
      <DatumMeta presentation={headlinePrice} />
    </div>
  );
}

function AssetQuoteLoading({ symbol }: { symbol: "BTC" | "ETH" }) {
  return (
    <div
      className="asset-quote"
      aria-label={`${symbol} 价格正在加载`}
      aria-busy="true"
      role="status"
    >
      <div className="asset-quote__value" aria-hidden="true">
        <strong>—</strong>
        <span className="asset-quote__currency">USD</span>
      </div>
      <span className="status-badge status-badge--neutral">
        <span aria-hidden="true" />加载中
      </span>
      <span className="sr-only">{symbol} 价格正在加载。</span>
    </div>
  );
}

function AssetWorkbenchLoading({ symbol }: { symbol: "BTC" | "ETH" }) {
  return (
    <div
      className="asset-workbench asset-workbench--loading"
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
      className="asset-facts"
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
  return (
    <section className="asset-facts" aria-labelledby="asset-facts-title">
      <div className="section-bar">
        <div>
          <p className="panel-kicker">Derivatives & Context</p>
          <h2 id="asset-facts-title">衍生品与市场背景</h2>
        </div>
        <span className="section-context">单场所与聚合口径分开标注</span>
      </div>
      <div className="asset-facts-grid">
        <MarketFact label={`${symbol} 资金费率`} datum={snapshot.funding} format={formatFundingReading} />
        <MarketFact label={`${symbol} 未平仓合约名义价值`} datum={snapshot.openInterest} format={formatOpenInterestReading} />
        <MarketFact label="全市场 24 小时强平" datum={snapshot.liquidations24h} format={formatLiquidationsReading} />
        <MarketFact label={`${symbol} ETF 净流量`} datum={snapshot.etfFlow} format={formatEtfFlowReading} />
        {snapshot.comparison.kind === "btc-dominance" ? (
          <MarketFact
            label="BTC 市占率"
            datum={snapshot.comparison.datum}
            format={(value) => ({ primary: formatPercent(value.btcDominancePercent) })}
          />
        ) : (
          <MarketFact
            label="ETH / BTC"
            datum={snapshot.comparison.datum}
            format={(value) => ({ primary: formatEthBtcRatio(value.ethBtcRatio) })}
          />
        )}
      </div>
    </section>
  );
}

function MarketFact<T>({
  label,
  datum,
  format,
}: {
  label: string;
  datum: MarketDatum<T>;
  format: (value: T) => FormattedDatumValue;
}) {
  const presentation = presentMarketDatum(datum, format);
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
