import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function read(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Phase 3 homepage integrity", () => {
  it("uses the server market service and stays dynamic at build time", () => {
    const page = read("src/app/page.tsx");

    expect(page).toContain("loadMarketQuoteSnapshot");
    expect(page).toContain("loadMarketPulseSnapshot");
    expect(page).toContain("loadMarketIndicatorSnapshot");
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).not.toMatch(/MockMarketProvider|createTestingRegistry|testing\//);
    expect(page).not.toMatch(/fetch\s*\(/);
  });

  it("renders every Phase 3 market capability from the normalized snapshot", () => {
    const market = read("src/components/home/homepage-market.tsx");
    const datumPresentation = read(
      "src/components/market/datum-presentation.tsx",
    );
    const requiredFields = [
      "btcPrice",
      "ethPrice",
      "marketCap",
      "fearAndGreed",
      "btcDominance",
      "ethBtc",
      "btcFunding",
      "ethFunding",
      "btcOpenInterest",
      "ethOpenInterest",
      "liquidations24h",
      "btcEtfFlow",
      "ethEtfFlow",
    ];

    for (const field of requiredFields) {
      expect(market).toContain(`data.${field}`);
    }
    expect(datumPresentation).toContain("数据截至");
    expect(datumPresentation).toContain("获取于");
    expect(datumPresentation).toContain("来源");
  });

  it("keeps editorial judgments server-only and behind executable policy validation", () => {
    const editorial = read("src/content/homepage-editorial.ts");
    const service = read(
      "src/server/editorial/homepage-editorial-service.ts",
    );
    const policy = read("src/lib/editorial/homepage-editorial.ts");

    expect(editorial).toContain('import "server-only"');
    expect(service).toContain("parseHomepageEditorialConfig");
    expect(policy).toContain("cannot contain hard-coded market numbers");
    expect(editorial).not.toMatch(
      /100_000|4_000|3_500_000_000_000|buy|sell|target|support|resistance/i,
    );
    expect(`${editorial}\n${service}`).not.toMatch(
      /MockMarketProvider|createTestingRegistry|testing\//,
    );
  });

  it("uses the current Next.js retry callback in error boundaries", () => {
    const errors = `${read("src/app/error.tsx")}\n${read("src/app/global-error.tsx")}`;

    expect(errors).toContain("retry: () => void");
    expect(errors).not.toContain("reset: () => void");
  });
});
