import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

function read(path: string) {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

describe("Public homepage landing integrity", () => {
  it("is a public doorway with no market, editorial, or identity dependency", () => {
    const page = read("src/app/page.tsx");

    expect(page).not.toContain("export const dynamic");
    expect(page).not.toMatch(/loadMarket|MarketPulse|KeyMarketIndicators/);
    expect(page).not.toMatch(/editorial|session|requirePageAccount|auth\(/i);
    expect(page).not.toMatch(/MockMarketProvider|createTestingRegistry|testing\//);
    expect(page).not.toMatch(/fetch\s*\(/);
  });

  it("presents the approved three-part brand narrative in reading order", () => {
    const page = read("src/app/page.tsx");

    const hero = page.indexOf('className={styles.hero}');
    const capabilities = page.indexOf('className={styles.capabilities}');
    const manifesto = page.indexOf('className={styles.manifesto}');

    expect(hero).toBeGreaterThan(-1);
    expect(capabilities).toBeGreaterThan(hero);
    expect(manifesto).toBeGreaterThan(capabilities);
    expect(page).toContain("看懂加密市场，");
    expect(page).toContain("再决定下一步。");
    expect(page).toContain("你需要的，不只是价格。");
    expect(page).toContain("我们不替你预测，");
    expect(page).toContain("只帮你看清。");
  });

  it("links all four capabilities to their existing protected destinations", () => {
    const page = read("src/app/page.tsx");

    for (const href of ["/btc", "/tools", "/learn/futures-intro", "/exchanges"]) {
      expect(page).toContain(`href: "${href}"`);
    }
    for (const label of ["看懂市场", "算清风险", "学会合约", "找到入口"]) {
      expect(page).toContain(`title: "${label}"`);
    }
    expect(page.match(/prefetch=\{false\}/g)?.length).toBeGreaterThanOrEqual(4);
    expect(page).not.toContain('href="/products"');
  });

  it("keeps the public doorway server-rendered and visually self-contained", () => {
    const page = read("src/app/page.tsx");
    const stylesheet = read("src/app/home-landing.module.css");

    expect(page).not.toContain('"use client"');
    expect(page).not.toContain("<SignalNetwork");
    expect(page).toContain("productMap");
    expect(page).toContain("trustStrip");
    expect(stylesheet).not.toMatch(/url\s*\(/);
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses route-scoped styling and contains no remote visual dependency", () => {
    const page = read("src/app/page.tsx");

    expect(page).toContain('import styles from "./home-landing.module.css"');
    expect(page).toContain("createPageMetadata");
    expect(page).toContain('path: "/"');
    expect(page).toContain("useSiteImage: true");
    expect(page).not.toContain("home-dashboard.css");
    expect(page).not.toMatch(/https?:\/\//);
    expect(page).not.toMatch(/<img|next\/image/i);
  });

  it("uses the current Next.js retry callback in error boundaries", () => {
    const errors = `${read("src/app/error.tsx")}\n${read("src/app/global-error.tsx")}`;

    expect(errors).toContain("retry: () => void");
    expect(errors).not.toContain("reset: () => void");
  });
});
