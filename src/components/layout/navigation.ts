export const navigation = [
  { href: "/", label: "市场总览" },
  { href: "/btc", label: "行情" },
  { href: "/tools", label: "工具" },
] as const;

export function isCurrentRoute(pathname: string, href: string) {
  if (href === "/btc") {
    return ["/btc", "/eth"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
  }

  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
