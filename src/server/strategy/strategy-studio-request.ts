import "server-only";

import { cookies, headers } from "next/headers";
import {
  loadStrategyStudioRuntimeConfig,
  type StrategyStudioRuntimeConfig,
} from "./staff-runtime-config";
import {
  deriveStrategyStudioCsrfToken,
  STRATEGY_STUDIO_SESSION_COOKIE_NAME,
  verifyStrategyStudioCsrfToken,
  verifyStrategyStudioSessionToken,
  type StrategyStudioSession,
} from "./staff-session";
import { assertStrategyStudioMutationOrigin } from "./strategy-studio-origin";

export type StrategyStudioPageSession = Readonly<{
  config: Extract<StrategyStudioRuntimeConfig, { enabled: true }>;
  session: StrategyStudioSession;
  csrfToken: string;
}>;

export type StrategyStudioMutationSession = StrategyStudioPageSession &
  Readonly<{ sessionToken: string }>;

export async function readStrategyStudioPageSession(
  config: StrategyStudioRuntimeConfig = loadStrategyStudioRuntimeConfig(),
): Promise<StrategyStudioPageSession | null> {
  if (!config.enabled) return null;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    STRATEGY_STUDIO_SESSION_COOKIE_NAME,
  )?.value;
  const session = verifyStrategyStudioSessionToken(
    sessionToken,
    config.sessionKey,
  );
  if (session === null || !matchesCurrentStaffConfig(session, config)) {
    return null;
  }

  return {
    config,
    session,
    csrfToken: deriveStrategyStudioCsrfToken(sessionToken!, config.sessionKey),
  };
}

export async function requireStrategyStudioMutationSession(
  csrfToken: unknown,
): Promise<StrategyStudioMutationSession> {
  const requestHeaders = await headers();
  assertStrategyStudioMutationOrigin({
    origin: requestHeaders.get("origin"),
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  });

  const config = loadStrategyStudioRuntimeConfig();
  if (!config.enabled) throw new Error("STRATEGY_STUDIO_DISABLED");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(
    STRATEGY_STUDIO_SESSION_COOKIE_NAME,
  )?.value;
  const session = verifyStrategyStudioSessionToken(
    sessionToken,
    config.sessionKey,
  );
  if (
    session === null ||
    sessionToken === undefined ||
    !matchesCurrentStaffConfig(session, config) ||
    !verifyStrategyStudioCsrfToken(
      csrfToken,
      sessionToken,
      config.sessionKey,
    )
  ) {
    throw new Error("STRATEGY_STUDIO_UNAUTHORIZED");
  }

  return {
    config,
    session,
    sessionToken,
    csrfToken: csrfToken as string,
  };
}

function matchesCurrentStaffConfig(
  session: StrategyStudioSession,
  config: Extract<StrategyStudioRuntimeConfig, { enabled: true }>,
): boolean {
  const configured = config[session.role];
  return (
    session.subject === configured.subject &&
    session.displayName === configured.displayName
  );
}
