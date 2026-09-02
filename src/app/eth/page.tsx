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
  title: "以太坊（ETH）",
  description:
    "Wise Crypto 以太坊工作台：ETH 价格、实时 K 线、EMA、VIP 多周期客观参考、ETH/BTC 与人工审核情景。",
  path: "/eth",
  socialTitle: "以太坊（ETH）市场工作台",
});

export default function EthereumPage() {
  const access = resolveUserAccess();
  const price = loadAssetPriceDatum("eth");
  const chart = loadAssetChartSnapshot("eth");
  const liveChart = loadAssetLiveChartDatum("eth");
  const context = loadAssetContextSnapshot("eth");
  const editorial = loadAssetEditorialForAccess("eth", access);
  const multiTimeframe = loadAssetMultiTimeframeForAccess("eth", access);

  return (
    <AssetDetailStreamPage
      asset="eth"
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
