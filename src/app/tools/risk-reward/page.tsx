import type { Metadata } from "next";
import { RiskRewardCalculator } from "@/components/tools/risk-reward-calculator";
import { ToolPageShell } from "@/components/tools/tool-page-shell";
import { getToolDefinition } from "@/lib/tools/catalog";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

const tool = getToolDefinition("risk-reward");

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "风险回报计算器",
  description:
    "校验做多或做空的入场价、止损价与目标价顺序，计算每单位风险、潜在回报和风险回报比。",
  path: tool.href,
  socialTitle: "风险回报计算器｜Wise Crypto",
});

export default async function RiskRewardToolPage() {
  await requireWisePageAccount("/tools/risk-reward");
  return (
    <ToolPageShell tool={tool}>
      <RiskRewardCalculator />
    </ToolPageShell>
  );
}
