import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "人工策略发布台",
  description: "Wise Crypto 本地私有人工策略编辑与复核入口。",
  alternates: { canonical: null },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false, noarchive: true },
  },
  openGraph: null,
  twitter: null,
};

export default function StrategyStudioLayout({
  children,
}: LayoutProps<"/studio/strategies">) {
  return children;
}
