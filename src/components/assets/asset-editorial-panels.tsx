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
  const activeCount = [keyLevels, wiseScenario].filter(
    (entry) => entry.state === "active",
  ).length;
  const hasExpired = [keyLevels, wiseScenario].some(
    (entry) => entry.state === "expired",
  );

  if (activeCount === 0 && !hasExpired) {
    return null;
  }

  return (
    <section
      id="editorial"
      className="asset-editorial-section asset-page-anchor"
      aria-labelledby="asset-editorial-title"
    >
      <div className="section-bar">
        <div>
          <p className="panel-kicker">人工研究层</p>
          <h2 id="asset-editorial-title">关键位与 Wise Scenario</h2>
        </div>
        <span className="section-context">
          {activeCount > 0
            ? `${activeCount} 项人工内容处于有效期内`
            : "过期内容不作为当前判断展示"}
        </span>
      </div>
      {activeCount > 0 && (
        <div
          className={`asset-editorial-grid${activeCount === 1 ? " asset-editorial-grid--single" : ""}`}
        >
          {keyLevels.state === "active" && (
            <KeyLevelsPanel entry={keyLevels} />
          )}
          {wiseScenario.state === "active" && (
            <WiseScenarioPanel entry={wiseScenario} />
          )}
        </div>
      )}
      {hasExpired && (
        <div className="asset-editorial-expired" role="status">
          {keyLevels.state === "expired" && (
            <EditorialExpiredNotice kind="人工关键位" entry={keyLevels} />
          )}
          {wiseScenario.state === "expired" && (
            <EditorialExpiredNotice kind="Wise Scenario" entry={wiseScenario} />
          )}
        </div>
      )}
    </section>
  );
}

export function hasVisibleAssetEditorial(
  entries: AssetEditorialEntries,
  now: number,
): boolean {
  return [
    resolveAssetEditorialEntry(entries.keyLevels, now).state,
    resolveAssetEditorialEntry(entries.wiseScenario, now).state,
  ].some((state) => state === "active" || state === "expired");
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
    return null;
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
    return null;
  }

  const content = entry.content;
  const sources = sourceMap(entry.sources);
  return (
    <article className="asset-editorial-panel asset-wise-scenario">
      <PanelHeader kicker="Wise Scenario" title="人工情景" />
      <div className="asset-scenario-body">
        <dl className="asset-scenario-context">
          <div>
            <dt>人工倾向</dt>
            <dd>{scenarioStanceLabel(content.stance)}</dd>
          </div>
          <div>
            <dt>适用窗口</dt>
            <dd>{content.timeframe}</dd>
          </div>
          <div>
            <dt>作者</dt>
            <dd>{content.author}</dd>
          </div>
        </dl>
        <h3>{content.headline}</h3>
        <p>{content.summary}</p>
        <ScenarioList title="判断依据" items={content.rationale} />
        <ScenarioList title="确认条件" items={content.confirmationConditions} />
        <ScenarioList title="失效条件" items={content.invalidationConditions} />
        {content.watchItems.length > 0 && (
          <ScenarioList title="持续观察" items={content.watchItems} />
        )}
        <p className="asset-scenario-risk">
          <strong>风险说明</strong>
          {content.riskDisclosure}
        </p>
        <ReferencedSources sourceIds={content.sourceIds} sources={sources} />
      </div>
      <EditorialMeta entry={entry} />
    </article>
  );
}

function scenarioStanceLabel(stance: WiseScenarioContent["stance"]): string {
  switch (stance) {
    case "bullish":
      return "偏多";
    case "bearish":
      return "偏空";
    case "neutral":
      return "中性";
    case "wait":
      return "等待确认";
  }
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

function EditorialExpiredNotice<T>({
  kind,
  entry,
}: {
  kind: string;
  entry: ResolvedAssetEditorialEntry<T>;
}) {
  return (
    <article>
      <div>
        <strong>{kind}已过期</strong>
        <p>该内容不会继续作为当前判断展示，等待下一次人工审核。</p>
      </div>
      <EditorialMeta entry={entry} />
    </article>
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
