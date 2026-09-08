import type { Metadata } from "next";
import Link from "next/link";
import {
  futuresIntroTool,
  toolCatalog,
  type ToolDefinition,
} from "@/lib/tools/catalog";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "加密工具",
  description:
    "通过合约入门学习工具理解交易规则与风险，并使用仓位、杠杆、定投和风险回报计算器检查计划。",
  path: "/tools",
  useSiteImage: true,
});

export default function ToolsPage() {
  return (
    <div className="tools-index page-container">
      <header className="tools-hero">
        <div>
          <h1>交易前，先把风险弄明白</h1>
          <p>
            先学会看懂合约的关键机制，再用计算工具检查自己的计划。页面不替你决定开多、开空或投入多少。
          </p>
        </div>
        <p className="tools-hero__trust">
          <ShieldIcon />
          <span>
            <strong>只在当前设备学习与计算</strong>
            学习进度保存在本地，计算输入不上传
          </span>
        </p>
      </header>

      <section className="tools-learning" aria-labelledby="tools-learning-title">
        <div className="tools-learning__intro">
          <span className="tools-learning__icon" aria-hidden="true">
            <CourseIcon />
          </span>

          <div className="tools-learning__copy">
            <h2 id="tools-learning-title">{futuresIntroTool.title}</h2>
            <p>{futuresIntroTool.description}</p>

            <ul className="tools-learning__meta" aria-label="课程信息">
              <li>
                <strong>{futuresIntroTool.chapterCount}</strong> 章
              </li>
              <li>
                <strong>{futuresIntroTool.lessonCount}</strong> 关
              </li>
              <li>
                快速路径 <strong>{futuresIntroTool.quickLessonCount}</strong> 关
              </li>
              <li>本地保存进度</li>
            </ul>

            <Link
              className="tools-learning__action"
              href={futuresIntroTool.href}
            >
              开始学习
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <ol className="tools-learning__chapters" aria-label="合约入门五章">
          {futuresIntroTool.chapters.map((chapter, index) => (
            <li key={chapter}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{chapter}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="tools-selector" aria-labelledby="tools-selector-title">
        <header className="tools-selector__heading">
          <div>
            <h2 id="tools-selector-title">从当前问题开始</h2>
            <p>每个工具都有独立分享 URL，且不会携带你的输入和结果。</p>
          </div>
          <span>4 个独立计算工具</span>
        </header>

        <ul className="tools-card-grid" aria-label="计算工具">
          {toolCatalog.map((tool) => (
            <li className="tools-card" key={tool.slug}>
              <Link href={tool.href} data-tool={tool.slug}>
                <div className="tools-card__top">
                  <span className="tools-card__icon" aria-hidden="true">
                    <ToolIcon slug={tool.slug} />
                  </span>
                  <small>{categoryLabel(tool)}</small>
                </div>

                <div className="tools-card__copy">
                  <h3>{tool.shortTitle}</h3>
                  <p>{tool.question}</p>
                </div>

                <dl className="tools-card__facts">
                  <div>
                    <dt>需要填写</dt>
                    <dd>{tool.inputSummary}</dd>
                  </div>
                  <div>
                    <dt>核心结果</dt>
                    <dd>{tool.primaryOutput}</dd>
                  </div>
                </dl>

                <span className="tools-card__action">
                  打开工具
                  <ArrowIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="tools-disclaimer">
        工具结果仅用于教育与计划整理，不构成投资建议；手续费、滑点、资金费率、税务和执行差异可能改变实际结果。
      </p>
    </div>
  );
}

function categoryLabel(tool: ToolDefinition) {
  if (tool.category === "long-term") return "长期计划";
  if (tool.category === "leverage") return "使用杠杆前";
  return "交易计划";
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
      <path
        d="M4.5 7.5c3.6-1.45 7.25-.9 11.5 1.9v16.1c-4.25-2.8-7.9-3.35-11.5-1.9V7.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M27.5 7.5c-3.6-1.45-7.25-.9-11.5 1.9v16.1c4.25-2.8 7.9-3.35 11.5-1.9V7.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M21 7v7.5l2-1.25 2 1.25V6.9"
        stroke="#d97706"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ToolIcon({ slug }: { slug: ToolDefinition["slug"] }) {
  if (slug === "position-size") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 7h8v3H8zM8.5 14h1m3 0h1m3 0h-1m-7 3h1m3 0h1m3 0h-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (slug === "leverage") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <path d="M4 17.5h16M6.5 14l3.2-3.2 2.7 2.6L18 7.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M14.8 7.8H18v3.3M6 6.5h3M7.5 5v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (slug === "dca") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.8v3.4m8-3.4v3.4M4.8 9.3h14.4M9 14.3a3.4 3.4 0 0 1 5.9-2.3m.1 2.7a3.4 3.4 0 0 1-5.9 2.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m14.8 10.5.2 2.2-2.2.2M9.2 18.5 9 16.3l2.2-.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (slug === "risk-reward") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="m14.5 9.5 5-5m0 0v3.2m0-3.2h-3.2M12 12l4.3-4.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  const exhaustiveSlug: never = slug;
  return exhaustiveSlug;
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}
