"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  toolAnalytics,
  type ToolAnalyticsSlug,
  type ToolAnalyticsSourcePage,
} from "@/lib/analytics/tool-analytics";

const CONTENT_VERSION = "wise-crypto-v0-phase5" as const;

export function useToolAnalytics(
  toolSlug: ToolAnalyticsSlug,
  sourcePage: ToolAnalyticsSourcePage,
) {
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    toolAnalytics.trackToolOpen({
      toolSlug,
      placement: "tool_page",
      sourcePage,
      contentVersion: CONTENT_VERSION,
    });
  }, [sourcePage, toolSlug]);

  return useCallback(() => {
    toolAnalytics.trackToolComplete({
      toolSlug,
      placement: "calculator_form",
      sourcePage,
      contentVersion: CONTENT_VERSION,
    });
  }, [sourcePage, toolSlug]);
}
