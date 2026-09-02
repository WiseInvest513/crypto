import { describe, expect, it } from "vitest";
import {
  isCurrentRoute,
  navigation,
} from "../../src/components/layout/navigation";

describe("primary navigation", () => {
  it("contains the five Phase 1 public routes", () => {
    expect(navigation.map((item) => item.href)).toEqual([
      "/",
      "/btc",
      "/eth",
      "/tools",
      "/products",
    ]);
  });

  it("uses Simplified Chinese labels for the public navigation", () => {
    expect(navigation.map((item) => item.label)).toEqual([
      "市场总览",
      "BTC",
      "ETH",
      "工具",
      "产品",
    ]);
  });

  it("matches overview exactly and section routes by segment", () => {
    expect(isCurrentRoute("/", "/")).toBe(true);
    expect(isCurrentRoute("/btc", "/")).toBe(false);
    expect(isCurrentRoute("/tools/dca", "/tools")).toBe(true);
    expect(isCurrentRoute("/toolsmith", "/tools")).toBe(false);
  });
});
