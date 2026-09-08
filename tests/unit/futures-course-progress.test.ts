import { describe, expect, it } from "vitest";
import {
  FUTURES_INTRO_CONTENT_VERSION,
  futuresFullPathLessonIds,
  futuresQuickPathLessonIds,
} from "../../src/lib/learning/futures-course";
import {
  FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
  FUTURES_INTRO_PROGRESS_STORAGE_KEY,
  MAX_QUIZ_ATTEMPTS,
  changeLearningPath,
  completeLesson,
  createInitialCourseProgress,
  deriveLessonAccess,
  getCourseCompletion,
  getPassedQuizKinds,
  getQuizState,
  getQuizStageState,
  isCourseProgress,
  isLessonUnlocked,
  migrateCourseProgress,
  parseCourseProgress,
  recordQuizResult,
  recordQuizStageResult,
  resetCourseProgress,
  serializeCourseProgress,
  setCurrentLesson,
  type CourseProgress,
} from "../../src/lib/learning/course-progress";

const T0 = "2026-09-06T00:00:00.000Z";
const T1 = "2026-09-06T00:01:00.000Z";
const T2 = "2026-09-06T00:02:00.000Z";
const T3 = "2026-09-06T00:03:00.000Z";

describe("futures course progress", () => {
  it("creates a minimal versioned quick or full-path state", () => {
    const quick = createInitialCourseProgress("quick", T0);
    const full = createInitialCourseProgress("full", T0);

    expect(FUTURES_INTRO_PROGRESS_STORAGE_KEY).toBe(
      "wise-crypto:futures-intro:progress:v1",
    );
    expect(quick).toEqual({
      schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
      contentVersion: FUTURES_INTRO_CONTENT_VERSION,
      path: "quick",
      currentLessonId: futuresQuickPathLessonIds[0],
      completedLessonIds: [],
      quiz: {},
      quizStages: {},
      updatedAt: T0,
    });
    expect(full.currentLessonId).toBe(futuresFullPathLessonIds[0]);
    expect(Object.isFrozen(quick)).toBe(true);
    expect(Object.isFrozen(quick.completedLessonIds)).toBe(true);
    expect(Object.isFrozen(quick.quiz)).toBe(true);
    expect(Object.isFrozen(quick.quizStages)).toBe(true);
  });

  it("derives strict sequential access without persisting unlock flags", () => {
    const initial = createInitialCourseProgress("quick", T0);
    const initialAccess = deriveLessonAccess(initial);

    expect(initialAccess[futuresQuickPathLessonIds[0]]).toBe("current");
    expect(initialAccess[futuresQuickPathLessonIds[1]]).toBe("locked");
    expect(initialAccess["lesson-03-notional-margin"]).toBe("not-in-path");
    expect(isLessonUnlocked(initial, futuresQuickPathLessonIds[0])).toBe(true);
    expect(isLessonUnlocked(initial, futuresQuickPathLessonIds[1])).toBe(false);

    const lockedNavigation = setCurrentLesson(
      initial,
      futuresQuickPathLessonIds[1],
      T1,
    );
    expect(lockedNavigation).toBe(initial);
  });

  it("records retry and pass states before completing a lesson", () => {
    const initial = createInitialCourseProgress("quick", T0);
    const lessonId = futuresQuickPathLessonIds[0];
    const retry = recordQuizResult(initial, lessonId, false, T1);

    expect(getQuizState(retry, lessonId)).toEqual({
      status: "retry",
      attempts: 1,
    });
    expect(completeLesson(retry, lessonId, T2)).toBe(retry);

    const passed = recordQuizResult(retry, lessonId, true, T2);
    expect(getQuizState(passed, lessonId)).toEqual({
      status: "passed",
      attempts: 2,
    });

    const completed = completeLesson(passed, lessonId, T3);
    expect(completed.completedLessonIds).toEqual([lessonId]);
    expect(completed.currentLessonId).toBe(futuresQuickPathLessonIds[1]);
    expect(deriveLessonAccess(completed)[lessonId]).toBe("completed");
    expect(deriveLessonAccess(completed)[futuresQuickPathLessonIds[1]]).toBe(
      "current",
    );
  });

  it("persists each quiz stage without storing selections and resumes in order", () => {
    const lessonId = futuresQuickPathLessonIds[0];
    const initial = createInitialCourseProgress("quick", T0);

    expect(
      recordQuizStageResult(initial, lessonId, "scenario", true, T1),
    ).toBe(initial);

    const conceptRetry = recordQuizStageResult(
      initial,
      lessonId,
      "concept",
      false,
      T1,
    );
    expect(getQuizStageState(conceptRetry, lessonId, "concept")).toEqual({
      status: "retry",
      attempts: 1,
    });

    const conceptPass = recordQuizStageResult(
      conceptRetry,
      lessonId,
      "concept",
      true,
      T2,
    );
    const resumedAfterConcept = parseCourseProgress(
      serializeCourseProgress(conceptPass),
    );
    expect(resumedAfterConcept).not.toBeNull();
    expect(getPassedQuizKinds(resumedAfterConcept!, lessonId)).toEqual([
      "concept",
    ]);
    expect(getQuizStageState(resumedAfterConcept!, lessonId, "concept")).toEqual({
      status: "passed",
      attempts: 2,
    });
    expect(getQuizStageState(resumedAfterConcept!, lessonId, "scenario")).toEqual({
      status: "unanswered",
      attempts: 0,
    });
    const scenarioPass = recordQuizStageResult(
      resumedAfterConcept!,
      lessonId,
      "scenario",
      true,
      T2,
    );
    const boundaryPass = recordQuizStageResult(
      scenarioPass,
      lessonId,
      "boundary",
      true,
      T3,
    );

    expect(getPassedQuizKinds(boundaryPass, lessonId)).toEqual([
      "concept",
      "scenario",
      "boundary",
    ]);
    expect(getQuizState(boundaryPass, lessonId)).toEqual({
      status: "passed",
      attempts: 4,
    });
    expect(completeLesson(boundaryPass, lessonId, T3).completedLessonIds).toEqual([
      lessonId,
    ]);

    const serialized = serializeCourseProgress(boundaryPass);
    expect(serialized).not.toContain("selectedOption");
    expect(serialized).not.toContain("answerText");
    expect(parseCourseProgress(serialized)).toEqual(boundaryPass);
  });

  it("shares completed lessons while switching paths", () => {
    let progress = createInitialCourseProgress("quick", T0);
    const firstLessonId = futuresQuickPathLessonIds[0];
    progress = recordQuizResult(progress, firstLessonId, true, T1);
    progress = completeLesson(progress, firstLessonId, T2);

    const full = changeLearningPath(progress, "full", T3);

    expect(full.path).toBe("full");
    expect(full.completedLessonIds).toEqual([firstLessonId]);
    expect(full.currentLessonId).toBe(futuresFullPathLessonIds[1]);
    expect(getCourseCompletion(full, "quick")).toMatchObject({
      completed: 1,
      total: 8,
      isComplete: false,
    });
    expect(getCourseCompletion(full, "full")).toMatchObject({
      completed: 1,
      total: 26,
      isComplete: false,
    });
  });

  it("completes the quick path without unlocking skipped full-path lessons", () => {
    let progress = createInitialCourseProgress("quick", T0);

    for (const lessonId of futuresQuickPathLessonIds) {
      progress = recordQuizResult(progress, lessonId, true, T1);
      progress = completeLesson(progress, lessonId, T2);
    }

    expect(getCourseCompletion(progress)).toEqual({
      completed: 8,
      total: 8,
      percent: 100,
      isComplete: true,
      nextLessonId: null,
    });
    expect(deriveLessonAccess(progress)["lesson-03-notional-margin"]).toBe(
      "not-in-path",
    );
  });

  it("round-trips valid state and drops unrecognized top-level data", () => {
    const initial = createInitialCourseProgress("quick", T0);
    const raw = JSON.stringify({
      ...initial,
      accountBalance: 100_000,
      selectedAnswerText: "sensitive",
    });
    const parsed = parseCourseProgress(raw);

    expect(parsed).toEqual(initial);
    expect(parsed).not.toHaveProperty("accountBalance");
    expect(parsed).not.toHaveProperty("selectedAnswerText");
    expect(parseCourseProgress(serializeCourseProgress(initial))).toEqual(
      initial,
    );
  });

  it("rejects corrupt, oversized, unknown-version and inconsistent state", () => {
    const initial = createInitialCourseProgress("quick", T0);

    expect(parseCourseProgress(null)).toBeNull();
    expect(parseCourseProgress("not-json")).toBeNull();
    expect(parseCourseProgress("x".repeat(20_001))).toBeNull();
    expect(
      parseCourseProgress(
        JSON.stringify({ ...initial, contentVersion: "futures-intro-v99" }),
      ),
    ).toBeNull();
    expect(
      parseCourseProgress(
        JSON.stringify({
          ...initial,
          completedLessonIds: [futuresQuickPathLessonIds[0]],
        }),
      ),
    ).toBeNull();
    expect(
      parseCourseProgress(
        JSON.stringify({
          ...initial,
          currentLessonId: futuresQuickPathLessonIds[2],
        }),
      ),
    ).toBeNull();
  });

  it("migrates only the declared draft schema and derives passed quiz state", () => {
    const migrated = migrateCourseProgress({
      schemaVersion: 0,
      contentVersion: "futures-intro-draft-v0",
      path: "quick",
      currentLessonId: futuresQuickPathLessonIds[1],
      completedLessonIds: [futuresQuickPathLessonIds[0]],
      updatedAt: T0,
    });

    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
      contentVersion: FUTURES_INTRO_CONTENT_VERSION,
      path: "quick",
      currentLessonId: futuresQuickPathLessonIds[1],
      completedLessonIds: [futuresQuickPathLessonIds[0]],
    });
    expect(getQuizState(migrated!, futuresQuickPathLessonIds[0])).toEqual({
      status: "passed",
      attempts: 1,
    });
    expect(
      getPassedQuizKinds(migrated!, futuresQuickPathLessonIds[0]),
    ).toEqual(["concept", "scenario", "boundary"]);
    expect(migrateCourseProgress({ schemaVersion: -1 })).toBeNull();
  });

  it("migrates the v1 aggregate quiz schema without inventing answer data", () => {
    const lessonId = futuresQuickPathLessonIds[0];
    const migrated = migrateCourseProgress({
      schemaVersion: 1,
      contentVersion: FUTURES_INTRO_CONTENT_VERSION,
      path: "quick",
      currentLessonId: futuresQuickPathLessonIds[1],
      completedLessonIds: [lessonId],
      quiz: {
        [lessonId]: { status: "passed", attempts: 4 },
      },
      updatedAt: T0,
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.schemaVersion).toBe(2);
    expect(getQuizState(migrated!, lessonId)).toEqual({
      status: "passed",
      attempts: 4,
    });
    expect(getPassedQuizKinds(migrated!, lessonId)).toEqual([
      "concept",
      "scenario",
      "boundary",
    ]);
    expect(serializeCourseProgress(migrated!)).not.toMatch(
      /answer|selection/i,
    );
  });

  it("caps attempts and never demotes a passed quiz", () => {
    const lessonId = futuresQuickPathLessonIds[0];
    const initial = createInitialCourseProgress("quick", T0);
    const saturated = {
      ...initial,
      quiz: {
        [lessonId]: { status: "passed", attempts: MAX_QUIZ_ATTEMPTS },
      },
      quizStages: {
        [lessonId]: {
          concept: { status: "passed", attempts: 1 },
          scenario: { status: "passed", attempts: 1 },
          boundary: { status: "passed", attempts: 1 },
        },
      },
    } as CourseProgress;

    const result = recordQuizResult(saturated, lessonId, false, T1);
    expect(getQuizState(result, lessonId)).toEqual({
      status: "passed",
      attempts: MAX_QUIZ_ATTEMPTS,
    });
  });

  it("resets only the in-memory course value and validates canonical time", () => {
    const reset = resetCourseProgress("full", T0);

    expect(reset.path).toBe("full");
    expect(reset.completedLessonIds).toEqual([]);
    expect(isCourseProgress(reset)).toBe(true);
    expect(() => createInitialCourseProgress("quick", "2026-09-06")).toThrow(
      /canonical ISO UTC/,
    );
  });
});
