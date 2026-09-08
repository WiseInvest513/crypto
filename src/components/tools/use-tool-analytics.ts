"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  toolAnalytics,
  type ToolAnalytics,
  type ToolAnalyticsSlug,
  type ToolAnalyticsSourcePage,
} from "@/lib/analytics/tool-analytics";

const CONTENT_VERSION = "wise-crypto-v0-phase5" as const;

type ToolAnalyticsMethods = Pick<
  ToolAnalytics,
  "trackToolOpen" | "trackToolComplete"
>;

type ToolOpenTracker = {
  current: string | null;
};

export function useToolAnalytics(
  toolSlug: ToolAnalyticsSlug,
  sourcePage: ToolAnalyticsSourcePage,
) {
  const opened = useRef<string | null>(null);

  useEffect(() => {
    trackToolOpenOnce(opened, toolSlug, sourcePage);
  }, [sourcePage, toolSlug]);

  return useCallback(() => {
    trackToolCompletion(toolSlug, sourcePage);
  }, [sourcePage, toolSlug]);
}

/** Tracks one open for each concrete tool page without accepting calculator data. */
export function trackToolOpenOnce(
  tracked: ToolOpenTracker,
  toolSlug: ToolAnalyticsSlug,
  sourcePage: ToolAnalyticsSourcePage,
  analytics: ToolAnalyticsMethods = toolAnalytics,
): void {
  const key = `${toolSlug}:${sourcePage}:${CONTENT_VERSION}`;
  if (tracked.current === key) return;
  tracked.current = key;

  try {
    analytics.trackToolOpen({
      toolSlug,
      placement: "tool_page",
      sourcePage,
      contentVersion: CONTENT_VERSION,
    });
  } catch {
    // A tracking implementation must never prevent the calculator from opening.
  }
}

/** Tracks a successful calculation with fixed, non-financial metadata only. */
export function trackToolCompletion(
  toolSlug: ToolAnalyticsSlug,
  sourcePage: ToolAnalyticsSourcePage,
  analytics: ToolAnalyticsMethods = toolAnalytics,
): void {
  try {
    analytics.trackToolComplete({
      toolSlug,
      placement: "calculator_form",
      sourcePage,
      contentVersion: CONTENT_VERSION,
    });
  } catch {
    // A tracking implementation must never interrupt a successful calculation.
  }
}
