export type UserTier = "regular" | "vip";

export type UserAccess = Readonly<{
  tier: UserTier;
  isAuthenticated: boolean;
  source: "anonymous-default" | "verified-identity";
}>;

/**
 * Product capabilities are named once here so route components do not grow
 * their own, subtly different VIP checks.
 */
export type FeatureKey =
  | "market.public"
  | "tools.public"
  | "analysis.publicResearch"
  | "analysis.privateMultiTimeframe"
  | "analysis.aiDrawdown"
  | "analysis.cycleMarkers"
  | "editorial.tradeStrategy";

const REGULAR_FEATURES: readonly FeatureKey[] = Object.freeze([
  "market.public",
  "tools.public",
  "analysis.publicResearch",
]);

const VIP_FEATURES: readonly FeatureKey[] = Object.freeze([
  ...REGULAR_FEATURES,
  "analysis.privateMultiTimeframe",
  "analysis.aiDrawdown",
  "analysis.cycleMarkers",
  "editorial.tradeStrategy",
]);

const FEATURES_BY_TIER: Readonly<Record<UserTier, readonly FeatureKey[]>> =
  Object.freeze({
    regular: REGULAR_FEATURES,
    vip: VIP_FEATURES,
  });

export const ANONYMOUS_USER_ACCESS: UserAccess = Object.freeze({
  tier: "regular",
  isAuthenticated: false,
  source: "anonymous-default",
});

/**
 * UI visibility may use this helper, but protected server resources must run
 * the same check again after resolving access through the server adapter.
 */
export function canAccessFeature(
  access: UserAccess,
  feature: FeatureKey,
): boolean {
  const tier = readTier(access);
  return tier === null ? false : FEATURES_BY_TIER[tier].includes(feature);
}

function readTier(access: UserAccess): UserTier | null {
  if (typeof access !== "object" || access === null) {
    return null;
  }

  if (
    access.isAuthenticated === true &&
    access.source === "verified-identity" &&
    (access.tier === "regular" || access.tier === "vip")
  ) {
    return access.tier;
  }

  if (
    access.tier === "regular" &&
    access.isAuthenticated === false &&
    access.source === "anonymous-default"
  ) {
    return "regular";
  }

  return null;
}
