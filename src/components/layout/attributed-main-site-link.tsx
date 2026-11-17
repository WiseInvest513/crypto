"use client";

import { usePathname } from "next/navigation";
import { isMainSiteUrl, withMainSiteAttribution } from "@/lib/auth/main-site-attribution";

type AttributedMainSiteLinkProps = React.ComponentProps<"a"> & {
  href: string;
  campaignPath?: string;
};

export function AttributedMainSiteLink({ href, campaignPath, ...props }: AttributedMainSiteLinkProps) {
  const pathname = usePathname() || "/";
  const resolved = isMainSiteUrl(href) ? withMainSiteAttribution(href, campaignPath ?? pathname) : href;
  return <a href={resolved} {...props} />;
}
