"use client";

import { useEffect, useRef } from "react";
import {
  productAnalytics,
  type ProductAnalytics,
  type ProductAnalyticsSourcePage,
  type ProductViewContext,
} from "@/lib/analytics/product-analytics";

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

  useEffect(() => {
    const context = {
      slug,
      placement: "product_detail",
      sourcePage,
      contentVersion,
    } as const;
    trackProductViewOnce(trackedKey, context, productAnalytics);
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
