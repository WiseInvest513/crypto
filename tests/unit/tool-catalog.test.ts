import { describe, expect, it } from "vitest";
import sitemap from "../../src/app/sitemap";
import {
  AUTHENTICATED_ROUTES,
  PUBLIC_ROUTES,
} from "../../src/config/site";
import {
  futuresFullPathLessonIds,
  futuresIntroCourse,
  futuresQuickPathLessonIds,
} from "../../src/lib/learning/futures-course";
import {
  futuresIntroCourseSummary,
  learningCatalog,
} from "../../src/lib/learning/catalog";
import {
  getToolDefinition,
  toolCatalog,
  toolCategories,
} from "../../src/lib/tools/catalog";

const EXPECTED_PRESENTATION = {
  "position-size": {
    category: "trade-planning",
    question: "单笔承担多少风险，对应可以下多少仓位？",
    inputSummary: "账户余额、风险比例、入场价与止损价",
    resultSummary: "估算最大风险金额、资产数量与名义仓位",
    primaryOutput: "资产数量",
  },
  leverage: {
    category: "leverage",
    question: "这笔杠杆仓位需要多少保证金，情景盈亏是多少？",
    inputSummary: "方向、名义仓位、杠杆、入场价与情景退出价",
    resultSummary: "估算初始保证金、仓位数量、情景盈亏与 ROE",
    primaryOutput: "初始保证金",
  },
  dca: {
    category: "long-term",
    question: "固定投入 BTC 或 ETH 的历史表现如何？",
    inputSummary: "资产、每期金额、UTC 日期范围与投入频率",
    resultSummary: "回看总投入、平均成本、期末价值与历史收益率",
    primaryOutput: "期末价值与收益率",
  },
  "risk-reward": {
    category: "trade-planning",
    question: "止损与目标价的距离，对应怎样的风险回报比？",
    inputSummary: "方向、入场价、止损价与目标价",
    resultSummary: "比较每单位风险、潜在回报与风险回报比",
    primaryOutput: "风险回报比",
  },
} as const;

describe("tool catalog", () => {
  it("keeps learning courses in a distinct catalog from the four calculators", () => {
    expect(toolCatalog).toHaveLength(4);
    expect(learningCatalog).toEqual([futuresIntroCourseSummary]);
    expect(futuresIntroCourseSummary).toMatchObject({
      slug: "futures-intro",
      href: "/learn/futures-intro",
      chapterCount: 5,
      lessonCount: 26,
      quickLessonCount: 8,
    });
    expect(futuresIntroCourseSummary.chapters).toHaveLength(5);
    expect(futuresIntroCourseSummary.chapterCount).toBe(
      futuresIntroCourse.chapters.length,
    );
    expect(futuresIntroCourseSummary.lessonCount).toBe(
      futuresFullPathLessonIds.length,
    );
    expect(futuresIntroCourseSummary.quickLessonCount).toBe(
      futuresQuickPathLessonIds.length,
    );
    expect(futuresIntroCourseSummary.chapters).toEqual(
      futuresIntroCourse.chapters.map((chapter) => chapter.title),
    );
    expect(toolCatalog.map((tool) => String(tool.slug))).not.toContain(
      "futures-intro",
    );
    expect(AUTHENTICATED_ROUTES).toContain(futuresIntroCourseSummary.href);
    expect(PUBLIC_ROUTES).not.toContain(futuresIntroCourseSummary.href);
    expect(sitemap().map((entry) => new URL(entry.url).pathname)).not.toContain(
      futuresIntroCourseSummary.href,
    );
  });

  it("defines the three supported decision categories", () => {
    expect(toolCategories).toEqual([
      "trade-planning",
      "leverage",
      "long-term",
    ]);
  });

  it("keeps one neutral discovery model for every calculator", () => {
    expect(Object.fromEntries(
      toolCatalog.map((tool) => [
        tool.slug,
        {
          category: tool.category,
          question: tool.question,
          inputSummary: tool.inputSummary,
          resultSummary: tool.resultSummary,
          primaryOutput: tool.primaryOutput,
        },
      ]),
    )).toEqual(EXPECTED_PRESENTATION);
  });

  it("uses a declared output as each tool's primary result", () => {
    for (const tool of toolCatalog) {
      expect(tool.outputs).toContain(tool.primaryOutput);
    }
  });

  it("does not turn discovery copy into a recommendation or promise", () => {
    const discoveryCopy = toolCatalog
      .flatMap((tool) => [
        tool.question,
        tool.inputSummary,
        tool.resultSummary,
        tool.primaryOutput,
      ])
      .join("\n");

    expect(discoveryCopy).not.toMatch(
      /推荐|建议买入|建议卖出|开多|开空|必涨|必跌|保证收益|稳赚|胜率/,
    );
  });

  it("resolves every catalog entry by slug without changing its route", () => {
    for (const tool of toolCatalog) {
      expect(getToolDefinition(tool.slug)).toBe(tool);
      expect(tool.href).toBe(`/tools/${tool.slug}`);
    }
  });
});
