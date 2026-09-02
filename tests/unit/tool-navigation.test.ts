import { describe, expect, it } from "vitest";
import {
  getToolNextSteps,
  parseToolAsset,
} from "../../src/lib/tools/tool-navigation";

describe("tool navigation", () => {
  it("accepts only the two supported single-value asset slugs", () => {
    expect(parseToolAsset("btc")).toBe("btc");
    expect(parseToolAsset("eth")).toBe("eth");

    for (const value of [
      "BTC",
      "sol",
      "btc?entryPrice=1",
      ["btc"],
      ["btc", "eth"],
      null,
      undefined,
      { asset: "btc" },
    ]) {
      expect(parseToolAsset(value)).toBeNull();
    }
  });

  it("maps each calculator to neutral next steps without financial values", () => {
    expect(getToolNextSteps("position-size", null).map((step) => step.href)).toEqual([
      "/tools/risk-reward",
      "/tools/leverage",
    ]);
    expect(getToolNextSteps("risk-reward", null).map((step) => step.href)).toEqual([
      "/tools/position-size",
    ]);
    expect(getToolNextSteps("leverage", null).map((step) => step.href)).toEqual([
      "/tools/position-size",
      "/tools/risk-reward",
    ]);

    const contextual = getToolNextSteps("position-size", "eth");
    expect(contextual.map((step) => step.href)).toEqual([
      "/tools/risk-reward?asset=eth",
      "/tools/leverage?asset=eth",
    ]);
    expect(JSON.stringify(contextual)).not.toMatch(
      /balance|entryPrice|stopPrice|targetPrice|result/i,
    );
  });

  it("returns DCA users to the matching asset workspace", () => {
    expect(getToolNextSteps("dca", "btc")).toEqual([
      expect.objectContaining({
        href: "/btc",
        label: "返回 BTC 资产工作台",
      }),
    ]);
    expect(getToolNextSteps("dca", null).map((step) => step.href)).toEqual([
      "/btc",
      "/eth",
    ]);
  });
});
