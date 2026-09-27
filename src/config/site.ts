export const SITE_NAME = "Wise Crypto";
export const PRODUCTION_SITE_URL = "https://crypto.wise-invest.org";
export const WISE_INVEST_SITE_URL = "https://www.wise-invest.org/";
export const WISE_INVEST_CRYPTO_PERKS_URL =
  "https://www.wise-invest.org/perk/crypto";
export const WISE_INVEST_ACCOUNT_URL = "https://www.wise-invest.org/account";
export const WISE_INVEST_VIP_URL = "https://www.wise-invest.org/vip";
export const WISE_INVEST_EXCHANGE_REFERRAL_GUIDE_URL =
  "https://www.wise-invest.org/guide/exchange-referral";

export function resolveSiteUrl(
  value: string | undefined = process.env.SITE_URL,
  environment: string | undefined = process.env.VERCEL_ENV,
): string {
  const candidate = value?.trim() || PRODUCTION_SITE_URL;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("SITE_URL must be a valid absolute HTTPS origin.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error(
      "SITE_URL must be a plain HTTPS origin without credentials, path, query, or hash.",
    );
  }

  if (environment === "production" && parsed.origin !== PRODUCTION_SITE_URL) {
    throw new Error(
      `Production SITE_URL must remain fixed at ${PRODUCTION_SITE_URL}.`,
    );
  }

  return parsed.origin;
}

export const SITE_URL = resolveSiteUrl();

export const PUBLIC_ROUTES = ["/"] as const;

export const AUTHENTICATED_ROUTES = [
  "/btc",
  "/eth",
  "/exchanges",
  "/learn",
  "/learn/futures-intro",
  "/tools",
  "/tools/position-size",
  "/tools/leverage",
  "/tools/dca",
  "/tools/risk-reward",
  "/account",
] as const;

export function isPublicIndexingEnabled(
  environment: string | undefined = process.env.VERCEL_ENV,
  siteUrl: string = SITE_URL,
) {
  return environment === "production" && siteUrl === PRODUCTION_SITE_URL;
}
