import {
  futuresFullPathLessonIds,
  futuresIntroCourse,
  futuresQuickPathLessonIds,
} from "@/lib/learning/futures-course";

export const learningCourseSlugs = ["futures-intro"] as const;

export type LearningCourseSlug = (typeof learningCourseSlugs)[number];

export type LearningCourseDefinition = Readonly<{
  slug: LearningCourseSlug;
  href: `/learn/${LearningCourseSlug}`;
  title: string;
  description: string;
  chapterCount: number;
  lessonCount: number;
  quickLessonCount: number;
  chapters: readonly string[];
}>;

export const futuresIntroCourseSummary: LearningCourseDefinition =
  Object.freeze({
    slug: "futures-intro",
    href: "/learn/futures-intro",
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

export const learningCatalog: readonly LearningCourseDefinition[] =
  Object.freeze([futuresIntroCourseSummary]);
