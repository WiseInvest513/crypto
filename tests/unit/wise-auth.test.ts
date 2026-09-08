import { describe, expect, it } from "vitest";
import { normalizeAuthReturnTo } from "@/lib/auth/auth-return-to";
import {
  formatWiseMembershipLabel,
  mapWiseMembershipToUserTier,
  readWiseMembershipTier,
} from "@/lib/auth/wise-membership";
import {
  isWiseIdentityFresh,
  readWiseIdentityExpiresAt,
} from "@/lib/auth/wise-session-policy";
import {
  getWiseAuthConfigurationStatus,
  resolveWiseAuthConfiguration,
  resolveWiseDiscoveryRequestUrl,
  WISE_AUTH_CALLBACK_PATH,
  WISE_AUTH_CLIENT_ID,
  WISE_AUTH_DISCOVERY_URL,
  WISE_AUTH_ISSUER_DISCOVERY_URL,
  WISE_AUTH_ISSUER,
  WISE_AUTH_LOCAL_ORIGIN,
  WISE_AUTH_SCOPE,
} from "@/server/auth/wise-auth-config";
import { parseWiseOidcProfile } from "@/server/auth/wise-profile";

const AUTH_SECRET = "session-secret-that-is-longer-than-thirty-two-characters";
const CLIENT_SECRET = "wsec_client-secret-longer-than-thirty-two-characters";

function validEnvironment(vercelEnvironment?: "production" | "preview") {
  return {
    AUTH_SECRET,
    WISE_AUTH_CLIENT_SECRET: CLIENT_SECRET,
    ...(vercelEnvironment ? { VERCEL_ENV: vercelEnvironment } : {}),
  };
}

describe("Wise membership mapping", () => {
  it.each([
    ["MEMBER", "regular", "普通用户"],
    ["VIP", "vip", "VIP 用户"],
    ["VIP_PLUS", "vip", "VIP+ 用户"],
  ] as const)("maps %s through the centralized access policy", (raw, tier, label) => {
    const membership = readWiseMembershipTier(raw);
    expect(membership).toBe(raw);
    expect(mapWiseMembershipToUserTier(raw)).toBe(tier);
    expect(formatWiseMembershipLabel(raw)).toBe(label);
  });

  it.each([null, undefined, "", "vip", "ADMIN", 1])(
    "fails closed for an unknown membership claim: %j",
    (value) => {
      expect(readWiseMembershipTier(value)).toBeNull();
      expect(mapWiseMembershipToUserTier(value)).toBeNull();
    },
  );
});

describe("Wise OIDC configuration", () => {
  it("rewrites only Auth.js' exact apex discovery request", () => {
    expect(
      resolveWiseDiscoveryRequestUrl(WISE_AUTH_ISSUER_DISCOVERY_URL),
    ).toBe(WISE_AUTH_DISCOVERY_URL);
    expect(
      resolveWiseDiscoveryRequestUrl("https://example.com/.well-known/openid-configuration"),
    ).toBe("https://example.com/.well-known/openid-configuration");
  });

  it("enables auth from two server-only secrets and fails closed for a partial pair", () => {
    expect(getWiseAuthConfigurationStatus({})).toBe("disabled");
    expect(
      getWiseAuthConfigurationStatus({ AUTH_SECRET }),
    ).toBe("misconfigured");
    expect(
      getWiseAuthConfigurationStatus({
        WISE_AUTH_CLIENT_SECRET: CLIENT_SECRET,
      }),
    ).toBe("misconfigured");
    expect(getWiseAuthConfigurationStatus(validEnvironment())).toBe("ready");
  });

  it("derives the fixed local client and callback without public environment variables", () => {
    expect(resolveWiseAuthConfiguration(validEnvironment())).toEqual(
      expect.objectContaining({
        authUrl: WISE_AUTH_LOCAL_ORIGIN,
        callbackUrl: `${WISE_AUTH_LOCAL_ORIGIN}${WISE_AUTH_CALLBACK_PATH}`,
        clientId: WISE_AUTH_CLIENT_ID,
        issuer: WISE_AUTH_ISSUER,
        discoveryUrl: WISE_AUTH_DISCOVERY_URL,
        scope: WISE_AUTH_SCOPE,
      }),
    );
  });

  it("derives the fixed production origin and disables Vercel previews", () => {
    expect(resolveWiseAuthConfiguration(validEnvironment("production"))).toEqual(
      expect.objectContaining({
        authUrl: "https://crypto.wise-invest.org",
        callbackUrl:
          "https://crypto.wise-invest.org/api/auth/callback/wise",
      }),
    );
    expect(resolveWiseAuthConfiguration(validEnvironment("preview"))).toBeNull();
    expect(getWiseAuthConfigurationStatus(validEnvironment("preview"))).toBe(
      "disabled",
    );
  });

  it.each([
    { AUTH_SECRET: "too-short" },
    { WISE_AUTH_CLIENT_SECRET: "too-short" },
  ])("rejects an invalid server-only secret: %j", (change) => {
    expect(
      resolveWiseAuthConfiguration({ ...validEnvironment(), ...change }),
    ).toBeNull();
  });
});

describe("Wise identity profile parsing", () => {
  it("keeps only verified identity fields", () => {
    expect(
      parseWiseOidcProfile({
        sub: "Y123456789",
        wise_user_id: "Y123456789",
        email: "member@example.com",
        email_verified: true,
        name: "Wise Member",
        picture: "https://www.wise-invest.org/avatar.png",
        membership_tier: "VIP_PLUS",
        access_token: "must-not-be-copied",
      }),
    ).toEqual({
      id: "Y123456789",
      email: "member@example.com",
      image: "https://www.wise-invest.org/avatar.png",
      name: "Wise Member",
      membershipTier: "VIP_PLUS",
      wiseEmailVerified: true,
      wiseId: "Y123456789",
    });
  });

  it.each([
    null,
    {},
    { sub: "Y123", membership_tier: "ADMIN" },
    { sub: "Y123", wise_user_id: "Y999", membership_tier: "VIP" },
    { sub: " bad ", membership_tier: "MEMBER" },
  ])("rejects unverifiable OIDC claims: %j", (profile) => {
    expect(() => parseWiseOidcProfile(profile)).toThrow();
  });
});

describe("post-authentication return paths", () => {
  it.each([
    ["/", "/"],
    ["/btc", "/btc"],
    ["/eth?interval=4h", "/eth?interval=4h"],
    ["/tools/futures-intro", "/tools/futures-intro"],
    ["/account", "/account"],
  ])("keeps an internal public path %s", (value, expected) => {
    expect(normalizeAuthReturnTo(value)).toBe(expected);
  });

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/studio/strategies",
    "/api/account",
    "/products",
    "/btc\nSet-Cookie:test=1",
    "",
    null,
  ])("rejects an unsafe return target: %j", (value) => {
    expect(normalizeAuthReturnTo(value)).toBe("/");
  });
});

describe("Wise session lifetime", () => {
  const now = Date.UTC(2026, 8, 8, 10, 0, 0);
  const nowSeconds = Math.floor(now / 1_000);

  it("uses the provider deadline instead of a sliding local session", () => {
    expect(isWiseIdentityFresh(nowSeconds + 3_600, now)).toBe(true);
    expect(isWiseIdentityFresh(nowSeconds, now)).toBe(false);
    expect(isWiseIdentityFresh(nowSeconds - 1, now)).toBe(false);
  });

  it.each([null, undefined, 0, -1, 1.5, Number.NaN, "123"])(
    "fails closed for an invalid provider deadline: %j",
    (value) => {
      expect(readWiseIdentityExpiresAt(value)).toBeNull();
      expect(isWiseIdentityFresh(value, now)).toBe(false);
    },
  );
});
