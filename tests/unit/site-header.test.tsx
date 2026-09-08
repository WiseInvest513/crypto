import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/layout/site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("site header login foundation", () => {
  it("keeps the unconfigured Wise ID entry fail-closed", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('<details class="site-header__account">');
    expect(html).toContain(
      '<summary class="site-header__account-trigger">登录</summary>',
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Wise ID 登录尚未开放");
    expect(html).toContain(
      "当前公开的市场行情、计算工具和合约课程无需登录即可使用。",
    );
    expect(html).not.toMatch(/已登录|VIP 用户|退出登录|前往主站登录/);
  });

  it("keeps the header server-rendered while exposing an accessible theme island", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    const headerSource = readFileSync(
      join(process.cwd(), "src/components/layout/site-header.tsx"),
      "utf8",
    );
    const toggleSource = readFileSync(
      join(process.cwd(), "src/components/layout/theme-toggle.tsx"),
      "utf8",
    );

    expect(headerSource).not.toMatch(/^\s*["']use client["'];?/);
    expect(toggleSource).toMatch(/^\s*["']use client["'];?/);
    expect(html).toContain('class="site-header__actions"');
    expect(html).toContain('class="site-header__theme-toggle"');
    expect(html).toContain('aria-label="切换到深色模式"');
    expect(html).toContain('title="切换到深色模式"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("keeps both actions touch-sized and inside narrow viewports", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.site-header__account-trigger\s*\{[^}]*min-height:\s*2\.75rem;/s,
    );
    expect(css).toMatch(
      /\.site-header__account-panel\s*\{[^}]*width:\s*min\(20rem, calc\(100vw - 2rem\)\);/s,
    );
    expect(css).toMatch(
      /\.site-header__theme-toggle\s*\{[^}]*width:\s*2\.75rem;[^}]*min-width:\s*2\.75rem;[^}]*min-height:\s*2\.75rem;/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.site-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/,
    );
  });
});
