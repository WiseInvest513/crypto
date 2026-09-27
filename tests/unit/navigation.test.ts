import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCurrentRoute,
  navigation,
} from "../../src/components/layout/navigation";

describe("primary navigation", () => {
  it("contains five task-focused sections with separate learning and tools", () => {
    expect(navigation.map((item) => item.href)).toEqual([
      "/",
      "/btc",
      "/exchanges",
      "/learn",
      "/tools",
    ]);
  });

  it("uses Simplified Chinese labels for the public navigation", () => {
    expect(navigation.map((item) => item.label)).toEqual([
      "市场总览",
      "行情",
      "开户福利",
      "学习",
      "工具",
    ]);
  });

  it("matches overview exactly and section routes by segment", () => {
    expect(isCurrentRoute("/", "/")).toBe(true);
    expect(isCurrentRoute("/btc", "/")).toBe(false);
    expect(isCurrentRoute("/exchanges", "/exchanges")).toBe(true);
    expect(isCurrentRoute("/exchanges/guide", "/exchanges")).toBe(true);
    expect(isCurrentRoute("/exchange", "/exchanges")).toBe(false);
    expect(isCurrentRoute("/learn/futures-intro", "/learn")).toBe(true);
    expect(isCurrentRoute("/learn/futures-intro", "/tools")).toBe(false);
    expect(isCurrentRoute("/tools/dca", "/tools")).toBe(true);
    expect(isCurrentRoute("/toolsmith", "/tools")).toBe(false);
  });

  it("keeps the market section active for both shareable asset routes", () => {
    expect(isCurrentRoute("/btc", "/btc")).toBe(true);
    expect(isCurrentRoute("/eth", "/btc")).toBe(true);
    expect(isCurrentRoute("/eth/history", "/btc")).toBe(true);
    expect(isCurrentRoute("/ethereum", "/btc")).toBe(false);
    expect(isCurrentRoute("/btcash", "/btc")).toBe(false);
    expect(isCurrentRoute("/tools", "/btc")).toBe(false);
  });

  it("does not expose the retired product directory in header or footer", () => {
    const headerNavigation = readFileSync(
      join(process.cwd(), "src/components/layout/navigation.ts"),
      "utf8",
    );
    const footer = readFileSync(
      join(process.cwd(), "src/components/layout/site-footer.tsx"),
      "utf8",
    );

    expect(`${headerNavigation}\n${footer}`).not.toContain('href: "/products"');
  });
});
