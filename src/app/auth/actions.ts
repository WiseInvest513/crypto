"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { signIn, signOut } from "@/auth";
import { normalizeAuthReturnTo } from "@/lib/auth/auth-return-to";
import {
  isWiseAuthConfigured,
  WISE_AUTH_PROVIDER_ID,
} from "@/server/auth/wise-auth-config";
import { saveWiseSessionDurationPreference } from "@/server/auth/wise-session-preference";

export async function startWiseSignIn(formData: FormData): Promise<void> {
  const returnTo = normalizeAuthReturnTo(formData.get("returnTo"));
  if (!isWiseAuthConfigured()) {
    redirect(
      `/auth/error?error=Configuration&returnTo=${encodeURIComponent(returnTo)}` as Route,
    );
  }

  await saveWiseSessionDurationPreference(
    formData.get("sessionDuration") === "remember-seven-days"
      ? "remember-seven-days"
      : "default",
  );
  await signIn(WISE_AUTH_PROVIDER_ID, { redirectTo: returnTo });
}

export async function endWiseSession(formData: FormData): Promise<void> {
  normalizeAuthReturnTo(formData.get("returnTo"));
  if (!isWiseAuthConfigured()) redirect("/");

  await signOut({ redirectTo: "/" });
}
