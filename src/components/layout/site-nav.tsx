"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentRoute, navigation } from "./navigation";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="primary-nav" aria-label="主导航">
      <ul>
        {navigation.map((item) => {
          const isCurrent = isCurrentRoute(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
