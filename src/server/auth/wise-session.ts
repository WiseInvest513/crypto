import "server-only";

import { auth } from "@/auth";
import {
  formatWiseMembershipLabel,
  mapWiseMembershipToUserTier,
  readWiseMembershipTier,
  type WiseMembershipTier,
} from "@/lib/auth/wise-membership";
import { isWiseAuthConfigured } from "@/server/auth/wise-auth-config";
import type { IdentityPrincipal } from "@/server/access/resolve-user-access";

export type WiseAccountSummary = Readonly<{
  displayName: string | null;
  label: ReturnType<typeof formatWiseMembershipLabel>;
  membershipTier: WiseMembershipTier;
  principal: IdentityPrincipal;
}>;

export type WiseAccountState =
  | Readonly<{ status: "anonymous" | "disabled" | "error" }>
  | Readonly<{ status: "authenticated"; account: WiseAccountSummary }>;

export async function resolveWiseAccount(): Promise<WiseAccountSummary | null> {
  const result = await resolveWiseAccountState();
  return result.status === "authenticated" ? result.account : null;
}

export async function resolveWiseAccountState(): Promise<WiseAccountState> {
  if (!isWiseAuthConfigured()) return Object.freeze({ status: "disabled" });

  try {
    const session = await auth();
    const subject = readSafeSubject(session?.user?.id);
    const membershipTier = readWiseMembershipTier(
      session?.user?.membershipTier,
    );
    const tier = mapWiseMembershipToUserTier(membershipTier);

    if (!session) return Object.freeze({ status: "anonymous" });
    if (!subject || !membershipTier || !tier) {
      return Object.freeze({ status: "error" });
    }

    return Object.freeze({
      status: "authenticated",
      account: Object.freeze({
        displayName: readDisplayName(session.user?.name),
        label: formatWiseMembershipLabel(membershipTier),
        membershipTier,
        principal: Object.freeze({ subject, tier }),
      }),
    });
  } catch {
    return Object.freeze({ status: "error" });
  }
}

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
