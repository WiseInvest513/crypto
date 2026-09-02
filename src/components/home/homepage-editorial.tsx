import {
  resolveEditorialEntry,
  resolveTodayInCryptoEntry,
  type EditorialEntry,
  type EditorialSource,
  type HomepageEditorialConfig,
  type MarketStatusContent,
  type TodayInCryptoContent,
  type WiseTakeContent,
} from "@/lib/editorial/homepage-editorial";
import {
  formatTradingDate,
  formatUtcDateTime,
  normalizeIsoTimestamp,
} from "@/lib/market/formatters";

export function HomepageEditorialPanels({
  config,
  now,
}: {
  config: HomepageEditorialConfig;
  now: number;
}) {
  const states = [
    resolveEditorialEntry(config.marketStatus, now).state,
    resolveTodayInCryptoEntry(config.todayInCrypto, now).state,
    resolveEditorialEntry(config.wiseTake, now).state,
  ];

  if (!states.some((state) => state === "active" || state === "expired")) {
    return null;
  }

  return (
    <div className="dashboard-grid dashboard-grid--content home-editorial-panels">
      <MarketStatusPanel entry={config.marketStatus} now={now} />
      <TodayInCryptoPanel entry={config.todayInCrypto} now={now} />
      <WiseTakePanel entry={config.wiseTake} now={now} />
    </div>
  );
}

export function MarketStatusPanel({
  entry,
  now,
}: {
  entry: EditorialEntry<MarketStatusContent>;
  now: number;
}) {
  const resolved = resolveEditorialEntry(entry, now);

  if (resolved.state === "unpublished" || resolved.state === "scheduled") {
    return null;
  }

  if (resolved.state === "expired") {
    return (
      <EditorialExpiredState
        label="人工市场状态"
        title="市场状态已过有效期"
        description="过期判断已从当前市场信息流移除，等待下一次人工审核。"
      />
    );
  }

  return (
    <aside
      className="product-panel market-status-panel"
      aria-labelledby="market-status-title"
    >
      <header className="panel-header panel-header--compact">
        <div>
          <p className="panel-kicker">人工审核</p>
          <h2 id="market-status-title">市场状态</h2>
        </div>
        <EditorialStatus state={resolved.state} />
      </header>

      {resolved.content ? (
        <div className="market-status-panel__body editorial-body">
          <p>当前状态</p>
          <strong>{resolved.content.headline}</strong>
          <span>{resolved.content.summary}</span>
          {resolved.content.watchItems.length > 0 && (
            <ul className="editorial-watch-list">
              {resolved.content.watchItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <EditorialMeta
        lastReviewedAt={resolved.lastReviewedAt}
        validUntil={resolved.validUntil}
        sources={resolved.sources}
        visible={resolved.state === "active"}
      />
    </aside>
  );
}

export function TodayInCryptoPanel({
  entry,
  now,
}: {
  entry: EditorialEntry<TodayInCryptoContent>;
  now: number;
}) {
  const resolved = resolveTodayInCryptoEntry(entry, now);

  if (resolved.state === "unpublished" || resolved.state === "scheduled") {
    return null;
  }

  if (resolved.state === "expired") {
    return (
      <EditorialExpiredState
        label="每日背景"
        title="今日简报已过期"
        description="过期简报不会继续作为今日内容展示，等待下一次人工核验。"
      />
    );
  }

  return (
    <section className="product-panel content-panel" aria-labelledby="today-title">
      <header className="panel-header">
        <div>
          <p className="panel-kicker">每日背景</p>
          <h2 id="today-title">今日加密市场</h2>
        </div>
        <span className="panel-date">
          {resolved.state === "active" && resolved.content
            ? formatTradingDate(resolved.content.date)
            : "人工审核"}
        </span>
      </header>

      {resolved.content ? (
        <div className="today-list">
          {resolved.content.items.map((item) => {
            const itemSources = item.sourceIds.flatMap((sourceId) => {
              const source = resolved.sources.find(
                (candidate) => candidate.id === sourceId,
              );
              return source ? [source] : [];
            });

            return (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <EditorialSourceLinks
                  className="today-item-sources"
                  label="本条来源"
                  sources={itemSources}
                />
              </article>
            );
          })}
        </div>
      ) : null}

      <EditorialMeta
        lastReviewedAt={resolved.lastReviewedAt}
        validUntil={resolved.validUntil}
        sources={[]}
        visible={resolved.state === "active"}
      />
    </section>
  );
}

export function WiseTakePanel({
  entry,
  now,
}: {
  entry: EditorialEntry<WiseTakeContent>;
  now: number;
}) {
  const resolved = resolveEditorialEntry(entry, now);

  if (resolved.state === "unpublished" || resolved.state === "scheduled") {
    return null;
  }

  if (resolved.state === "expired") {
    return (
      <EditorialExpiredState
        label="编辑观点"
        title="Wise Take 已过有效期"
        description="过期观点已从当前信息流移除，等待下一次人工审核。"
      />
    );
  }

  return (
    <section
      className="product-panel wise-take-panel"
      aria-labelledby="wise-take-title"
    >
      <header className="panel-header">
        <div>
          <p className="panel-kicker">编辑观点</p>
          <h2 id="wise-take-title">Wise Take</h2>
        </div>
        <EditorialStatus state={resolved.state} />
      </header>

      {resolved.content ? (
        <div className="wise-take-content editorial-body">
          <h3>{resolved.content.headline}</h3>
          <p>{resolved.content.body}</p>
          {resolved.content.watchItems.length > 0 && (
            <div>
              <strong>观察条件</strong>
              <ul className="editorial-watch-list">
                {resolved.content.watchItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <EditorialMeta
        lastReviewedAt={resolved.lastReviewedAt}
        validUntil={resolved.validUntil}
        sources={resolved.sources}
        visible={resolved.state === "active"}
      />
    </section>
  );
}

function EditorialStatus({ state }: { state: string }) {
  const status =
    state === "active"
      ? { label: "当前有效", tone: "success" }
      : state === "expired"
        ? { label: "已过期", tone: "warning" }
        : state === "scheduled"
          ? { label: "待生效", tone: "neutral" }
          : { label: "暂未发布", tone: "neutral" };

  return (
    <span className={`status-badge status-badge--${status.tone}`}>
      <span aria-hidden="true" />
      {status.label}
    </span>
  );
}

function EditorialExpiredState({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <aside className="product-panel editorial-expired-state" role="status">
      <div>
        <p className="panel-kicker">{label}</p>
        <strong>{title}</strong>
      </div>
      <p>{description}</p>
    </aside>
  );
}

function EditorialMeta({
  lastReviewedAt,
  validUntil,
  sources,
  visible,
}: {
  lastReviewedAt: string | null;
  validUntil: string | null;
  sources: readonly EditorialSource[];
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  const reviewedIso = normalizeIsoTimestamp(lastReviewedAt);
  const validIso = normalizeIsoTimestamp(validUntil);

  return (
    <footer className="editorial-meta" aria-label="编辑内容审核信息">
      {reviewedIso && (
        <time dateTime={reviewedIso}>
          最近审核 {formatUtcDateTime(lastReviewedAt)}
        </time>
      )}
      {validIso && (
        <time dateTime={validIso}>有效期至 {formatUtcDateTime(validUntil)}</time>
      )}
      {sources.length > 0 && (
        <span>
          <EditorialSourceLinks label="来源" sources={sources} />
        </span>
      )}
    </footer>
  );
}

function EditorialSourceLinks({
  sources,
  label,
  className,
}: {
  sources: readonly EditorialSource[];
  label: string;
  className?: string;
}) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {label}{" "}
      {sources.map((source, index) => (
        <span key={source.id}>
          {index > 0 && "、"}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.label}
            <span className="sr-only">（在新标签页打开）</span>
          </a>
        </span>
      ))}
    </span>
  );
}
