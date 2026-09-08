import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import {
  resolveWiseAccountState,
  type WiseAccountSummary,
} from "@/server/auth/wise-session";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function requireWisePageAccount(
  returnTo: Route,
): Promise<WiseAccountSummary> {
  const state = await resolveWiseAccountState();
  if (state.status === "authenticated") return state.account;

  const encodedReturnTo = encodeURIComponent(returnTo);
  if (state.status === "anonymous") {
    redirect(`/auth/sign-in?returnTo=${encodedReturnTo}` as Route);
  }

  redirect(
    `/auth/error?error=Configuration&returnTo=${encodedReturnTo}` as Route,
  );
}

export async function requireWiseApiAccount(): Promise<Response | null> {
  const state = await resolveWiseAccountState();
  if (state.status === "authenticated") return null;

  if (state.status === "anonymous") {
    return Response.json(
      {
        error: "authentication_required",
        message: "请先使用 Wise ID 登录后再查看行情或使用工具。",
      },
      { status: 401, headers: privateHeaders },
    );
  }

  return Response.json(
    {
      error: "authentication_unavailable",
      message: "Wise ID 登录服务暂时不可用，请稍后重试。",
    },
    { status: 503, headers: privateHeaders },
  );
}
