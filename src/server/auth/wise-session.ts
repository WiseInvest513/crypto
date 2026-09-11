import "server-only";

import { auth } from "@/auth";
import {
  formatWiseMembershipLabel,
  mapWiseMembershipToUserTier,
  readWiseMembershipTier,
  type WiseMembershipTier,
} from "@/lib/auth/wise-membership";
import { isWiseAuthConfigured } from "@/server/auth/wise-auth-config";
import { isWiseLocalDevelopmentRequest } from "@/server/auth/wise-local-development";
import type { IdentityPrincipal } from "@/server/access/resolve-user-access";
import { isWiseIdentityFresh } from "@/lib/auth/wise-session-policy";

export type WiseAuthenticationSource = "wise-id" | "local-development";

export type WiseAccountSummary = Readonly<{
  authenticationSource: WiseAuthenticationSource;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean | null;
  imageUrl: string | null;
  label: ReturnType<typeof formatWiseMembershipLabel>;
  membershipAccessFresh: boolean;
  membershipTier: WiseMembershipTier;
  principal: IdentityPrincipal;
  wiseId: string;
}>;

export type WiseAccountState =
  | Readonly<{ status: "anonymous" | "disabled" | "error" }>
  | Readonly<{ status: "authenticated"; account: WiseAccountSummary }>;

export async function resolveWiseAccount(): Promise<WiseAccountSummary | null> {
  const result = await resolveWiseAccountState();
  return result.status === "authenticated" ? result.account : null;
}

export async function resolveWiseAccountState(): Promise<WiseAccountState> {
  if (await isWiseLocalDevelopmentRequest()) {
    return Object.freeze({
      status: "authenticated",
      account: LOCAL_DEVELOPMENT_ACCOUNT,
    });
  }

  if (!isWiseAuthConfigured()) return Object.freeze({ status: "disabled" });

  try {
    const session = await auth();
    const subject = readSafeSubject(session?.user?.id);
    const wiseId = readSafeSubject(session?.user?.wiseId) ?? subject;
    const membershipTier = readWiseMembershipTier(
      session?.user?.membershipTier,
    );
    const mappedTier = mapWiseMembershipToUserTier(membershipTier);

    if (!session) return Object.freeze({ status: "anonymous" });
    if (!subject || !wiseId || !membershipTier || !mappedTier) {
      return Object.freeze({ status: "error" });
    }

    // The local identity can remain signed in for 3 / 7 days, but a private
    // VIP entitlement is only trusted while the upstream Wise ID proof is
    // fresh. Regular access does not depend on an elevated entitlement.
    const membershipAccessFresh = mappedTier !== "vip" || isWiseIdentityFresh(
      session.user?.wiseIdentityExpiresAt,
    );
    const tier = mappedTier === "vip" && !membershipAccessFresh
      ? "regular"
      : mappedTier;

    return Object.freeze({
      status: "authenticated",
      account: Object.freeze({
        authenticationSource: "wise-id",
        displayName: readDisplayName(session.user?.name),
        email: readSafeEmail(session.user?.email),
        emailVerified: readOptionalBoolean(session.user?.wiseEmailVerified),
        imageUrl: readSafeImageUrl(session.user?.image),
        label: formatWiseMembershipLabel(membershipTier),
        membershipAccessFresh,
        membershipTier,
        principal: Object.freeze({ subject, tier }),
        wiseId,
      }),
    });
  } catch {
    return Object.freeze({ status: "error" });
  }
}

const LOCAL_DEVELOPMENT_ACCOUNT: WiseAccountSummary = Object.freeze({
  authenticationSource: "local-development",
  displayName: "本地开发用户",
  email: null,
  emailVerified: null,
  imageUrl: null,
  label: formatWiseMembershipLabel("MEMBER"),
  membershipAccessFresh: true,
  membershipTier: "MEMBER",
  principal: Object.freeze({
    subject: "local-development",
    tier: "regular",
  }),
  wiseId: "LOCAL-DEVELOPMENT",
});

function readSafeSubject(value: unknown): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function readDisplayName(value: unknown): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 120 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function readSafeEmail(value: unknown): string | null {
  return typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 320 &&
    value.trim() === value &&
    value.includes("@") &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readSafeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
