import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StrategyDisclosurePanel } from "@/components/strategy/strategy-disclosure-panel";
import { strategyHasExpired } from "@/components/strategy/strategy-expiry-boundary";
import {
  parseTradeStrategy,
  toActiveTradeStrategyView,
} from "@/lib/strategy/trade-strategy";
import type { TradeStrategyDisclosure } from "@/server/strategy/trade-strategy-service";
import { tradeStrategyFixture } from "../fixtures/trade-strategy";

function render(disclosure: TradeStrategyDisclosure): string {
  return renderToStaticMarkup(
    createElement(StrategyDisclosurePanel, { disclosure }),
  );
}

describe("strategy disclosure panel", () => {
  it("renders a compact regular boundary without private strategy fields", () => {
    const html = render({ kind: "locked", asset: "btc" });
    expect(html).toContain("Wise 人工策略");
    expect(html).toContain("客观研究已开放");
    expect(html).toContain("普通权限");
    expect(html).toContain("https://www.wise-invest.org/perk/crypto");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    for (const privateValue of [
      "PRIVATE_HEADLINE_SENTINEL",
      "PRIVATE_ZONE_SENTINEL",
      "PRIVATE_AUTHOR_SENTINEL",
      "71,000",
    ]) {
      expect(html).not.toContain(privateValue);
    }
  });

  it.each([
    ["unpublished", "本期人工策略尚未发布"],
    ["scheduled", "本期人工策略已排期"],
    ["expired", "上一期人工策略已到期"],
    ["withdrawn", "本期人工策略已撤回"],
    ["unavailable", "人工策略服务暂不可用"],
  ] as const)("renders the %s state without old content", (state, copy) => {
    const html = render({ kind: "status", asset: "btc", state });
    expect(html).toContain(copy);
    expect(html).not.toContain("PRIVATE_HEADLINE_SENTINEL");
    expect(html).not.toContain("71,000");
  });

  it("renders an authorized strategy with zones, confirmation, invalidation and review details", () => {
    const strategy = toActiveTradeStrategyView(
      parseTradeStrategy(tradeStrategyFixture()),
    );
    const html = render({ kind: "active", asset: "btc", strategy });
    for (const value of [
      "PRIVATE_HEADLINE_SENTINEL",
      "PRIVATE_ZONE_SENTINEL",
      "71,000.00 — 72,000.00 USDT",
      "PRIVATE_CONFIRMATION_SENTINEL",
      "PRIVATE_INVALIDATION_SENTINEL",
      "PRIVATE_RISK_SENTINEL",
      "查看完整人工研究",
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('dateTime="2026-09-07T00:00:00Z"');
    expect(html).not.toContain("PRIVATE_SOURCE_SENTINEL");
    expect(html).not.toContain("research.example.com");
  });

  it("expires at the exact validUntil boundary", () => {
    const deadline = "2026-09-07T00:00:00Z";
    expect(strategyHasExpired(deadline, Date.parse(deadline) - 1)).toBe(false);
    expect(strategyHasExpired(deadline, Date.parse(deadline))).toBe(true);
    expect(strategyHasExpired("invalid", Date.now())).toBe(true);
  });
});
