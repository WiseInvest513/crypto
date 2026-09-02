import "server-only";

import { DatumMeta, DatumStatus } from "@/components/market/datum-presentation";
import {
  chartIntervalLabels,
  liveEmaDefinitions,
  type LiveEmaKey,
} from "@/lib/market/live-chart";
import {
  directionFor,
  formatPercent,
} from "@/lib/market/formatters";
import { presentMarketDatum } from "@/lib/market/homepage-presentation";
import type { MultiTimeframeIntervalAnalysis } from "@/lib/market/multi-timeframe";
import type {
  MultiTimeframeAccessPayload,
  MultiTimeframeIntervalDatum,
} from "@/server/data/services/multi-timeframe-service";

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export async function StreamedAssetMultiTimeframe({
  payload,
  symbol,
}: {
  payload: Promise<MultiTimeframeAccessPayload>;
  symbol: "BTC" | "ETH";
}) {
  const resolved = await payload;
  if (resolved.status !== "granted") {
    return null;
  }

  return (
    <AssetMultiTimeframe
      intervals={resolved.intervals}
      symbol={symbol}
    />
  );
}

export function AssetMultiTimeframeLoading({
  symbol,
}: {
  symbol: "BTC" | "ETH";
}) {
  return (
    <section
      className="asset-mtf asset-mtf--loading"
      aria-label={`${symbol} 多周期客观参考正在加载`}
      aria-busy="true"
      role="status"
    >
      <div>
        <span className="skeleton-line skeleton-line--label" />
        <span className="skeleton-line skeleton-line--value" />
      </div>
      <div className="asset-mtf__loading-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className="sr-only">
        正在读取 {symbol} 的 15 分钟、1 小时、4 小时与日线数据。
      </span>
    </section>
  );
}

function AssetMultiTimeframe({
  intervals,
  symbol,
}: {
  intervals: readonly MultiTimeframeIntervalDatum[];
  symbol: "BTC" | "ETH";
}) {
  const publicAnalyses = intervals.flatMap(({ datum }) => {
    const value = publicAnalysisValue(datum);
    return value === null ? [] : [value];
  });
  const aboveEma20 = countRelation(publicAnalyses, "ema20", "above");
  const aboveEma50 = countRelation(publicAnalyses, "ema50", "above");
  const shortAboveLong = publicAnalyses.filter(
    (analysis) => analysis.ordering?.state === "short_above_long",
  ).length;
  const shortBelowLong = publicAnalyses.filter(
    (analysis) => analysis.ordering?.state === "short_below_long",
  ).length;

  return (
    <section className="asset-mtf" aria-labelledby={`asset-mtf-${symbol}-title`}>
      <header className="section-bar asset-mtf__header">
        <div>
          <p className="panel-kicker">多周期事实</p>
          <h3 id={`asset-mtf-${symbol}-title`}>多周期客观参考</h3>
        </div>
        <span className="asset-mtf__coverage">
          {publicAnalyses.length}/{intervals.length} 个周期可用
        </span>
      </header>

      <div className="asset-mtf__summary" aria-label="多周期机械统计摘要">
        <SummaryFact
          label="收盘高于 EMA20"
          value={formatAvailableCoverage(aboveEma20, publicAnalyses.length)}
        />
        <SummaryFact
          label="收盘高于 EMA50"
          value={formatAvailableCoverage(aboveEma50, publicAnalyses.length)}
        />
        <SummaryFact
          label="EMA10 > 20 > 50 > 200"
          value={formatAvailableCoverage(shortAboveLong, publicAnalyses.length)}
        />
        <SummaryFact
          label="EMA10 < 20 < 50 < 200"
          value={formatAvailableCoverage(shortBelowLong, publicAnalyses.length)}
        />
      </div>

      <div className="asset-mtf__reading">
        <div>
          <span>先看周期差异</span>
          <h4>哪些周期站在 EMA20 上方，哪些仍在下方</h4>
          <p>{buildEma20Reading(publicAnalyses)}</p>
        </div>
        <nav aria-label={`${symbol} 多周期快速定位`}>
          <span>定位周期</span>
          {intervals.map((item) => (
            <a
              key={item.interval}
              href={`#asset-mtf-${symbol}-${item.interval}`}
            >
              {chartIntervalLabels[item.interval]}
            </a>
          ))}
        </nav>
      </div>

      <div className="asset-mtf__grid">
        {intervals.map((item) => (
          <IntervalCard key={item.interval} item={item} symbol={symbol} />
        ))}
      </div>

      <p className="asset-mtf__method" role="note">
        所有比较仅使用已闭合 K 线；EMA 由最多 1,000 根同周期现货 K
        线计算，区间事实取最近 20 根。这里陈述价格与均线关系，不自动生成做多、做空或开仓建议。
      </p>
    </section>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IntervalCard({
  item,
  symbol,
}: {
  item: MultiTimeframeIntervalDatum;
  symbol: "BTC" | "ETH";
}) {
  const presentation = presentMarketDatum(item.datum, (value) => ({
    primary: priceFormatter.format(value.latestClose),
    secondary: "USDT",
  }));
  const analysis = publicAnalysisValue(item.datum);

  return (
    <article
      id={`asset-mtf-${symbol}-${item.interval}`}
      className={`asset-mtf-card asset-mtf-card--${presentation.state}`}
      aria-labelledby={`asset-mtf-${symbol}-${item.interval}-title`}
    >
      <header className="asset-mtf-card__header">
        <div>
          <span>{item.interval}</span>
          <h4 id={`asset-mtf-${symbol}-${item.interval}-title`}>
            {chartIntervalLabels[item.interval]}
          </h4>
        </div>
        <DatumStatus presentation={presentation} />
      </header>

      {analysis === null ? (
        <div className="asset-mtf-card__unavailable" role="status">
          <strong>此周期暂无法完成比较</strong>
          <p>{presentation.note}</p>
          <DatumMeta presentation={presentation} />
        </div>
      ) : (
        <>
          <div className="asset-mtf-card__price">
            <div>
              <span>最新已闭合收盘</span>
              <strong>{priceFormatter.format(analysis.latestClose)}</strong>
              <small>USDT</small>
            </div>
            <span>{analysis.sampleCount} 根闭合样本</span>
          </div>

          <div className="asset-mtf-card__emas" aria-label="EMA 相对位置">
            {analysis.comparisons.map((comparison) => (
              <EmaRelation
                key={comparison.key}
                comparison={comparison}
              />
            ))}
          </div>

          <div className="asset-mtf-card__ordering">
            <span>均线排列</span>
            <strong>{analysis.ordering?.expression ?? "样本不足"}</strong>
          </div>

          <dl className="asset-mtf-card__facts">
            <Fact
              label="近 3 根累计"
              value={formatNullableSignedPercent(
                analysis.recentThreeChangePercent,
              )}
              tone={directionFor(analysis.recentThreeChangePercent)}
            />
            <Fact
              label="近 20 根涨跌"
              value={formatPercent(
                analysis.window.openToCloseChangePercent,
                true,
              )}
              tone={directionFor(analysis.window.openToCloseChangePercent)}
            />
            <Fact
              label="距近 20 根高点"
              value={formatPercent(
                analysis.window.changeFromHighPercent,
                true,
              )}
              tone={directionFor(analysis.window.changeFromHighPercent)}
            />
            <Fact
              label="近 20 根区间位置"
              value={
                analysis.window.latestCloseRangePositionPercent === null
                  ? "区间无振幅"
                  : `${formatPercent(analysis.window.latestCloseRangePositionPercent)} 位置`
              }
            />
          </dl>

          <p className="asset-mtf-card__high-context">
            近 20 根最高 {priceFormatter.format(analysis.window.highestPrice)}、最低{" "}
            {priceFormatter.format(analysis.window.lowestPrice)} USDT；高点位于当前闭合 K
            线之前 {analysis.window.barsSinceHigh} 根；最新闭合量为此前 20 根均量的{" "}
            {analysis.window.latestVolumeRatioToAverage === null
              ? "—"
              : `${analysis.window.latestVolumeRatioToAverage.toFixed(2)} 倍`}。
          </p>

          <details className="asset-mtf-card__method">
            <summary>查看计算口径</summary>
            <dl>
              <div>
                <dt>算法版本</dt>
                <dd>{analysis.algorithmVersion}</dd>
              </div>
              <div>
                <dt>形成中 K 线</dt>
                <dd>
                  {analysis.excludedFormingCandle
                    ? "本次输入已发现并排除"
                    : "本次输入未包含"}
                </dd>
              </div>
              <div>
                <dt>分析样本</dt>
                <dd>{analysis.sampleCount} 根已闭合 K 线</dd>
              </div>
              <div>
                <dt>区间位置定义</dt>
                <dd>最低为 0%，最高为 100%</dd>
              </div>
            </dl>
          </details>

          <div className="asset-mtf-card__meta">
            <DatumMeta presentation={presentation} />
          </div>
        </>
      )}
    </article>
  );
}

function EmaRelation({
  comparison,
}: {
  comparison: MultiTimeframeIntervalAnalysis["comparisons"][number];
}) {
  const label = liveEmaDefinitions[comparison.key].label;
  const relation = relationLabel(comparison.relation);
  const tone = directionFor(comparison.distancePercent);

  return (
    <div className={`asset-mtf-card__ema value-direction--${tone}`}>
      <span>{label}</span>
      <strong>{relation}</strong>
      <small>
        偏离{" "}
        {comparison.distancePercent === null
          ? "—"
          : formatPercent(comparison.distancePercent, true)}
      </small>
      <small>
        EMA 近 3 根{" "}
        {comparison.slope === null
          ? "—"
          : formatPercent(comparison.slope.changePercent, true)}
      </small>
    </div>
  );
}

function Fact({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: ReturnType<typeof directionFor>;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`value-direction--${tone}`}>{value}</dd>
    </div>
  );
}

function publicAnalysisValue(
  datum: MultiTimeframeIntervalDatum["datum"],
): MultiTimeframeIntervalAnalysis | null {
  return (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic"
    ? datum.value
    : null;
}

function countRelation(
  analyses: readonly MultiTimeframeIntervalAnalysis[],
  key: LiveEmaKey,
  relation: "above" | "below" | "equal",
): number {
  return analyses.filter((analysis) =>
    analysis.comparisons.some(
      (comparison) => comparison.key === key && comparison.relation === relation,
    ),
  ).length;
}

function relationLabel(
  relation: MultiTimeframeIntervalAnalysis["comparisons"][number]["relation"],
): string {
  return relation === "above"
    ? "收盘在上"
    : relation === "below"
      ? "收盘在下"
      : relation === "equal"
        ? "收盘重合"
        : "不可用";
}

function formatNullableSignedPercent(value: number | null): string {
  return value === null ? "—" : formatPercent(value, true);
}

function formatAvailableCoverage(value: number, available: number): string {
  return available === 0 ? "—" : `${value}/${available} 个可用`;
}

function buildEma20Reading(
  analyses: readonly MultiTimeframeIntervalAnalysis[],
): string {
  if (analyses.length === 0) {
    return "当前没有足够的已闭合 K 线完成周期比较，缺失周期不会用零值补齐。";
  }

  const relationGroups = [
    { relation: "above" as const, label: "收盘在 EMA20 上方" },
    { relation: "below" as const, label: "收盘在 EMA20 下方" },
    { relation: "equal" as const, label: "收盘与 EMA20 重合" },
  ].flatMap(({ relation, label }) => {
    const intervalLabels = analyses.flatMap((analysis) =>
      analysis.comparisons.some(
        (comparison) =>
          comparison.key === "ema20" && comparison.relation === relation,
      )
        ? [chartIntervalLabels[analysis.interval]]
        : [],
    );
    return intervalLabels.length === 0
      ? []
      : [`${intervalLabels.join("、")}${label}`];
  });

  return `按各自最新一根已闭合 K 线：${relationGroups.join("；")}。这是周期位置对照，不是交易方向判断。`;
}
