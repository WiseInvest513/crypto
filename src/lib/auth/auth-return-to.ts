import type { Route } from "next";

const SAFE_RETURN_ROOTS = [
  "/btc",
  "/eth",
  "/exchanges",
  "/learn",
  "/tools",
  "/account",
] as const;

export function normalizeAuthReturnTo(value: unknown): Route {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return "/";
  }

  try {
    const base = new URL("https://crypto.wise-invest.org");
    const target = new URL(value, base);
    const isSafePath =
      target.pathname === "/" ||
      SAFE_RETURN_ROOTS.some(
        (root) =>
          target.pathname === root || target.pathname.startsWith(`${root}/`),
      );

    if (target.origin !== base.origin || !isSafePath) return "/";

    return `${target.pathname}${target.search}` as Route;
  } catch {
    return "/";
  }
}
