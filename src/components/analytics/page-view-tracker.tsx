"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  isStaticPageViewPath,
  pageAnalytics,
  type PageAnalytics,
} from "@/lib/analytics/page-analytics";

export function PageViewTracker() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    trackPageViewOnce(previousPath, pathname);
  }, [pathname]);

  return null;
}

export function trackPageViewOnce(
  previousPath: { current: string | null },
  pathname: string,
  analytics: Pick<PageAnalytics, "trackPageView"> = pageAnalytics,
) {
  if (previousPath.current === pathname) {
    return;
  }

  previousPath.current = pathname;
  if (!isStaticPageViewPath(pathname)) {
    return;
  }

  analytics.trackPageView(pathname);
}
