import type { UserTier } from "@/lib/access/user-access";

export const WISE_MEMBERSHIP_TIERS = ["MEMBER", "VIP", "VIP_PLUS"] as const;

export type WiseMembershipTier = (typeof WISE_MEMBERSHIP_TIERS)[number];

export function readWiseMembershipTier(
  value: unknown,
): WiseMembershipTier | null {
  return typeof value === "string" &&
    WISE_MEMBERSHIP_TIERS.includes(value as WiseMembershipTier)
    ? (value as WiseMembershipTier)
    : null;
}

export function mapWiseMembershipToUserTier(
  value: unknown,
): UserTier | null {
  const membership = readWiseMembershipTier(value);
  if (membership === "MEMBER") return "regular";
  if (membership === "VIP" || membership === "VIP_PLUS") return "vip";
  return null;
}

export function formatWiseMembershipLabel(
  value: WiseMembershipTier,
): "普通用户" | "VIP 用户" | "VIP+ 用户" {
  if (value === "VIP_PLUS") return "VIP+ 用户";
  if (value === "VIP") return "VIP 用户";
  return "普通用户";
}
