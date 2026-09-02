"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  productAnalytics,
  type ProductAnalyticsPlacement,
  type ProductAnalyticsSourcePage,
} from "@/lib/analytics/product-analytics";

type ReferralLinkProps = Readonly<{
  href: string;
  slug: string;
  placement: ProductAnalyticsPlacement;
  sourcePage: ProductAnalyticsSourcePage;
  contentVersion: string;
  children: ReactNode;
}> &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "children" | "download" | "href" | "onClick" | "ping" | "rel" | "target"
  >;

export function ReferralLink({
  href,
  slug,
  placement,
  sourcePage,
  contentVersion,
  children,
  ...anchorProps
}: ReferralLinkProps) {
  if (!isSafeExternalUrl(href)) {
    return null;
  }

  return (
    <a
      {...anchorProps}
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      onClick={() => {
        productAnalytics.trackReferralClick({
          slug,
          placement,
          sourcePage,
          contentVersion,
        });
      }}
    >
      {children}
      <span className="sr-only">（在新标签页打开）</span>
    </a>
  );
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}
