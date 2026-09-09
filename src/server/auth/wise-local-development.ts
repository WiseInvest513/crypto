import "server-only";

import { headers } from "next/headers";

const LOCAL_DEVELOPMENT_HOSTS = new Set([
  "127.0.0.1:2222",
  "localhost:2222",
]);

const DEPLOYMENT_ENVIRONMENT_KEYS = [
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "CF_PAGES",
  "CF_PAGES_URL",
  "NETLIFY",
  "AWS_EXECUTION_ENV",
  "AWS_LAMBDA_FUNCTION_NAME",
] as const;

export type WiseLocalDevelopmentEnvironment = Readonly<
  Partial<
    Record<(typeof DEPLOYMENT_ENVIRONMENT_KEYS)[number], string | undefined>
  > & {
    NODE_ENV?: string;
  }
>;

export async function isWiseLocalDevelopmentRequest(
  environment: WiseLocalDevelopmentEnvironment = process.env,
): Promise<boolean> {
  if (!isLocalDevelopmentRuntime(environment)) return false;

  try {
    return isWiseLocalDevelopmentRequestInput(await headers(), environment);
  } catch {
    return false;
  }
}

export function isWiseLocalDevelopmentRequestInput(
  requestHeaders: Pick<Headers, "get">,
  environment: WiseLocalDevelopmentEnvironment,
): boolean {
  if (!isLocalDevelopmentRuntime(environment)) return false;

  const host = readSingleHeaderValue(requestHeaders.get("host"));
  if (!host || !LOCAL_DEVELOPMENT_HOSTS.has(host.toLowerCase())) return false;

  const forwardedHostValue = requestHeaders.get("x-forwarded-host");
  if (forwardedHostValue !== null) {
    const forwardedHost = readSingleHeaderValue(forwardedHostValue);
    if (!forwardedHost || forwardedHost.toLowerCase() !== host.toLowerCase()) {
      return false;
    }
  }

  const forwardedProtocolValue = requestHeaders.get("x-forwarded-proto");
  if (forwardedProtocolValue !== null) {
    const forwardedProtocol = readSingleHeaderValue(forwardedProtocolValue);
    if (forwardedProtocol?.toLowerCase() !== "http") return false;
  }

  const forwardedPortValue = requestHeaders.get("x-forwarded-port");
  if (forwardedPortValue !== null) {
    const forwardedPort = readSingleHeaderValue(forwardedPortValue);
    if (forwardedPort !== "2222") return false;
  }

  return requestHeaders.get("forwarded") === null;
}

function isLocalDevelopmentRuntime(
  environment: WiseLocalDevelopmentEnvironment,
): boolean {
  return (
    environment.NODE_ENV === "development" &&
    DEPLOYMENT_ENVIRONMENT_KEYS.every(
      (key) => !environment[key]?.trim(),
    )
  );
}

function readSingleHeaderValue(value: string | null): string | null {
  if (
    value === null ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes(",") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }

  return value;
}
