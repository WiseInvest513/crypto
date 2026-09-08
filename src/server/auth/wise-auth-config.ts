import "server-only";

import { PRODUCTION_SITE_URL } from "@/config/site";

export const WISE_AUTH_PROVIDER_ID = "wise";
export const WISE_AUTH_CLIENT_ID = "wise_crypto";
export const WISE_AUTH_ISSUER = "https://wise-invest.org";
export const WISE_AUTH_DISCOVERY_URL =
  "https://www.wise-invest.org/.well-known/openid-configuration";
export const WISE_AUTH_ISSUER_DISCOVERY_URL =
  `${WISE_AUTH_ISSUER}/.well-known/openid-configuration` as const;
export const WISE_AUTH_SCOPE = "openid profile email wise.membership";
export const WISE_AUTH_CALLBACK_PATH =
  `/api/auth/callback/${WISE_AUTH_PROVIDER_ID}` as const;
export const WISE_AUTH_LOCAL_ORIGIN = "http://127.0.0.1:2222";

export type WiseAuthConfiguration = Readonly<{
  authUrl: string;
  callbackUrl: string;
  clientId: typeof WISE_AUTH_CLIENT_ID;
  clientSecret: string;
  discoveryUrl: typeof WISE_AUTH_DISCOVERY_URL;
  issuer: typeof WISE_AUTH_ISSUER;
  scope: typeof WISE_AUTH_SCOPE;
  sessionSecret: string;
}>;

export type WiseAuthConfigurationStatus = "disabled" | "misconfigured" | "ready";

type WiseAuthEnvironment = Readonly<{
  AUTH_SECRET?: string;
  VERCEL_ENV?: string;
  WISE_AUTH_CLIENT_SECRET?: string;
  [key: string]: string | undefined;
}>;

export function resolveWiseAuthConfiguration(
  environment: WiseAuthEnvironment = process.env,
): WiseAuthConfiguration | null {
  if (isNonProductionVercelEnvironment(environment)) return null;

  const sessionSecret = environment.AUTH_SECRET?.trim();
  const clientSecret = environment.WISE_AUTH_CLIENT_SECRET?.trim();

  if (
    !sessionSecret ||
    sessionSecret.length < 32 ||
    !clientSecret ||
    clientSecret.length < 32
  ) {
    return null;
  }

  const authUrl =
    environment.VERCEL_ENV === "production"
      ? PRODUCTION_SITE_URL
      : WISE_AUTH_LOCAL_ORIGIN;

  return Object.freeze({
    authUrl,
    callbackUrl: `${authUrl}${WISE_AUTH_CALLBACK_PATH}`,
    clientId: WISE_AUTH_CLIENT_ID,
    clientSecret,
    discoveryUrl: WISE_AUTH_DISCOVERY_URL,
    issuer: WISE_AUTH_ISSUER,
    scope: WISE_AUTH_SCOPE,
    sessionSecret,
  });
}

export function isWiseAuthConfigured(
  environment: WiseAuthEnvironment = process.env,
): boolean {
  return resolveWiseAuthConfiguration(environment) !== null;
}

export function getWiseAuthConfigurationStatus(
  environment: WiseAuthEnvironment = process.env,
): WiseAuthConfigurationStatus {
  if (isNonProductionVercelEnvironment(environment)) return "disabled";

  const sessionSecret = environment.AUTH_SECRET?.trim();
  const clientSecret = environment.WISE_AUTH_CLIENT_SECRET?.trim();
  if (!sessionSecret && !clientSecret) return "disabled";

  return resolveWiseAuthConfiguration(environment) ? "ready" : "misconfigured";
}

/**
 * Auth.js currently derives discovery from `issuer` even when `wellKnown` is
 * supplied. Wise ID deliberately publishes an apex issuer but serves its
 * metadata on `www`, so rewrite only that one exact metadata request.
 */
export function resolveWiseDiscoveryRequestUrl(requestUrl: string): string {
  return requestUrl === WISE_AUTH_ISSUER_DISCOVERY_URL
    ? WISE_AUTH_DISCOVERY_URL
    : requestUrl;
}

function isNonProductionVercelEnvironment(
  environment: WiseAuthEnvironment,
): boolean {
  return Boolean(
    environment.VERCEL_ENV && environment.VERCEL_ENV !== "production",
  );
}
