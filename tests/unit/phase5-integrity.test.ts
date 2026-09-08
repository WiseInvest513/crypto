import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "../../src/app/sitemap";
import {
  AUTHENTICATED_ROUTES,
  PUBLIC_ROUTES,
} from "../../src/config/site";
import { toolCatalog } from "../../src/lib/tools/catalog";

const PROJECT_ROOT = process.cwd();
const TOOL_ROUTES = [
  "/tools/position-size",
  "/tools/leverage",
  "/tools/dca",
  "/tools/risk-reward",
] as const;

function readSource(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Phase 5 integrity", () => {
  it("keeps exactly four independently addressable calculators behind the account gate", () => {
    const indexedRoutes = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(toolCatalog.map((tool) => tool.href)).toEqual(TOOL_ROUTES);
    expect(AUTHENTICATED_ROUTES).toEqual(
      expect.arrayContaining([...TOOL_ROUTES]),
    );
    expect(PUBLIC_ROUTES).not.toEqual(
      expect.arrayContaining([...TOOL_ROUTES]),
    );
    expect(indexedRoutes).not.toEqual(expect.arrayContaining([...TOOL_ROUTES]));

    for (const route of TOOL_ROUTES) {
      const page = readSource(`src/app${route}/page.tsx`);
      expect(page).toContain("createProtectedPageMetadata({");
      expect(page).toContain("path: tool.href");
      expect(page).toContain("socialTitle:");
      expect(page).toContain(`requireWisePageAccount("${route}")`);
    }
  });

  it("keeps all calculator inputs in narrow client components", () => {
    const clients = [
      "src/components/tools/position-size-calculator.tsx",
      "src/components/tools/leverage-calculator.tsx",
      "src/components/tools/dca-calculator.tsx",
      "src/components/tools/risk-reward-calculator.tsx",
    ].map(readSource);

    for (const source of clients) {
      expect(source.startsWith('"use client";')).toBe(true);
      expect(source).not.toMatch(/\bfetch\s*\(|process\.env|NEXT_PUBLIC_/);
      expect(source).toContain("noValidate");
      expect(source).toContain("useToolAnalytics");
    }
  });

  it("keeps DCA market access server-only, live and provenance-preserving", () => {
    const service = readSource("src/server/tools/dca-history-service.ts");
    const dto = readSource("src/lib/tools/dca-market-data.ts");

    expect(service.startsWith('import "server-only";')).toBe(true);
    expect(service).toContain("getMarketProviderRegistry");
    expect(service).toContain('source.id !== "binance-spot"');
    expect(service).toContain('provenance !== "live"');
    expect(service).toContain("closedAt >= requestedAt");
    expect(service).not.toMatch(/mock|synthetic[^\n]*return/i);
    expect(dto).toContain("source: DcaMarketDataSource | null");
    expect(dto).toContain("updatedAt: string | null");
    expect(dto).toContain("stale: boolean");
    expect(dto).toContain("cache: DcaMarketCacheMetadata");
    expect(dto).toContain("error: DcaMarketDataError | null");
  });

  it("does not calculate an exchange liquidation price", () => {
    const calculation = readSource("src/lib/tools/leverage.ts");
    const component = readSource(
      "src/components/tools/leverage-calculator.tsx",
    );

    expect(calculation).not.toContain("liquidationPrice:");
    expect(component).toContain("V0 不计算强平价");
    expect(component).toContain("维持保证金档位");
  });

  it("shares route URLs only and keeps financial values out of analytics", () => {
    const share = readSource("src/components/tools/share-tool-link.tsx");
    const analytics = readSource("src/lib/analytics/tool-analytics.ts");

    expect(share).toContain("new URL(href, window.location.origin)");
    expect(share).not.toMatch(/searchParams|balance|entryPrice|stopPrice/);
    expect(analytics).toContain('"tool_open"');
    expect(analytics).toContain('"tool_complete"');
    expect(analytics).toContain("ALLOWED_CONTEXT_KEYS");
    expect(analytics).toContain('  "toolSlug",');
    expect(analytics).not.toMatch(/ALLOWED_CONTEXT_KEYS[\s\S]*?"balance"/);
  });
});
