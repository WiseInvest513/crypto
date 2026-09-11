import NextAuth, { customFetch, type NextAuthConfig } from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import { readWiseMembershipTier } from "@/lib/auth/wise-membership";
import {
  createWiseSessionExpiresAt,
  isWiseIdentityFresh,
  isWiseSessionFresh,
  readWiseIdentityExpiresAt,
  WISE_SESSION_REMEMBERED_SECONDS,
} from "@/lib/auth/wise-session-policy";
import {
  resolveWiseAuthConfiguration,
  resolveWiseDiscoveryRequestUrl,
  WISE_AUTH_PROVIDER_ID,
} from "@/server/auth/wise-auth-config";
import {
  parseWiseOidcProfile,
  type WiseOidcProfile,
} from "@/server/auth/wise-profile";
import { readWiseSessionDurationPreference } from "@/server/auth/wise-session-preference";

const configuration = resolveWiseAuthConfiguration();

// Auth.js reads AUTH_URL directly when it builds its OAuth callback. Keep the
// public origin in versioned server code so Vercel only needs the two secrets.
if (configuration) process.env.AUTH_URL = configuration.authUrl;

const providers: NextAuthConfig["providers"] = configuration
  ? [createWiseProvider(configuration)]
  : [];

const authConfig = {
  providers,
  secret: configuration?.sessionSecret,
  session: {
    strategy: "jwt",
    maxAge: WISE_SESSION_REMEMBERED_SECONDS,
  },
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, profile, account }) {
      if (user && profile) {
        const parsedProfile = parseWiseOidcProfile(profile);
        const identityExpiresAt = readWiseIdentityExpiresAt(
          account?.expires_at,
        );
        if (!isWiseIdentityFresh(identityExpiresAt)) return null;

        token.wiseSubject = parsedProfile.id;
        token.wiseUserId = parsedProfile.wiseId;
        token.wiseDisplayName = parsedProfile.name;
        token.wiseEmail = parsedProfile.email;
        token.wiseEmailVerified = parsedProfile.wiseEmailVerified;
        token.wiseImage = parsedProfile.image;
        token.wiseMembershipTier = parsedProfile.membershipTier;
        token.wiseIdentityExpiresAt = identityExpiresAt;
        token.wiseSessionExpiresAt = createWiseSessionExpiresAt(
          await readWiseSessionDurationPreference(),
        ) ?? undefined;
      }

      if (!isWiseSessionFresh(token.wiseSessionExpiresAt)) return null;
      return token;
    },
    async session({ session, token }) {
      const membershipTier = readWiseMembershipTier(
        token.wiseMembershipTier,
      );
      const subject = readSafeSubject(token.wiseSubject);
      const wiseId = readSafeSubject(token.wiseUserId) ?? subject;

      if (session.user && subject && wiseId && membershipTier) {
        const email = readSafeString(token.wiseEmail, 320);
        session.user.id = subject;
        session.user.wiseId = wiseId;
        session.user.name = readSafeString(token.wiseDisplayName, 120);
        if (email) session.user.email = email;
        session.user.wiseEmailVerified = readOptionalBoolean(
          token.wiseEmailVerified,
        );
        session.user.image = readSafeUrl(token.wiseImage);
        session.user.membershipTier = membershipTier;
        session.user.wiseIdentityExpiresAt = readWiseIdentityExpiresAt(
          token.wiseIdentityExpiresAt,
        ) ?? undefined;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

export const {
  handlers: wiseAuthHandlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

function createWiseProvider(
  config: NonNullable<typeof configuration>,
): OIDCConfig<WiseOidcProfile> {
  return {
    id: WISE_AUTH_PROVIDER_ID,
    name: "Wise ID",
    type: "oidc",
    issuer: config.issuer,
    wellKnown: config.discoveryUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    client: {
      token_endpoint_auth_method: "client_secret_basic",
    },
    authorization: {
      params: {
        scope: config.scope,
      },
    },
    checks: ["pkce", "state", "nonce"],
    idToken: false,
    profile: parseWiseOidcProfile,
    [customFetch]: createWiseOidcFetch(),
  };
}

function createWiseOidcFetch(): typeof fetch {
  return (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const resolvedUrl = resolveWiseDiscoveryRequestUrl(requestUrl);

    return resolvedUrl === requestUrl
      ? globalThis.fetch(input, init)
      : globalThis.fetch(resolvedUrl, init);
  };
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

function readSafeString(value: unknown, maximumLength: number): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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
