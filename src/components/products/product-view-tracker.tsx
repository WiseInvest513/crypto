"use client";

import { useEffect, useRef } from "react";
import {
  productAnalytics,
  type ProductAnalytics,
  type ProductAnalyticsSourcePage,
  type ProductViewContext,
} from "@/lib/analytics/product-analytics";
import {
  pageAnalytics,
  type PageAnalytics,
} from "@/lib/analytics/page-analytics";

type ProductViewTrackerProps = Readonly<{
  slug: string;
  sourcePage: ProductAnalyticsSourcePage;
  contentVersion: string;
}>;

export function ProductViewTracker({
  slug,
  sourcePage,
  contentVersion,
}: ProductViewTrackerProps) {
  const trackedKey = useRef<string | null>(null);
  const trackedPageKey = useRef<string | null>(null);

  useEffect(() => {
    const context = {
      slug,
      placement: "product_detail",
      sourcePage,
      contentVersion,
    } as const;
    trackProductViewOnce(trackedKey, context, productAnalytics);
    trackProductPageViewOnce(trackedPageKey, context, pageAnalytics);
  }, [contentVersion, slug, sourcePage]);

  return null;
}

export function trackProductViewOnce(
  trackedKey: { current: string | null },
  context: ProductViewContext,
  analytics: Pick<ProductAnalytics, "trackProductView"> = productAnalytics,
): void {
  const nextKey = `${context.slug}:${context.contentVersion}`;
  if (trackedKey.current === nextKey) {
    return;
  }

  trackedKey.current = nextKey;
  analytics.trackProductView(context);
}

export function trackProductPageViewOnce(
  trackedKey: { current: string | null },
  context: Pick<ProductViewContext, "slug" | "contentVersion">,
  analytics: Pick<PageAnalytics, "trackPageView"> = pageAnalytics,
): void {
  const nextKey = `${context.slug}:${context.contentVersion}`;
  if (trackedKey.current === nextKey) {
    return;
  }

  trackedKey.current = nextKey;
  analytics.trackPageView(`/products/${context.slug}`);
}
