import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Phase 4 BTC and ETH integrity", () => {
  it.each(["btc", "eth"])(
    "streams public normalized market data without private identity dependencies for /%s",
    (asset) => {
      const page = read(`src/app/${asset}/page.tsx`);

      expect(page).toContain(`loadAssetLiveChartDatum("${asset}")`);
      expect(page).not.toContain("loadAssetEditorialForAccess");
      expect(page).not.toContain("resolveUserAccess");
      expect(page).not.toContain("access={access}");
      expect(page).not.toContain("loadAssetEditorial(");
      expect(page).toContain('export const dynamic = "force-dynamic"');
      expect(page).toContain("MarketWorkbenchPage");
      expect(page).not.toMatch(/fetch\s*\(|MockMarketProvider|testing\//);
    },
  );

  it("keeps the client chart isolated from providers and refreshes through a same-origin route", () => {
    const chart = read("src/components/assets/asset-price-chart.tsx");

    expect(chart).toContain('"use client"');
    expect(chart).toContain("aria-labelledby");
    expect(chart).toContain("查看最近 20 根 K 线数据");
    expect(chart).toContain("每 5 秒更新");
    expect(chart).toContain("summarizeVisibleChart");
    expect(chart).toContain("summarizeLiveTrend");
    expect(chart).toContain("时间周期");
    expect(chart).toContain("分析视角");
    expect(chart).toContain("EMA 10 · 20 · 50");
    expect(chart).toContain("EMA 20 · 50 · 200");
    expect(chart).toContain("指标与范围");
    expect(chart).toContain("开盘");
    expect(chart).toContain("最高");
    expect(chart).toContain("最低");
    expect(chart).toContain("收盘 / 最新");
    expect(chart).toContain("一眼结论");
    expect(chart).toContain("已闭合 K 线区间位置");
    expect(chart).toContain("下一次要确认什么");
    expect(chart).toContain("事实会改变");
    expect(chart).toContain("查看全部 EMA 对比");
    expect(chart).toContain("形成中 K 线不进入分析结论");
    expect(chart).toContain('point.state === "closed"');
    expect(chart).toContain("presentation: presentMarketDatum");
    expect(chart).toContain('kind: "issue"');
    expect(chart).toContain("可见区间统计");
    expect(chart).toContain("图表范围与计算口径");
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
    expect(chart).not.toMatch(
      /(?:建议|立即)(?:买入|卖出)|止盈(?:价|位)|止损(?:价|位)|目标价/,
    );
  });

  it("keeps the K-line and VIP strategy ahead of derivatives and risk tools", () => {
    const workspace = read("src/components/assets/asset-detail-page.tsx");
    const marketHeaderIndex = workspace.indexOf("<AssetMarketHeader");
    const chartIndex = workspace.indexOf("<StreamedAssetWorkbench");
    const vipIndex = workspace.indexOf("<AssetVipResearch");
    const contextIndex = workspace.indexOf("<StreamedAssetContext");
    const toolsIndex = workspace.indexOf("<AssetToolShortcuts");

    expect(marketHeaderIndex).toBeGreaterThan(-1);
    expect(chartIndex).toBeGreaterThan(marketHeaderIndex);
    expect(vipIndex).toBeGreaterThan(chartIndex);
    expect(contextIndex).toBeGreaterThan(vipIndex);
    expect(toolsIndex).toBeGreaterThan(contextIndex);
    expect(workspace).toContain("切换资产工作台");
    expect(workspace).not.toContain("AssetCompactSummary");
    expect(workspace).not.toContain("AssetPageActions");
    expect(workspace).not.toContain('href="#vip-research"');
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
