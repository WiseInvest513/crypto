export function readWiseIdentityExpiresAt(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : null;
}

export const WISE_SESSION_DEFAULT_SECONDS = 3 * 24 * 60 * 60;
export const WISE_SESSION_REMEMBERED_SECONDS = 7 * 24 * 60 * 60;

export type WiseSessionDuration = "default" | "remember-seven-days";

export function readWiseSessionDuration(value: unknown): WiseSessionDuration {
  return value === "remember-seven-days" ? value : "default";
}

export function createWiseSessionExpiresAt(
  duration: unknown,
  nowMilliseconds: number = Date.now(),
): number | null {
  if (!Number.isFinite(nowMilliseconds) || nowMilliseconds < 0) return null;
  const lifetime = readWiseSessionDuration(duration) === "remember-seven-days"
    ? WISE_SESSION_REMEMBERED_SECONDS
    : WISE_SESSION_DEFAULT_SECONDS;
  return Math.floor(nowMilliseconds / 1_000) + lifetime;
}

export function isWiseSessionFresh(
  expiresAt: unknown,
  nowMilliseconds: number = Date.now(),
): boolean {
  const deadline = readWiseIdentityExpiresAt(expiresAt);
  return (
    deadline !== null &&
    Number.isFinite(nowMilliseconds) &&
    Math.floor(nowMilliseconds / 1_000) < deadline
  );
}

export function isWiseIdentityFresh(
  expiresAt: unknown,
  nowMilliseconds: number = Date.now(),
): boolean {
  const deadline = readWiseIdentityExpiresAt(expiresAt);
  return (
    deadline !== null &&
    Number.isFinite(nowMilliseconds) &&
    Math.floor(nowMilliseconds / 1_000) < deadline
  );
}
