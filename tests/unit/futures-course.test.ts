import { describe, expect, it } from "vitest";
import {
  FUTURES_INTRO_CONTENT_VERSION,
  FUTURES_INTRO_COURSE_ID,
  futuresFullPathLessonIds,
  futuresIntroCourse,
  futuresIntroLessons,
  futuresQuickPathLessonIds,
  getFuturesChapter,
  getFuturesLesson,
  interactionKinds,
  isFuturesChapterId,
  isFuturesLessonId,
  quizKinds,
} from "../../src/lib/learning/futures-course";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      collectStrings,
    );
  }
  return [];
}

describe("futures intro course", () => {
  it("defines the approved versioned 5 chapter / 26 lesson structure", () => {
    expect(futuresIntroCourse.id).toBe(FUTURES_INTRO_COURSE_ID);
    expect(futuresIntroCourse.contentVersion).toBe(
      FUTURES_INTRO_CONTENT_VERSION,
    );
    expect(futuresIntroCourse.contentVersion).toBe("futures-intro-v2");
    expect(futuresIntroCourse.chapters).toHaveLength(5);
    expect(
      futuresIntroCourse.chapters.map((chapter) => chapter.lessons.length),
    ).toEqual([5, 6, 4, 6, 5]);
    expect(futuresIntroLessons).toHaveLength(26);
    expect(futuresIntroLessons.map((lesson) => lesson.order)).toEqual(
      Array.from({ length: 26 }, (_, index) => index + 1),
    );
  });

  it("gives every chapter a substantial introduction and three objectives", () => {
    for (const chapter of futuresIntroCourse.chapters) {
      expect(chapter.introduction.length).toBeGreaterThanOrEqual(120);
      expect(chapter.introduction.length).toBeLessThanOrEqual(220);
      expect(chapter.learningObjectives).toHaveLength(3);
      for (const objective of chapter.learningObjectives) {
        expect(objective.trim().length).toBeGreaterThanOrEqual(10);
      }
      expect(chapter.completionOutcome.length).toBeGreaterThanOrEqual(40);
    }
  });

  it("uses unique, stable IDs with correct chapter relationships", () => {
    const lessonIds = futuresIntroLessons.map((lesson) => lesson.id);
    const chapterIds = futuresIntroCourse.chapters.map((chapter) => chapter.id);

    expect(lessonIds).toEqual(futuresFullPathLessonIds);
    expect(new Set(lessonIds)).toHaveProperty("size", 26);
    expect(new Set(chapterIds)).toHaveProperty("size", 5);

    for (const chapter of futuresIntroCourse.chapters) {
      expect(isFuturesChapterId(chapter.id)).toBe(true);
      expect(getFuturesChapter(chapter.id)).toBe(chapter);
      for (const lesson of chapter.lessons) {
        expect(lesson.chapterId).toBe(chapter.id);
        expect(isFuturesLessonId(lesson.id)).toBe(true);
        expect(getFuturesLesson(lesson.id)).toBe(lesson);
      }
    }
    expect(isFuturesLessonId("lesson-99-made-up")).toBe(false);
    expect(isFuturesChapterId("chapter-6-made-up")).toBe(false);
  });

  it("marks exactly eight ordered core lessons for the shared quick path", () => {
    expect(futuresQuickPathLessonIds).toHaveLength(8);
    expect(new Set(futuresQuickPathLessonIds)).toHaveProperty("size", 8);
    expect(
      futuresIntroLessons
        .filter((lesson) => lesson.isQuickPath)
        .map((lesson) => lesson.id),
    ).toEqual(futuresQuickPathLessonIds);

    const fullIndexes = futuresQuickPathLessonIds.map((lessonId) =>
      futuresFullPathLessonIds.indexOf(lessonId),
    );
    expect(fullIndexes).toEqual([...fullIndexes].sort((a, b) => a - b));
  });

  it("gives every lesson substantive teaching, one interaction and three complementary quizzes", () => {
    const usedInteractionKinds = new Set<string>();
    const quizIds = new Set<string>();
    const scenarioQuestions = new Set<string>();

    for (const lesson of futuresIntroLessons) {
      expect(lesson.title.trim()).not.toBe("");
      expect(lesson.summary.trim()).not.toBe("");
      expect(lesson.takeaway.trim()).not.toBe("");
      const explanationLength =
        lesson.explanation.definition.length +
        lesson.explanation.whyItMatters.length +
        lesson.explanation.example.length +
        lesson.explanation.commonMistake.length;
      expect(lesson.explanation.definition.length).toBeGreaterThanOrEqual(55);
      expect(lesson.explanation.whyItMatters.length).toBeGreaterThanOrEqual(35);
      expect(lesson.explanation.example.length).toBeGreaterThanOrEqual(55);
      expect(lesson.explanation.commonMistake.length).toBeGreaterThanOrEqual(40);
      expect(explanationLength).toBeGreaterThanOrEqual(180);
      expect(explanationLength).toBeLessThanOrEqual(350);
      expect(lesson.explanation.keyPoints).toHaveLength(3);
      for (const keyPoint of lesson.explanation.keyPoints) {
        expect(keyPoint.trim().length).toBeGreaterThanOrEqual(8);
      }
      expect(lesson.interaction.instruction.trim()).not.toBe("");
      expect(interactionKinds).toContain(lesson.interaction.kind);
      usedInteractionKinds.add(lesson.interaction.kind);

      expect(lesson.deepDive.estimatedMinutes).toBeGreaterThanOrEqual(4);
      expect(lesson.deepDive.estimatedMinutes).toBeLessThanOrEqual(10);
      expect(lesson.deepDive.learningGoals).toHaveLength(2);
      for (const goal of lesson.deepDive.learningGoals) {
        expect(goal.trim().length).toBeGreaterThanOrEqual(12);
      }
      expect(lesson.deepDive.keyTerms.length).toBeGreaterThanOrEqual(2);
      expect(lesson.deepDive.keyTerms.length).toBeLessThanOrEqual(4);
      for (const keyTerm of lesson.deepDive.keyTerms) {
        expect(keyTerm.term.trim().length).toBeGreaterThanOrEqual(2);
        expect(
          keyTerm.definition.trim().length,
          `${lesson.id}:${keyTerm.term}`,
        ).toBeGreaterThanOrEqual(12);
      }
      expect(lesson.deepDive.mechanismSteps.length).toBeGreaterThanOrEqual(3);
      expect(lesson.deepDive.mechanismSteps.length).toBeLessThanOrEqual(5);
      for (const step of lesson.deepDive.mechanismSteps) {
        expect(step.title.trim().length).toBeGreaterThanOrEqual(4);
        expect(step.detail.trim().length).toBeGreaterThanOrEqual(24);
      }
      expect(
        lesson.deepDive.workedExample.setup.length,
        lesson.id,
      ).toBeGreaterThanOrEqual(25);
      expect(lesson.deepDive.workedExample.steps).toHaveLength(3);
      for (const step of lesson.deepDive.workedExample.steps) {
        expect(step.trim().length).toBeGreaterThanOrEqual(28);
      }
      expect(
        lesson.deepDive.workedExample.observation.length,
      ).toBeGreaterThanOrEqual(30);
      expect(
        lesson.deepDive.workedExample.limitation.length,
      ).toBeGreaterThanOrEqual(28);
      expect(lesson.deepDive.boundary.canTell).toHaveLength(2);
      expect(lesson.deepDive.boundary.cannotTell).toHaveLength(2);
      for (const boundary of [
        ...lesson.deepDive.boundary.canTell,
        ...lesson.deepDive.boundary.cannotTell,
      ]) {
        expect(boundary.trim().length, lesson.id).toBeGreaterThanOrEqual(8);
      }
      expect(lesson.deepDive.recap.length, lesson.id).toBeGreaterThanOrEqual(28);
      expect(
        lesson.deepDive.nextLessonBridge.length,
        lesson.id,
      ).toBeGreaterThanOrEqual(25);
      expect(
        collectStrings(lesson.deepDive).join("").length,
        lesson.id,
      ).toBeGreaterThanOrEqual(550);

      expect(lesson).not.toHaveProperty("quiz");
      expect(lesson.quizzes).toHaveLength(3);
      expect(lesson.quizzes.map((quiz) => quiz.kind)).toEqual(quizKinds);
      for (const quiz of lesson.quizzes) {
        expect(quiz.id).toBe(`${lesson.id}-${quiz.kind}`);
        expect(quizIds.has(quiz.id)).toBe(false);
        quizIds.add(quiz.id);
        expect(quiz.title.trim().length).toBeGreaterThanOrEqual(8);
        expect(quiz.question.trim().length).toBeGreaterThanOrEqual(12);
        expect(quiz.options).toHaveLength(3);
        expect(
          new Set(quiz.options.map((option) => option.id)),
        ).toHaveProperty("size", 3);
        expect(quiz.options).toContainEqual({
          id: "unsure",
          label: "我暂时不确定",
        });
        expect(
          quiz.options.some(
            (option) => option.id === quiz.correctOptionId,
          ),
        ).toBe(true);
        expect(quiz.correctOptionId).not.toBe("unsure");
        expect(quiz.correctExplanation.trim().length).toBeGreaterThanOrEqual(12);
        expect(quiz.incorrectExplanation.trim().length).toBeGreaterThanOrEqual(
          12,
        );
      }
      scenarioQuestions.add(lesson.quizzes[1].question);
      expect(lesson.riskNote.trim()).not.toBe("");
    }

    expect(usedInteractionKinds.size).toBe(26);
    expect(quizIds.size).toBe(78);
    expect(scenarioQuestions.size).toBe(26);
  });

  it("uses a stable, balanced answer position for every quiz kind", () => {
    const countsByKind = Object.fromEntries(
      quizKinds.map((kind) => [kind, { a: 0, b: 0 }]),
    ) as Record<(typeof quizKinds)[number], { a: number; b: number }>;

    for (const lesson of futuresIntroLessons) {
      for (const quiz of lesson.quizzes) {
        const kindOffset = quizKinds.indexOf(quiz.kind);
        const expectedCorrectOptionId =
          (lesson.order + kindOffset) % 2 === 1 ? "a" : "b";

        expect(
          quiz.options.map((option) => option.id),
          `${lesson.id}:${quiz.kind}`,
        ).toEqual(["a", "b", "unsure"]);
        expect(quiz.correctOptionId, `${lesson.id}:${quiz.kind}`).toBe(
          expectedCorrectOptionId,
        );
        countsByKind[quiz.kind][quiz.correctOptionId] += 1;
      }
    }

    for (const kind of quizKinds) {
      expect(countsByKind[kind], kind).toEqual({ a: 13, b: 13 });
    }
  });

  it("rotates boundary quizzes across both teachable and non-teachable facts", () => {
    const selectedBoundaryIndexes = new Set<number>();

    for (const lesson of futuresIntroLessons) {
      const boundaryIndex = lesson.order % 2 === 1 ? 0 : 1;
      const boundaryQuiz = lesson.quizzes[2];
      const correctOption = boundaryQuiz.options.find(
        (option) => option.id === boundaryQuiz.correctOptionId,
      );
      const incorrectOption = boundaryQuiz.options.find(
        (option) =>
          option.id !== boundaryQuiz.correctOptionId && option.id !== "unsure",
      );

      selectedBoundaryIndexes.add(boundaryIndex);
      expect(correctOption?.label, lesson.id).toBe(
        lesson.deepDive.boundary.cannotTell[boundaryIndex],
      );
      expect(incorrectOption?.label, lesson.id).toBe(
        lesson.deepDive.boundary.canTell[boundaryIndex],
      );
    }

    expect(selectedBoundaryIndexes).toEqual(new Set([0, 1]));
  });

  it("uses credible misconceptions instead of giveaway distractors", () => {
    const giveawayDistractor =
      /必然立即|一定会在固定日期|必然以屏幕价格|亏损上限会自动降低|所有交易所都使用完全相同|保证补偿所有亏损方|必然盈利的概率|没有任何价格数据|成交量较大就必然上涨|提前知道下一根|未来方向已经确定|必然是反转点|已经确定完成突破|盘中影线触及就永远有效|固定概率会发生|保证不会亏损|稳定盈利的方法|所有费用和风险都会自动归零|金额盈亏必然按杠杆|唯一强平依据|精确复制交易所最终清算价格|保证价格继续上涨|后续上涨已经确认/;

    for (const lesson of futuresIntroLessons) {
      for (const quiz of lesson.quizzes.slice(0, 2)) {
        const distractor = quiz.options.find(
          (option) =>
            option.id !== quiz.correctOptionId && option.id !== "unsure",
        );
        expect(distractor?.label, `${lesson.id}:${quiz.kind}`).not.toMatch(
          giveawayDistractor,
        );
      }
    }
  });

  it("explains the core mechanics and indicator limits explicitly", () => {
    const firstLesson = getFuturesLesson("lesson-01-spot-vs-perpetual")!;
    const firstLessonCopy = JSON.stringify(firstLesson);
    for (const concept of [
      "账户现货余额",
      "衍生品仓位",
      "做多",
      "做空",
      "同名义",
      "同保证金",
      "资金费率",
      "强平",
    ]) {
      expect(firstLessonCopy).toContain(concept);
    }
    expect(firstLesson.explanation.definition).toContain(
      "能否提取及托管方式仍受平台规则约束",
    );
    expect(firstLesson.explanation.definition).not.toContain(
      "实际持有对应资产",
    );

    const fundingLesson = getFuturesLesson("lesson-09-funding-fees")!;
    expect(fundingLesson.explanation.definition).toContain(
      "多头持仓者向空头持仓者支付",
    );
    expect(fundingLesson.explanation.definition).not.toContain(
      "多方向空方支付",
    );

    const notionalLesson = getFuturesLesson("lesson-03-notional-margin")!;
    const notionalDeepDiveCopy = JSON.stringify(notionalLesson.deepDive);
    for (const contractSpecification of [
      "U 本位",
      "币本位",
      "线性",
      "反向",
      "合约乘数",
      "保证金币种",
      "结算币种",
    ]) {
      expect(notionalDeepDiveCopy).toContain(contractSpecification);
    }
    expect(notionalDeepDiveCopy).toMatch(/不能.{0,12}(?:套|用于).{0,8}所有/);

    const orderLesson = getFuturesLesson("lesson-04-order-types")!;
    const orderLessonCopy = JSON.stringify(orderLesson);
    for (const orderConcept of [
      "条件单",
      "触发不等于成交",
      "止损市价",
      "止损限价",
      "只减仓",
    ]) {
      expect(orderLessonCopy).toContain(orderConcept);
    }
    expect(orderLesson.interaction.instruction).toContain("条件单");
    expect(orderLesson.quizzes[1].question).toContain("止损限价单");

    expect(
      JSON.stringify(getFuturesLesson("lesson-16-ema")!.explanation),
    ).toMatch(/历史|反应式|滞后/);
    expect(
      JSON.stringify(
        getFuturesLesson("lesson-18-bollinger-bands")!.explanation,
      ),
    ).toContain("不是买卖信号");
    expect(
      JSON.stringify(
        getFuturesLesson("lesson-20-fibonacci-retracement")!.explanation,
      ),
    ).toContain("潜在");
    expect(
      JSON.stringify(
        getFuturesLesson(
          "lesson-08-liquidation-maintenance-margin",
        )!.explanation,
      ),
    ).toMatch(/维持保证金|费用|平台规则/);
  });

  it("keeps the curriculum educational and free of live-price or profit promises", () => {
    const copy = JSON.stringify(futuresIntroCourse);

    expect(copy).not.toMatch(/当前(?:BTC|ETH)?价格[:：]?\s*[¥$￥]?\d/i);
    expect(copy).not.toMatch(/稳赚|保证盈利|无风险|必赚|必胜|确定上涨|确定下跌/);
    expect(copy).not.toMatch(/建议(?:立即)?(?:开多|开空|买入|卖出)/);
    expect(copy).not.toMatch(/\b(?:USDT|USD)\s*\d|[¥$￥]\s*\d/i);
  });
});
