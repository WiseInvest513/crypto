"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  LEARNING_CONTENT_VERSION,
  LEARNING_COURSE_ID,
  learningAnalytics,
} from "@/lib/analytics/learning-analytics";
import {
  deriveLessonAccess,
  getCourseCompletion,
  getPassedQuizKinds,
  getQuizState,
  getQuizStageState,
  changeLearningPath,
  completeLesson,
  createInitialCourseProgress,
  FUTURES_INTRO_PROGRESS_STORAGE_KEY,
  parseCourseProgress,
  recordQuizStageResult,
  resetCourseProgress,
  serializeCourseProgress,
  setCurrentLesson,
  type CourseProgress,
} from "@/lib/learning/course-progress";
import {
  futuresFullPathLessonIds,
  futuresIntroCourse,
  futuresQuickPathLessonIds,
  getFuturesLesson,
  type FuturesChapterId,
  type FuturesLessonId,
  type LearningPath,
  type LessonDefinition,
  type LessonQuiz,
  type QuizKind,
  type FuturesIntroCourse,
} from "@/lib/learning/futures-course";
import { BackToLearnLink } from "@/components/learning/back-to-learn-link";
import { LessonVisual } from "./lesson-visual";
import styles from "./futures-intro.module.css";

type ViewState =
  | Readonly<{ kind: "overview" }>
  | Readonly<{ kind: "lesson"; lessonId: FuturesLessonId }>;

type AnswerFeedback =
  | Readonly<{ kind: "correct"; message: string }>
  | Readonly<{ kind: "incorrect"; message: string }>
  | Readonly<{ kind: "missing"; message: string }>
  | null;

type QuizSelections = Partial<Record<QuizKind, string>>;
type QuizFeedbackMap = Partial<Record<QuizKind, Exclude<AnswerFeedback, null>>>;

const SERVER_PROGRESS_RAW = serializeCourseProgress(
  createInitialCourseProgress("quick", "1970-01-01T00:00:00.000Z"),
);
const progressListeners = new Set<() => void>();
let cachedClientProgressRaw: string | null = null;

function subscribeToProgress(onStoreChange: () => void) {
  progressListeners.add(onStoreChange);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== FUTURES_INTRO_PROGRESS_STORAGE_KEY) {
      return;
    }
    cachedClientProgressRaw = normalizeProgressRaw(event.newValue);
    onStoreChange();
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    progressListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function getClientProgressRaw() {
  if (cachedClientProgressRaw !== null) {
    return cachedClientProgressRaw;
  }

  try {
    cachedClientProgressRaw = normalizeProgressRaw(
      window.localStorage.getItem(FUTURES_INTRO_PROGRESS_STORAGE_KEY),
    );
  } catch {
    cachedClientProgressRaw = SERVER_PROGRESS_RAW;
  }

  return cachedClientProgressRaw;
}

function normalizeProgressRaw(raw: string | null) {
  const parsed = parseCourseProgress(raw);
  return parsed ? serializeCourseProgress(parsed) : SERVER_PROGRESS_RAW;
}

function publishProgress(progress: CourseProgress) {
  cachedClientProgressRaw = serializeCourseProgress(progress);
  let persisted = true;
  try {
    window.localStorage.setItem(
      FUTURES_INTRO_PROGRESS_STORAGE_KEY,
      cachedClientProgressRaw,
    );
  } catch {
    persisted = false;
  }
  progressListeners.forEach((listener) => listener());
  return persisted;
}

function publishReset(progress: CourseProgress) {
  cachedClientProgressRaw = serializeCourseProgress(progress);
  let persisted = true;
  try {
    window.localStorage.removeItem(FUTURES_INTRO_PROGRESS_STORAGE_KEY);
  } catch {
    persisted = false;
  }
  progressListeners.forEach((listener) => listener());
  return persisted;
}

export function FuturesIntroExperience() {
  const course = futuresIntroCourse;
  const progressRaw = useSyncExternalStore(
    subscribeToProgress,
    getClientProgressRaw,
    () => SERVER_PROGRESS_RAW,
  );
  const progress = useMemo(
    () => parseCourseProgress(progressRaw) ?? createInitialCourseProgress("quick"),
    [progressRaw],
  );
  const [view, setView] = useState<ViewState>({ kind: "overview" });
  const [selectedChapterId, setSelectedChapterId] =
    useState<FuturesChapterId | null>(null);
  const [quizSelections, setQuizSelections] = useState<QuizSelections>({});
  const [quizFeedback, setQuizFeedback] = useState<QuizFeedbackMap>({});
  const [resetPending, setResetPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const courseOpenTrackedRef = useRef(false);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const nextLessonButtonRef = useRef<HTMLButtonElement>(null);
  const progressLesson = getFuturesLesson(progress.currentLessonId);
  const expandedChapterId =
    selectedChapterId ?? progressLesson?.chapterId ?? course.chapters[0].id;

  useEffect(() => {
    if (!courseOpenTrackedRef.current) {
      courseOpenTrackedRef.current = true;
      learningAnalytics.trackCourseOpen({
        courseId: LEARNING_COURSE_ID,
        contentVersion: LEARNING_CONTENT_VERSION,
        placement: "course_index",
        sourcePage: "/learn/futures-intro",
      });
    }

  }, []);

  const activeLesson =
    view.kind === "lesson" ? getFuturesLesson(view.lessonId) : null;
  const passedQuizKinds = activeLesson
    ? getPassedQuizKinds(progress, activeLesson.id)
    : [];

  function handlePathChange(path: LearningPath) {
    if (progress.path === path) {
      return;
    }

    const nextProgress = changeLearningPath(progress, path);
    commitProgress(nextProgress);
    const currentLesson = getFuturesLesson(nextProgress.currentLessonId);
    if (currentLesson) {
      setSelectedChapterId(currentLesson.chapterId);
    }
    setStatusMessage(
      path === "quick"
        ? "已切换到快速路径，已完成记录会保留"
        : "已切换到完整路径，已完成记录会保留",
    );
  }

  function openLesson(lessonId: FuturesLessonId) {
    const lesson = getFuturesLesson(lessonId);
    if (!lesson) {
      return;
    }

    const access = deriveLessonAccess(progress)[lessonId];
    if (access === "locked" || access === "not-in-path") {
      setStatusMessage("请先完成当前路径前面的关卡");
      return;
    }

    const nextProgress = setCurrentLesson(progress, lessonId);
    commitProgress(nextProgress);
    setSelectedChapterId(lesson.chapterId);
    setQuizSelections({});
    setQuizFeedback({});
    setView({ kind: "lesson", lessonId });
    setStatusMessage("");
    learningAnalytics.trackLessonStart({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      path: nextProgress.path,
      chapterId: lesson.chapterId,
      lessonId: lesson.id,
    });
    window.requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  }

  function returnToOverview(message = "已返回课程目录") {
    setView({ kind: "overview" });
    setQuizSelections({});
    setQuizFeedback({});
    setStatusMessage(message);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        overviewHeadingRef.current?.focus({ preventScroll: true });
        window.scrollTo({
          top: 0,
          behavior: reduceMotion ? "auto" : "smooth",
        });
      });
    });
  }

  function handleQuizSubmit(
    event: FormEvent<HTMLFormElement>,
    quiz: LessonQuiz,
  ) {
    event.preventDefault();
    if (!activeLesson) {
      return;
    }

    const selectedOptionId = quizSelections[quiz.kind];
    if (!selectedOptionId) {
      setQuizFeedback((current) => ({
        ...current,
        [quiz.kind]: { kind: "missing", message: "请先选择一个答案。" },
      }));
      focusQuizFeedback(quiz.kind);
      return;
    }

    const isCorrect = selectedOptionId === quiz.correctOptionId;
    const wasComplete = progress.completedLessonIds.includes(activeLesson.id);
    const attempt = Math.min(
      getQuizStageState(progress, activeLesson.id, quiz.kind).attempts + 1,
      20,
    );

    learningAnalytics.trackQuizResult({
      courseId: LEARNING_COURSE_ID,
      contentVersion: LEARNING_CONTENT_VERSION,
      path: progress.path,
      chapterId: activeLesson.chapterId,
      lessonId: activeLesson.id,
      quizKind: quiz.kind,
      result: isCorrect ? "correct" : "incorrect",
      attempt,
    });

    if (isCorrect) {
      let nextProgress = recordQuizStageResult(
        progress,
        activeLesson.id,
        quiz.kind,
        true,
      );
      const nextPassedQuizKinds = getPassedQuizKinds(
        nextProgress,
        activeLesson.id,
      );
      const passedEveryQuiz = activeLesson.quizzes.every((item) =>
        nextPassedQuizKinds.includes(item.kind),
      );
      setQuizFeedback((current) => ({
        ...current,
        [quiz.kind]: {
          kind: "correct",
          message: quiz.correctExplanation,
        },
      }));

      if (!passedEveryQuiz) {
        const currentIndex = activeLesson.quizzes.findIndex(
          (item) => item.kind === quiz.kind,
        );
        const nextQuiz = activeLesson.quizzes[currentIndex + 1];
        const currentLabel = quizStageMeta[quiz.kind].label;
        const nextLabel = nextQuiz ? quizStageMeta[nextQuiz.kind].label : "下一项";
        commitProgress(nextProgress);
        setStatusMessage(
          `${currentLabel}已通过。${quiz.correctExplanation} ${nextLabel}已解锁。`,
        );
        window.requestAnimationFrame(() => {
          document.getElementById(`lesson-quiz-${nextQuiz?.kind}`)?.focus();
        });
        return;
      }

      nextProgress = completeLesson(nextProgress, activeLesson.id);
      const completion = getCourseCompletion(nextProgress);

      if (!wasComplete) {
        learningAnalytics.trackLessonComplete({
          courseId: LEARNING_COURSE_ID,
          contentVersion: LEARNING_CONTENT_VERSION,
          path: nextProgress.path,
          chapterId: activeLesson.chapterId,
          lessonId: activeLesson.id,
        });
      }

      if (!wasComplete && completion.isComplete) {
        learningAnalytics.trackCourseComplete({
          courseId: LEARNING_COURSE_ID,
          contentVersion: LEARNING_CONTENT_VERSION,
          path: nextProgress.path,
        });
      }

      commitProgress(nextProgress);
      setStatusMessage(
        completion.isComplete
          ? "本关三项理解检查已全部完成，当前学习路径已经完成。焦点已移至完成学习按钮。"
          : "本关三项理解检查已全部完成，下一关已解锁。焦点已移至下一关按钮。",
      );
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => nextLessonButtonRef.current?.focus());
      });
      return;
    } else {
      const nextProgress = recordQuizStageResult(
        progress,
        activeLesson.id,
        quiz.kind,
        false,
      );
      setQuizFeedback((current) => ({
        ...current,
        [quiz.kind]: {
          kind: "incorrect",
          message: quiz.incorrectExplanation,
        },
      }));
      commitProgress(nextProgress);
    }

    focusQuizFeedback(quiz.kind);
  }

  function retryQuiz(quizKind: QuizKind) {
    setQuizSelections((current) => ({ ...current, [quizKind]: undefined }));
    setQuizFeedback((current) => ({ ...current, [quizKind]: undefined }));
    setStatusMessage("可以重新观察教学示意，再回答一次");
    window.requestAnimationFrame(() => {
      document.getElementById(`lesson-quiz-${quizKind}`)?.focus();
    });
  }

  function focusQuizFeedback(quizKind: QuizKind) {
    window.requestAnimationFrame(() => {
      document.getElementById(`quiz-feedback-${quizKind}`)?.focus();
    });
  }

  function goToNextLesson() {
    if (!activeLesson) {
      return;
    }

    const lessonIds = lessonIdsForPath(progress.path);
    const currentIndex = lessonIds.indexOf(activeLesson.id);
    const nextLessonId = lessonIds[currentIndex + 1];
    if (!nextLessonId) {
      returnToOverview(
        progress.path === "quick"
          ? "快速路径已完成。你可以切换完整路径继续学习。"
          : "完整课程已完成。你可以从目录重新复习任何关卡。",
      );
      return;
    }

    openLesson(nextLessonId);
  }

  function confirmReset() {
    const nextProgress = resetCourseProgress(progress.path);
    const persisted = publishReset(nextProgress);
    setSelectedChapterId(course.chapters[0].id);
    setView({ kind: "overview" });
    setResetPending(false);
    setQuizSelections({});
    setQuizFeedback({});
    setStatusMessage(
      persisted
        ? "学习进度已清除"
        : "本次进度已重置，但浏览器未允许修改本地存储",
    );
  }

  function commitProgress(nextProgress: CourseProgress) {
    const persisted = publishProgress(nextProgress);
    if (!persisted) {
      setStatusMessage("浏览器未能保存进度，本次学习仍可继续");
    }
  }

  return (
    <div className={styles.experience}>
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {activeLesson ? (
        <LessonView
          course={course}
          lesson={activeLesson}
          progress={progress}
          quizFeedback={quizFeedback}
          quizSelections={quizSelections}
          passedQuizKinds={passedQuizKinds}
          headingRef={lessonHeadingRef}
          nextButtonRef={nextLessonButtonRef}
          onBack={() => returnToOverview()}
          onOptionChange={(quizKind, optionId) => {
            setQuizSelections((current) => ({
              ...current,
              [quizKind]: optionId,
            }));
            if (quizFeedback[quizKind]) {
              setQuizFeedback((current) => ({
                ...current,
                [quizKind]: undefined,
              }));
            }
          }}
          onSubmit={handleQuizSubmit}
          onRetry={retryQuiz}
          onNext={goToNextLesson}
        />
      ) : (
        <CourseOverview
          course={course}
          progress={progress}
          headingRef={overviewHeadingRef}
          expandedChapterId={expandedChapterId}
          statusMessage={statusMessage}
          resetPending={resetPending}
          onPathChange={handlePathChange}
          onChapterChange={setSelectedChapterId}
          onOpenLesson={openLesson}
          onResetRequest={() => setResetPending(true)}
          onResetCancel={() => setResetPending(false)}
          onResetConfirm={confirmReset}
        />
      )}
    </div>
  );
}

function CourseOverview({
  course,
  progress,
  headingRef,
  expandedChapterId,
  statusMessage,
  resetPending,
  onPathChange,
  onChapterChange,
  onOpenLesson,
  onResetRequest,
  onResetCancel,
  onResetConfirm,
}: {
  course: FuturesIntroCourse;
  progress: CourseProgress | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  expandedChapterId: FuturesChapterId;
  statusMessage: string;
  resetPending: boolean;
  onPathChange: (path: LearningPath) => void;
  onChapterChange: (chapterId: FuturesChapterId) => void;
  onOpenLesson: (lessonId: FuturesLessonId) => void;
  onResetRequest: () => void;
  onResetCancel: () => void;
  onResetConfirm: () => void;
}) {
  const path = progress?.path ?? "quick";
  const completion = progress
    ? getCourseCompletion(progress)
    : { completed: 0, total: 8, percent: 0, isComplete: false, nextLessonId: null };
  const access = progress ? deriveLessonAccess(progress) : null;
  const startLessonId =
    completion.nextLessonId ?? lessonIdsForPath(path)[0] ?? null;
  const hasProgress = Boolean(progress && progress.completedLessonIds.length > 0);

  return (
    <div className={`${styles.page} page-container`}>
      <BackToLearnLink currentLabel="合约入门" />

      <header className={styles.courseHero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>学习 · 合约入门</p>
          <h1 ref={headingRef} tabIndex={-1}>{course.title}</h1>
          <p>{course.summary}</p>
          <div className={styles.courseFacts} aria-label="课程概况">
            <span>5 章</span>
            <span>26 关</span>
            <span>每关 3 层理解检查</span>
            <span>进度仅保存在本机</span>
          </div>
        </div>

        <div className={styles.progressCard}>
          <div className={styles.progressHeading}>
            <span>{path === "quick" ? "快速路径" : "完整路径"}</span>
            <strong>
              {completion.completed}/{completion.total}
            </strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="课程完成进度"
            aria-valuemin={0}
            aria-valuemax={completion.total}
            aria-valuenow={completion.completed}
          >
            <span style={{ width: `${completion.percent}%` }} />
          </div>
          <p>
            {completion.isComplete
              ? "这条路径已经完成，可以继续复习或切换路径。"
              : hasProgress
                ? "从上次停下的位置继续。"
                : "先选路径，再从第一关开始。"}
          </p>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!progress || !startLessonId}
            onClick={() => startLessonId && onOpenLesson(startLessonId)}
          >
            {hasProgress && !completion.isComplete
              ? "继续学习"
              : completion.isComplete
                ? "从第一关复习"
                : "开始第一关"}
            <ArrowIcon />
          </button>
        </div>
      </header>

      <section className={styles.pathSection} aria-labelledby="path-title">
        <div>
          <p className={styles.sectionEyebrow}>选择学习方式</p>
          <h2 id="path-title">先走核心路径，也可以一次学完整</h2>
        </div>
        <div
          className={styles.pathChoices}
          role="group"
          aria-label="学习路径"
          aria-describedby="learning-path-note"
        >
          <button
            type="button"
            aria-pressed={path === "quick"}
            onClick={() => onPathChange("quick")}
            disabled={!progress}
          >
            <span>快速路径</span>
            <strong>8 个核心关卡</strong>
            <small>约 45–60 分钟</small>
          </button>
          <button
            type="button"
            aria-pressed={path === "full"}
            onClick={() => onPathChange("full")}
            disabled={!progress}
          >
            <span>完整路径</span>
            <strong>全部 26 关</strong>
            <small>约 2.5–3 小时</small>
          </button>
        </div>
        <p className={styles.pathNote} id="learning-path-note">
          两条路径共用完成记录。快速路径仅作概念导览，不代表已具备真实合约操作准备；标记价、保证金模式、资金费率等完整规则请学习完整路径。
        </p>
      </section>

      <section className={styles.curriculum} aria-labelledby="curriculum-title">
        <header className={styles.curriculumHeader}>
          <div>
            <p className={styles.sectionEyebrow}>五章学习路径</p>
            <h2 id="curriculum-title">现在只展开需要关注的章节</h2>
          </div>
          <p>理解机制 → 动手观察 → 情境应用 → 风险边界</p>
        </header>

        <ol className={styles.chapterList}>
          {course.chapters.map((chapter) => {
            const chapterLessons = chapter.lessons;
            const pathChapterLessons =
              path === "quick"
                ? chapterLessons.filter((lesson) => lesson.isQuickPath)
                : chapterLessons;
            const completedCount = progress
              ? pathChapterLessons.filter((lesson) =>
                  progress.completedLessonIds.includes(lesson.id),
                ).length
              : 0;
            const chapterProgressLabel =
              path === "quick" && pathChapterLessons.length === 0
                ? `${chapterLessons.length} 关完整课程`
                : path === "quick"
                  ? `${completedCount}/${pathChapterLessons.length} 核心`
                  : `${completedCount}/${chapterLessons.length}`;
            const expanded = chapter.id === expandedChapterId;

            return (
              <li className={styles.chapter} data-expanded={expanded} key={chapter.id}>
                <button
                  className={styles.chapterButton}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`chapter-content-${chapter.id}`}
                  onClick={() => onChapterChange(chapter.id)}
                >
                  <span className={styles.chapterNumber} aria-hidden="true">
                    {String(chapter.order).padStart(2, "0")}
                  </span>
                  <span className={styles.chapterCopy}>
                    <strong>{chapter.title}</strong>
                    <small>{chapter.summary}</small>
                  </span>
                  <span className={styles.chapterProgress}>
                    {chapterProgressLabel}
                  </span>
                  <ChevronIcon expanded={expanded} />
                </button>

                {expanded ? (
                  <div className={styles.chapterContent} id={`chapter-content-${chapter.id}`}>
                    <section className={styles.chapterIntroduction} aria-label={`${chapter.title}导读`}>
                      <div>
                        <span>本章导读</span>
                        <p>{chapter.introduction}</p>
                      </div>
                      <div>
                        <span>
                          {path === "quick" ? "完整章节学完你能" : "学完你能"}
                        </span>
                        <ul>
                          {chapter.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                        <p className={styles.chapterOutcome}>
                          {path === "quick" ? "完整路径目标：" : null}
                          {chapter.completionOutcome}
                        </p>
                      </div>
                    </section>
                    <ol className={styles.lessonList} id={`chapter-lessons-${chapter.id}`}>
                      {chapterLessons.map((lesson) => {
                        const lessonAccess = access?.[lesson.id] ?? "locked";
                        const disabled =
                          !progress ||
                          lessonAccess === "locked" ||
                          lessonAccess === "not-in-path";
                        return (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              disabled={disabled}
                              data-access={lessonAccess}
                              onClick={() => onOpenLesson(lesson.id)}
                            >
                              <span className={styles.lessonOrder}>
                                {String(lesson.order).padStart(2, "0")}
                              </span>
                              <span className={styles.lessonCopy}>
                                <strong>{lesson.title}</strong>
                                <small>{lesson.summary}</small>
                              </span>
                              {lesson.isQuickPath ? (
                                <span className={styles.quickLabel}>快速路径</span>
                              ) : null}
                              <span className={styles.lessonState}>
                                {accessLabel(lessonAccess)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.safetyNote} aria-labelledby="safety-title">
        <span className={styles.safetyIcon} aria-hidden="true">!</span>
        <div>
          <h2 id="safety-title">先理解风险，再考虑是否交易</h2>
          <p>{course.riskNote}</p>
        </div>
      </section>

      <div className={styles.courseActions}>
        <button type="button" onClick={onResetRequest} disabled={!progress}>
          清除本地进度
        </button>
      </div>

      {statusMessage ? (
        <p className={styles.visibleStatus}>
          {statusMessage}
        </p>
      ) : null}

      {resetPending ? (
        <ResetDialog onCancel={onResetCancel} onConfirm={onResetConfirm} />
      ) : null}
    </div>
  );
}

function ResetDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        window.requestAnimationFrame(() => previouslyFocused.focus());
      }
    };
  }, [onCancel]);

  return (
    <div
      className={styles.resetDialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-title"
      aria-describedby="reset-description"
      ref={dialogRef}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div>
        <p className={styles.sectionEyebrow}>清除学习记录</p>
        <h2 id="reset-title">确定从头开始吗？</h2>
        <p id="reset-description">
          只会删除这门课程保存在当前浏览器中的进度，无法撤销。
        </p>
        <div className={styles.dialogActions}>
          <button ref={cancelRef} type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onConfirm}>
            确认清除
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonView({
  course,
  lesson,
  progress,
  quizFeedback,
  quizSelections,
  passedQuizKinds,
  headingRef,
  nextButtonRef,
  onBack,
  onOptionChange,
  onSubmit,
  onRetry,
  onNext,
}: {
  course: FuturesIntroCourse;
  lesson: LessonDefinition;
  progress: CourseProgress;
  quizFeedback: QuizFeedbackMap;
  quizSelections: QuizSelections;
  passedQuizKinds: readonly QuizKind[];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  nextButtonRef: React.RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onOptionChange: (quizKind: QuizKind, optionId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, quiz: LessonQuiz) => void;
  onRetry: (quizKind: QuizKind) => void;
  onNext: () => void;
}) {
  const chapter = course.chapters.find((item) => item.id === lesson.chapterId);
  const completion = getCourseCompletion(progress);
  const quizState = getQuizState(progress, lesson.id);
  const isPassed =
    quizState.status === "passed" ||
    lesson.quizzes.every((quiz) => passedQuizKinds.includes(quiz.kind));
  const lessonIds = lessonIdsForPath(progress.path);
  const isLastLesson = lessonIds.at(-1) === lesson.id;

  return (
    <div
      className={`${styles.page} ${styles.lessonPage} page-container`}
      data-chapter={lesson.chapterId}
    >
      <header className={styles.lessonTopbar}>
        <div className={styles.lessonNavigation}>
          <BackToLearnLink currentLabel="合约入门" />
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label="返回课程目录"
          >
            <BackIcon />
            <span>返回目录</span>
          </button>
        </div>
        <div className={styles.lessonTopProgress}>
          <span>
            <strong>{lessonIds.indexOf(lesson.id) + 1}</strong> / {lessonIds.length}
          </span>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="当前路径完成进度"
            aria-valuetext={`已完成 ${completion.completed} / ${completion.total} 关`}
            aria-valuemin={0}
            aria-valuemax={completion.total}
            aria-valuenow={completion.completed}
          >
            <span style={{ width: `${completion.percent}%` }} />
          </div>
        </div>
      </header>

      <article className={styles.lessonArticle}>
        <header className={styles.lessonHeader}>
          <div className={styles.lessonMetaLine}>
            <p className={styles.lessonChapter}>
              第 {chapter?.order ?? "—"} 章 · {chapter?.title ?? "合约入门"}
            </p>
            <span>约 {lesson.deepDive.estimatedMinutes} 分钟</span>
          </div>
          <h1 ref={headingRef} tabIndex={-1}>{lesson.title}</h1>
          <p className={styles.lessonFocus}>
            <span>这一关先看懂</span>
            <strong>{lesson.takeaway}</strong>
          </p>
          <p className={styles.lessonSummary}>{lesson.summary}</p>
        </header>

        <LessonKnowledge lesson={lesson} />

        <LessonMechanism lesson={lesson} />

        <LessonVisual key={lesson.id} lesson={lesson} />

        <LessonCaseStudy lesson={lesson} />

        <LessonBoundaries lesson={lesson} />

        <LessonAssessment
          lesson={lesson}
          persistedPass={quizState.status === "passed"}
          feedback={quizFeedback}
          selections={quizSelections}
          passedQuizKinds={passedQuizKinds}
          onOptionChange={onOptionChange}
          onSubmit={onSubmit}
          onRetry={onRetry}
        />
      </article>

      {isPassed ? (
        <div className={styles.stickyNext}>
          <button
            ref={nextButtonRef}
            type="button"
            onClick={onNext}
            aria-label={isLastLesson ? "完成学习并返回课程目录" : "进入下一关"}
          >
            {isLastLesson ? "完成学习" : "下一关"}
            <ArrowIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LessonKnowledge({ lesson }: { lesson: LessonDefinition }) {
  const { explanation } = lesson;

  if (lesson.interaction.kind === "spot-perpetual-comparison") {
    return <SpotPerpetualKnowledge lesson={lesson} />;
  }

  return (
    <section className={styles.lessonKnowledge} aria-labelledby="lesson-knowledge-title">
      <h2 className={styles.visuallyHidden} id="lesson-knowledge-title">
        本关核心知识
      </h2>

      <div className={styles.conceptPair} data-generic="true">
        <article className={styles.conceptCard} data-tone="blue">
          <span className={styles.conceptNumber} aria-hidden="true">01</span>
          <h3>是什么</h3>
          <p>{explanation.definition}</p>
        </article>
        <article className={styles.conceptCard} data-tone="accent">
          <span className={styles.conceptNumber} aria-hidden="true">02</span>
          <h3>为什么重要</h3>
          <p>{explanation.whyItMatters}</p>
        </article>
      </div>

      <ol className={styles.knowledgePoints} aria-label="三个关键点">
        {explanation.keyPoints.map((point, index) => (
          <li key={point}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p>{point}</p>
          </li>
        ))}
      </ol>

      <div className={styles.knowledgeDesktopMore}>
        <KnowledgeItem label="简单例子" text={explanation.example} tone="purple" />
        <KnowledgeItem label="常见误区" text={explanation.commonMistake} tone="amber" />
      </div>

      <details className={styles.knowledgeMobileMore}>
        <summary>
          继续看原因、例子与误区
          <ChevronIcon expanded={false} />
        </summary>
        <div>
          <KnowledgeItem label="简单例子" text={explanation.example} tone="purple" />
          <KnowledgeItem label="常见误区" text={explanation.commonMistake} tone="amber" />
        </div>
      </details>
    </section>
  );
}

function LessonMechanism({ lesson }: { lesson: LessonDefinition }) {
  const { deepDive } = lesson;

  return (
    <section className={styles.mechanismSection} aria-labelledby="lesson-mechanism-title">
      <header className={styles.deepDiveHeader}>
        <div>
          <span>理解地图</span>
          <h2 id="lesson-mechanism-title">不是背结论，而是看懂它怎么发生</h2>
        </div>
        <p>学完这一段，你应该能自己解释过程，而不只是记住一个名词。</p>
      </header>

      <div className={styles.learningGoals}>
        {deepDive.learningGoals.map((goal, index) => (
          <article key={goal}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>本关目标</small>
              <strong>{goal}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.keyTerms} aria-label="本关关键术语">
        {deepDive.keyTerms.map((item) => (
          <article key={item.term}>
            <strong>{item.term}</strong>
            <p>{item.definition}</p>
          </article>
        ))}
      </div>

      <ol className={styles.mechanismSteps}>
        {deepDive.mechanismSteps.map((step, index) => (
          <li key={`${step.title}-${index}`}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LessonCaseStudy({ lesson }: { lesson: LessonDefinition }) {
  const { workedExample } = lesson.deepDive;

  return (
    <section className={styles.caseStudy} aria-labelledby="lesson-case-title">
      <header className={styles.deepDiveHeader}>
        <div>
          <span>完整例子</span>
          <h2 id="lesson-case-title">把概念放进一个真实决策顺序</h2>
        </div>
        <p>这是教学情景，不代表实时行情，也不是开仓建议。</p>
      </header>

      <p className={styles.caseSetup}>{workedExample.setup}</p>
      <ol className={styles.caseSteps}>
        {workedExample.steps.map((step, index) => (
          <li key={step}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <div className={styles.caseOutcome}>
        <article data-tone="blue">
          <span>可以观察到</span>
          <p>{workedExample.observation}</p>
        </article>
        <article data-tone="amber">
          <span>仍然不能忽略</span>
          <p>{workedExample.limitation}</p>
        </article>
      </div>
    </section>
  );
}

function LessonBoundaries({ lesson }: { lesson: LessonDefinition }) {
  const { boundary, recap, nextLessonBridge } = lesson.deepDive;

  return (
    <section className={styles.boundarySection} aria-labelledby="lesson-boundary-title">
      <header className={styles.deepDiveHeader}>
        <div>
          <span>能力边界</span>
          <h2 id="lesson-boundary-title">这一关能回答什么，不能回答什么</h2>
        </div>
      </header>

      <div className={styles.boundaryGrid}>
        <article data-kind="can">
          <span>能帮助你判断</span>
          <ul>
            {boundary.canTell.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
        <article data-kind="cannot">
          <span>不能直接告诉你</span>
          <ul>
            {boundary.cannotTell.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      </div>

      <div className={styles.lessonRecap}>
        <article>
          <span>离开这一关前</span>
          <p>{recap}</p>
        </article>
        <article>
          <span>下一步会连接到</span>
          <p>{nextLessonBridge}</p>
        </article>
      </div>

      <aside className={styles.riskNote} aria-label="本关风险边界">
        <strong>风险提示</strong>
        <p>{lesson.riskNote}</p>
      </aside>
    </section>
  );
}

const quizStageMeta: Readonly<
  Record<QuizKind, Readonly<{ label: string; description: string }>>
> = Object.freeze({
  concept: {
    label: "概念判断",
    description: "先确认核心定义没有混淆。",
  },
  scenario: {
    label: "情境应用",
    description: "再把知识放进具体场景。",
  },
  boundary: {
    label: "风险边界",
    description: "最后识别它不能证明什么。",
  },
});

function LessonAssessment({
  lesson,
  persistedPass,
  feedback,
  selections,
  passedQuizKinds,
  onOptionChange,
  onSubmit,
  onRetry,
}: {
  lesson: LessonDefinition;
  persistedPass: boolean;
  feedback: QuizFeedbackMap;
  selections: QuizSelections;
  passedQuizKinds: readonly QuizKind[];
  onOptionChange: (quizKind: QuizKind, optionId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, quiz: LessonQuiz) => void;
  onRetry: (quizKind: QuizKind) => void;
}) {
  return (
    <section className={styles.assessmentSection} aria-labelledby="lesson-assessment-title">
      <header className={styles.assessmentHeader}>
        <div>
          <span>理解检查 · 3 步</span>
          <h2 id="lesson-assessment-title">不是猜中一题，就算真正学会</h2>
          <p>依次完成概念、情境和边界判断。三项都正确，才会解锁下一关。</p>
        </div>
        <strong>{persistedPass ? "已完成" : `${passedQuizKinds.length} / 3`}</strong>
      </header>

      <div className={styles.assessmentList}>
        {lesson.quizzes.map((quiz, index) => {
          const previousQuiz = lesson.quizzes[index - 1];
          const complete = persistedPass || passedQuizKinds.includes(quiz.kind);
          const unlocked =
            complete ||
            index === 0 ||
            (previousQuiz ? passedQuizKinds.includes(previousQuiz.kind) : false);
          const selectedOptionId = selections[quiz.kind];
          const currentFeedback = feedback[quiz.kind];
          const meta = quizStageMeta[quiz.kind];

          return (
            <article
              className={styles.assessmentCard}
              data-status={complete ? "complete" : unlocked ? "current" : "locked"}
              data-stage={quiz.kind}
              key={quiz.id}
            >
              <header className={styles.assessmentCardHeader}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <small>{meta.label}</small>
                  <h3>{meta.description}</h3>
                </div>
                <strong>{complete ? "已通过" : unlocked ? "当前" : "待解锁"}</strong>
              </header>

              {complete ? (
                <div className={styles.assessmentPassed}>
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>这一项已经理解</strong>
                    <p>{quiz.correctExplanation}</p>
                  </div>
                </div>
              ) : unlocked ? (
                <form onSubmit={(event) => onSubmit(event, quiz)}>
                  <fieldset>
                    <legend id={`lesson-quiz-${quiz.kind}`} tabIndex={-1}>
                      {quiz.question}
                    </legend>
                    <div className={styles.quizOptions}>
                      {quiz.options.map((option, optionIndex) => (
                        <label
                          data-selected={selectedOptionId === option.id}
                          key={option.id}
                        >
                          <input
                            type="radio"
                            name={`quiz-${lesson.id}-${quiz.kind}`}
                            value={option.id}
                            checked={selectedOptionId === option.id}
                            onChange={() => onOptionChange(quiz.kind, option.id)}
                          />
                          <span aria-hidden="true">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <strong>{option.label}</strong>
                        </label>
                      ))}
                    </div>
                    <button className={styles.submitButton} type="submit">
                      检查这一项
                    </button>
                  </fieldset>

                  {currentFeedback ? (
                    <div
                      className={styles.quizFeedback}
                      data-kind={currentFeedback.kind}
                      id={`quiz-feedback-${quiz.kind}`}
                      role="status"
                      aria-live="polite"
                      tabIndex={-1}
                    >
                      <span aria-hidden="true">!</span>
                      <div>
                        <strong>
                          {currentFeedback.kind === "missing"
                            ? "还没有选择答案"
                            : "这一步需要再想一次"}
                        </strong>
                        <p>{currentFeedback.message}</p>
                      </div>
                    </div>
                  ) : null}

                  {currentFeedback?.kind === "incorrect" ? (
                    <button
                      className={styles.retryButton}
                      type="button"
                      onClick={() => onRetry(quiz.kind)}
                    >
                      清除选择，重新作答
                    </button>
                  ) : null}
                </form>
              ) : (
                <p className={styles.assessmentLocked}>
                  完成上一项后，这里的情境会自动展开。
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SpotPerpetualKnowledge({ lesson }: { lesson: LessonDefinition }) {
  const { explanation } = lesson;

  return (
    <section className={styles.lessonKnowledge} aria-labelledby="lesson-knowledge-title">
      <h2 className={styles.visuallyHidden} id="lesson-knowledge-title">
        现货与永续合约核心对比
      </h2>

      <div className={styles.conceptPair}>
        <article className={styles.conceptCard} data-tone="blue">
          <header className={styles.conceptCardHeader}>
            <ConceptIcon kind="spot" />
            <div>
              <h3>现货</h3>
              <span>账户通常持有对应现货余额</span>
            </div>
          </header>
          <p>买入后账户通常持有对应现货余额，能否提取与如何保管取决于平台规则和账户安排。</p>
          <ul className={styles.conceptTraits}>
            <li>通常有现货余额</li>
            <li>视平台规则可提取</li>
            <li>普通无杠杆现货无合约式强平</li>
          </ul>
        </article>

        <span className={styles.versus} aria-hidden="true">VS</span>

        <article className={styles.conceptCard} data-tone="orange">
          <header className={styles.conceptCardHeader}>
            <ConceptIcon kind="perpetual" />
            <div>
              <h3>永续合约</h3>
              <span>你持有的是合约头寸</span>
            </div>
          </header>
          <p>基于价格波动建立仓位，可做多做空，但存在杠杆和强平风险。</p>
          <ul className={styles.conceptTraits}>
            <li>不增加对应现货余额</li>
            <li>可多可空</li>
            <li>存在强平风险</li>
          </ul>
        </article>
      </div>

      <div className={styles.knowledgeMatrix} role="table" aria-label="现货与永续合约对照">
        <div className={styles.knowledgeMatrixHeader} role="row">
          <span role="columnheader">本质区别</span>
          <strong role="columnheader">现货</strong>
          <strong role="columnheader">永续合约</strong>
        </div>
        <ComparisonRow
          label="盈亏怎么来"
          hint="钱从哪里赚或亏"
          spot="买入价格与卖出价格的差额。"
          perpetual="随标记价格变化；做多、做空都可能盈利或亏损。"
        />
        <ComparisonRow
          label="额外成本"
          hint="除了涨跌还有什么"
          spot="通常只有交易手续费。"
          perpetual="可能产生资金费率和交易手续费。"
        />
        <ComparisonRow
          label="最大风险"
          hint="最坏会怎样"
          spot="资产价格可能持续下跌，但普通无杠杆现货本身不触发合约式强平。"
          perpetual="保证金不足时可能被强制平仓；逐仓可能损失该仓保证金，全仓还可能影响共享余额。"
          risk
        />
      </div>

      <ol className={styles.knowledgePoints} aria-label="三个关键点">
        {explanation.keyPoints.map((point, index) => (
          <li key={point}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p>{point}</p>
          </li>
        ))}
      </ol>

      <div className={styles.knowledgeDesktopMore}>
        <KnowledgeItem label="为什么重要" text={explanation.whyItMatters} tone="blue" />
        <KnowledgeItem label="简单例子" text={explanation.example} tone="purple" />
        <KnowledgeItem label="常见误区" text={explanation.commonMistake} tone="amber" />
      </div>

      <details className={styles.knowledgeMobileMore}>
        <summary>
          继续看原因、例子与误区
          <ChevronIcon expanded={false} />
        </summary>
        <div>
          <KnowledgeItem label="为什么重要" text={explanation.whyItMatters} tone="blue" />
          <KnowledgeItem label="简单例子" text={explanation.example} tone="purple" />
          <KnowledgeItem label="常见误区" text={explanation.commonMistake} tone="amber" />
        </div>
      </details>
    </section>
  );
}

function ComparisonRow({
  label,
  hint,
  spot,
  perpetual,
  risk = false,
}: {
  label: string;
  hint: string;
  spot: string;
  perpetual: string;
  risk?: boolean;
}) {
  return (
    <div className={styles.knowledgeMatrixRow} role="row" data-risk={risk}>
      <div className={styles.comparisonAspect} role="rowheader">
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
      <p role="cell">{spot}</p>
      <p role="cell">{perpetual}</p>
    </div>
  );
}

function KnowledgeItem({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "blue" | "purple" | "amber";
}) {
  return (
    <article className={styles.knowledgeItem} data-tone={tone}>
      <span>{label}</span>
      <p>{text}</p>
    </article>
  );
}

function ConceptIcon({ kind }: { kind: "spot" | "perpetual" }) {
  if (kind === "perpetual") {
    return (
      <span className={styles.conceptIcon} aria-hidden="true">
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <path
            d="M5.2 14c2.5-4.2 4.7-6.3 6.7-6.3 3.1 0 4.5 6.3 7.3 6.3 1.5 0 2.8-1.1 3.6-3M22.8 14c-2.5 4.2-4.7 6.3-6.7 6.3-3.1 0-4.5-6.3-7.3-6.3-1.5 0-2.8 1.1-3.6 3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.3"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={styles.conceptIcon} aria-hidden="true">
      <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
        <path
          d="M6 8.5h15.5v12H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h12.5M17 12h7v5h-7a2.5 2.5 0 0 1 0-5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </span>
  );
}

function lessonIdsForPath(path: LearningPath): readonly FuturesLessonId[] {
  return path === "quick" ? futuresQuickPathLessonIds : futuresFullPathLessonIds;
}

function accessLabel(
  access: "completed" | "current" | "available" | "locked" | "not-in-path",
) {
  if (access === "completed") return "已完成";
  if (access === "current") return "继续";
  if (access === "available") return "开始";
  if (access === "not-in-path") return "完整路径";
  return "待解锁";
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
      <path d="m11.5 5-5 5 5 5M7 10h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" data-expanded={expanded}>
      <path d="m6 8 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}
