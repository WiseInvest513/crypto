import type { Metadata } from "next";
import { MarketWorkbenchPage } from "@/components/assets/market-workbench-page";
import { loadAssetLiveChartDatum } from "@/server/data/services/market-data-service";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "比特币（BTC）",
  description: "Wise Crypto 比特币行情：实时价格、K 线与 EMA 对比、近期历史情景、支撑压力参考、成交密集区估算和多周期结构。",
  path: "/btc",
  socialTitle: "比特币（BTC）行情工作台",
});

export default async function AssetPage() {
  await requireWisePageAccount("/btc");
  const liveChart = loadAssetLiveChartDatum("btc");
  return <MarketWorkbenchPage asset="btc" liveChart={liveChart} />;
}
