import type { Route } from "next";
import type { ToolSlug } from "./catalog";

export const toolAssetSlugs = ["btc", "eth"] as const;

export type ToolAssetSlug = (typeof toolAssetSlugs)[number];

export type ToolPageSearchParams = {
  asset?: string | string[];
};

export type ToolNextStep = {
  href: Route;
  label: string;
  description: string;
};

const NEXT_TOOL_STEPS: Readonly<
  Record<
    Exclude<ToolSlug, "dca">,
    readonly (Omit<ToolNextStep, "href"> & { slug: ToolSlug })[]
  >
> = {
  "position-size": [
    {
      slug: "risk-reward",
      label: "检查风险回报",
      description: "用你自行输入的入场、止损和目标价比较价格距离。",
    },
    {
      slug: "leverage",
      label: "估算保证金",
      description: "用名义仓位与杠杆倍数拆解保证金和方向盈亏。",
    },
  ],
  leverage: [
    {
      slug: "position-size",
      label: "计算仓位风险",
      description: "按账户风险预算反推资产数量与名义仓位。",
    },
    {
      slug: "risk-reward",
      label: "检查风险回报",
      description: "单独比较入场、止损与目标价之间的价格距离。",
    },
  ],
  "risk-reward": [
    {
      slug: "position-size",
      label: "计算仓位风险",
      description: "按账户风险预算反推资产数量与名义仓位。",
    },
  ],
};

export function parseToolAsset(value: unknown): ToolAssetSlug | null {
  return value === "btc" || value === "eth" ? value : null;
}

export function getToolAssetLabel(asset: ToolAssetSlug): "BTC" | "ETH" {
  return asset === "btc" ? "BTC" : "ETH";
}

export function getToolNextSteps(
  toolSlug: ToolSlug,
  asset: ToolAssetSlug | null,
): readonly ToolNextStep[] {
  if (toolSlug === "dca") {
    const assets = asset ? [asset] : toolAssetSlugs;

    return assets.map((candidate) => {
      const label = getToolAssetLabel(candidate);
      return {
        href: `/${candidate}` as Route,
        label: asset ? `返回 ${label} 资产工作台` : `查看 ${label} 资产工作台`,
        description: `继续查看 ${label} 的市场价格、已闭合日线与长期结构。`,
      };
    });
  }

  return NEXT_TOOL_STEPS[toolSlug].map(({ slug, ...step }) => ({
    ...step,
    href: withToolAsset(`/tools/${slug}`, asset),
  }));
}

function withToolAsset(
  href: `/tools/${ToolSlug}`,
  asset: ToolAssetSlug | null,
): Route {
  return (asset ? `${href}?asset=${asset}` : href) as Route;
}
