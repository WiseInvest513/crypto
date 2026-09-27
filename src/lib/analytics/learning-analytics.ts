import {
  FUTURES_INTRO_CONTENT_VERSION,
  FUTURES_INTRO_COURSE_ID,
  futuresChapterIds,
  getFuturesLesson,
  isFuturesChapterId,
  isFuturesLessonId,
  quizKinds,
  type QuizKind,
} from "@/lib/learning/futures-course";

export const LEARNING_COURSE_ID = FUTURES_INTRO_COURSE_ID;
export const LEARNING_CONTENT_VERSION = FUTURES_INTRO_CONTENT_VERSION;

export const LEARNING_PATHS = ["quick", "full"] as const;
export const LEARNING_CHAPTER_IDS = futuresChapterIds;
export const COURSE_OPEN_PLACEMENTS = ["course_index"] as const;
export const QUIZ_RESULTS = ["correct", "incorrect"] as const;
export const LEARNING_QUIZ_KINDS = quizKinds;

export type LearningPath = (typeof LEARNING_PATHS)[number];
export type LearningChapterId = (typeof LEARNING_CHAPTER_IDS)[number];
export type CourseOpenPlacement = (typeof COURSE_OPEN_PLACEMENTS)[number];
export type QuizResult = (typeof QUIZ_RESULTS)[number];

export type LearningEventName =
  | "course_open"
  | "lesson_start"
  | "quiz_result"
  | "lesson_complete"
  | "course_complete";

type CourseIdentity = Readonly<{
  courseId: typeof LEARNING_COURSE_ID;
  contentVersion: typeof LEARNING_CONTENT_VERSION;
}>;

export type CourseOpenContext = CourseIdentity &
  Readonly<{
    placement: CourseOpenPlacement;
    sourcePage: "/learn/futures-intro";
  }>;

type LessonContext = CourseIdentity &
  Readonly<{
    path: LearningPath;
    chapterId: LearningChapterId;
    lessonId: string;
  }>;

export type LessonStartContext = LessonContext;
export type LessonCompleteContext = LessonContext;
export type QuizResultContext = LessonContext &
  Readonly<{
    quizKind: QuizKind;
    result: QuizResult;
    attempt: number;
  }>;
export type CourseCompleteContext = CourseIdentity &
  Readonly<{
    path: LearningPath;
  }>;

export type LearningEvent = Readonly<{
  name: LearningEventName;
  payload: Readonly<Record<string, string | number>>;
}>;

export interface LearningAnalyticsAdapter {
  track(event: LearningEvent): void | Promise<void>;
}

type Exact<Allowed, Context extends Allowed> = Context &
  Readonly<Record<Exclude<keyof Context, keyof Allowed>, never>>;

export interface LearningAnalytics {
  trackCourseOpen<const Context extends CourseOpenContext>(
    context: Exact<CourseOpenContext, Context>,
  ): void;
  trackLessonStart<const Context extends LessonStartContext>(
    context: Exact<LessonStartContext, Context>,
  ): void;
  trackQuizResult<const Context extends QuizResultContext>(
    context: Exact<QuizResultContext, Context>,
  ): void;
  trackLessonComplete<const Context extends LessonCompleteContext>(
    context: Exact<LessonCompleteContext, Context>,
  ): void;
  trackCourseComplete<const Context extends CourseCompleteContext>(
    context: Exact<CourseCompleteContext, Context>,
  ): void;
}

export const noopLearningAnalyticsAdapter: LearningAnalyticsAdapter =
  Object.freeze({
    track: () => undefined,
  });

class LearningAnalyticsFacade implements LearningAnalytics {
  constructor(private readonly adapter: LearningAnalyticsAdapter) {}

  trackCourseOpen<const Context extends CourseOpenContext>(
    context: Exact<CourseOpenContext, Context>,
  ): void {
    this.dispatch("course_open", context);
  }

  trackLessonStart<const Context extends LessonStartContext>(
    context: Exact<LessonStartContext, Context>,
  ): void {
    this.dispatch("lesson_start", context);
  }

  trackQuizResult<const Context extends QuizResultContext>(
    context: Exact<QuizResultContext, Context>,
  ): void {
    this.dispatch("quiz_result", context);
  }

  trackLessonComplete<const Context extends LessonCompleteContext>(
    context: Exact<LessonCompleteContext, Context>,
  ): void {
    this.dispatch("lesson_complete", context);
  }

  trackCourseComplete<const Context extends CourseCompleteContext>(
    context: Exact<CourseCompleteContext, Context>,
  ): void {
    this.dispatch("course_complete", context);
  }

  private dispatch(name: LearningEventName, context: unknown): void {
    try {
      const payload = toSafePayload(name, context);

      if (!payload) {
        return;
      }

      const result = this.adapter.track(Object.freeze({ name, payload }));

      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics is best effort and must never interrupt learning.
    }
  }
}

export function createLearningAnalytics(
  adapter: LearningAnalyticsAdapter = noopLearningAnalyticsAdapter,
): LearningAnalytics {
  return new LearningAnalyticsFacade(adapter);
}

/** Provider-neutral facade. It remains a noop until a reviewed adapter is supplied. */
export const learningAnalytics = createLearningAnalytics();

const BASE_KEYS = ["courseId", "contentVersion"] as const;
const EVENT_KEYS: Readonly<Record<LearningEventName, ReadonlySet<PropertyKey>>> =
  Object.freeze({
    course_open: new Set([
      ...BASE_KEYS,
      "placement",
      "sourcePage",
    ]),
    lesson_start: new Set([
      ...BASE_KEYS,
      "path",
      "chapterId",
      "lessonId",
    ]),
    quiz_result: new Set([
      ...BASE_KEYS,
      "path",
      "chapterId",
      "lessonId",
      "quizKind",
      "result",
      "attempt",
    ]),
    lesson_complete: new Set([
      ...BASE_KEYS,
      "path",
      "chapterId",
      "lessonId",
    ]),
    course_complete: new Set([...BASE_KEYS, "path"]),
  });
const PATH_SET = new Set<string>(LEARNING_PATHS);
const PLACEMENT_SET = new Set<string>(COURSE_OPEN_PLACEMENTS);
const QUIZ_RESULT_SET = new Set<string>(QUIZ_RESULTS);
const QUIZ_KIND_SET = new Set<string>(LEARNING_QUIZ_KINDS);

function toSafePayload(
  name: LearningEventName,
  context: unknown,
): Readonly<Record<string, string | number>> | null {
  if (!isPlainRecord(context)) {
    return null;
  }

  const allowedKeys = EVENT_KEYS[name];
  if (Reflect.ownKeys(context).some((key) => !allowedKeys.has(key))) {
    return null;
  }

  if (
    context.courseId !== LEARNING_COURSE_ID ||
    context.contentVersion !== LEARNING_CONTENT_VERSION
  ) {
    return null;
  }

  if (name === "course_open") {
    if (
      !isAllowedString(context.placement, PLACEMENT_SET) ||
      context.sourcePage !== "/learn/futures-intro"
    ) {
      return null;
    }

    return Object.freeze({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      placement: context.placement,
      sourcePage: context.sourcePage,
    });
  }

  if (!isAllowedString(context.path, PATH_SET)) {
    return null;
  }

  if (name === "course_complete") {
    return Object.freeze({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      path: context.path,
    });
  }

  if (
    !isFuturesChapterId(context.chapterId) ||
    !isFuturesLessonId(context.lessonId)
  ) {
    return null;
  }

  const lesson = getFuturesLesson(context.lessonId);
  if (
    !lesson ||
    lesson.chapterId !== context.chapterId ||
    (context.path === "quick" && !lesson.isQuickPath)
  ) {
    return null;
  }

  const lessonPayload = {
    courseId: LEARNING_COURSE_ID,
    contentVersion: LEARNING_CONTENT_VERSION,
    path: context.path,
    chapterId: context.chapterId,
    lessonId: context.lessonId,
  } as const;

  if (name !== "quiz_result") {
    return Object.freeze(lessonPayload);
  }

  if (
    !isAllowedString(context.quizKind, QUIZ_KIND_SET) ||
    !isAllowedString(context.result, QUIZ_RESULT_SET) ||
    typeof context.attempt !== "number" ||
    !Number.isSafeInteger(context.attempt) ||
    context.attempt < 1 ||
    context.attempt > 20
  ) {
    return null;
  }

  return Object.freeze({
    ...lessonPayload,
    quizKind: context.quizKind,
    result: context.result,
    attempt: context.attempt,
  });
}

function isAllowedString(value: unknown, allowed: ReadonlySet<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
