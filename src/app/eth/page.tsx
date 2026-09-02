import type { Metadata } from "next";
import { AssetDetailStreamPage } from "@/components/assets/asset-detail-page";
import {
  loadAssetChartSnapshot,
  loadAssetContextSnapshot,
  loadAssetLiveChartDatum,
  loadAssetPriceDatum,
} from "@/server/data/services/market-data-service";
import { loadAssetEditorial } from "@/server/editorial/asset-editorial-service";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "以太坊（ETH）",
  description:
    "Wise Crypto 以太坊工作台：ETH 价格、日线、MA20、MA50、ETH/BTC、衍生品数据与人工审核情景。",
  path: "/eth",
  socialTitle: "以太坊（ETH）市场工作台",
});

export default function EthereumPage() {
  const price = loadAssetPriceDatum("eth");
  const chart = loadAssetChartSnapshot("eth");
  const liveChart = loadAssetLiveChartDatum("eth");
  const context = loadAssetContextSnapshot("eth");
  const { config, now } = loadAssetEditorial("eth");

  return (
    <AssetDetailStreamPage
      asset="eth"
      price={price}
      chart={chart}
      liveChart={liveChart}
      context={context}
      editorial={config}
      editorialNow={now}
    />
  );
}
