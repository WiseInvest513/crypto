import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function readSource(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Simplified Chinese interface foundation", () => {
  it("declares zh-CN as the document language", () => {
    const layout = readSource("src/app/layout.tsx");

    expect(layout).toContain('lang="zh-CN"');
    expect(layout).toContain('data-theme="light"');
    expect(layout).toContain("suppressHydrationWarning");
    expect(readSource("src/app/global-error.tsx")).toContain(
      '<html lang="zh-CN">',
    );
  });

  it("keeps navigation and core status actions in Chinese", () => {
    const publicUi = [
      "src/components/layout/navigation.ts",
      "src/components/layout/site-header.tsx",
      "src/components/layout/theme-toggle.tsx",
      "src/components/layout/site-footer.tsx",
      "src/components/ui/route-placeholder.tsx",
      "src/app/loading.tsx",
      "src/app/error.tsx",
      "src/app/global-error.tsx",
      "src/app/not-found.tsx",
    ]
      .map(readSource)
      .join("\n");

    expect(publicUi).toContain("市场总览");
    expect(publicUi).toContain("切换到深色模式");
    expect(publicUi).toContain("切换到浅色模式");
    expect(publicUi).toContain("页面加载中");
    expect(publicUi).toContain("重试");
    expect(publicUi).not.toMatch(
      /Market overview|Loading page|Try again|Return to overview|Page not found|Primary navigation|Footer navigation|Data unavailable/,
    );
  });

  it.each([
    ["src/app/tools/page.tsx", "加密工具", "每个工具都有独立分享 URL"],
  ])("localizes the public copy in %s", (path, title, status) => {
    const source = readSource(path);

    expect(source).toContain(title);
    expect(source).toContain(status);
    expect(source).not.toMatch(
      /Data unavailable|Not published|market data cannot be displayed|Calculators are not available|No product guides are available/,
    );
  });

  it.each([
    ["src/app/btc/page.tsx", "比特币（BTC）", 'loadAssetLiveChartDatum("btc")'],
    ["src/app/eth/page.tsx", "以太坊（ETH）", 'loadAssetLiveChartDatum("eth")'],
  ])("keeps the completed asset route localized in %s", (path, title, serviceCall) => {
    const source = readSource(path);
    const workspace = readSource("src/components/assets/asset-detail-page.tsx");
    const chart = readSource("src/components/assets/asset-price-chart.tsx");

    expect(source).toContain(title);
    expect(source).toContain(serviceCall);
    expect(source).toContain("MarketWorkbenchPage");
    expect(source).toContain("成交密集区估算");
    expect(workspace).toContain("切换资产工作台");
    expect(chart).toContain("行情图表");
    expect(chart).toContain("时间周期");
    expect(chart).toContain("分析视角");
    expect(chart).toContain("每 5 秒更新");
    expect(chart).toContain("EMA 10 · 20 · 50");
    expect(chart).toContain("EMA 20 · 50 · 200");
    expect(chart).toContain("开盘");
    expect(chart).toContain("最高");
    expect(chart).toContain("最低");
    expect(chart).toContain("收盘 / 最新");
    expect(chart).toContain("一眼结论");
    expect(chart).toContain("已闭合 K 线区间位置");
    expect(chart).toContain("下一次要确认什么");
    expect(chart).toContain("查看全部 EMA 对比");
    expect(chart).toContain("图表范围与计算口径");
    expect(workspace).toContain("衍生品与市场背景");
    expect(workspace).toContain("数据暂不可用");
    expect(`${source}\n${workspace}`).not.toMatch(
      /Data unavailable|Not published|market data cannot be displayed/,
    );
  });
});
