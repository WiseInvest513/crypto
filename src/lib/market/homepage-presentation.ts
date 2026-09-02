import type {
  DataScope,
  DataSource,
  MarketCapability,
  MarketDatumView,
  UpdatedAtKind,
} from "@/server/data/contracts/market-data";
import {
  formatUtcDateTime,
  normalizeIsoTimestamp,
  type ValueDirection,
} from "./formatters";

export type FormattedDatumValue = {
  primary: string;
  secondary?: string;
  direction?: ValueDirection;
};

export type DatumPresentationState =
  | "fresh"
  | "stale"
  | "error"
  | "unavailable"
  | "loading";

export type DatumPresentation = {
  state: DatumPresentationState;
  statusLabel: string;
  value: FormattedDatumValue;
  note: string | null;
  source: DataSource | null;
  scopeLabel: string | null;
  updatedAt: string | null;
  updatedAtLabel: string | null;
  updatedAtKind: UpdatedAtKind | null;
  retrievedAt: string | null;
  retrievedAtLabel: string | null;
  cacheLabel: string | null;
  fallbackLabel: string | null;
};

export type MarketDataSummary = {
  kind: "healthy" | "partial" | "stale" | "error" | "unavailable";
  title: string;
  description: string;
  sources: readonly string[];
  retrievedAt: string | null;
  retrievedAtLabel: string | null;
};

export function presentMarketDatum<T>(
  datum: MarketDatumView<T>,
  format: (value: T) => FormattedDatumValue,
): DatumPresentation {
  if (datum.status === "loading") {
    return emptyPresentation("loading", "加载中", "正在获取数据。");
  }

  if (datum.status === "unavailable") {
    const hasMetadata = Boolean(
      datum.source || datum.scope || datum.retrievedAt,
    );
    return {
      ...emptyPresentation(
        "unavailable",
        "暂不可用",
        unavailableMessage(datum.reason),
      ),
      source: datum.source,
      scopeLabel: datum.scope
        ? formatScopeLabel(datum.capability, datum.scope)
        : null,
      retrievedAt: normalizeIsoTimestamp(datum.retrievedAt),
      retrievedAtLabel: safeTimeLabel(datum.retrievedAt),
      cacheLabel: hasMetadata ? cacheLabel(datum.cache.status) : null,
    };
  }

  if (datum.status === "error") {
    return {
      ...emptyPresentation(
        "error",
        "更新失败",
        errorMessage(datum.error.code),
      ),
      source: datum.source,
      scopeLabel: datum.scope
        ? formatScopeLabel(datum.capability, datum.scope)
        : null,
      retrievedAt: normalizeIsoTimestamp(datum.retrievedAt),
      retrievedAtLabel: safeTimeLabel(datum.retrievedAt),
      cacheLabel:
        datum.cache.status === "hit" ? "失败退避中" : "未缓存",
    };
  }

  if (datum.provenance === "synthetic") {
    return emptyPresentation(
      "unavailable",
      "暂不可用",
      "公开页面不会展示开发测试数据。",
    );
  }

  const isStale = datum.status === "stale";
  return {
    state: datum.status,
    statusLabel: isStale ? "数据延迟" : "已更新",
    value: format(datum.value),
    note: isStale
      ? datum.error
        ? "刷新失败，正在显示最近一次可用数据。"
        : "正在显示最近一次可用数据。"
      : null,
    source: datum.source,
    scopeLabel: formatScopeLabel(datum.capability, datum.scope),
    updatedAt: normalizeIsoTimestamp(datum.updatedAt),
    updatedAtLabel: safeTimeLabel(datum.updatedAt),
    updatedAtKind: datum.updatedAtKind ?? "source",
    retrievedAt: normalizeIsoTimestamp(datum.retrievedAt),
    retrievedAtLabel: safeTimeLabel(datum.retrievedAt),
    cacheLabel: cacheLabel(datum.cache.status),
    fallbackLabel: datum.fallback
      ? datum.fallback.primaryStatus === "stale"
        ? datum.fallback.primarySource
          ? `主来源 ${datum.fallback.primarySource.label} 数据延迟，当前显示备用来源数据。`
          : "主来源数据延迟，当前显示备用来源数据。"
        : datum.fallback.primarySource
          ? `主来源 ${datum.fallback.primarySource.label} 暂不可用，当前显示备用来源数据。`
          : "主来源暂不可用，当前显示备用来源数据。"
      : null,
  };
}

export function summarizeMarketData(
  datums: readonly MarketDatumView<unknown>[],
): MarketDataSummary {
  const normalizedStates = datums.map((datum) =>
    (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance === "synthetic"
      ? "unavailable"
      : datum.status,
  );
  const count = (state: DatumPresentationState) =>
    normalizedStates.filter((candidate) => candidate === state).length;
  const fresh = count("fresh");
  const stale = count("stale");
  const errors = count("error");
  const unavailable = count("unavailable");
  const available = fresh + stale;
  const sources = Array.from(
    new Set(
      datums.flatMap((datum) =>
        (datum.status === "fresh" || datum.status === "stale") &&
        datum.provenance !== "synthetic"
          ? [datum.source.label]
          : [],
      ),
    ),
  );
  const retrievedAt = newestTimestamp(
    datums.flatMap((datum) =>
      isSyntheticAvailableDatum(datum) || datum.retrievedAt === null
        ? []
        : [datum.retrievedAt],
    ),
  );
  const shared = {
    sources,
    retrievedAt,
    retrievedAtLabel: retrievedAt ? formatUtcDateTime(retrievedAt) : null,
  };

  if (stale > 0) {
    return {
      kind: "stale",
      title: "部分市场数据更新延迟",
      description:
        errors + unavailable > 0
          ? "页面正在显示最近一次可用数据，另有部分指标暂不可用。请留意各项数据截至时间。"
          : "页面正在显示最近一次可用数据，请留意各项数据截至时间。",
      ...shared,
    };
  }

  if (available > 0 && errors > 0) {
    return {
      kind: "partial",
      title: "部分市场数据暂不可用",
      description: "其余内容仍按已验证的数据展示，缺失指标不会以零值替代。",
      ...shared,
    };
  }

  if (available === 0 && errors > 0) {
    return {
      kind: "error",
      title: "市场数据暂时无法更新",
      description: "页面不会使用未经验证的数据，请稍后再试。",
      ...shared,
    };
  }

  if (available === 0) {
    return {
      kind: "unavailable",
      title: "市场数据暂不可用",
      description: "尚未接入可靠数据源的指标将保持为空。",
      ...shared,
    };
  }

  return {
    kind: "healthy",
    title: "市场数据已更新",
    description:
      unavailable > 0
        ? "当前可用指标均来自经过验证的数据源，未接入可靠来源的指标保持为空。"
        : "所有已配置指标均来自经过验证的数据源。",
    ...shared,
  };
}

function isSyntheticAvailableDatum(
  datum: MarketDatumView<unknown>,
): boolean {
  return (
    (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance === "synthetic"
  );
}

function emptyPresentation(
  state: DatumPresentationState,
  statusLabel: string,
  note: string,
): DatumPresentation {
  return {
    state,
    statusLabel,
    value: { primary: "—", direction: "neutral" },
    note,
    source: null,
    scopeLabel: null,
    updatedAt: null,
    updatedAtLabel: null,
    updatedAtKind: null,
    retrievedAt: null,
    retrievedAtLabel: null,
    cacheLabel: null,
    fallbackLabel: null,
  };
}

function unavailableMessage(reason: string): string {
  const messages: Record<string, string> = {
    not_configured: "数据源尚未配置。",
    unsupported: "当前数据源不支持此指标。",
    license_restricted: "尚未配置具备展示许可的数据源。",
    no_reliable_source: "暂未找到可靠数据源。",
    no_data: "数据源当前未返回可用数据。",
    insufficient_history: "历史数据不足，暂无法完成计算。",
  };
  return messages[reason] ?? "此指标暂不可用。";
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    timeout: "数据源响应超时，请稍后再试。",
    rate_limited: "数据源暂时限制请求，请稍后再试。",
    upstream_error: "数据源暂时异常。",
    invalid_payload: "数据源返回内容未通过校验。",
    no_data: "数据源当前未返回可用数据。",
  };
  return messages[code] ?? "数据暂时无法更新。";
}

function cacheLabel(status: string): string {
  const labels: Record<string, string> = {
    hit: "缓存命中",
    miss: "最新获取",
    bypass: "未缓存",
  };
  return labels[status] ?? "缓存状态未知";
}

function formatScopeLabel(
  capability: MarketCapability,
  scope: DataScope,
): string {
  const labels: Partial<Record<MarketCapability, string>> = {
    "spot.btc-price":
      scope.kind === "venue"
        ? "BTC/USD 单一交易场所现货"
        : "BTC/USD 多市场聚合现货",
    "spot.eth-price":
      scope.kind === "venue"
        ? "ETH/USD 单一交易场所现货"
        : "ETH/USD 多市场聚合现货",
    "spot.market-cap": "数据源覆盖的加密市场",
    "spot.btc-dominance": "数据源覆盖的加密市场",
    "spot.eth-btc": "由 ETH/USD 与 BTC/USD 派生",
    "sentiment.fear-and-greed": "数据源自有加密市场情绪指数",
    "derivatives.btc-funding": derivativesScope(scope),
    "derivatives.eth-funding": derivativesScope(scope),
    "derivatives.btc-open-interest": derivativesScope(scope),
    "derivatives.eth-open-interest": derivativesScope(scope),
    "derivatives.total-liquidations":
      scope.kind === "global"
        ? "数据源追踪交易所聚合"
        : derivativesScope(scope),
    "fund-flows.btc-etf": "美国现货 BTC ETF · 日频",
    "fund-flows.eth-etf": "美国现货 ETH ETF · 日频",
  };
  return labels[capability] ?? scope.label;
}

function derivativesScope(scope: DataScope): string {
  return scope.kind === "venue"
    ? "单一交易场所 · 永续合约"
    : scope.kind === "global"
      ? "多交易所聚合"
      : "资产衍生品数据";
}

function safeTimeLabel(value: string | null): string | null {
  const label = formatUtcDateTime(value);
  return label === "—" ? null : label;
}

function newestTimestamp(values: readonly string[]): string | null {
  let newest: { value: string; timestamp: number } | null = null;
  for (const value of values) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      continue;
    }
    if (newest === null || timestamp > newest.timestamp) {
      newest = { value: new Date(timestamp).toISOString(), timestamp };
    }
  }
  return newest?.value ?? null;
}
