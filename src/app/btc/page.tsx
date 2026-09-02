import type { Metadata } from "next";
import { AssetDetailStreamPage } from "@/components/assets/asset-detail-page";
import {
  loadAssetChartSnapshot,
  loadAssetContextSnapshot,
  loadAssetLiveChartDatum,
  loadAssetPriceDatum,
} from "@/server/data/services/market-data-service";
import { loadAssetEditorialForAccess } from "@/server/editorial/asset-editorial-service";
import { createPageMetadata } from "@/lib/seo/page-metadata";
import { resolveUserAccess } from "@/server/access/resolve-user-access";
import { loadAssetMultiTimeframeForAccess } from "@/server/data/services/multi-timeframe-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "比特币（BTC）",
  description:
    "Wise Crypto 比特币工作台：BTC 价格、实时 K 线、EMA、VIP 多周期客观参考、衍生品数据与人工审核情景。",
  path: "/btc",
  socialTitle: "比特币（BTC）市场工作台",
});

export default function BitcoinPage() {
  const access = resolveUserAccess();
  const price = loadAssetPriceDatum("btc");
  const chart = loadAssetChartSnapshot("btc");
  const liveChart = loadAssetLiveChartDatum("btc");
  const context = loadAssetContextSnapshot("btc");
  const editorial = loadAssetEditorialForAccess("btc", access);
  const multiTimeframe = loadAssetMultiTimeframeForAccess("btc", access);

  return (
    <AssetDetailStreamPage
      asset="btc"
      price={price}
      chart={chart}
      liveChart={liveChart}
      context={context}
      editorial={editorial}
      access={access}
      multiTimeframe={multiTimeframe}
    />
  );
}
