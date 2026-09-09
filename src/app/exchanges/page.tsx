import type { Metadata } from "next";
import { ExchangeOnboarding } from "@/components/exchanges/exchange-onboarding";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "交易所开户与返佣",
  description:
    "集中进入 Binance、OKX、Bitget、Bybit 与 Gate 主站教程、当前返佣入口和 Wise VIP 申请说明。",
  path: "/exchanges",
  useSiteImage: true,
});

export default async function ExchangesPage() {
  await requireWisePageAccount("/exchanges");

  return <ExchangeOnboarding />;
}
