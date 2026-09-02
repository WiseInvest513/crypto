export const navigation = [
  { href: "/", label: "市场总览" },
  { href: "/btc", label: "BTC" },
  { href: "/eth", label: "ETH" },
  { href: "/tools", label: "工具" },
] as const;

export function isCurrentRoute(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
