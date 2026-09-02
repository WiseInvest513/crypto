import { describe, expect, it } from "vitest";
import type {
  AvailableMarketDatum,
  ErrorMarketDatum,
  MarketDatumView,
} from "../../src/server/data/contracts/market-data";
import {
  loadingDatum,
  unavailableDatum,
} from "../../src/server/data/contracts/market-data";
import {
  presentMarketDatum,
  summarizeMarketData,
} from "../../src/lib/market/homepage-presentation";

const UPDATED_AT = "2026-08-29T12:00:00.000Z";
const RETRIEVED_AT = "2026-08-29T12:00:01.000Z";

function available(
  overrides: Partial<AvailableMarketDatum<number>> = {},
): AvailableMarketDatum<number> {
  return {
    status: "fresh",
    capability: "spot.btc-price",
    value: 100,
    source: {
      id: "verified-source",
      label: "Verified Source",
      url: "https://example.com/source",
    },
    scope: { kind: "asset", label: "BTC/USD" },
    updatedAt: UPDATED_AT,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 60,
      staleIfErrorSeconds: 300,
    },
    error: null,
    ...overrides,
  };
}

function failed(): ErrorMarketDatum {
  return {
    status: "error",
    capability: "spot.btc-price",
    value: null,
    source: {
      id: "verified-source",
      label: "Verified Source",
      url: "https://example.com/source",
    },
    scope: { kind: "asset", label: "BTC/USD" },
    updatedAt: null,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: { code: "timeout", retryable: true },
  };
}

const formatNumber = (value: number) => ({ primary: `$${value}` });

describe("homepage market presentation", () => {
  it("shows fresh values with source, scope, timestamps, and cache state", () => {
    const result = presentMarketDatum(available(), formatNumber);

    expect(result).toMatchObject({
      state: "fresh",
      statusLabel: "已更新",
      value: { primary: "$100" },
      source: { label: "Verified Source" },
      scopeLabel: "BTC/USD 多市场聚合现货",
      updatedAtLabel: "2026-08-29 12:00 UTC",
      updatedAtKind: "source",
      retrievedAtLabel: "2026-08-29 12:00 UTC",
      cacheLabel: "最新获取",
    });
  });

  it("preserves an observation timestamp without presenting it as a source as-of time", () => {
    const result = presentMarketDatum(
      available({ updatedAtKind: "observed" }),
      formatNumber,
    );

    expect(result).toMatchObject({
      updatedAt: UPDATED_AT,
      updatedAtLabel: "2026-08-29 12:00 UTC",
      updatedAtKind: "observed",
    });
  });

  it("derives scope copy from the scope kind instead of a hard-coded venue", () => {
    const result = presentMarketDatum(
      available({
        scope: { kind: "venue", label: "Example Exchange" },
      }),
      formatNumber,
    );

    expect(result.scopeLabel).toBe("BTC/USD 单一交易场所现货");
  });

  it("retains a stale last-known-good value with an explicit warning", () => {
    const result = presentMarketDatum(
      available({
        status: "stale",
        stale: true,
        error: { code: "upstream_error", retryable: true },
      }),
      formatNumber,
    );

    expect(result).toMatchObject({
      state: "stale",
      statusLabel: "数据延迟",
      value: { primary: "$100" },
      note: "刷新失败，正在显示最近一次可用数据。",
      source: { label: "Verified Source" },
      updatedAt: UPDATED_AT,
    });
  });

  it("discloses when a verified fallback provider supplied the value", () => {
    const result = presentMarketDatum(
      available({
        source: {
          id: "fallback-source",
          label: "Fallback Source",
          url: "https://example.com/fallback",
        },
        fallback: {
          primarySource: {
            id: "primary-source",
            label: "Primary Source",
            url: "https://example.com/primary",
          },
          primaryStatus: "error",
          primaryError: { code: "timeout", retryable: true },
          primaryReason: null,
        },
      }),
      formatNumber,
    );

    expect(result).toMatchObject({
      state: "fresh",
      source: { label: "Fallback Source" },
      fallbackLabel:
        "主来源 Primary Source 暂不可用，当前显示备用来源数据。",
    });
  });

  it("distinguishes a delayed primary from a fully unavailable source", () => {
    const result = presentMarketDatum(
      available({
        source: {
          id: "fallback-source",
          label: "Fallback Source",
          url: "https://example.com/fallback",
        },
        fallback: {
          primarySource: {
            id: "primary-source",
            label: "Primary Source",
            url: "https://example.com/primary",
          },
          primaryStatus: "stale",
          primaryError: { code: "timeout", retryable: true },
          primaryReason: null,
        },
      }),
      formatNumber,
    );

    expect(result.fallbackLabel).toBe(
      "主来源 Primary Source 数据延迟，当前显示备用来源数据。",
    );
  });

  it("separates error, unavailable, and loading states without zeroes", () => {
    const error = presentMarketDatum(failed(), formatNumber);
    const unavailable = presentMarketDatum(
      unavailableDatum("fund-flows.btc-etf", "license_restricted"),
      formatNumber,
    );
    const loading = presentMarketDatum(
      loadingDatum("spot.btc-price"),
      formatNumber,
    );

    expect(error).toMatchObject({
      state: "error",
      value: { primary: "—" },
      statusLabel: "更新失败",
      note: "数据源响应超时，请稍后再试。",
      cacheLabel: "未缓存",
    });
    expect(unavailable).toMatchObject({
      state: "unavailable",
      value: { primary: "—" },
      note: "尚未配置具备展示许可的数据源。",
      source: null,
    });
    expect(loading).toMatchObject({
      state: "loading",
      value: { primary: "—" },
      statusLabel: "加载中",
    });
  });

  it("refuses to display synthetic values on the public homepage", () => {
    const result = presentMarketDatum(
      available({ provenance: "synthetic", value: 999_999 }),
      formatNumber,
    );

    expect(result).toMatchObject({
      state: "unavailable",
      value: { primary: "—" },
      source: null,
    });
    expect(result.value.primary).not.toContain("999999");
  });

  it("summarizes partial failure without hiding healthy data", () => {
    const datums: MarketDatumView<unknown>[] = [
      available(),
      failed(),
      unavailableDatum("fund-flows.btc-etf", "license_restricted"),
    ];
    const summary = summarizeMarketData(datums);

    expect(summary).toMatchObject({
      kind: "partial",
      title: "部分市场数据暂不可用",
      sources: ["Verified Source"],
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("stays healthy when the only gaps are intentionally unavailable", () => {
    const summary = summarizeMarketData([
      available(),
      unavailableDatum("fund-flows.btc-etf", "license_restricted"),
    ]);

    expect(summary).toMatchObject({
      kind: "healthy",
      title: "市场数据已更新",
      sources: ["Verified Source"],
    });
    expect(summary.description).toContain("保持为空");
  });

  it("reports an error when every attempted datum failed", () => {
    expect(summarizeMarketData([failed(), failed()])).toMatchObject({
      kind: "error",
      title: "市场数据暂时无法更新",
      sources: [],
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("excludes synthetic sources and retrieval times from the summary", () => {
    const synthetic = available({
      provenance: "synthetic",
      source: {
        id: "fixture-source",
        label: "Fixture Source",
        url: "https://example.com/fixture",
      },
      retrievedAt: "2026-08-29T13:00:00.000Z",
    });

    expect(summarizeMarketData([synthetic])).toMatchObject({
      kind: "unavailable",
      sources: [],
      retrievedAt: null,
      retrievedAtLabel: null,
    });

    expect(summarizeMarketData([available(), synthetic])).toMatchObject({
      kind: "healthy",
      sources: ["Verified Source"],
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("deduplicates repeated verified source labels", () => {
    const summary = summarizeMarketData([
      available(),
      available({
        capability: "spot.eth-price",
        provenance: "derived",
      }),
    ]);

    expect(summary).toMatchObject({
      kind: "healthy",
      sources: ["Verified Source"],
    });
  });

  it("prioritizes stale and all-unavailable summaries", () => {
    const stale = available({ status: "stale", stale: true });
    expect(summarizeMarketData([stale, failed()])).toMatchObject({
      kind: "stale",
      title: "部分市场数据更新延迟",
    });

    expect(
      summarizeMarketData([
        unavailableDatum("fund-flows.btc-etf", "license_restricted"),
        unavailableDatum("fund-flows.eth-etf", "license_restricted"),
      ]),
    ).toMatchObject({
      kind: "unavailable",
      title: "市场数据暂不可用",
    });
  });
});
