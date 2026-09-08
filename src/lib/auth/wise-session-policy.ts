export function readWiseIdentityExpiresAt(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : null;
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
