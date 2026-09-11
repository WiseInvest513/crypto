import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseAccountState } from "@/components/layout/account-menu";
import { SiteHeader } from "@/components/layout/site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("site header login foundation", () => {
  it("keeps the unconfigured Wise ID entry fail-closed", async () => {
    const html = renderToStaticMarkup(await SiteHeader());

    expect(html).toContain('<details class="site-header__account">');
    expect(html).toContain('aria-label="打开登录菜单"');
    expect(html).toContain("登录</strong>");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Wise ID 登录尚未开放");
    expect(html).toContain(
      "登录完成配置前，行情、计算工具和合约课程暂时不可进入。",
    );
    expect(html).not.toMatch(/已登录|VIP 用户|退出登录|前往主站登录/);
  });

  it("keeps the header server-rendered while exposing an accessible theme island", async () => {
    const html = renderToStaticMarkup(await SiteHeader());
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
    expect(html).toContain('class="site-header__main-site-link"');
    expect(html).toContain('href="https://www.wise-invest.org/vip"');
    expect(html).toContain('aria-label="了解如何加入 Wise VIP"');
    expect(html).toContain("加入 VIP");
    expect(html).toContain('class="site-header__theme-toggle"');
    expect(html).toContain('aria-label="切换到深色模式"');
    expect(html).toContain('title="切换到深色模式"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("keeps all three utilities touch-sized and inside narrow viewports", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.site-header__account-trigger\s*\{[^}]*min-height:\s*2\.75rem;/s,
    );
    expect(css).toMatch(
      /\.site-header__main-site-link\s*\{[^}]*min-height:\s*2\.75rem;/s,
    );
    expect(css).toMatch(
      /\.site-header__account-panel\s*\{[^}]*width:\s*min\(22rem, calc\(100vw - 2rem\)\);/s,
    );
    expect(css).toMatch(
      /\.site-header__theme-toggle\s*\{[^}]*width:\s*2\.75rem;[^}]*min-width:\s*2\.75rem;[^}]*min-height:\s*2\.75rem;/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.site-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.site-header__main-site-link\s*\{[^}]*width:\s*2\.75rem;[^}]*min-width:\s*2\.75rem;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.site-header__main-site-link span\s*\{[^}]*display:\s*none;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.site-header__actions\s*\{[^}]*grid-row:\s*1;[^}]*grid-column:\s*2;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 42rem\)[\s\S]*?\.primary-nav\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1 \/ -1;/,
    );
  });

  it("keeps the right-side utilities visually quiet without shrinking their hit areas", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.site-header__actions\s*\{[^}]*gap:\s*0\.125rem;/s,
    );
    expect(css).toMatch(
      /\.site-header__main-site-link\s*\{[^}]*min-height:\s*2\.75rem;[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;/s,
    );
    expect(css).toMatch(
      /\.site-header__theme-toggle\s*\{[^}]*min-height:\s*2\.75rem;[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;/s,
    );
    expect(css).toMatch(
      /\.site-header__account-trigger\s*\{[^}]*min-height:\s*2\.75rem;[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;/s,
    );
  });

  it("accepts only a complete, sanitized Wise ID account projection", () => {
    expect(
      parseAccountState({
        status: "authenticated",
        authenticationSource: "wise-id",
        displayName: "Invest wise",
        email: "member@example.com",
        emailVerified: true,
        imageUrl: "https://www.wise-invest.org/avatar.png",
        label: "Wise VIP",
        membershipAccessFresh: true,
        membershipTier: "VIP",
        tier: "vip",
        wiseId: "Y36FUHLKBHJVE",
      }),
    ).toEqual({
      status: "authenticated",
      authenticationSource: "wise-id",
      displayName: "Invest wise",
      email: "member@example.com",
      emailVerified: true,
      imageUrl: "https://www.wise-invest.org/avatar.png",
      label: "Wise VIP",
      membershipAccessFresh: true,
      membershipTier: "VIP",
      tier: "vip",
      wiseId: "Y36FUHLKBHJVE",
    });

    expect(
      parseAccountState({
        status: "authenticated",
        authenticationSource: "wise-id",
        displayName: "Invest wise",
        email: null,
        emailVerified: null,
        imageUrl: "http://insecure.example/avatar.png",
        label: "Wise VIP",
        membershipAccessFresh: true,
        membershipTier: "VIP",
        tier: "vip",
        wiseId: "Y36FUHLKBHJVE",
      }),
    ).toEqual({ status: "error" });

    expect(
      parseAccountState({
        status: "authenticated",
        authenticationSource: "local-development",
        displayName: "本地开发用户",
        email: null,
        emailVerified: null,
        imageUrl: null,
        label: "普通用户",
        membershipAccessFresh: true,
        membershipTier: "MEMBER",
        tier: "regular",
        wiseId: "LOCAL-DEVELOPMENT",
      }),
    ).toEqual({
      status: "authenticated",
      authenticationSource: "local-development",
      displayName: "本地开发用户",
      email: null,
      emailVerified: null,
      imageUrl: null,
      label: "普通用户",
      membershipAccessFresh: true,
      membershipTier: "MEMBER",
      tier: "regular",
      wiseId: "LOCAL-DEVELOPMENT",
    });
  });
});
