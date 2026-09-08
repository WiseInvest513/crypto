import type { Metadata } from "next";
import { MarketWorkbenchPage } from "@/components/assets/market-workbench-page";
import { loadAssetLiveChartDatum } from "@/server/data/services/market-data-service";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "以太坊（ETH）",
  description: "Wise Crypto 以太坊行情：实时价格、K 线与 EMA 对比、近期历史情景、支撑压力参考、成交密集区估算和多周期结构。",
  path: "/eth",
  socialTitle: "以太坊（ETH）行情工作台",
});

export default function AssetPage() {
  const liveChart = loadAssetLiveChartDatum("eth");
  return <MarketWorkbenchPage asset="eth" liveChart={liveChart} />;
}
