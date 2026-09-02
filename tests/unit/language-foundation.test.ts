import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function readSource(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Simplified Chinese interface foundation", () => {
  it("declares zh-CN as the document language", () => {
    expect(readSource("src/app/layout.tsx")).toContain('<html lang="zh-CN">');
    expect(readSource("src/app/global-error.tsx")).toContain(
      '<html lang="zh-CN">',
    );
  });

  it("keeps navigation and core status actions in Chinese", () => {
    const publicUi = [
      "src/components/layout/navigation.ts",
      "src/components/layout/site-header.tsx",
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
    expect(publicUi).toContain("页面加载中");
    expect(publicUi).toContain("重试");
    expect(publicUi).not.toMatch(
      /Market overview|Loading page|Try again|Return to overview|Page not found|Primary navigation|Footer navigation|Data unavailable/,
    );
  });

  it.each([
    ["src/app/tools/page.tsx", "加密工具", "每个工具都有独立分享 URL"],
    [
      "src/components/products/product-directory.tsx",
      "加密产品指南",
      "暂无可用的产品指南",
    ],
  ])("localizes the public copy in %s", (path, title, status) => {
    const source = readSource(path);

    expect(source).toContain(title);
    expect(source).toContain(status);
    expect(source).not.toMatch(
      /Data unavailable|Not published|market data cannot be displayed|Calculators are not available|No product guides are available/,
    );
  });

  it.each([
    ["src/app/btc/page.tsx", "比特币（BTC）", 'loadAssetPriceDatum("btc")'],
    ["src/app/eth/page.tsx", "以太坊（ETH）", 'loadAssetPriceDatum("eth")'],
  ])("keeps the completed asset route localized in %s", (path, title, serviceCall) => {
    const source = readSource(path);
    const workspace = readSource("src/components/assets/asset-detail-page.tsx");
    const chart = readSource("src/components/assets/asset-price-chart.tsx");

    expect(source).toContain(title);
    expect(source).toContain(serviceCall);
    expect(source).toContain("loadAssetChartSnapshot");
    expect(source).toContain("loadAssetContextSnapshot");
    expect(chart).toContain("实时 K 线工作台");
    expect(chart).toContain("5 秒检查");
    expect(workspace).toContain("衍生品与市场背景");
    expect(workspace).toContain("数据暂不可用");
    expect(`${source}\n${workspace}`).not.toMatch(
      /Data unavailable|Not published|market data cannot be displayed/,
    );
  });
});
