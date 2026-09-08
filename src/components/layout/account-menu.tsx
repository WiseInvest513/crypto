"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WiseAvatar } from "@/components/account/wise-avatar";
import { DismissibleDetails } from "@/components/ui/dismissible-details";
import type { UserTier } from "@/lib/access/user-access";
import type { WiseMembershipTier } from "@/lib/auth/wise-membership";
import type { WiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";

type AccountState =
  | Readonly<{ status: "disabled" | "loading" | "anonymous" | "error" }>
  | Readonly<{
      status: "authenticated";
      displayName: string | null;
      email: string | null;
      emailVerified: boolean | null;
      imageUrl: string | null;
      label: string;
      membershipTier: WiseMembershipTier;
      tier: UserTier;
      wiseId: string;
    }>;

export function AccountMenu({
  configurationStatus,
}: {
  configurationStatus: WiseAuthConfigurationStatus;
}) {
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountState>(() =>
    configurationStatus === "ready"
      ? { status: "loading" }
      : { status: configurationStatus === "disabled" ? "disabled" : "error" },
  );

  useEffect(() => {
    if (configurationStatus !== "ready") return;

    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void loadAccount(controller.signal).then((result) => {
        if (!controller.signal.aborted) setAccount(result);
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [configurationStatus, pathname]);

  const isAuthenticated = account.status === "authenticated";

  return (
    <DismissibleDetails
      className="site-header__account"
      closeKey={pathname}
    >
      <summary
        className={`site-header__account-trigger${isAuthenticated ? " site-header__account-trigger--authenticated" : ""}`}
        aria-label={isAuthenticated ? "打开账户菜单" : "打开登录菜单"}
      >
        {isAuthenticated ? (
          <>
            <WiseAvatar
              displayName={account.displayName}
              email={account.email}
              imageUrl={account.imageUrl}
              size="compact"
            />
            <span className="site-header__account-trigger-copy">
              <strong>{account.displayName ?? account.label}</strong>
              <small>{account.label}</small>
            </span>
          </>
        ) : (
          <span className="site-header__account-trigger-copy">
            <strong>{account.status === "loading" ? "账户" : "登录"}</strong>
          </span>
        )}
      </summary>
      <div className="site-header__account-panel" aria-live="polite">
        {renderAccountPanel(account, pathname)}
      </div>
    </DismissibleDetails>
  );
}

function renderAccountPanel(account: AccountState, returnTo: string) {
  const encodedReturnTo = encodeURIComponent(returnTo);

  if (account.status === "authenticated") {
    return (
      <>
        <div className="site-header__account-heading">
          <WiseAvatar
            displayName={account.displayName}
            email={account.email}
            imageUrl={account.imageUrl}
          />
          <div>
            <strong>{account.displayName ?? "Wise 用户"}</strong>
            <p>{account.email ?? "邮箱由 Wise ID 管理"}</p>
          </div>
          <span className="site-header__membership-badge">{account.label}</span>
        </div>
        <dl className="site-header__account-meta">
          <div>
            <dt>Wise ID</dt>
            <dd>{account.wiseId}</dd>
          </div>
          <div>
            <dt>登录状态</dt>
            <dd>当前设备已登录</dd>
          </div>
        </dl>
        <nav className="site-header__account-links" aria-label="账户操作">
          <Link className="site-header__account-action" href="/account">
            打开账户中心
            <span aria-hidden="true">→</span>
          </Link>
          <a href="https://www.wise-invest.org/account">
            前往 Wise ID 管理资料
            <span aria-hidden="true">↗</span>
          </a>
          <Link
            className="site-header__account-sign-out"
            href={`/auth/sign-out?returnTo=${encodedReturnTo}` as Route}
          >
            退出当前账户
          </Link>
        </nav>
      </>
    );
  }

  if (account.status === "loading") {
    return (
      <>
        <strong>正在确认 Wise ID</strong>
        <p>账户状态确认后，才能进入行情和工具。</p>
      </>
    );
  }

  if (account.status === "disabled") {
    return (
      <>
        <strong>Wise ID 登录尚未开放</strong>
        <p>登录完成配置前，行情、计算工具和合约课程暂时不可进入。</p>
      </>
    );
  }

  if (account.status === "error") {
    return (
      <>
        <strong>暂时无法确认登录状态</strong>
        <p>请稍后刷新或重新登录；系统不会在状态未知时开放受限页面。</p>
        <Link
          className="site-header__account-action"
          href={`/auth/sign-in?returnTo=${encodedReturnTo}` as Route}
        >
          重新登录
        </Link>
      </>
    );
  }

  return (
    <>
      <strong>使用主站 Wise ID 登录</strong>
      <p>登录后会识别普通用户或 VIP 用户，无需在 Crypto 重新注册。</p>
      <Link
        className="site-header__account-action"
        href={`/auth/sign-in?returnTo=${encodedReturnTo}` as Route}
      >
        前往主站登录
        <span aria-hidden="true">↗</span>
      </Link>
    </>
  );
}

async function loadAccount(signal: AbortSignal): Promise<AccountState> {
  try {
    const response = await fetch("/api/account", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) return { status: "error" };
    return parseAccountState(await response.json());
  } catch {
    return signal.aborted ? { status: "loading" } : { status: "error" };
  }
}

export function parseAccountState(value: unknown): AccountState {
  if (typeof value !== "object" || value === null) return { status: "error" };
  const candidate = value as Record<string, unknown>;

  if (candidate.status === "disabled") return { status: "disabled" };
  if (candidate.status === "anonymous") return { status: "anonymous" };

  const displayName = readNullableString(candidate.displayName, 120);
  const email = readNullableString(candidate.email, 320);
  const imageUrl = readNullableHttpsUrl(candidate.imageUrl);
  const wiseId = readRequiredString(candidate.wiseId, 128);
  const emailVerified = readNullableBoolean(candidate.emailVerified);

  if (
    candidate.status === "authenticated" &&
    (candidate.tier === "regular" || candidate.tier === "vip") &&
    (candidate.membershipTier === "MEMBER" ||
      candidate.membershipTier === "VIP" ||
      candidate.membershipTier === "VIP_PLUS") &&
    typeof candidate.label === "string" &&
    displayName !== undefined &&
    email !== undefined &&
    imageUrl !== undefined &&
    wiseId !== null &&
    emailVerified !== undefined
  ) {
    return {
      status: "authenticated",
      displayName,
      email,
      emailVerified,
      imageUrl,
      label: candidate.label,
      membershipTier: candidate.membershipTier,
      tier: candidate.tier,
      wiseId,
    };
  }

  return { status: "error" };
}

function readRequiredString(value: unknown, maximumLength: number): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function readNullableString(
  value: unknown,
  maximumLength: number,
): string | null | undefined {
  return value === null
    ? null
    : readRequiredString(value, maximumLength) ?? undefined;
}

function readNullableBoolean(value: unknown): boolean | null | undefined {
  return value === null ? null : typeof value === "boolean" ? value : undefined;
}

function readNullableHttpsUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  const candidate = readRequiredString(value, 2_048);
  if (!candidate) return undefined;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
