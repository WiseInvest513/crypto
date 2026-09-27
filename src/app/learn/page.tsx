import type { Metadata } from "next";
import Link from "next/link";
import { learningCatalog } from "@/lib/learning/catalog";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "学习中心",
  description:
    "在独立学习中心按章节理解合约规则、杠杆风险、K 线、关键区域与交易计划。",
  path: "/learn",
  socialTitle: "学习中心 — Wise Crypto",
  useSiteImage: true,
});

export default async function LearnPage() {
  await requireWisePageAccount("/learn");

  return (
    <div className="learn-index page-container">
      <header className="learn-hero">
        <div className="learn-hero__copy">
          <p className="learn-eyebrow">Wise Crypto · 学习中心</p>
          <h1>系统学习，从合约入门开始</h1>
          <p>
            课程与计算工具已经分开。这里集中放置完成并核验过的学习内容，当前先从合约基础开始。
          </p>
        </div>

        <aside className="learn-hero__trust" aria-label="学习数据说明">
          <ShieldIcon />
          <span>
            <strong>学习进度只在当前设备保存</strong>
            答题选择与学习进度不会上传
          </span>
        </aside>
      </header>

      <section className="learn-library" aria-labelledby="learn-library-title">
        <header className="learn-library__heading">
          <div>
            <p className="learn-eyebrow">当前课程</p>
            <h2 id="learn-library-title">先把核心机制学清楚</h2>
          </div>
          <p>课程内容独立成章；新内容会在完成核验后再加入这里。</p>
        </header>

        <ul className="learn-course-list">
          {learningCatalog.map((course) => (
            <li className="learn-course" key={course.slug}>
              <div className="learn-course__intro">
                <span className="learn-course__icon" aria-hidden="true">
                  <CourseIcon />
                </span>

                <div className="learn-course__copy">
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>

                  <ul className="learn-course__meta" aria-label={`${course.title}课程信息`}>
                    <li>
                      <strong>{course.chapterCount}</strong> 章
                    </li>
                    <li>
                      <strong>{course.lessonCount}</strong> 关
                    </li>
                    <li>
                      快速路径 <strong>{course.quickLessonCount}</strong> 关
                    </li>
                    <li>本地保存进度</li>
                  </ul>

                  <Link className="learn-course__action" href={course.href}>
                    开始学习
                    <ArrowIcon />
                  </Link>
                </div>
              </div>

              <ol
                className="learn-course__chapters"
                aria-label={`${course.title}章节`}
              >
                {course.chapters.map((chapter, index) => (
                  <li key={chapter}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{chapter}</strong>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </section>

      <p className="learn-disclaimer">
        学习内容用于理解机制与风险，不构成投资建议，也不代表完成课程后能够获得收益。
      </p>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <path d="M12 3 19 6v5.2c0 4.5-2.8 7.9-7 9.8-4.2-1.9-7-5.3-7-9.8V6l7-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function CourseIcon() {
  return (
    <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
      <path d="M4.5 7.5c3.6-1.45 7.25-.9 11.5 1.9v16.1c-4.25-2.8-7.9-3.35-11.5-1.9V7.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M27.5 7.5c-3.6-1.45-7.25-.9-11.5 1.9v16.1c4.25-2.8 7.9-3.35 11.5-1.9V7.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M21 7v7.5l2-1.25 2 1.25V6.9" stroke="#d97706" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}
