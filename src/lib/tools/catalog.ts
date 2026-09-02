export const toolSlugs = [
  "position-size",
  "leverage",
  "dca",
  "risk-reward",
] as const;

export type ToolSlug = (typeof toolSlugs)[number];

export type ToolDefinition = {
  slug: ToolSlug;
  href: `/tools/${ToolSlug}`;
  index: string;
  shortTitle: string;
  title: string;
  description: string;
  formula: readonly string[];
  outputs: readonly string[];
  caveat: string;
};

export const toolCatalog: readonly ToolDefinition[] = [
  {
    slug: "position-size",
    href: "/tools/position-size",
    index: "01",
    shortTitle: "仓位计算",
    title: "仓位风险计算器",
    description:
      "根据账户规模、最大风险比例、入场价和止损价，估算风险预算、数量与名义仓位。",
    formula: [
      "最大风险 = 账户余额 × 风险比例",
      "数量 = 最大风险 ÷ |入场价 − 止损价|",
    ],
    outputs: ["最大风险金额", "资产数量", "名义仓位"],
    caveat: "未计手续费、滑点和跳空；实际损失可能高于计划值。",
  },
  {
    slug: "leverage",
    href: "/tools/leverage",
    index: "02",
    shortTitle: "杠杆计算",
    title: "杠杆与盈亏计算器",
    description:
      "用统一口径估算保证金、仓位数量、方向盈亏与 ROE，并明确区分交易所强平规则。",
    formula: [
      "保证金 = 名义仓位 ÷ 杠杆倍数",
      "盈亏 = 方向价格差 × 数量",
    ],
    outputs: ["仓位数量", "初始保证金", "预估盈亏", "ROE"],
    caveat: "V0 不计算交易所强平价；维持保证金档位、仓位模式与费用都会改变强平结果。",
  },
  {
    slug: "dca",
    href: "/tools/dca",
    index: "03",
    shortTitle: "DCA 定投",
    title: "历史 DCA 定投计算器",
    description:
      "按照 UTC 计划与已验证的 BTC/ETH 日线，回看每期投入、平均成本和期末表现。",
    formula: [
      "每期数量 = 每期投入 ÷ 执行日价格",
      "平均成本 = 总投入 ÷ 累计数量",
    ],
    outputs: ["总投入", "累计数量", "平均成本", "期末价值与收益率"],
    caveat: "历史回测不代表未来结果，且不包含手续费、点差、税务和质押收益。",
  },
  {
    slug: "risk-reward",
    href: "/tools/risk-reward",
    index: "04",
    shortTitle: "风险 / 回报",
    title: "风险回报计算器",
    description:
      "分别校验做多或做空的入场、止损和目标价顺序，并计算风险、潜在回报与 1:x。",
    formula: [
      "风险 = |入场价 − 止损价|",
      "回报倍数 = |目标价 − 入场价| ÷ 风险",
    ],
    outputs: ["每单位风险", "潜在回报", "风险回报比"],
    caveat: "目标价与止损价只是输入假设，不是 Wise Crypto 的市场判断。",
  },
] as const;

export function getToolDefinition(slug: ToolSlug): ToolDefinition {
  const tool = toolCatalog.find((candidate) => candidate.slug === slug);
  if (!tool) {
    throw new Error(`Unknown tool slug: ${slug}`);
  }
  return tool;
}
