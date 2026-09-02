import type {
  Asset,
  AvailableMarketDatum,
  MarketDatum,
  PriceQuote,
} from "@/server/data/contracts/market-data";
import type {
  MarketQuoteSnapshot,
} from "@/server/data/services/market-snapshot-service";
import type { AssetChartSnapshot } from "@/server/data/services/asset-detail-service";
import {
  deriveDailyMarketFacts,
  describeQuoteDirection,
} from "@/lib/market/homepage-facts";
import { formatUsdPrice } from "@/lib/market/formatters";
import { presentMarketDatum } from "@/lib/market/homepage-presentation";
import {
  DatumMeta,
  DatumStatus,
} from "@/components/market/datum-presentation";

type QuoteFactEntry = {
  symbol: "BTC" | "ETH";
  summary: string;
  datum: AvailableMarketDatum<PriceQuote>;
};

export async function MarketNowQuoteFact({
  snapshot,
}: {
  snapshot: Promise<MarketQuoteSnapshot>;
}) {
  const data = await snapshot;
  const entries = [
    quoteFactEntry("BTC", data.btcPrice),
    quoteFactEntry("ETH", data.ethPrice),
  ].filter((entry): entry is QuoteFactEntry => entry !== null);

  if (entries.length === 0) {
    return null;
  }

  const summary = `${entries
    .map((entry) => entry.summary.replace(/。$/u, ""))
    .join("；")}。`;
  const hasStaleInput = entries.some((entry) => entry.datum.status === "stale");
  const sharedPresentation = sharedQuotePresentation(entries);

  return (
    <article className="market-now-card">
      <header className="market-now-card__header">
        <div>
          <p className="panel-kicker">同一报价内比较</p>
          <h3>短期变化</h3>
        </div>
        <span
          className={`status-badge status-badge--${hasStaleInput ? "warning" : "success"} status-badge--compact`}
        >
          <span aria-hidden="true" />
          {hasStaleInput ? "数据延迟" : "已更新"}
        </span>
      </header>
      <p className="market-now-card__summary">{summary}</p>
      {sharedPresentation ? (
        <div className="market-now-card__shared-meta">
          <DatumMeta presentation={sharedPresentation} />
        </div>
      ) : (
        <div className="market-now-card__meta-list">
          {entries.map((entry) => (
            <div key={entry.symbol} aria-label={`${entry.symbol} 报价元数据`}>
              <span className="market-now-card__meta-label">{entry.symbol}</span>
              <DatumMeta
                presentation={presentMarketDatum(entry.datum, () => ({
                  primary: entry.summary,
                }))}
              />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export async function MarketNowDailyFact({
  asset,
  snapshot,
}: {
  asset: Asset;
  snapshot: Promise<AssetChartSnapshot>;
}) {
  const data = await snapshot;

  if (
    (data.candles.status !== "fresh" && data.candles.status !== "stale") ||
    data.candles.provenance === "synthetic"
  ) {
    return null;
  }

  const technical =
    (data.technical.status === "fresh" || data.technical.status === "stale") &&
    data.technical.provenance !== "synthetic"
      ? data.technical
      : null;

  const facts = deriveDailyMarketFacts(
    asset,
    data.candles.value,
    technical?.value ?? null,
  );
  const summary =
    facts?.summary ??
    facts?.twentyDayRange?.summary ??
    facts?.previousDayRange?.summary;
  if (!facts || !summary) {
    return null;
  }

  const presentation = technical
    ? presentMarketDatum(technical, () => ({ primary: summary }))
    : presentMarketDatum(data.candles, () => ({ primary: summary }));
  const symbol = asset.toUpperCase();

  return (
    <article className="market-now-card">
      <header className="market-now-card__header">
        <div>
          <p className="panel-kicker">{symbol} 已闭合日线</p>
          <h3>{facts.structure ? "均线与区间" : "区间观察"}</h3>
        </div>
        <DatumStatus presentation={presentation} compact />
      </header>
      <p className="market-now-card__summary">{summary}</p>
      <dl className="market-now-card__ranges">
        {facts.previousDayRange && (
          <div>
            <dt>前一日区间</dt>
            <dd>
              {formatUsdtRange(
                facts.previousDayRange.lowUsdt,
                facts.previousDayRange.highUsdt,
              )}
            </dd>
          </div>
        )}
        {facts.twentyDayRange && (
          <div>
            <dt>近 20 日区间</dt>
            <dd>
              {formatUsdtRange(
                facts.twentyDayRange.lowUsdt,
                facts.twentyDayRange.highUsdt,
              )}
              <span>收盘位于{rangePositionLabel(facts.twentyDayRange.position)}</span>
            </dd>
          </div>
        )}
      </dl>
      <DatumMeta presentation={presentation} />
    </article>
  );
}

export function MarketNowFactLoading({ label }: { label: string }) {
  return (
    <article className="market-now-card market-now-card--loading" aria-busy="true">
      <span className="skeleton-line skeleton-line--label" />
      <span className="skeleton-line skeleton-line--value" />
      <span className="skeleton-line skeleton-line--meta" />
      <span className="sr-only">{label}正在加载。</span>
    </article>
  );
}

function quoteFactEntry(
  symbol: "BTC" | "ETH",
  datum: MarketDatum<PriceQuote>,
): QuoteFactEntry | null {
  if (
    (datum.status !== "fresh" && datum.status !== "stale") ||
    datum.provenance === "synthetic"
  ) {
    return null;
  }

  const fact = describeQuoteDirection(datum.value);
  return fact ? { symbol, summary: fact.summary, datum } : null;
}

function sharedQuotePresentation(entries: readonly QuoteFactEntry[]) {
  if (entries.length !== 2) {
    return null;
  }

  const [first, second] = entries;
  if (
    first.datum.status !== second.datum.status ||
    first.datum.source.id !== second.datum.source.id ||
    first.datum.source.url !== second.datum.source.url ||
    first.datum.source.label !== second.datum.source.label ||
    JSON.stringify(first.datum.source.components ?? []) !==
      JSON.stringify(second.datum.source.components ?? []) ||
    first.datum.updatedAt !== second.datum.updatedAt ||
    first.datum.retrievedAt !== second.datum.retrievedAt ||
    JSON.stringify(first.datum.cache) !== JSON.stringify(second.datum.cache) ||
    JSON.stringify(first.datum.fallback ?? null) !==
      JSON.stringify(second.datum.fallback ?? null)
  ) {
    return null;
  }

  return {
    ...presentMarketDatum(first.datum, () => ({ primary: first.summary })),
    scopeLabel: "同一批次的 BTC/USD 与 ETH/USD 聚合现货报价",
  };
}

function formatUsdtRange(low: number, high: number): string {
  return `${formatUsdPrice(low).replace(/^\$/u, "")}–${formatUsdPrice(high).replace(/^\$/u, "")} USDT`;
}

function rangePositionLabel(position: "lower" | "middle" | "upper" | "flat") {
  const labels = {
    lower: "区间下部",
    middle: "区间中部",
    upper: "区间上部",
    flat: "区间上下沿重合位置",
  } as const;
  return labels[position];
}
