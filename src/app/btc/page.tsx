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
  title: "比特币（BTC）",
  description:
    "Wise Crypto 比特币工作台：BTC 价格、日线、MA20、MA50、衍生品数据、市场背景与人工审核情景。",
  path: "/btc",
  socialTitle: "比特币（BTC）市场工作台",
});

export default function BitcoinPage() {
  const price = loadAssetPriceDatum("btc");
  const chart = loadAssetChartSnapshot("btc");
  const liveChart = loadAssetLiveChartDatum("btc");
  const context = loadAssetContextSnapshot("btc");
  const { config, now } = loadAssetEditorial("btc");

  return (
    <AssetDetailStreamPage
      asset="btc"
      price={price}
      chart={chart}
      liveChart={liveChart}
      context={context}
      editorial={config}
      editorialNow={now}
    />
  );
}
