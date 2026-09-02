import type { Metadata } from "next";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import {
  isPublicIndexingEnabled,
  SITE_NAME,
  SITE_URL,
} from "@/config/site";
import { SITE_SOCIAL_IMAGE } from "@/lib/seo/page-metadata";
import "./globals.css";

const siteUrl = new URL(SITE_URL);
const isProduction = isPublicIndexingEnabled();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Wise Crypto",
  title: {
    default: "Wise Crypto — 加密市场工作台",
    template: "%s | Wise Crypto",
  },
  description:
    "面向加密市场用户的市场数据、人工审核背景、实用工具与产品指南工作台。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wise Crypto",
    locale: "zh_CN",
    title: "Wise Crypto — 加密市场工作台",
    description:
      "清晰查看加密市场数据、市场结构与经过人工审核的背景信息。",
    images: [SITE_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wise Crypto — 加密市场工作台",
    description:
      "清晰查看加密市场数据、市场结构与经过人工审核的背景信息。",
    images: [SITE_SOCIAL_IMAGE],
  },
  robots: {
    index: isProduction,
    follow: isProduction,
    googleBot: { index: isProduction, follow: isProduction },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "zh-CN",
    description:
      "面向加密市场用户的市场数据、实用工具与客观产品指南工作台。",
  } as const;

  return (
    <html lang="zh-CN">
      <body>
        <JsonLd data={websiteJsonLd} />
        <PageViewTracker />
        <a className="skip-link" href="#main-content">
          跳转到主要内容
        </a>
        <div className="site-shell">
          <SiteHeader />
          <main id="main-content" className="site-main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
