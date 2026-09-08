import "server-only";

import type { User } from "next-auth";
import {
  readWiseMembershipTier,
  type WiseMembershipTier,
} from "@/lib/auth/wise-membership";

export type WiseOidcProfile = Readonly<{
  sub?: unknown;
  wise_user_id?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
  membership_tier?: unknown;
}>;

export type WiseAuthUser = User &
  Readonly<{
    id: string;
    membershipTier: WiseMembershipTier;
    wiseEmailVerified: boolean | null;
    wiseId: string;
  }>;

export function parseWiseOidcProfile(profile: unknown): WiseAuthUser {
  if (typeof profile !== "object" || profile === null) {
    throw new TypeError("Wise ID returned an invalid profile.");
  }

  const candidate = profile as WiseOidcProfile;
  const subject = readSafeString(candidate.sub, 128);
  const wiseUserId = readSafeString(candidate.wise_user_id, 128);
  const membershipTier = readWiseMembershipTier(candidate.membership_tier);

  if (
    !subject ||
    (wiseUserId !== null && wiseUserId !== subject) ||
    membershipTier === null
  ) {
    throw new TypeError("Wise ID returned unverifiable identity claims.");
  }

  return {
    id: subject,
    email: readSafeString(candidate.email, 320),
    image: readSafeUrl(candidate.picture),
    name: readSafeString(candidate.name, 120),
    membershipTier,
    wiseEmailVerified: readOptionalBoolean(candidate.email_verified),
    wiseId: wiseUserId ?? subject,
  };
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readSafeString(value: unknown, maximumLength: number): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }
  return value;
}

function readSafeUrl(value: unknown): string | null {
  const candidate = readSafeString(value, 2_048);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
