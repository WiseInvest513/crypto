import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DcaCalculator } from "../../src/components/tools/dca-calculator";
import { LeverageCalculator } from "../../src/components/tools/leverage-calculator";
import { PositionSizeCalculator } from "../../src/components/tools/position-size-calculator";
import { RiskRewardCalculator } from "../../src/components/tools/risk-reward-calculator";
import { ToolPageShell } from "../../src/components/tools/tool-page-shell";
import type {
  DcaMarketDataset,
  DcaMarketHistory,
} from "../../src/lib/tools/dca-market-data";
import { getToolDefinition } from "../../src/lib/tools/catalog";

describe("Phase 5 calculator components", () => {
  it("renders an empty, labelled position-size form without a suggested risk value", () => {
    const markup = renderToStaticMarkup(createElement(PositionSizeCalculator));

    expect(markup).toContain("设置风险预算");
    expect(markup).toContain('id="position-balance"');
    expect(markup).toContain('id="position-risk-percent"');
    expect(markup).toContain("等待计算");
    expect(markup).not.toMatch(/id="position-risk-percent"[^>]*value="\d/);
  });

  it("states that leverage results exclude venue liquidation rules", () => {
    const markup = renderToStaticMarkup(createElement(LeverageCalculator));

    expect(markup).toContain("V0 不计算强平价");
    expect(markup).toContain("逐仓/全仓模式");
    expect(markup).toContain("不是账户收益率");
    expect(markup).not.toContain("liquidationPrice");
  });

  it("keeps risk/reward inputs user-defined and exposes the long/short direction", () => {
    const markup = renderToStaticMarkup(createElement(RiskRewardCalculator));

    expect(markup).toContain("做多 Long");
    expect(markup).toContain("做空 Short");
    expect(markup).toContain("页面不会提供推荐价位");
    expect(markup).toContain("不包含成交概率");
  });

  it("keeps the risk/reward ratio presentation neutral", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/tools/risk-reward-calculator.tsx"),
      "utf8",
    );

    expect(source).toContain('tone: "neutral"');
    expect(source).not.toMatch(/rewardToRiskRatio\s*>?=?.*positive/);
  });

  it("shows a safe asset context and blank next-step tools", () => {
    const markup = renderToStaticMarkup(
      ToolPageShell({
        asset: "btc",
        tool: getToolDefinition("position-size"),
        children: createElement("div", null, "calculator"),
      }),
    );

    expect(markup).toContain("来自 BTC 资产工作台");
    expect(markup).toContain("价格、余额、交易计划和计算结果均未带入");
    expect(markup).toContain('href="/btc"');
    expect(markup).toContain('href="/tools/risk-reward?asset=btc"');
    expect(markup).toContain('href="/tools/leverage?asset=btc"');
    expect(markup).toContain("只打开空白工具");
  });

  it("renders Binance source, UTC scope and an empty DCA result before submit", () => {
    const markup = renderToStaticMarkup(
      createElement(DcaCalculator, { datasets: availableHistory() }),
    );

    expect(markup).toContain("Binance BTCUSDT / ETHUSDT 现货");
    expect(markup).toContain("已闭合 UTC 日线");
    expect(markup).toContain("Binance 现货市场数据");
    expect(markup).toContain("可用已闭合日线：2026-08-29 至 2026-08-30");
    expect(markup).toContain("等待计算");
    expect(markup).not.toContain("历史定投结果");
  });

  it("uses a safe asset context only to choose the initial DCA dataset", () => {
    const markup = renderToStaticMarkup(
      createElement(DcaCalculator, {
        datasets: availableHistory(),
        initialAsset: "eth",
      }),
    );

    expect(markup).toContain("Binance ETHUSDT 现货日线");
    expect(markup).toMatch(/<option value="eth" selected="">ETH \/ USDT<\/option>/);
    expect(markup).not.toMatch(/value="(?:\d|\.)+"/);
  });

  it("disables DCA calculation instead of inventing prices when data fails", () => {
    const failed = errorDataset("btc");
    const markup = renderToStaticMarkup(
      createElement(DcaCalculator, {
        datasets: { btc: failed, eth: errorDataset("eth") },
      }),
    );

    expect(markup).toContain("日线获取失败");
    expect(markup).toContain("行情暂不可用");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>行情暂不可用<\/button>/);
    expect(markup).toContain("不生成任何替代或模拟结果");
  });
});

function availableHistory(): DcaMarketHistory {
  return {
    btc: availableDataset("btc"),
    eth: availableDataset("eth"),
  };
}

function availableDataset(asset: "btc" | "eth"): DcaMarketDataset {
  const symbol = asset === "btc" ? "BTCUSDT" : "ETHUSDT";
  return {
    asset,
    symbol,
    venue: "Binance",
    quoteCurrency: "USDT",
    interval: "1d",
    timeZone: "UTC",
    candleState: "closed",
    requestedRange: {
      from: "2024-08-31T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    },
    status: "fresh",
    prices: [
      { date: "2026-08-29", close: asset === "btc" ? 100_000 : 4_000 },
      { date: "2026-08-30", close: asset === "btc" ? 101_000 : 4_100 },
    ],
    source: {
      id: "binance-spot",
      label: "Binance 现货市场数据",
      url: "https://developers.binance.com/docs/binance-spot-api-docs",
    },
    scope: {
      kind: "venue",
      label: `Binance ${symbol} 现货日线（USDT，UTC）`,
    },
    updatedAt: "2026-08-30T23:59:59.999Z",
    retrievedAt: "2026-08-31T12:00:00.000Z",
    stale: false,
    cache: {
      status: "miss",
      revalidateSeconds: 900,
      staleIfErrorSeconds: 604_800,
    },
    error: null,
    reason: null,
  };
}

function errorDataset(asset: "btc" | "eth"): DcaMarketDataset {
  const dataset = availableDataset(asset);
  return {
    ...dataset,
    status: "error",
    prices: [],
    updatedAt: null,
    stale: false,
    error: { code: "timeout", retryable: true },
  };
}
