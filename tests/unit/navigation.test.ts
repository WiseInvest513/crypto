import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCurrentRoute,
  navigation,
} from "../../src/components/layout/navigation";

describe("primary navigation", () => {
  it("contains the four core market and tool routes", () => {
    expect(navigation.map((item) => item.href)).toEqual([
      "/",
      "/btc",
      "/eth",
      "/tools",
    ]);
  });

  it("uses Simplified Chinese labels for the public navigation", () => {
    expect(navigation.map((item) => item.label)).toEqual([
      "市场总览",
      "BTC",
      "ETH",
      "工具",
    ]);
  });

  it("matches overview exactly and section routes by segment", () => {
    expect(isCurrentRoute("/", "/")).toBe(true);
    expect(isCurrentRoute("/btc", "/")).toBe(false);
    expect(isCurrentRoute("/tools/dca", "/tools")).toBe(true);
    expect(isCurrentRoute("/toolsmith", "/tools")).toBe(false);
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
