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
import {
  presentMarketDatum,
  type DatumPresentation,
} from "@/lib/market/homepage-presentation";
import {
  DatumStatus,
  DatumUpdatedAt,
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
    const availableQuote = [data.btcPrice, data.ethPrice].find(
      (datum) =>
        (datum.status === "fresh" || datum.status === "stale") &&
        datum.provenance !== "synthetic",
    );
    const fallbackDatum =
      availableQuote ??
      [data.btcPrice, data.ethPrice].find((datum) => datum.status === "error") ??
      data.btcPrice;
    const inputPresentation = presentMarketDatum(fallbackDatum, () => ({
      primary: "—",
    }));
    const presentation = availableQuote
      ? ({
          ...inputPresentation,
          state: "unavailable",
          statusLabel: "变化数据不足",
          value: { primary: "—", direction: "neutral" },
          note: "当前报价缺少完整的 24 小时或 7 日变化。",
        } satisfies DatumPresentation)
      : inputPresentation;

    return (
      <article className="market-now-card market-now-card--lead market-now-card--unavailable">
        <header className="market-now-card__header">
          <div>
            <p className="panel-kicker">BTC 与 ETH</p>
            <h3>短期变化暂不可用</h3>
          </div>
          <DatumStatus presentation={presentation} compact />
        </header>
        <p className="market-now-card__summary">
          {availableQuote
            ? "当前报价缺少完整的 24 小时或 7 日变化，暂不能形成短期比较。"
            : "当前没有可验证的报价，恢复后会自动显示 24 小时与 7 天方向。"}
        </p>
        <DatumUpdatedAt presentation={presentation} />
      </article>
    );
  }

  const summary = `${entries
    .map((entry) => entry.summary.replace(/。$/u, ""))
    .join("；")}。`;
  const hasStaleInput = entries.some((entry) => entry.datum.status === "stale");
  const sharedPresentation = sharedQuotePresentation(entries);
  const isPartial = entries.length < 2;
  const statusLabel = isPartial
    ? hasStaleInput
      ? "1/2 项可用 · 延迟"
      : "1/2 项可用"
    : hasStaleInput
      ? "数据延迟"
      : "已更新";

  return (
    <article className="market-now-card market-now-card--lead">
      <header className="market-now-card__header">
        <div>
          <p className="panel-kicker">24 小时与 7 日</p>
          <h3>{isPartial ? `${entries[0].symbol} 短期变化` : "短期变化"}</h3>
        </div>
        <span
          className={`status-badge status-badge--${hasStaleInput || isPartial ? "warning" : "success"} status-badge--compact`}
        >
          <span aria-hidden="true" />
          {statusLabel}
        </span>
      </header>
      <p className="market-now-card__summary">{summary}</p>
      {sharedPresentation ? (
        <div className="market-now-card__shared-meta">
          <DatumUpdatedAt presentation={sharedPresentation} />
        </div>
      ) : (
        <div className="market-now-card__meta-list">
          {entries.map((entry) => (
            <div key={entry.symbol}>
              <span className="market-now-card__meta-label">{entry.symbol}</span>
              <DatumUpdatedAt
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
  const symbol = asset.toUpperCase();

  if (
    (data.candles.status !== "fresh" && data.candles.status !== "stale") ||
    data.candles.provenance === "synthetic"
  ) {
    const presentation = presentMarketDatum(data.candles, () => ({
      primary: "—",
    }));

    return (
      <article className="market-now-card market-now-card--unavailable">
        <header className="market-now-card__header">
          <div>
            <p className="panel-kicker">{symbol} 已闭合日线</p>
            <h3>日线事实暂不可用</h3>
          </div>
          <DatumStatus presentation={presentation} compact />
        </header>
        <p className="market-now-card__summary">
          {presentation.note ?? "当前没有足够的已验证日线数据。"}
        </p>
        <DatumUpdatedAt presentation={presentation} />
      </article>
    );
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
    const inputPresentation = presentMarketDatum(data.candles, () => ({
      primary: "—",
    }));
    const presentation = {
      ...inputPresentation,
      state: "unavailable",
      statusLabel: "历史不足",
      value: { primary: "—", direction: "neutral" },
      note: "当前可用历史不足以形成可靠的区间或均线事实。",
    } satisfies DatumPresentation;

    return (
      <article className="market-now-card market-now-card--unavailable">
        <header className="market-now-card__header">
          <div>
            <p className="panel-kicker">{symbol} 已闭合日线</p>
            <h3>日线历史不足</h3>
          </div>
          <DatumStatus presentation={presentation} compact />
        </header>
        <p className="market-now-card__summary">
          当前可用历史不足以形成可靠的区间或均线事实。
        </p>
        <DatumUpdatedAt presentation={presentation} />
      </article>
    );
  }

  const presentation = technical
    ? presentMarketDatum(technical, () => ({ primary: summary }))
    : presentMarketDatum(data.candles, () => ({ primary: summary }));
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
            <dt>上一根日线区间</dt>
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
      <DatumUpdatedAt presentation={presentation} />
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
