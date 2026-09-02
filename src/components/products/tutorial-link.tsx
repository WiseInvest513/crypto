"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  productAnalytics,
  type ProductAnalyticsSourcePage,
} from "@/lib/analytics/product-analytics";

type TutorialLinkProps = Readonly<{
  href: string;
  slug: string;
  sourcePage: ProductAnalyticsSourcePage;
  contentVersion: string;
  children: ReactNode;
}> &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "children" | "download" | "href" | "onClick" | "ping" | "rel" | "target"
  >;

export function TutorialLink({
  href,
  slug,
  sourcePage,
  contentVersion,
  children,
  ...anchorProps
}: TutorialLinkProps) {
  if (!isSafeExternalUrl(href)) {
    return null;
  }

  return (
    <a
      {...anchorProps}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        productAnalytics.trackTutorialClick({
          slug,
          placement: "product_detail",
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
