import Link from "next/link";
import type {
  MarketDatum,
  MarketDatumView,
  PriceQuote,
} from "@/server/data/contracts/market-data";
import type {
  MarketCoreSnapshot,
  MarketIndicatorSnapshot,
  MarketPulseSnapshot,
  MarketQuoteSnapshot,
} from "@/server/data/services/market-snapshot-service";
import {
  directionFor,
  formatCompactUsd,
  formatEthBtcRatio,
  formatIndexValue,
  formatPercent,
  formatUtcDateTime,
  formatUsdPrice,
  translateSentimentClassification,
} from "@/lib/market/formatters";
import {
  interpretMarketIndicators,
  type ObjectiveMarketInterpretation,
} from "@/lib/market/market-indicator-interpretation";
import {
  presentMarketDatum,
  summarizeMarketData,
  type FormattedDatumValue,
} from "@/lib/market/homepage-presentation";
import {
  DatumStatus,
  DatumUpdatedAt,
} from "@/components/market/datum-presentation";

type CoreSnapshotPromise = Promise<MarketCoreSnapshot>;
type IndicatorSnapshotPromise = Promise<MarketIndicatorSnapshot>;
type PulseSnapshotPromise = Promise<MarketPulseSnapshot>;
type QuoteSnapshotPromise = Promise<MarketQuoteSnapshot>;

export async function MarketDataNotice({
  snapshot,
}: {
  snapshot: CoreSnapshotPromise;
}) {
  const data = await snapshot;
  const summary = summarizeMarketData(snapshotDatums(data));

  if (summary.kind === "healthy") {
    return null;
  }

  return (
    <section
      className={`data-notice data-notice--${summary.kind}`}
      aria-labelledby="data-notice-title"
      role="status"
    >
      <span className="data-notice__icon" aria-hidden="true">
        i
      </span>
      <div>
        <strong id="data-notice-title">{summary.title}</strong>
        <p>{summary.description}</p>
      </div>
      <div className="data-notice__meta">
        {summary.retrievedAt && summary.retrievedAtLabel && (
          <time dateTime={summary.retrievedAt}>
            最近检查 {summary.retrievedAtLabel}
          </time>
        )}
      </div>
    </section>
  );
}

export function MarketDataNoticeLoading() {
  return (
    <section className="data-notice data-notice--loading" role="status">
      <span className="data-notice__icon" aria-hidden="true">
        i
      </span>
      <div>
        <strong>正在连接市场数据</strong>
        <p>已验证的数据会逐项显示，缺失值不会用占位数字替代。</p>
      </div>
      <span className="sr-only">市场数据正在加载。</span>
    </section>
  );
}

export async function MarketPulse({ snapshot }: { snapshot: PulseSnapshotPromise }) {
  const data = await snapshot;

  return (
    <section className="home-market-pulse" aria-labelledby="metrics-title">
      <div className="home-section-heading home-section-heading--compact">
        <div>
          <h2 id="metrics-title">市场脉搏</h2>
          <p>四个指标，帮助快速理解市场所处背景。</p>
        </div>
        <span>客观数据，不生成市场判断</span>
      </div>
      <div className="metric-grid">
        <MetricItem
          label="加密市场总市值"
          datum={data.marketCap}
          format={(value) => ({
            primary: formatCompactUsd(value.totalMarketCapUsd),
          })}
        />
        <MetricItem
          label="恐慌与贪婪指数"
          datum={data.fearAndGreed}
          format={(value) => ({
            primary: formatIndexValue(value.value),
            secondary: translateSentimentClassification(value.classification),
          })}
        />
        <MetricItem
          label="BTC 市占率"
          datum={data.btcDominance}
          format={(value) => ({
            primary: formatPercent(value.btcDominancePercent),
          })}
        />
        <MetricItem
          label="ETH / BTC"
          datum={data.ethBtc}
          format={(value) => ({
            primary: formatEthBtcRatio(value.ethBtcRatio),
          })}
        />
      </div>
    </section>
  );
}

export function MarketPulseLoading() {
  return (
    <section
      className="home-market-pulse"
      aria-labelledby="metrics-loading-title"
      aria-busy="true"
    >
      <div className="home-section-heading home-section-heading--compact">
        <div>
          <h2 id="metrics-loading-title">市场脉搏</h2>
          <p>四个指标，帮助快速理解市场所处背景。</p>
        </div>
        <span className="status-badge status-badge--neutral">加载中</span>
      </div>
      <div className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="metric-item metric-item--loading" key={index}>
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line skeleton-line--value" />
            <span className="skeleton-line skeleton-line--meta" />
          </div>
        ))}
      </div>
      <span className="sr-only">关键市场指标正在加载。</span>
    </section>
  );
}

export async function AssetOverview({
  snapshot,
}: {
  snapshot: QuoteSnapshotPromise;
}) {
  const data = await snapshot;
  const assets = [
    {
      href: "/btc" as const,
      symbol: "BTC" as const,
      name: "比特币",
      tone: "asset-mark--bitcoin",
      datum: data.btcPrice,
    },
    {
      href: "/eth" as const,
      symbol: "ETH" as const,
      name: "以太坊",
      tone: "asset-mark--ethereum",
      datum: data.ethPrice,
    },
  ];

  return (
    <section className="home-asset-board" aria-labelledby="assets-title">
      <h2 className="sr-only" id="assets-title">
        BTC 与 ETH 市场概览
      </h2>
      <ul aria-label="资产概览">
        {assets.map((asset) => (
          <AssetRow key={asset.href} {...asset} />
        ))}
      </ul>
    </section>
  );
}

export function AssetOverviewLoading() {
  return (
    <section
      className="home-asset-board home-asset-board--loading"
      aria-labelledby="assets-loading-title"
      aria-busy="true"
    >
      <h2 className="sr-only" id="assets-loading-title">
        BTC 与 ETH 市场概览正在加载
      </h2>
      <div className="asset-loading-list" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => (
          <div className="asset-loading-row" key={index}>
            <span className="skeleton-circle" />
            <span className="skeleton-line skeleton-line--asset" />
            <span className="skeleton-line skeleton-line--price" />
          </div>
        ))}
      </div>
      <span className="sr-only">BTC 与 ETH 行情正在加载。</span>
    </section>
  );
}

export async function HomepageQuoteUpdatedAt({
  snapshot,
}: {
  snapshot: QuoteSnapshotPromise;
}) {
  const data = await snapshot;
  const presentations = [
    presentMarketDatum(data.btcPrice, (value) => ({
      primary: formatUsdPrice(value.priceUsd),
    })),
    presentMarketDatum(data.ethPrice, (value) => ({
      primary: formatUsdPrice(value.priceUsd),
    })),
  ];
  const available = presentations.filter(
    (presentation) => presentation.updatedAt && presentation.updatedAtLabel,
  );

  if (available.length === 0) {
    return <span className="home-hero__update">更新时间暂不可用</span>;
  }

  const oldest = available.reduce((current, candidate) =>
    Date.parse(candidate.updatedAt!) < Date.parse(current.updatedAt!)
      ? candidate
      : current,
  );
  const isStale = available.some(
    (presentation) => presentation.state === "stale",
  );

  return (
    <span className="home-hero__update">
      <span className="sr-only">BTC 与 ETH 数据更新时间：</span>
      <time dateTime={oldest.updatedAt!}>
        最后更新 {oldest.updatedAtLabel}
      </time>
      {available.length < presentations.length && (
        <strong>行情 {available.length}/{presentations.length} 项可用</strong>
      )}
      {isStale && <strong>数据延迟</strong>}
    </span>
  );
}

export async function KeyMarketIndicators({
  snapshot,
}: {
  snapshot: IndicatorSnapshotPromise;
}) {
  const data = await snapshot;
  const interpretations = interpretMarketIndicators(data);
  const visibleInterpretations = [
    interpretations.leverage,
    interpretations.liquidations,
    interpretations.etfFlow,
  ].filter((interpretation) => interpretation.evidence.length > 0);

  return (
    <section
      className={`home-market-context${visibleInterpretations.length === 0 ? " home-market-context--unavailable" : ""}`}
      aria-labelledby="market-context-title"
    >
      <header className="home-market-context__header">
        <div>
          <span>从数字到含义</span>
          <h2 id="market-context-title">杠杆与资金，正在发生什么</h2>
          <p>先读客观结论，再看支撑它的事实和下一步观察条件。</p>
        </div>
        <span>机械解读 · 不预测涨跌</span>
      </header>
      {visibleInterpretations.length > 0 ? (
        <>
          <div className="home-market-context__grid">
            {visibleInterpretations.map((interpretation, index) => (
              <MarketInterpretationCard
                interpretation={interpretation}
                index={index + 1}
                key={interpretation.id}
              />
            ))}
          </div>
          {visibleInterpretations.length < 3 && (
            <p className="home-market-context__partial-note" role="status">
              部分主题暂时缺少可核验数据；已有结论保持显示，缺失项不会用零补齐。
            </p>
          )}
        </>
      ) : (
        <div className="home-market-context__empty" role="status">
          <span aria-hidden="true">···</span>
          <div>
            <strong>暂无法形成市场解释</strong>
            <p>资金与杠杆数据恢复后会自动更新；缺失值不会按零处理。</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function KeyMarketIndicatorsLoading() {
  return (
    <section
      className="home-market-context home-market-context--loading"
      aria-labelledby="market-context-loading-title"
      aria-busy="true"
      role="status"
    >
      <header className="home-market-context__header">
        <div>
          <span>从数字到含义</span>
          <h2 id="market-context-loading-title">杠杆与资金，正在发生什么</h2>
          <p>正在整理客观结论、支撑事实与观察条件。</p>
        </div>
        <span>正在解读</span>
      </header>
      <div className="home-market-context__grid" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="home-market-context-card home-market-context-card--loading" key={index}>
            <span className="skeleton-line skeleton-line--label" />
            <span className="skeleton-line skeleton-line--value" />
            <span className="skeleton-line skeleton-line--meta" />
            <span className="skeleton-line skeleton-line--meta" />
          </div>
        ))}
      </div>
      <span className="sr-only">衍生品与资金流数据正在加载。</span>
    </section>
  );
}

function MarketInterpretationCard({
  interpretation,
  index,
}: {
  interpretation: ObjectiveMarketInterpretation;
  index: number;
}) {
  const titleId = `market-context-${interpretation.id}`;
  const status = interpretation.stale
    ? "数据延迟"
    : interpretation.availability === "partial"
      ? "部分数据"
      : "已更新";

  return (
    <article
      className={`home-market-context-card home-market-context-card--${interpretation.id}${interpretation.stale ? " home-market-context-card--stale" : ""}`}
      aria-labelledby={titleId}
    >
      <header className="home-market-context-card__header">
        <span className="home-market-context-card__icon" aria-hidden="true">
          <MarketContextIcon id={interpretation.id} />
        </span>
        <div>
          <span>{String(index).padStart(2, "0")}</span>
          <p>{interpretation.title}</p>
        </div>
        <span className={`home-market-context-card__status home-market-context-card__status--${interpretation.stale ? "stale" : interpretation.availability}`}>
          {status}
        </span>
      </header>

      <div className="home-market-context-card__meaning">
        <span>现在发生了什么</span>
        <h3 id={titleId}>{interpretation.headline}</h3>
        <p>
          <strong>这代表什么</strong>
          {interpretation.summary}
        </p>
      </div>

      <div className="home-market-context-card__evidence">
        <span>支撑这一结论的数据</span>
        <dl>
          {interpretation.evidence.map((evidence) => (
            <div key={evidence.capability}>
              <dt>{evidence.label}</dt>
              <dd>{evidence.value}</dd>
              <small>{evidence.context}</small>
            </div>
          ))}
        </dl>
      </div>

      <div className="home-market-context-card__watch">
        <span>接下来观察</span>
        <p>{interpretation.watchCondition}</p>
      </div>

      <footer>
        {interpretation.updatedAt ? (
          <time dateTime={interpretation.updatedAt}>
            更新于 {formatUtcDateTime(interpretation.updatedAt)}
          </time>
        ) : (
          <span>更新时间暂不可用</span>
        )}
        <span>只解释已发生的数据</span>
      </footer>
    </article>
  );
}

function MarketContextIcon({
  id,
}: {
  id: ObjectiveMarketInterpretation["id"];
}) {
  if (id === "leverage") {
    return (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 18V11m7 7V6m7 12V9" />
        <path d="m3 8 4-4 4 4m2 8 4 4 4-4" />
      </svg>
    );
  }

  if (id === "liquidations") {
    return (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m13.5 2-8 12h6L10.5 22l8-12h-6z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 7h14m-3-3 3 3-3 3M20 17H6m3-3-3 3 3 3" />
    </svg>
  );
}

function AssetRow({
  href,
  symbol,
  name,
  tone,
  datum,
}: {
  href: "/btc" | "/eth";
  symbol: "BTC" | "ETH";
  name: string;
  tone: string;
  datum: MarketDatum<PriceQuote>;
}) {
  const presentation = presentMarketDatum(datum, (value) => ({
    primary: formatUsdPrice(value.priceUsd),
  }));
  const quote =
    (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic"
      ? datum.value
      : null;
  const change24h = quote?.change24hPercent ?? null;
  const change7d = quote?.change7dPercent ?? null;

  return (
    <li className={`home-asset-card home-asset-card--${symbol.toLowerCase()} home-asset-card--${presentation.state}`}>
      <div className="home-asset-card__identity">
        <span className={`asset-mark ${tone}`} aria-hidden="true">
          {symbol.slice(0, 1)}
        </span>
        <span className="home-asset-card__name">
          <strong>{symbol}</strong>
          <small>{name}</small>
        </span>
        <DatumStatus presentation={presentation} compact />
      </div>
      <div className="home-asset-card__market">
        <span className="home-asset-card__price">
          <small>聚合现货价格</small>
          <strong>{presentation.value.primary}</strong>
        </span>
        <dl className="home-asset-card__changes">
          <div>
            <dt>24 小时</dt>
            <dd className={`value-direction--${directionFor(change24h)}`}>
              {change24h === null ? "—" : formatPercent(change24h, true)}
            </dd>
          </div>
          <div>
            <dt>7 天</dt>
            <dd className={`value-direction--${directionFor(change7d)}`}>
              {change7d === null ? "—" : formatPercent(change7d, true)}
            </dd>
          </div>
        </dl>
      </div>
      {presentation.note && (
        <p className="home-asset-card__note">{presentation.note}</p>
      )}
      <div className="home-asset-card__footer">
        <DatumUpdatedAt presentation={presentation} />
        <Link href={href}>
          打开 {symbol} 工作台
          <ArrowRightIcon />
        </Link>
      </div>
    </li>
  );
}

function MetricItem<T>({
  label,
  datum,
  format,
}: {
  label: string;
  datum: MarketDatumView<T>;
  format: (value: T) => FormattedDatumValue;
}) {
  const presentation = presentMarketDatum(datum, format);
  return (
    <article
      className={`metric-item metric-item--${presentation.state}`}
      aria-labelledby={`metric-${presentationId(label)}`}
    >
      <div className="datum-heading">
        <h3 id={`metric-${presentationId(label)}`}>{label}</h3>
        <DatumStatus presentation={presentation} compact />
      </div>
      <strong
        className={`metric-value value-direction--${presentation.value.direction ?? "neutral"}`}
      >
        {presentation.value.primary}
      </strong>
      {presentation.value.secondary && (
        <span className="metric-secondary">{presentation.value.secondary}</span>
      )}
      {presentation.note && <p className="datum-note">{presentation.note}</p>}
      <DatumUpdatedAt presentation={presentation} />
    </article>
  );
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

function presentationId(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/gu, "");
}

function snapshotDatums(
  snapshot: MarketCoreSnapshot,
): readonly MarketDatumView<unknown>[] {
  return [
    snapshot.btcPrice,
    snapshot.ethPrice,
    snapshot.marketCap,
    snapshot.fearAndGreed,
    snapshot.btcDominance,
    snapshot.ethBtc,
  ];
}
