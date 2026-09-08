import "server-only";

export const STRATEGY_STUDIO_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:2222",
  "http://127.0.0.1:2222",
] as const);

export type StrategyStudioRequestHeaders = Readonly<{
  origin: string | null;
  host: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}>;

/**
 * Server Actions receive framework-level Origin/Host validation too. This
 * second, application-level check deliberately permits only the local studio
 * origins and rejects ambiguous proxy headers.
 */
export function assertStrategyStudioMutationOrigin(
  request: StrategyStudioRequestHeaders,
): void {
  if (
    request.origin === null ||
    request.host === null ||
    request.origin === "null" ||
    request.host.includes(",") ||
    request.forwardedHost?.includes(",") ||
    request.forwardedProto?.includes(",")
  ) {
    throw new Error("STRATEGY_STUDIO_INVALID_ORIGIN");
  }

  let origin: URL;
  try {
    origin = new URL(request.origin);
  } catch {
    throw new Error("STRATEGY_STUDIO_INVALID_ORIGIN");
  }

  if (
    !STRATEGY_STUDIO_ALLOWED_ORIGINS.includes(
      origin.origin as (typeof STRATEGY_STUDIO_ALLOWED_ORIGINS)[number],
    ) ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== "" ||
    request.host !== origin.host
  ) {
    throw new Error("STRATEGY_STUDIO_INVALID_ORIGIN");
  }

  if (
    request.forwardedHost !== undefined &&
    request.forwardedHost !== null &&
    request.forwardedHost !== origin.host
  ) {
    throw new Error("STRATEGY_STUDIO_INVALID_ORIGIN");
  }

  if (
    request.forwardedProto !== undefined &&
    request.forwardedProto !== null &&
    request.forwardedProto !== origin.protocol.slice(0, -1)
  ) {
    throw new Error("STRATEGY_STUDIO_INVALID_ORIGIN");
  }
}
