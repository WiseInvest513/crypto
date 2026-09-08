import {
  FUTURES_INTRO_CONTENT_VERSION,
  futuresFullPathLessonIds,
  getLessonIdsForPath,
  isFuturesLessonId,
  quizKinds,
  type FuturesLessonId,
  type LearningPath,
  type QuizKind,
} from "./futures-course";

export const FUTURES_INTRO_PROGRESS_STORAGE_KEY =
  "wise-crypto:futures-intro:progress:v1" as const;
export const FUTURES_INTRO_PROGRESS_SCHEMA_VERSION = 2 as const;
export const MAX_QUIZ_ATTEMPTS = 99;

export const quizStatuses = ["unanswered", "retry", "passed"] as const;
export type QuizStatus = (typeof quizStatuses)[number];

export type QuizProgress = Readonly<{
  status: QuizStatus;
  attempts: number;
}>;

export type LessonQuizProgress = Readonly<
  Partial<Record<QuizKind, QuizProgress>>
>;

export type CourseProgress = Readonly<{
  schemaVersion: typeof FUTURES_INTRO_PROGRESS_SCHEMA_VERSION;
  contentVersion: typeof FUTURES_INTRO_CONTENT_VERSION;
  path: LearningPath;
  currentLessonId: FuturesLessonId;
  completedLessonIds: readonly FuturesLessonId[];
  quiz: Readonly<Partial<Record<FuturesLessonId, QuizProgress>>>;
  quizStages: Readonly<
    Partial<Record<FuturesLessonId, LessonQuizProgress>>
  >;
  updatedAt: string;
}>;

export type LessonAccess =
  | "completed"
  | "current"
  | "available"
  | "locked"
  | "not-in-path";

export type CourseCompletion = Readonly<{
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
  nextLessonId: FuturesLessonId | null;
}>;

const UNANSWERED_QUIZ: QuizProgress = Object.freeze({
  status: "unanswered",
  attempts: 0,
});

const fullPathOrder = new Map<FuturesLessonId, number>(
  futuresFullPathLessonIds.map((lessonId, index) => [lessonId, index]),
);

export function createInitialCourseProgress(
  path: LearningPath = "quick",
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertLearningPath(path);
  assertIsoTimestamp(updatedAt);
  const firstLessonId = getLessonIdsForPath(path)[0];

  return freezeProgress({
    schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
    contentVersion: FUTURES_INTRO_CONTENT_VERSION,
    path,
    currentLessonId: firstLessonId,
    completedLessonIds: [],
    quiz: {},
    quizStages: {},
    updatedAt,
  });
}

/**
 * Reset returns a fresh value only. The browser interaction layer is
 * responsible for deleting this course's single local-storage key.
 */
export function resetCourseProgress(
  path: LearningPath = "quick",
  updatedAt = new Date().toISOString(),
): CourseProgress {
  return createInitialCourseProgress(path, updatedAt);
}

export function parseCourseProgress(raw: string | null): CourseProgress | null {
  if (raw === null || raw.length === 0 || raw.length > 20_000) {
    return null;
  }

  try {
    return migrateCourseProgress(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function serializeCourseProgress(progress: CourseProgress): string {
  const normalized = normalizeCurrentProgress(progress);
  if (normalized === null) {
    throw new TypeError("Cannot serialize invalid futures course progress.");
  }

  return JSON.stringify(normalized);
}

export function isCourseProgress(value: unknown): value is CourseProgress {
  return normalizeCurrentProgress(value) !== null;
}

/**
 * Supported migrations are the prior aggregate-quiz schema and the internal
 * pre-release draft. Unknown schemas and content versions fail closed so the
 * caller can start a clean course without guessing at meaning.
 */
export function migrateCourseProgress(value: unknown): CourseProgress | null {
  const current = normalizeCurrentProgress(value);
  if (current !== null) {
    return current;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (value.schemaVersion === 1) {
    return migrateAggregateQuizProgress(value);
  }

  if (value.schemaVersion !== 0) {
    return null;
  }

  if (
    value.contentVersion !== undefined &&
    value.contentVersion !== "futures-intro-draft-v0"
  ) {
    return null;
  }

  if (
    !isLearningPath(value.path) ||
    !isLessonIdArray(value.completedLessonIds) ||
    !isIsoTimestamp(value.updatedAt)
  ) {
    return null;
  }

  const completedLessonIds = sortLessonIds(value.completedLessonIds);
  const quiz = Object.fromEntries(
    completedLessonIds.map((lessonId) => [
      lessonId,
      Object.freeze({ status: "passed", attempts: 1 } satisfies QuizProgress),
    ]),
  ) as Partial<Record<FuturesLessonId, QuizProgress>>;
  const quizStages = createPassedQuizStages(completedLessonIds);
  const preferredCurrentLesson = isFuturesLessonId(value.currentLessonId)
    ? value.currentLessonId
    : null;
  const currentLessonId = chooseReachableCurrentLesson(
    value.path,
    completedLessonIds,
    preferredCurrentLesson,
  );

  return freezeProgress({
    schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
    contentVersion: FUTURES_INTRO_CONTENT_VERSION,
    path: value.path,
    currentLessonId,
    completedLessonIds,
    quiz,
    quizStages,
    updatedAt: value.updatedAt,
  });
}

function migrateAggregateQuizProgress(
  value: Record<string, unknown>,
): CourseProgress | null {
  if (
    value.contentVersion !== FUTURES_INTRO_CONTENT_VERSION ||
    !isLearningPath(value.path) ||
    !isFuturesLessonId(value.currentLessonId) ||
    !isLessonIdArray(value.completedLessonIds) ||
    !isIsoTimestamp(value.updatedAt) ||
    !isQuizRecord(value.quiz)
  ) {
    return null;
  }

  const completedLessonIds = sortLessonIds(value.completedLessonIds);
  const quiz = normalizeQuizRecord(value.quiz);
  if (
    completedLessonIds.some(
      (lessonId) => quiz[lessonId]?.status !== "passed",
    ) ||
    !isCurrentLessonReachable(
      value.path,
      value.currentLessonId,
      completedLessonIds,
    )
  ) {
    return null;
  }

  const passedLessonIds = Object.entries(quiz)
    .filter(([, state]) => state.status === "passed")
    .map(([lessonId]) => lessonId as FuturesLessonId);

  return freezeProgress({
    schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
    contentVersion: FUTURES_INTRO_CONTENT_VERSION,
    path: value.path,
    currentLessonId: value.currentLessonId,
    completedLessonIds,
    quiz,
    quizStages: createPassedQuizStages(passedLessonIds),
    updatedAt: value.updatedAt,
  });
}

export function changeLearningPath(
  progress: CourseProgress,
  path: LearningPath,
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertLearningPath(path);
  assertIsoTimestamp(updatedAt);
  const currentLessonId = chooseReachableCurrentLesson(
    path,
    progress.completedLessonIds,
    null,
  );

  return freezeProgress({
    ...progress,
    path,
    currentLessonId,
    updatedAt,
  });
}

export function setCurrentLesson(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertIsoTimestamp(updatedAt);
  if (!isLessonUnlocked(progress, lessonId)) {
    return progress;
  }

  return freezeProgress({
    ...progress,
    currentLessonId: lessonId,
    updatedAt,
  });
}

export function recordQuizResult(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
  correct: boolean,
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertIsoTimestamp(updatedAt);
  if (typeof correct !== "boolean") {
    throw new TypeError("Quiz result must be a boolean.");
  }
  if (!isLessonUnlocked(progress, lessonId)) {
    return progress;
  }

  const previous = getQuizState(progress, lessonId);
  const attempts = Math.min(MAX_QUIZ_ATTEMPTS, previous.attempts + 1);
  const status: QuizStatus =
    previous.status === "passed" || correct ? "passed" : "retry";

  return freezeProgress({
    ...progress,
    currentLessonId: lessonId,
    quiz: {
      ...progress.quiz,
      [lessonId]: Object.freeze({ status, attempts }),
    },
    quizStages:
      status === "passed"
        ? {
            ...progress.quizStages,
            [lessonId]: createPassedLessonQuizProgress(
              progress.quizStages[lessonId],
            ),
          }
        : progress.quizStages,
    updatedAt,
  });
}

export function recordQuizStageResult(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
  quizKind: QuizKind,
  correct: boolean,
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertIsoTimestamp(updatedAt);
  assertQuizKind(quizKind);
  if (typeof correct !== "boolean") {
    throw new TypeError("Quiz result must be a boolean.");
  }
  if (!isLessonUnlocked(progress, lessonId)) {
    return progress;
  }

  const quizIndex = quizKinds.indexOf(quizKind);
  if (
    quizKinds
      .slice(0, quizIndex)
      .some(
        (previousKind) =>
          getQuizStageState(progress, lessonId, previousKind).status !==
          "passed",
      )
  ) {
    return progress;
  }

  const previousStage = getQuizStageState(progress, lessonId, quizKind);
  const stageAttempts = Math.min(
    MAX_QUIZ_ATTEMPTS,
    previousStage.attempts + 1,
  );
  const stageStatus: QuizStatus =
    previousStage.status === "passed" || correct ? "passed" : "retry";
  const lessonStages = {
    ...progress.quizStages[lessonId],
    [quizKind]: Object.freeze({
      status: stageStatus,
      attempts: stageAttempts,
    }),
  } satisfies LessonQuizProgress;
  const passedEveryStage = quizKinds.every(
    (kind) => lessonStages[kind]?.status === "passed",
  );
  const previousQuiz = getQuizState(progress, lessonId);
  const aggregateAttempts = Math.min(
    MAX_QUIZ_ATTEMPTS,
    previousQuiz.attempts + 1,
  );
  const aggregateStatus: QuizStatus =
    previousQuiz.status === "passed" || passedEveryStage ? "passed" : "retry";

  return freezeProgress({
    ...progress,
    currentLessonId: lessonId,
    quiz: {
      ...progress.quiz,
      [lessonId]: Object.freeze({
        status: aggregateStatus,
        attempts: aggregateAttempts,
      }),
    },
    quizStages: {
      ...progress.quizStages,
      [lessonId]: lessonStages,
    },
    updatedAt,
  });
}

export function completeLesson(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
  updatedAt = new Date().toISOString(),
): CourseProgress {
  assertIsoTimestamp(updatedAt);
  if (
    !isLessonUnlocked(progress, lessonId) ||
    getQuizState(progress, lessonId).status !== "passed" ||
    !quizKinds.every(
      (quizKind) =>
        getQuizStageState(progress, lessonId, quizKind).status === "passed",
    )
  ) {
    return progress;
  }

  const completedLessonIds = sortLessonIds([
    ...progress.completedLessonIds,
    lessonId,
  ]);
  const currentLessonId = chooseReachableCurrentLesson(
    progress.path,
    completedLessonIds,
    null,
  );

  return freezeProgress({
    ...progress,
    currentLessonId,
    completedLessonIds,
    updatedAt,
  });
}

export function getQuizState(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
): QuizProgress {
  return progress.quiz[lessonId] ?? UNANSWERED_QUIZ;
}

export function getQuizStageState(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
  quizKind: QuizKind,
): QuizProgress {
  return progress.quizStages[lessonId]?.[quizKind] ?? UNANSWERED_QUIZ;
}

export function getPassedQuizKinds(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
): readonly QuizKind[] {
  return Object.freeze(
    quizKinds.filter(
      (quizKind) =>
        getQuizStageState(progress, lessonId, quizKind).status === "passed",
    ),
  );
}

export function isLessonUnlocked(
  progress: CourseProgress,
  lessonId: FuturesLessonId,
): boolean {
  const pathIds = getLessonIdsForPath(progress.path);
  const lessonIndex = pathIds.indexOf(lessonId);
  if (lessonIndex === -1) {
    return false;
  }

  const completed = new Set(progress.completedLessonIds);
  if (completed.has(lessonId)) {
    return true;
  }

  return pathIds
    .slice(0, lessonIndex)
    .every((previousLessonId) => completed.has(previousLessonId));
}

export function deriveLessonAccess(
  progress: CourseProgress,
): Readonly<Record<FuturesLessonId, LessonAccess>> {
  const pathIds = new Set(getLessonIdsForPath(progress.path));
  const completed = new Set(progress.completedLessonIds);
  const access = {} as Record<FuturesLessonId, LessonAccess>;

  for (const lessonId of futuresFullPathLessonIds) {
    if (!pathIds.has(lessonId)) {
      access[lessonId] = "not-in-path";
    } else if (completed.has(lessonId)) {
      access[lessonId] = "completed";
    } else if (
      lessonId === progress.currentLessonId &&
      isLessonUnlocked(progress, lessonId)
    ) {
      access[lessonId] = "current";
    } else if (isLessonUnlocked(progress, lessonId)) {
      access[lessonId] = "available";
    } else {
      access[lessonId] = "locked";
    }
  }

  return Object.freeze(access);
}

export function getCourseCompletion(
  progress: CourseProgress,
  path: LearningPath = progress.path,
): CourseCompletion {
  assertLearningPath(path);
  const pathIds = getLessonIdsForPath(path);
  const completed = new Set(progress.completedLessonIds);
  const completedCount = pathIds.filter((lessonId) =>
    completed.has(lessonId),
  ).length;
  const nextLessonId =
    pathIds.find((lessonId) => !completed.has(lessonId)) ?? null;

  return Object.freeze({
    completed: completedCount,
    total: pathIds.length,
    percent: Math.round((completedCount / pathIds.length) * 100),
    isComplete: completedCount === pathIds.length,
    nextLessonId,
  });
}

function normalizeCurrentProgress(value: unknown): CourseProgress | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== FUTURES_INTRO_PROGRESS_SCHEMA_VERSION ||
    value.contentVersion !== FUTURES_INTRO_CONTENT_VERSION ||
    !isLearningPath(value.path) ||
    !isFuturesLessonId(value.currentLessonId) ||
    !isLessonIdArray(value.completedLessonIds) ||
    !isIsoTimestamp(value.updatedAt) ||
    !isQuizRecord(value.quiz) ||
    !isQuizStageRecord(value.quizStages)
  ) {
    return null;
  }

  const completedLessonIds = sortLessonIds(value.completedLessonIds);
  const quiz = normalizeQuizRecord(value.quiz);
  const quizStages = normalizeQuizStageRecord(value.quizStages);
  if (
    completedLessonIds.some(
      (lessonId) =>
        quiz[lessonId]?.status !== "passed" ||
        !hasPassedEveryQuizStage(quizStages[lessonId]),
    ) ||
    Object.entries(quiz).some(([lessonId, state]) => {
      const stages = quizStages[lessonId as FuturesLessonId];
      return (
        (state.status === "passed") !== hasPassedEveryQuizStage(stages) ||
        (hasAnyQuizStage(stages) && state.status === "unanswered")
      );
    }) ||
    Object.keys(quizStages).some((lessonId) => !quiz[lessonId as FuturesLessonId]) ||
    !isCurrentLessonReachable(
      value.path,
      value.currentLessonId,
      completedLessonIds,
    )
  ) {
    return null;
  }

  return freezeProgress({
    schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
    contentVersion: FUTURES_INTRO_CONTENT_VERSION,
    path: value.path,
    currentLessonId: value.currentLessonId,
    completedLessonIds,
    quiz,
    quizStages,
    updatedAt: value.updatedAt,
  });
}

function normalizeQuizRecord(
  value: Record<string, unknown>,
): Partial<Record<FuturesLessonId, QuizProgress>> {
  const normalized: Partial<Record<FuturesLessonId, QuizProgress>> = {};
  for (const [lessonId, quiz] of Object.entries(value)) {
    if (!isFuturesLessonId(lessonId) || !isQuizProgress(quiz)) {
      continue;
    }
    normalized[lessonId] = Object.freeze({
      status: quiz.status,
      attempts: quiz.attempts,
    });
  }
  return normalized;
}

function isQuizRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length <= futuresFullPathLessonIds.length &&
    entries.every(
      ([lessonId, quiz]) =>
        isFuturesLessonId(lessonId) && isQuizProgress(quiz),
    )
  );
}

function normalizeQuizStageRecord(
  value: Record<string, unknown>,
): Partial<Record<FuturesLessonId, LessonQuizProgress>> {
  const normalized: Partial<Record<FuturesLessonId, LessonQuizProgress>> = {};
  for (const [lessonId, stages] of Object.entries(value)) {
    if (!isFuturesLessonId(lessonId) || !isLessonQuizProgress(stages)) {
      continue;
    }
    normalized[lessonId] = freezeLessonQuizProgress(stages);
  }
  return normalized;
}

function isQuizStageRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length <= futuresFullPathLessonIds.length &&
    entries.every(
      ([lessonId, stages]) =>
        isFuturesLessonId(lessonId) && isLessonQuizProgress(stages),
    )
  );
}

function isLessonQuizProgress(value: unknown): value is LessonQuizProgress {
  if (!isRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length <= quizKinds.length &&
    entries.every(
      ([quizKind, state]) => isQuizKind(quizKind) && isQuizProgress(state),
    ) &&
    isQuizStageSequenceValid(value)
  );
}

function isQuizStageSequenceValid(value: Record<string, unknown>): boolean {
  const conceptPassed = isQuizProgress(value.concept) && value.concept.status === "passed";
  const scenarioStarted = value.scenario !== undefined;
  const scenarioPassed =
    isQuizProgress(value.scenario) && value.scenario.status === "passed";
  const boundaryStarted = value.boundary !== undefined;

  return (!scenarioStarted || conceptPassed) && (!boundaryStarted || scenarioPassed);
}

function isQuizProgress(value: unknown): value is QuizProgress {
  if (
    !isRecord(value) ||
    !quizStatuses.includes(value.status as QuizStatus) ||
    !Number.isInteger(value.attempts) ||
    typeof value.attempts !== "number" ||
    value.attempts < 0 ||
    value.attempts > MAX_QUIZ_ATTEMPTS
  ) {
    return false;
  }

  if (value.status === "unanswered") {
    return value.attempts === 0;
  }
  return value.attempts >= 1;
}

function isQuizKind(value: unknown): value is QuizKind {
  return typeof value === "string" && quizKinds.includes(value as QuizKind);
}

function assertQuizKind(value: unknown): asserts value is QuizKind {
  if (!isQuizKind(value)) {
    throw new TypeError("Unknown quiz kind.");
  }
}

function isLessonIdArray(value: unknown): value is FuturesLessonId[] {
  if (
    !Array.isArray(value) ||
    value.length > futuresFullPathLessonIds.length ||
    !value.every(isFuturesLessonId)
  ) {
    return false;
  }
  return new Set(value).size === value.length;
}

function isCurrentLessonReachable(
  path: LearningPath,
  currentLessonId: FuturesLessonId,
  completedLessonIds: readonly FuturesLessonId[],
): boolean {
  const pathIds = getLessonIdsForPath(path);
  const index = pathIds.indexOf(currentLessonId);
  if (index === -1) {
    return false;
  }

  const completed = new Set(completedLessonIds);
  return (
    completed.has(currentLessonId) ||
    pathIds.slice(0, index).every((lessonId) => completed.has(lessonId))
  );
}

function chooseReachableCurrentLesson(
  path: LearningPath,
  completedLessonIds: readonly FuturesLessonId[],
  preferredLessonId: FuturesLessonId | null,
): FuturesLessonId {
  const pathIds = getLessonIdsForPath(path);
  const completed = new Set(completedLessonIds);
  if (
    preferredLessonId !== null &&
    isCurrentLessonReachable(path, preferredLessonId, completedLessonIds)
  ) {
    return preferredLessonId;
  }

  return (
    pathIds.find((lessonId) => !completed.has(lessonId)) ?? pathIds.at(-1)!
  );
}

function sortLessonIds(
  lessonIds: readonly FuturesLessonId[],
): FuturesLessonId[] {
  return [...new Set(lessonIds)].sort(
    (left, right) => fullPathOrder.get(left)! - fullPathOrder.get(right)!,
  );
}

function freezeProgress(progress: CourseProgress): CourseProgress {
  const frozenQuiz = Object.freeze(
    Object.fromEntries(
      Object.entries(progress.quiz).map(([lessonId, quiz]) => [
        lessonId,
        Object.freeze({ status: quiz.status, attempts: quiz.attempts }),
      ]),
    ),
  ) as CourseProgress["quiz"];
  const frozenQuizStages = Object.freeze(
    Object.fromEntries(
      Object.entries(progress.quizStages).map(([lessonId, stages]) => [
        lessonId,
        freezeLessonQuizProgress(stages),
      ]),
    ),
  ) as CourseProgress["quizStages"];

  return Object.freeze({
    schemaVersion: FUTURES_INTRO_PROGRESS_SCHEMA_VERSION,
    contentVersion: FUTURES_INTRO_CONTENT_VERSION,
    path: progress.path,
    currentLessonId: progress.currentLessonId,
    completedLessonIds: Object.freeze([...progress.completedLessonIds]),
    quiz: frozenQuiz,
    quizStages: frozenQuizStages,
    updatedAt: progress.updatedAt,
  });
}

function createPassedQuizStages(
  lessonIds: readonly FuturesLessonId[],
): Partial<Record<FuturesLessonId, LessonQuizProgress>> {
  return Object.fromEntries(
    lessonIds.map((lessonId) => [lessonId, createPassedLessonQuizProgress()]),
  ) as Partial<Record<FuturesLessonId, LessonQuizProgress>>;
}

function createPassedLessonQuizProgress(
  previous: LessonQuizProgress = {},
): LessonQuizProgress {
  return freezeLessonQuizProgress(
    Object.fromEntries(
      quizKinds.map((quizKind) => [
        quizKind,
        previous[quizKind]?.status === "passed"
          ? previous[quizKind]
          : Object.freeze({ status: "passed", attempts: 1 } satisfies QuizProgress),
      ]),
    ),
  );
}

function freezeLessonQuizProgress(value: LessonQuizProgress): LessonQuizProgress {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([quizKind, state]) => [
        quizKind,
        Object.freeze({ status: state.status, attempts: state.attempts }),
      ]),
    ),
  ) as LessonQuizProgress;
}

function hasPassedEveryQuizStage(
  stages: LessonQuizProgress | undefined,
): boolean {
  return quizKinds.every((quizKind) => stages?.[quizKind]?.status === "passed");
}

function hasAnyQuizStage(stages: LessonQuizProgress | undefined): boolean {
  return stages !== undefined && Object.keys(stages).length > 0;
}

function isLearningPath(value: unknown): value is LearningPath {
  return value === "quick" || value === "full";
}

function assertLearningPath(value: unknown): asserts value is LearningPath {
  if (!isLearningPath(value)) {
    throw new TypeError("Unknown futures course path.");
  }
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function assertIsoTimestamp(value: unknown): asserts value is string {
  if (!isIsoTimestamp(value)) {
    throw new TypeError("Course progress timestamp must be canonical ISO UTC.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
