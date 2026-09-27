import { describe, expect, it } from "vitest";
import {
  createLearningAnalytics,
  LEARNING_CONTENT_VERSION,
  LEARNING_COURSE_ID,
  type CourseOpenContext,
  type LearningAnalyticsAdapter,
  type LearningEvent,
  type QuizResultContext,
} from "../../src/lib/analytics/learning-analytics";

const lessonContext = {
  courseId: LEARNING_COURSE_ID,
  contentVersion: LEARNING_CONTENT_VERSION,
  path: "quick",
  chapterId: "chapter-1-contract-basics",
  lessonId: "lesson-01-spot-vs-perpetual",
} as const;

describe("learning analytics facade", () => {
  it("emits only the five provider-neutral learning events", () => {
    const events: LearningEvent[] = [];
    const analytics = createLearningAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackCourseOpen({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      placement: "course_index",
      sourcePage: "/learn/futures-intro",
    });
    analytics.trackLessonStart(lessonContext);
    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "concept",
      result: "incorrect",
      attempt: 1,
    });
    analytics.trackLessonComplete(lessonContext);
    analytics.trackCourseComplete({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      path: "quick",
    });

    expect(events.map((event) => event.name)).toEqual([
      "course_open",
      "lesson_start",
      "quiz_result",
      "lesson_complete",
      "course_complete",
    ]);
    expect(events[2]).toEqual({
      name: "quiz_result",
      payload: {
        ...lessonContext,
        quizKind: "concept",
        result: "incorrect",
        attempt: 1,
      },
    });
  });

  it("rejects extra fields, answer identifiers, prices and invalid attempts", () => {
    const events: LearningEvent[] = [];
    const analytics = createLearningAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "concept",
      result: "correct",
      attempt: 0,
    });
    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "concept",
      result: "correct",
      attempt: 21,
    });
    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "memory",
      result: "correct",
      attempt: 1,
    } as unknown as QuizResultContext);
    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "concept",
      result: "correct",
      attempt: 1,
      answerText: "不应离开浏览器",
    } as unknown as QuizResultContext);
    analytics.trackQuizResult({
      ...lessonContext,
      quizKind: "concept",
      result: "correct",
      attempt: 1,
      price: 77_000,
    } as unknown as QuizResultContext);
    analytics.trackLessonStart({
      ...lessonContext,
      // This looks structurally valid but is not part of the published course.
      lessonId: "lesson-01-made-up",
    });
    analytics.trackLessonStart({
      ...lessonContext,
      chapterId: "chapter-2-leverage-risk",
    });
    analytics.trackLessonStart({
      ...lessonContext,
      lessonId: "lesson-03-notional-margin",
    });

    expect(events).toEqual([]);
  });

  it("accepts only the course route's single mount event", () => {
    const events: LearningEvent[] = [];
    const analytics = createLearningAnalytics({
      track: (event) => {
        events.push(event);
      },
    });

    analytics.trackCourseOpen({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      placement: "tools_index",
      sourcePage: "/tools",
    } as unknown as CourseOpenContext);
    analytics.trackCourseOpen({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      placement: "direct",
      sourcePage: "/learn/futures-intro",
    } as unknown as CourseOpenContext);

    expect(events).toEqual([]);
  });

  it("never lets synchronous or asynchronous adapters interrupt learning", async () => {
    const synchronous = createLearningAnalytics({
      track: () => {
        throw new Error("analytics unavailable");
      },
    });
    const asynchronous = createLearningAnalytics({
      track: () => Promise.reject(new Error("analytics unavailable")),
    });

    expect(() => synchronous.trackLessonStart(lessonContext)).not.toThrow();
    expect(() => asynchronous.trackLessonComplete(lessonContext)).not.toThrow();
    await Promise.resolve();
  });

  it("keeps financial data and raw answers out of the typed boundary", () => {
    const adapter: LearningAnalyticsAdapter = { track: () => undefined };
    const analytics = createLearningAnalytics(adapter);

    // @ts-expect-error Raw answers cannot cross the learning analytics boundary.
    analytics.trackQuizResult({ ...lessonContext, quizKind: "concept", result: "correct", attempt: 1, answerText: "A" });
    // @ts-expect-error Prices cannot cross the learning analytics boundary.
    analytics.trackLessonComplete({ ...lessonContext, price: 77_000 });
    // @ts-expect-error User identifiers cannot cross the learning analytics boundary.
    analytics.trackCourseComplete({ courseId: LEARNING_COURSE_ID, contentVersion: LEARNING_CONTENT_VERSION, path: "full", userId: "user-1" });
  });
});
