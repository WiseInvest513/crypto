import type { Metadata } from "next";
import { Suspense } from "react";
import { DcaCalculator } from "@/components/tools/dca-calculator";
import { ResultEmpty } from "@/components/tools/calculator-ui";
import { ToolPageShell } from "@/components/tools/tool-page-shell";
import { getToolDefinition } from "@/lib/tools/catalog";
import {
  parseToolAsset,
  type ToolAssetSlug,
  type ToolPageSearchParams,
} from "@/lib/tools/tool-navigation";
import { getDcaMarketHistory } from "@/server/tools/dca-history-service";
import { createPageMetadata } from "@/lib/seo/page-metadata";

const tool = getToolDefinition("dca");

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "历史 DCA 定投计算器",
  description:
    "基于 BTC 或 ETH 的已闭合 UTC 日线，回看定期投入、累计数量、平均成本与期末表现。",
  path: tool.href,
  socialTitle: "历史 DCA 定投计算器｜Wise Crypto",
});

export default async function DcaToolPage({
  searchParams,
}: {
  searchParams: Promise<ToolPageSearchParams>;
}) {
  const asset = parseToolAsset((await searchParams).asset);

  return (
    <ToolPageShell asset={asset} tool={tool}>
      <Suspense fallback={<DcaLoadingState />}>
        <DcaCalculatorWithData initialAsset={asset} />
      </Suspense>
    </ToolPageShell>
  );
}

async function DcaCalculatorWithData({
  initialAsset,
}: {
  initialAsset: ToolAssetSlug | null;
}) {
  const datasets = await getDcaMarketHistory();

  return (
    <DcaCalculator
      datasets={datasets}
      initialAsset={initialAsset ?? undefined}
      key={initialAsset ?? "btc"}
    />
  );
}

function DcaLoadingState() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <ResultEmpty>正在加载 BTC 与 ETH 的已闭合日线数据…</ResultEmpty>
    </div>
  );
}
