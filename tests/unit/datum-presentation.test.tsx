import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatumMeta } from "@/components/market/datum-presentation";
import type { DatumPresentation } from "@/lib/market/homepage-presentation";

function presentation(
  overrides: Partial<DatumPresentation> = {},
): DatumPresentation {
  return {
    state: "fresh",
    statusLabel: "已更新",
    value: { primary: "$100.00" },
    note: null,
    source: {
      id: "primary",
      label: "主要来源",
      url: "https://example.com/primary",
    },
    scopeLabel: null,
    updatedAt: "2026-09-01T09:00:00.000Z",
    updatedAtLabel: "2026-09-01 09:00 UTC",
    updatedAtKind: "source",
    retrievedAt: null,
    retrievedAtLabel: null,
    cacheLabel: null,
    fallbackLabel: null,
    ...overrides,
  };
}

describe("DatumMeta", () => {
  it("keeps the default layer limited to source, as-of time, and freshness", () => {
    const html = renderToStaticMarkup(
      <DatumMeta presentation={presentation()} />,
    );

    expect(html).toContain("来源");
    expect(html).toContain("主要来源");
    expect(html).toContain("数据截至 2026-09-01 09:00 UTC");
    expect(html).toContain("已更新");
    expect(html).not.toContain("<details");
  });

  it("labels observed live values as server observations", () => {
    const html = renderToStaticMarkup(
      <DatumMeta
        presentation={presentation({ updatedAtKind: "observed" })}
      />,
    );

    expect(html).toContain("服务器观测于 2026-09-01 09:00 UTC");
    expect(html).not.toContain("数据截至 2026-09-01 09:00 UTC");
  });

  it("moves full lineage and fallback explanation into a native details element", () => {
    const html = renderToStaticMarkup(
      <DatumMeta
        presentation={presentation({
          state: "stale",
          statusLabel: "数据延迟",
          source: {
            id: "derived",
            label: "Wise Crypto 派生指标",
            url: "https://crypto.wise-invest.org",
            components: [
              {
                id: "btc-input",
                label: "BTC 输入来源",
                url: "https://example.com/btc",
              },
              {
                id: "eth-input",
                label: "ETH 输入来源",
                url: "https://example.com/eth",
              },
            ],
          },
          scopeLabel: "ETH/USD 除以 BTC/USD",
          retrievedAt: "2026-09-01T09:00:05.000Z",
          retrievedAtLabel: "2026-09-01 09:00 UTC",
          cacheLabel: "缓存命中",
          fallbackLabel:
            "主来源暂不可用，当前显示备用来源数据。",
        })}
      />,
    );

    expect(html).toContain("数据延迟");
    expect(html).toContain("备用来源");
    expect(html).toContain('<details class="datum-meta__details">');
    expect(html).not.toContain("<details open");
    expect(html).toContain("<summary>查看数据口径</summary>");
    expect(html).toContain("主来源暂不可用，当前显示备用来源数据。");
    expect(html).toContain("底层来源");
    expect(html).toContain("BTC 输入来源");
    expect(html).toContain("ETH 输入来源");
    expect(html).toContain("ETH/USD 除以 BTC/USD");
    expect(html).toContain("获取于 2026-09-01 09:00 UTC");
    expect(html).toContain("缓存命中");
    expect(html.indexOf("ETH/USD 除以 BTC/USD")).toBeGreaterThan(
      html.indexOf("<summary>"),
    );
  });

  it("uses the failed retrieval label inside details for error data", () => {
    const html = renderToStaticMarkup(
      <DatumMeta
        presentation={presentation({
          state: "error",
          statusLabel: "更新失败",
          updatedAt: null,
          updatedAtLabel: null,
          retrievedAt: "2026-09-01T09:00:05.000Z",
          retrievedAtLabel: "2026-09-01 09:00 UTC",
        })}
      />,
    );

    expect(html).toContain("<summary>查看数据口径</summary>");
    expect(html).toContain("请求失败于 2026-09-01 09:00 UTC");
  });

  it("renders nothing when no metadata is available", () => {
    const html = renderToStaticMarkup(
      <DatumMeta
        presentation={presentation({
          state: "unavailable",
          statusLabel: "暂不可用",
          source: null,
          updatedAt: null,
          updatedAtLabel: null,
        })}
      />,
    );

    expect(html).toBe("");
  });
});
