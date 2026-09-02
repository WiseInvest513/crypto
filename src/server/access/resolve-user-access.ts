import "server-only";

import {
  ANONYMOUS_USER_ACCESS,
  type UserAccess,
  type UserTier,
} from "../../lib/access/user-access";

/**
 * The future Wise ID adapter must return only a verified, stable subject and
 * its server-authoritative tier. Raw tokens and profile data do not cross this
 * boundary.
 */
export type IdentityPrincipal = Readonly<{
  subject: string;
  tier: UserTier;
}>;

export interface IdentityAdapter {
  resolveIdentity(): Promise<unknown>;
}

/**
 * Production-safe default while Wise ID is not connected. This intentionally
 * has no query-string, storage, cookie, header, or environment override.
 */
export const anonymousIdentityAdapter: IdentityAdapter = Object.freeze({
  resolveIdentity: async () => null,
});

export async function resolveUserAccess(
  adapter: IdentityAdapter = anonymousIdentityAdapter,
): Promise<UserAccess> {
  let principal: unknown;

  try {
    principal = await adapter.resolveIdentity();
  } catch {
    return ANONYMOUS_USER_ACCESS;
  }

  if (!isIdentityPrincipal(principal)) {
    return ANONYMOUS_USER_ACCESS;
  }

  return Object.freeze({
    tier: principal.tier,
    isAuthenticated: true,
    source: "verified-identity",
  });
}

function isIdentityPrincipal(value: unknown): value is IdentityPrincipal {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isSafeSubject(candidate.subject) &&
    (candidate.tier === "regular" || candidate.tier === "vip")
  );
}

function isSafeSubject(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}
