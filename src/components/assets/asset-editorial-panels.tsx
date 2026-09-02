import {
  resolveAssetEditorialEntry,
  type AssetEditorialEntries,
  type AssetEditorialSource,
  type AssetKeyLevel,
  type ResolvedAssetEditorialEntry,
  type WiseScenarioContent,
} from "@/lib/editorial/asset-editorial";
import { formatUtcDateTime } from "@/lib/market/formatters";

export function AssetEditorialPanels({
  entries,
  now,
}: {
  entries: AssetEditorialEntries;
  now: number;
}) {
  const keyLevels = resolveAssetEditorialEntry(entries.keyLevels, now);
  const wiseScenario = resolveAssetEditorialEntry(entries.wiseScenario, now);

  return (
    <section className="asset-editorial-section" aria-labelledby="asset-editorial-title">
      <div className="section-bar">
        <div>
          <p className="panel-kicker">人工研究层</p>
          <h2 id="asset-editorial-title">关键位与 Wise Scenario</h2>
        </div>
        <span className="section-context">仅展示已审核且仍在有效期内的人工内容</span>
      </div>
      <div className="asset-editorial-grid">
        <KeyLevelsPanel entry={keyLevels} />
        <WiseScenarioPanel entry={wiseScenario} />
      </div>
    </section>
  );
}

function KeyLevelsPanel({
  entry,
}: {
  entry: ResolvedAssetEditorialEntry<{
    quoteCurrency: "USDT";
    levels: readonly AssetKeyLevel[];
  }>;
}) {
  if (entry.state !== "active" || entry.content === null) {
    return (
      <article className="asset-editorial-panel asset-key-levels">
        <PanelHeader kicker="Support / Resistance" title="人工关键位" />
        <EditorialEmptyState
          state={entry.state}
          kind="人工关键位"
          description="不会把自动计算的候选位置包装成 Wise 的正式支撑位或阻力位。"
        />
        <EditorialMeta entry={entry} />
      </article>
    );
  }

  const support = entry.content.levels
    .filter((level) => level.role === "support")
    .toSorted((left, right) => right.price - left.price);
  const resistance = entry.content.levels
    .filter((level) => level.role === "resistance")
    .toSorted((left, right) => left.price - right.price);

  return (
    <article className="asset-editorial-panel asset-key-levels">
      <PanelHeader kicker="Support / Resistance" title="人工关键位" />
      <div className="asset-level-columns">
        <LevelList
          title="支撑位"
          levels={support}
          quoteCurrency={entry.content.quoteCurrency}
          sources={entry.sources}
        />
        <LevelList
          title="阻力位"
          levels={resistance}
          quoteCurrency={entry.content.quoteCurrency}
          sources={entry.sources}
        />
      </div>
      <EditorialMeta entry={entry} />
    </article>
  );
}

function WiseScenarioPanel({
  entry,
}: {
  entry: ResolvedAssetEditorialEntry<WiseScenarioContent>;
}) {
  if (entry.state !== "active" || entry.content === null) {
    return (
      <article className="asset-editorial-panel asset-wise-scenario">
        <PanelHeader kicker="Wise Scenario" title="人工情景" />
        <EditorialEmptyState
          state={entry.state}
          kind="Wise Scenario"
          description="当前没有处于有效期内的人工情景，系统不会根据价格自动补写投资判断。"
        />
        <EditorialMeta entry={entry} />
      </article>
    );
  }

  const content = entry.content;
  const sources = sourceMap(entry.sources);
  return (
    <article className="asset-editorial-panel asset-wise-scenario">
      <PanelHeader kicker="Wise Scenario" title="人工情景" />
      <div className="asset-scenario-body">
        <h3>{content.headline}</h3>
        <p>{content.summary}</p>
        <ScenarioList title="确认条件" items={content.confirmationConditions} />
        <ScenarioList title="失效条件" items={content.invalidationConditions} />
        {content.watchItems.length > 0 && (
          <ScenarioList title="持续观察" items={content.watchItems} />
        )}
        <ReferencedSources sourceIds={content.sourceIds} sources={sources} />
      </div>
      <EditorialMeta entry={entry} />
    </article>
  );
}

function PanelHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="asset-editorial-panel__header">
      <div>
        <p className="panel-kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      <span className="manual-label">人工维护</span>
    </header>
  );
}

function EditorialEmptyState({
  state,
  kind,
  description,
}: {
  state: "active" | "scheduled" | "expired" | "unpublished";
  kind: string;
  description: string;
}) {
  const separator = /^[A-Za-z]/.test(kind) ? " " : "";
  const labels = {
    active: `${kind}${separator}暂不可用`,
    scheduled: `${kind}${separator}尚未生效`,
    expired: `${kind}${separator}已过期`,
    unpublished: `${kind}${separator}尚未发布`,
  } as const;

  return (
    <div className="asset-editorial-empty">
      <strong>{labels[state]}</strong>
      <p>{description}</p>
    </div>
  );
}

function LevelList({
  title,
  levels,
  quoteCurrency,
  sources,
}: {
  title: string;
  levels: readonly AssetKeyLevel[];
  quoteCurrency: "USDT";
  sources: readonly AssetEditorialSource[];
}) {
  const sourcesById = sourceMap(sources);
  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      <div className="asset-level-list">
        {levels.map((level) => (
          <article key={level.id}>
            <div className="asset-level-list__heading">
              <strong>{formatUsdt(level.price)} {quoteCurrency}</strong>
              <span>{level.label}</span>
            </div>
            <p>{level.rationale}</p>
            <dl>
              <div>
                <dt>失效条件</dt>
                <dd>{level.invalidationCondition}</dd>
              </div>
            </dl>
            <ReferencedSources sourceIds={level.sourceIds} sources={sourcesById} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenarioList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="asset-scenario-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function ReferencedSources({
  sourceIds,
  sources,
}: {
  sourceIds: readonly string[];
  sources: ReadonlyMap<string, AssetEditorialSource>;
}) {
  return (
    <span className="asset-editorial-sources">
      来源{" "}
      {sourceIds.map((sourceId, index) => {
        const source = sources.get(sourceId);
        return source ? (
          <span key={sourceId}>
            {index > 0 && "、"}
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.label}
              <span className="sr-only">（在新标签页打开）</span>
            </a>
          </span>
        ) : null;
      })}
    </span>
  );
}

function EditorialMeta<T>({
  entry,
}: {
  entry: ResolvedAssetEditorialEntry<T>;
}) {
  if (
    entry.lastReviewedAt === null &&
    entry.effectiveAt === null &&
    entry.validUntil === null &&
    entry.sources.length === 0
  ) {
    return (
      <footer className="asset-editorial-meta">
        <span>状态：未发布</span>
      </footer>
    );
  }

  return (
    <footer className="asset-editorial-meta">
      {entry.lastReviewedAt && (
        <time dateTime={entry.lastReviewedAt}>
          审核于 {formatUtcDateTime(entry.lastReviewedAt)}
        </time>
      )}
      {entry.effectiveAt && (
        <time dateTime={entry.effectiveAt}>
          生效于 {formatUtcDateTime(entry.effectiveAt)}
        </time>
      )}
      {entry.validUntil && (
        <time dateTime={entry.validUntil}>
          有效至 {formatUtcDateTime(entry.validUntil)}
        </time>
      )}
      {entry.sources.map((source) => (
        <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">
          {source.label}
          <span className="sr-only">（在新标签页打开）</span>
        </a>
      ))}
    </footer>
  );
}

function sourceMap(
  sources: readonly AssetEditorialSource[],
): ReadonlyMap<string, AssetEditorialSource> {
  return new Map(sources.map((source) => [source.id, source] as const));
}

function formatUsdt(value: number): string {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)
    : "—";
}
