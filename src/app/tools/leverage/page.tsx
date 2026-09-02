import type { Metadata } from "next";
import { LeverageCalculator } from "@/components/tools/leverage-calculator";
import { ToolPageShell } from "@/components/tools/tool-page-shell";
import { getToolDefinition } from "@/lib/tools/catalog";
import { createPageMetadata } from "@/lib/seo/page-metadata";

const tool = getToolDefinition("leverage");

export const metadata: Metadata = createPageMetadata({
  title: "杠杆与盈亏计算器",
  description:
    "估算杠杆交易的仓位数量、初始保证金、方向盈亏与 ROE，并说明交易所强平规则差异。",
  path: tool.href,
  socialTitle: "杠杆与盈亏计算器｜Wise Crypto",
});

export default function LeverageToolPage() {
  return (
    <ToolPageShell tool={tool}>
      <LeverageCalculator />
    </ToolPageShell>
  );
}
