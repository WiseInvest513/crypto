import type { DatumPresentation } from "@/lib/market/homepage-presentation";

export function DatumStatus({
  presentation,
  compact = false,
}: {
  presentation: DatumPresentation;
  compact?: boolean;
}) {
  if (compact && presentation.state === "fresh") {
    return <span className="sr-only">{presentation.statusLabel}</span>;
  }

  const tone =
    presentation.state === "fresh"
      ? "success"
      : presentation.state === "stale"
        ? "warning"
        : presentation.state === "error"
          ? "danger"
          : "neutral";

  return (
    <span
      className={`status-badge status-badge--${tone}${compact ? " status-badge--compact" : ""}`}
    >
      <span aria-hidden="true" />
      {presentation.statusLabel}
    </span>
  );
}

export function DatumMeta({
  presentation,
}: {
  presentation: DatumPresentation;
}) {
  const hasUpdatedAt = Boolean(
    presentation.updatedAt && presentation.updatedAtLabel,
  );
  const hasRetrievedAt = Boolean(
    presentation.retrievedAt && presentation.retrievedAtLabel,
  );
  const sourceComponents = presentation.source?.components ?? [];
  const hasDetails = Boolean(
    presentation.scopeLabel ||
      hasRetrievedAt ||
      presentation.cacheLabel ||
      presentation.fallbackLabel ||
      sourceComponents.length > 0,
  );

  if (
    !presentation.source &&
    !hasUpdatedAt &&
    !hasDetails
  ) {
    return null;
  }

  return (
    <div className="datum-meta" aria-label="数据来源、范围与时间">
      <div className="datum-meta__primary">
        {presentation.source && (
          <span>
            来源{" "}
            <a
              href={presentation.source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {presentation.source.label}
              <span className="sr-only">（在新标签页打开）</span>
            </a>
          </span>
        )}
        {hasUpdatedAt && (
          <time dateTime={presentation.updatedAt!}>
            {presentation.updatedAtKind === "observed"
              ? "服务器观测于"
              : "数据截至"}{" "}
            {presentation.updatedAtLabel}
          </time>
        )}
        {(presentation.state === "fresh" ||
          presentation.state === "stale") && (
          <span>{presentation.statusLabel}</span>
        )}
        {presentation.fallbackLabel && (
          <span className="datum-fallback">
            备用来源
          </span>
        )}
      </div>
      {hasDetails && (
        <details className="datum-meta__details">
          <summary>查看数据口径</summary>
          <div className="datum-meta__secondary">
            {presentation.fallbackLabel && (
              <span>{presentation.fallbackLabel}</span>
            )}
            {sourceComponents.length > 0 && (
              <span>
                底层来源{" "}
                {sourceComponents.map((source, index) => (
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
            )}
            {presentation.scopeLabel && <span>{presentation.scopeLabel}</span>}
            {hasRetrievedAt && (
              <time dateTime={presentation.retrievedAt!}>
                {presentation.state === "error" ? "请求失败于" : "获取于"}{" "}
                {presentation.retrievedAtLabel}
              </time>
            )}
            {presentation.cacheLabel && <span>{presentation.cacheLabel}</span>}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Homepage-only compact metadata. The normalized presentation still retains
 * its complete source, scope, cache and fallback lineage; this component keeps
 * the public market scan focused on freshness rather than repeating provider
 * names beneath every value.
 */
export function DatumUpdatedAt({
  presentation,
  label = "更新于",
}: {
  presentation: DatumPresentation;
  label?: string;
}) {
  const usesSourceTime = Boolean(
    presentation.updatedAt && presentation.updatedAtLabel,
  );
  const timestamp = usesSourceTime
    ? presentation.updatedAt
    : presentation.retrievedAt;
  const timestampLabel = usesSourceTime
    ? presentation.updatedAtLabel
    : presentation.retrievedAtLabel;

  if (!timestamp || !timestampLabel) {
    return null;
  }

  return (
    <span className="datum-updated-at">
      <span className="sr-only">数据更新时间：</span>
      <time dateTime={timestamp}>
        {usesSourceTime ? label : "检查于"} {timestampLabel}
      </time>
    </span>
  );
}
