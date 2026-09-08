"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PublicChromeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isPrivateStudioPath(pathname) ? null : children;
}

export function isPrivateStudioPath(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}
