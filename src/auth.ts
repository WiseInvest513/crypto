import NextAuth, { customFetch, type NextAuthConfig } from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import { readWiseMembershipTier } from "@/lib/auth/wise-membership";
import {
  isWiseIdentityFresh,
  readWiseIdentityExpiresAt,
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
    maxAge: 60 * 60,
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
        token.wiseMembershipTier = parsedProfile.membershipTier;
        token.wiseIdentityExpiresAt = identityExpiresAt;
      }

      if (!isWiseIdentityFresh(token.wiseIdentityExpiresAt)) return null;
      return token;
    },
    async session({ session, token }) {
      const membershipTier = readWiseMembershipTier(
        token.wiseMembershipTier,
      );
      const subject = readSafeSubject(token.wiseSubject);

      if (session.user && subject && membershipTier) {
        session.user.id = subject;
        session.user.membershipTier = membershipTier;
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
