import type { Metadata } from "next";
import { SITE_NAME } from "@/config/site";

export const SITE_SOCIAL_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Wise Crypto 加密市场工作台",
} as const;

type PageMetadataInput = Readonly<{
  title: string;
  description: string;
  path: `/${string}` | "/";
  socialTitle?: string;
  useSiteImage?: boolean;
}>;

/**
 * Next.js replaces nested metadata objects instead of deeply merging them.
 * This helper keeps canonical, Open Graph, and X metadata complete on every
 * public route while allowing item/detail pages to clear the shared site card.
 */
export function createPageMetadata({
  title,
  description,
  path,
  socialTitle = title,
  useSiteImage = false,
}: PageMetadataInput): Metadata {
  const images = useSiteImage ? [SITE_SOCIAL_IMAGE] : [];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      locale: "zh_CN",
      title: socialTitle,
      description,
      images,
    },
    twitter: {
      card: useSiteImage ? "summary_large_image" : "summary",
      title: socialTitle,
      description,
      images,
    },
  };
}

export function createProtectedPageMetadata(
  input: PageMetadataInput,
): Metadata {
  return {
    ...createPageMetadata(input),
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      googleBot: { index: false, follow: false, noarchive: true },
    },
  };
}

export function createNotFoundMetadata(): Metadata {
  return {
    title: "页面未找到",
    description: "找不到你请求的 Wise Crypto 页面。",
    alternates: { canonical: null },
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "zh_CN",
      title: "页面未找到",
      description: "找不到你请求的 Wise Crypto 页面。",
      images: [],
    },
    twitter: {
      card: "summary",
      title: "页面未找到",
      description: "找不到你请求的 Wise Crypto 页面。",
      images: [],
    },
  };
}
