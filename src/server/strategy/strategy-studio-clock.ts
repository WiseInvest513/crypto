import "server-only";

/** Captures request time outside the React render purity boundary. */
export function captureStrategyStudioNow(): number {
  return Date.now();
}
