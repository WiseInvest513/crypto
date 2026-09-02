import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ANONYMOUS_USER_ACCESS,
  canAccessFeature,
  type FeatureKey,
  type UserAccess,
} from "../../src/lib/access/user-access";
import {
  anonymousIdentityAdapter,
  resolveUserAccess,
  type IdentityAdapter,
} from "../../src/server/access/resolve-user-access";

const PUBLIC_FEATURES = ["market.public", "tools.public"] as const;
const VIP_FEATURES = [
  "analysis.multiTimeframe",
  "analysis.aiDrawdown",
  "analysis.cycleMarkers",
  "editorial.tradeStrategy",
] as const;
const ALL_FEATURES: readonly FeatureKey[] = [
  ...PUBLIC_FEATURES,
  ...VIP_FEATURES,
];
const VERIFIED_REGULAR_ACCESS: UserAccess = Object.freeze({
  tier: "regular",
  isAuthenticated: true,
  source: "verified-identity",
});
const VERIFIED_VIP_ACCESS: UserAccess = Object.freeze({
  tier: "vip",
  isAuthenticated: true,
  source: "verified-identity",
});

describe("user access policy", () => {
  it("keeps public market and tool capabilities available to both tiers", () => {
    for (const feature of PUBLIC_FEATURES) {
      expect(canAccessFeature(ANONYMOUS_USER_ACCESS, feature)).toBe(true);
      expect(canAccessFeature(VERIFIED_REGULAR_ACCESS, feature)).toBe(true);
      expect(canAccessFeature(VERIFIED_VIP_ACCESS, feature)).toBe(true);
    }
  });

  it("reserves premium analysis and editorial capabilities for VIP", () => {
    for (const feature of VIP_FEATURES) {
      expect(canAccessFeature(ANONYMOUS_USER_ACCESS, feature)).toBe(false);
      expect(canAccessFeature(VERIFIED_REGULAR_ACCESS, feature)).toBe(false);
      expect(canAccessFeature(VERIFIED_VIP_ACCESS, feature)).toBe(true);
    }
  });

  it("accepts the minimal UserAccess DTO without requiring identity details", () => {
    const access: UserAccess = Object.freeze({
      tier: "vip",
      isAuthenticated: true,
      source: "verified-identity",
    });

    for (const feature of ALL_FEATURES) {
      expect(canAccessFeature(access, feature)).toBe(true);
    }
  });

  it("fails closed for malformed runtime values", () => {
    expect(
      canAccessFeature(
        { tier: "admin" } as unknown as UserAccess,
        "editorial.tradeStrategy",
      ),
    ).toBe(false);
    expect(
      canAccessFeature(
        VERIFIED_VIP_ACCESS,
        "editorial.unregistered" as unknown as FeatureKey,
      ),
    ).toBe(false);
    expect(
      canAccessFeature(
        {
          tier: "vip",
          isAuthenticated: false,
          source: "anonymous-default",
        } as UserAccess,
        "editorial.tradeStrategy",
      ),
    ).toBe(false);
    expect(
      canAccessFeature(
        {
          tier: "vip",
          isAuthenticated: true,
          source: "anonymous-default",
        } as UserAccess,
        "analysis.aiDrawdown",
      ),
    ).toBe(false);
  });
});

describe("server user access resolution", () => {
  it("defaults to an immutable anonymous regular user", async () => {
    const access = await resolveUserAccess();

    expect(access).toBe(ANONYMOUS_USER_ACCESS);
    expect(access).toEqual({
      tier: "regular",
      isAuthenticated: false,
      source: "anonymous-default",
    });
    expect(Object.isFrozen(access)).toBe(true);
  });

  it("keeps the explicit anonymous adapter fail-closed", async () => {
    await expect(resolveUserAccess(anonymousIdentityAdapter)).resolves.toBe(
      ANONYMOUS_USER_ACCESS,
    );
  });

  it.each(["regular", "vip"] as const)(
    "accepts a verified %s principal and returns only the access DTO",
    async (tier) => {
      const resolveIdentity = vi.fn(async () => ({
        subject: "wise-id-user-123",
        tier,
        rawToken: "must-not-cross-the-boundary",
      }));

      const access = await resolveUserAccess({ resolveIdentity });

      expect(resolveIdentity).toHaveBeenCalledTimes(1);
      expect(access).toEqual({
        tier,
        isAuthenticated: true,
        source: "verified-identity",
      });
      expect(access).not.toHaveProperty("subject");
      expect(access).not.toHaveProperty("rawToken");
      expect(Object.isFrozen(access)).toBe(true);
    },
  );

  it.each([
    null,
    undefined,
    "vip",
    {},
    { subject: "", tier: "vip" },
    { subject: " padded ", tier: "vip" },
    { subject: "user\nname", tier: "vip" },
    { subject: "user-1", tier: "admin" },
  ])("fails closed for an unverified identity payload: %j", async (payload) => {
    const adapter: IdentityAdapter = {
      resolveIdentity: async () => payload,
    };

    await expect(resolveUserAccess(adapter)).resolves.toBe(
      ANONYMOUS_USER_ACCESS,
    );
  });

  it("fails closed when the future identity provider is unavailable", async () => {
    const adapter: IdentityAdapter = {
      resolveIdentity: async () => {
        throw new Error("identity provider unavailable");
      },
    };

    await expect(resolveUserAccess(adapter)).resolves.toBe(
      ANONYMOUS_USER_ACCESS,
    );
  });

  it("has no client-controlled or environment-based VIP override", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/server/access/resolve-user-access.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(
      /(?:from\s+["']next\/headers|process\.env|globalThis\.(?:localStorage|sessionStorage)|NEXT_PUBLIC_)/,
    );
  });
});
