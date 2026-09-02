import type { Metadata } from "next";
import { PositionSizeCalculator } from "@/components/tools/position-size-calculator";
import { ToolPageShell } from "@/components/tools/tool-page-shell";
import { getToolDefinition } from "@/lib/tools/catalog";
import { createPageMetadata } from "@/lib/seo/page-metadata";

const tool = getToolDefinition("position-size");

export const metadata: Metadata = createPageMetadata({
  title: "仓位风险计算器",
  description:
    "根据账户余额、最大风险比例、入场价与止损价，估算风险预算、资产数量和名义仓位。",
  path: tool.href,
  socialTitle: "仓位风险计算器｜Wise Crypto",
});

export default function PositionSizeToolPage() {
  return (
    <ToolPageShell tool={tool}>
      <PositionSizeCalculator />
    </ToolPageShell>
  );
}
