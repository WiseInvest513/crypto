"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { UserTier } from "@/lib/access/user-access";
import type { WiseMembershipTier } from "@/lib/auth/wise-membership";
import type { WiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";

type AccountState =
  | Readonly<{ status: "disabled" | "loading" | "anonymous" | "error" }>
  | Readonly<{
      status: "authenticated";
      displayName: string | null;
      label: string;
      membershipTier: WiseMembershipTier;
      tier: UserTier;
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

    const controller = new AbortController();
    void loadAccount(controller.signal).then((result) => {
      if (!controller.signal.aborted) setAccount(result);
    });
    return () => controller.abort();
  }, [configurationStatus]);

  const isAuthenticated = account.status === "authenticated";
  const triggerLabel = isAuthenticated
    ? account.tier === "vip"
      ? "VIP"
      : "账户"
    : "登录";

  return (
    <details className="site-header__account">
      <summary className="site-header__account-trigger">{triggerLabel}</summary>
      <div className="site-header__account-panel" aria-live="polite">
        {renderAccountPanel(account, pathname)}
      </div>
    </details>
  );
}

function renderAccountPanel(account: AccountState, returnTo: string) {
  const encodedReturnTo = encodeURIComponent(returnTo);

  if (account.status === "authenticated") {
    return (
      <>
        <div className="site-header__account-heading">
          <span aria-hidden="true">
            {account.displayName?.slice(0, 1).toUpperCase() ?? "W"}
          </span>
          <div>
            <strong>{account.label}</strong>
            {account.displayName ? <p>{account.displayName}</p> : null}
          </div>
        </div>
        <p className="site-header__account-note">
          权限由 Wise Invest 主站确认，本页面不会保存主站密码。
        </p>
        <Link
          className="site-header__account-action"
          href={`/auth/sign-out?returnTo=${encodedReturnTo}` as Route}
        >
          退出登录
        </Link>
      </>
    );
  }

  if (account.status === "loading") {
    return (
      <>
        <strong>正在确认 Wise ID</strong>
        <p>公开行情与工具无需等待，可以继续使用。</p>
      </>
    );
  }

  if (account.status === "disabled") {
    return (
      <>
        <strong>Wise ID 登录尚未开放</strong>
        <p>当前公开的市场行情、计算工具和合约课程无需登录即可使用。</p>
      </>
    );
  }

  if (account.status === "error") {
    return (
      <>
        <strong>暂时无法确认登录状态</strong>
        <p>公开功能不受影响，请稍后刷新页面重试。</p>
      </>
    );
  }

  return (
    <>
      <strong>使用主站 Wise ID 登录</strong>
      <p>登录后会自动识别普通用户或 VIP 用户，不需要重新注册账号。</p>
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
  if (
    candidate.status === "authenticated" &&
    (candidate.tier === "regular" || candidate.tier === "vip") &&
    (candidate.membershipTier === "MEMBER" ||
      candidate.membershipTier === "VIP" ||
      candidate.membershipTier === "VIP_PLUS") &&
    typeof candidate.label === "string" &&
    (candidate.displayName === null ||
      typeof candidate.displayName === "string")
  ) {
    return {
      status: "authenticated",
      displayName: candidate.displayName,
      label: candidate.label,
      membershipTier: candidate.membershipTier,
      tier: candidate.tier,
    };
  }

  return { status: "error" };
}
