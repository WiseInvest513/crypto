import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Phase 4 BTC and ETH integrity", () => {
  it.each(["btc", "eth"])(
    "streams normalized server data slices independently for /%s",
    (asset) => {
      const page = read(`src/app/${asset}/page.tsx`);

      expect(page).toContain(`loadAssetPriceDatum("${asset}")`);
      expect(page).toContain(`loadAssetChartSnapshot("${asset}")`);
      expect(page).toContain(`loadAssetLiveChartDatum("${asset}")`);
      expect(page).toContain(`loadAssetContextSnapshot("${asset}")`);
      expect(page).toContain(`loadAssetEditorial("${asset}")`);
      expect(page).toContain('export const dynamic = "force-dynamic"');
      expect(page).toContain("AssetDetailStreamPage");
      expect(page).not.toMatch(/fetch\s*\(|MockMarketProvider|testing\//);
    },
  );

  it("keeps the client chart isolated from providers and refreshes through a same-origin route", () => {
    const chart = read("src/components/assets/asset-price-chart.tsx");

    expect(chart).toContain('"use client"');
    expect(chart).toContain("aria-labelledby");
    expect(chart).toContain("查看最近 20 根 K 线数据");
    expect(chart).toContain("5 秒检查");
    expect(chart).toContain("summarizeVisibleChart");
    expect(chart).toContain("summarizeLiveTrend");
    expect(chart).toContain("EMA10 / 20 / 50");
    expect(chart).toContain("EMA20 / 50 / 200");
    expect(chart).toContain("最新已闭合 K 线");
    expect(chart).toContain("形成中 K 线不进入分析结论");
    expect(chart).toContain("可见区间事实");
    expect(chart).toContain("所选历史窗口");
    expect(chart).toContain("safeEndOffset");
    expect(chart).toContain("requestAnimationFrame");
    expect(chart).toContain("当前历史窗口末端 20 根");
    expect(chart).toContain("基础资产成交量");
    expect(chart).toContain("visibilitychange");
    expect(chart).toMatch(/fetch\(`\/api\/market\/candles\?/);
    expect(chart).not.toMatch(
      /@\/server|https?:\/\/|axios|coinmarketcap|binance\.vision|api\.binance/i,
    );
    expect(chart).not.toMatch(/建议买|建议卖|止盈|止损|目标价/);
  });

  it("keeps all production support, resistance and scenario content unpublished", () => {
    const content = read("src/content/asset-editorial.ts");
    const service = read("src/server/editorial/asset-editorial-service.ts");

    expect(content).toContain('import "server-only"');
    expect(service).toContain("parseAssetEditorialConfig");
    expect(content.match(/publicationStatus: "unpublished"/g)).toHaveLength(4);
    expect(content.match(/content: null/g)).toHaveLength(4);
    expect(content).not.toMatch(/price:\s*\d|buy|sell|target|support-one/i);
  });

  it("does not make the reference Python project a runtime dependency", () => {
    const productionSources = [
      "src/server/data/services/asset-detail-service.ts",
      "src/lib/market/technical-analysis.ts",
      "src/components/assets/asset-detail-page.tsx",
      "src/components/assets/asset-price-chart.tsx",
    ].map(read).join("\n");

    expect(productionSources).not.toMatch(
      /crypto-analyzer|Trading\/crypto|python|streamlit|plotly|pandas/i,
    );
    expect(productionSources).not.toMatch(/买入|卖出|目标价|保证收益/);
  });
});
