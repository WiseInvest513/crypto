import type { Metadata } from "next";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PublicChromeBoundary } from "@/components/layout/public-chrome-boundary";
import { JsonLd } from "@/components/seo/json-ld";
import {
  isPublicIndexingEnabled,
  SITE_NAME,
  SITE_URL,
} from "@/config/site";
import { SITE_SOCIAL_IMAGE } from "@/lib/seo/page-metadata";
import { THEME_INITIALIZATION_SCRIPT } from "@/lib/theme/theme-preference";
import "./globals.css";
import "./market-workbench.css";

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
    "Wise Crypto 把行情、风险工具、合约学习与开户福利，整理成一套清晰、可执行的加密市场工作台。",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wise Crypto",
    locale: "zh_CN",
    title: "Wise Crypto — 加密市场工作台",
    description:
      "看懂加密市场，再决定下一步。行情、风险工具、合约学习与开户路径，一站清晰整理。",
    images: [SITE_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wise Crypto — 加密市场工作台",
    description:
      "看懂加密市场，再决定下一步。行情、风险工具、合约学习与开户路径，一站清晰整理。",
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
      "面向加密市场用户的行情观察、风险工具、合约学习与开户路径工作台。",
  } as const;

  return (
    <html
      lang="zh-CN"
      data-theme="light"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          id="wise-crypto-theme-initializer"
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }}
        />
      </head>
      <body>
        <JsonLd data={websiteJsonLd} />
        <PageViewTracker />
        <a className="skip-link" href="#main-content">
          跳转到主要内容
        </a>
        <div className="site-shell">
          <PublicChromeBoundary>
            <SiteHeader />
          </PublicChromeBoundary>
          <main id="main-content" className="site-main" tabIndex={-1}>
            {children}
          </main>
          <PublicChromeBoundary>
            <SiteFooter />
          </PublicChromeBoundary>
        </div>
      </body>
    </html>
  );
}
