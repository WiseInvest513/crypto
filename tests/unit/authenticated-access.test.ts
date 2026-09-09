import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTHENTICATED_ROUTES,
  PUBLIC_ROUTES,
} from "@/config/site";

const PROJECT_ROOT = process.cwd();

const protectedPages = {
  "/btc": "src/app/btc/page.tsx",
  "/eth": "src/app/eth/page.tsx",
  "/exchanges": "src/app/exchanges/page.tsx",
  "/tools": "src/app/tools/page.tsx",
  "/tools/position-size": "src/app/tools/position-size/page.tsx",
  "/tools/leverage": "src/app/tools/leverage/page.tsx",
  "/tools/dca": "src/app/tools/dca/page.tsx",
  "/tools/risk-reward": "src/app/tools/risk-reward/page.tsx",
  "/tools/futures-intro": "src/app/tools/futures-intro/page.tsx",
  "/account": "src/app/account/page.tsx",
} as const;

const protectedMarketApis = {
  "/api/market/candles": {
    path: "src/app/api/market/candles/route.ts",
    loader: "loadAssetLiveChartDatum",
  },
  "/api/market/performance": {
    path: "src/app/api/market/performance/route.ts",
    loader: "loadAssetPerformanceSnapshot",
  },
  "/api/market/research": {
    path: "src/app/api/market/research/route.ts",
    loader: "loadAssetResearchSnapshot",
  },
} as const;

describe("authenticated access static boundaries", () => {
  it("keeps the protected route inventory explicit and separate from public pages", () => {
    expect([...AUTHENTICATED_ROUTES]).toEqual(Object.keys(protectedPages));
    expect(new Set(AUTHENTICATED_ROUTES).size).toBe(
      AUTHENTICATED_ROUTES.length,
    );
    expect(PUBLIC_ROUTES).toEqual(["/"]);

    const publicRoutes = new Set<string>(PUBLIC_ROUTES);
    for (const route of AUTHENTICATED_ROUTES) {
      expect(publicRoutes.has(route)).toBe(false);
    }
  });

  it.each(Object.entries(protectedPages))(
    "requires a server-side Wise account before rendering %s",
    (route, path) => {
      const source = readSource(path);

      expect(source).toContain(
        'import { requireWisePageAccount } from "@/server/auth/wise-route-access";',
      );
      expect(source).toContain('export const dynamic = "force-dynamic";');
      expect(source).toContain(`requireWisePageAccount("${route}")`);
    },
  );

  it.each(Object.entries(protectedMarketApis))(
    "checks Wise authentication before loading %s",
    (_route, definition) => {
      const source = readSource(definition.path);
      const handler = source.slice(source.indexOf("export async function GET"));
      const gateIndex = handler.indexOf("await requireWiseApiAccount()");
      const loaderIndex = handler.indexOf(definition.loader);

      expect(source).toContain(
        'import { requireWiseApiAccount } from "@/server/auth/wise-route-access";',
      );
      expect(source).toContain('export const dynamic = "force-dynamic";');
      expect(gateIndex).toBeGreaterThanOrEqual(0);
      expect(loaderIndex).toBeGreaterThan(gateIndex);
      expect(handler).toMatch(
        /if \(authenticationFailure\) return authenticationFailure;/,
      );
    },
  );

  it("always ends the Crypto session at the public home page", () => {
    const source = readSource("src/app/auth/actions.ts");
    const action = source.slice(source.indexOf("export async function endWiseSession"));

    expect(action).toContain('if (!isWiseAuthConfigured()) redirect("/");');
    expect(action).toContain('await signOut({ redirectTo: "/" });');
    expect(action).not.toContain("redirectTo: returnTo");
    expect(action).not.toMatch(/redirect\(returnTo\)/);
  });

  it("keeps account and chart details dismissible by outside interaction and Escape", () => {
    const source = readSource("src/components/ui/dismissible-details.tsx");

    expect(source).toContain(
      'document.addEventListener("pointerdown", handlePointerDown, true);',
    );
    expect(source).toContain(
      'document.addEventListener("focusin", handleFocusIn);',
    );
    expect(source.match(/!details\.contains\(event\.target\)/g)).toHaveLength(2);
    expect(source.match(/close\(false\);/g)).toHaveLength(2);
    expect(source).toContain('if (event.key !== "Escape") return;');
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("close(true);");
    expect(source).toContain(
      'details.querySelector<HTMLElement>(":scope > summary")?.focus();',
    );
    expect(source).toContain(
      'document.removeEventListener("pointerdown", handlePointerDown, true);',
    );
    expect(source).toContain(
      'document.removeEventListener("keydown", handleKeyDown);',
    );
  });
});

function readSource(path: string): string {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}
