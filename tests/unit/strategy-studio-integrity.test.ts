import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigation } from "@/components/layout/navigation";
import { PUBLIC_ROUTES } from "@/config/site";
import { isPublicPagePath } from "@/lib/analytics/page-analytics";
import { createConfiguredTradeStrategyRepository } from "@/server/strategy/configured-strategy-repository";

describe("private strategy studio integrity", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("never enters public navigation, sitemap routes or public analytics", () => {
    expect(navigation.some(({ href }) => href.startsWith("/studio"))).toBe(false);
    expect(PUBLIC_ROUTES.some((route) => route.startsWith("/studio"))).toBe(false);
    expect(isPublicPagePath("/studio/strategies")).toBe(false);
  });

  it("keeps the configured public repository empty while local mode is disabled", async () => {
    vi.stubEnv("WISE_STRATEGY_STUDIO_MODE", "disabled");
    const repository = createConfiguredTradeStrategyRepository();
    await expect(
      repository.getDisclosure("btc", Date.parse("2026-09-06T00:00:00Z")),
    ).resolves.toEqual({ kind: "status", state: "unpublished" });
  });

  it("requires authenticated, CSRF-bound mutations and reviewer reauthentication", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/studio/strategies/actions.ts"),
      "utf8",
    );
    expect(actions.match(/requireStrategyStudioMutationSession\(/gu)?.length).toBe(
      6,
    );
    expect(actions).toContain('formData.get("confirmed") !== "yes"');
    expect(actions.match(/reviewer\.tokenDigest/gu)?.length).toBe(3);
    expect(actions).toContain('formData.get("strategyId")');
    expect(actions).toContain('formData.get("revision")');
    expect(actions.match(/context\.session\.subject/gu)?.length).toBeGreaterThanOrEqual(
      4,
    );
    expect(actions).toContain("waitForMinimumLoginDuration");
    expect(actions).not.toContain("NEXT_PUBLIC_");
  });

  it("binds both local servers to loopback on the required port", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    for (const script of [packageJson.scripts.dev, packageJson.scripts.start]) {
      expect(script).toContain("-H 127.0.0.1");
      expect(script).toContain("-p 2222");
    }
  });

  it("ignores private strategy files and commits no example credential", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    const environment = readFileSync(
      join(process.cwd(), ".env.example"),
      "utf8",
    );
    expect(gitignore).toContain("/.wise-crypto-private/");
    expect(environment).toContain("WISE_STRATEGY_STUDIO_MODE=disabled");
    expect(environment).not.toMatch(
      /WISE_STRATEGY_STUDIO_(?:SESSION_KEY|ENCRYPTION_KEY|EDITOR_TOKEN_SHA256|REVIEWER_TOKEN_SHA256)=[A-Za-z0-9_-]+/u,
    );
  });
});
