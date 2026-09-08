import {
  futuresFullPathLessonIds,
  futuresIntroCourse,
  futuresQuickPathLessonIds,
} from "@/lib/learning/futures-course";

export const toolSlugs = [
  "position-size",
  "leverage",
  "dca",
  "risk-reward",
] as const;

export type ToolSlug = (typeof toolSlugs)[number];

export const toolCategories = [
  "trade-planning",
  "leverage",
  "long-term",
] as const;

export type ToolCategory = (typeof toolCategories)[number];

export type ToolDefinition = {
  slug: ToolSlug;
  href: `/tools/${ToolSlug}`;
  category: ToolCategory;
  shortTitle: string;
  title: string;
  description: string;
  question: string;
  inputSummary: string;
  resultSummary: string;
  primaryOutput: string;
  formula: readonly string[];
  outputs: readonly string[];
  caveat: string;
};

export type LearningToolDefinition = Readonly<{
  slug: "futures-intro";
  href: "/tools/futures-intro";
  title: string;
  description: string;
  chapterCount: number;
  lessonCount: number;
  quickLessonCount: number;
  chapters: readonly string[];
}>;

/**
 * Learning stays separate from `toolCatalog` so the four calculator entries
 * keep their equal layout and calculator-only type contract.
 */
export const futuresIntroTool: LearningToolDefinition = Object.freeze({
  slug: "futures-intro",
  href: "/tools/futures-intro",
  title: futuresIntroCourse.title,
  description:
    "从合约规则、杠杆风险到 K 线与关键区域，一关一关建立自己的观察流程。",
  chapterCount: futuresIntroCourse.chapters.length,
  lessonCount: futuresFullPathLessonIds.length,
  quickLessonCount: futuresQuickPathLessonIds.length,
  chapters: Object.freeze(
    futuresIntroCourse.chapters.map((chapter) => chapter.title),
  ),
});

export const toolCatalog: readonly ToolDefinition[] = [
  {
    slug: "position-size",
    href: "/tools/position-size",
    category: "trade-planning",
    shortTitle: "仓位计算",
    title: "仓位风险计算器",
    description:
      "根据账户规模、最大风险比例、入场价和止损价，估算风险预算、数量与名义仓位。",
    question: "单笔承担多少风险，对应可以下多少仓位？",
    inputSummary: "账户余额、风险比例、入场价与止损价",
    resultSummary: "估算最大风险金额、资产数量与名义仓位",
    primaryOutput: "资产数量",
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
    category: "leverage",
    shortTitle: "杠杆计算",
    title: "杠杆与盈亏计算器",
    description:
      "用统一口径估算保证金、仓位数量、方向盈亏与 ROE，并明确区分交易所强平规则。",
    question: "这笔杠杆仓位需要多少保证金，情景盈亏是多少？",
    inputSummary: "方向、名义仓位、杠杆、入场价与情景退出价",
    resultSummary: "估算初始保证金、仓位数量、情景盈亏与 ROE",
    primaryOutput: "初始保证金",
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
    category: "long-term",
    shortTitle: "DCA 定投",
    title: "历史 DCA 定投计算器",
    description:
      "按照 UTC 计划与已验证的 BTC/ETH 日线，回看每期投入、平均成本和期末表现。",
    question: "固定投入 BTC 或 ETH 的历史表现如何？",
    inputSummary: "资产、每期金额、UTC 日期范围与投入频率",
    resultSummary: "回看总投入、平均成本、期末价值与历史收益率",
    primaryOutput: "期末价值与收益率",
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
    category: "trade-planning",
    shortTitle: "风险 / 回报",
    title: "风险回报计算器",
    description:
      "分别校验做多或做空的入场、止损和目标价顺序，并计算风险、潜在回报与 1:x。",
    question: "止损与目标价的距离，对应怎样的风险回报比？",
    inputSummary: "方向、入场价、止损价与目标价",
    resultSummary: "比较每单位风险、潜在回报与风险回报比",
    primaryOutput: "风险回报比",
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
