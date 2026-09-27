import type { Metadata } from "next";
import Link from "next/link";
import { toolCatalog, type ToolDefinition } from "@/lib/tools/catalog";
import { createProtectedPageMetadata } from "@/lib/seo/page-metadata";
import { requireWisePageAccount } from "@/server/auth/wise-route-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createProtectedPageMetadata({
  title: "加密工具",
  description:
    "使用仓位、杠杆、定投和风险回报四个独立计算器，检查交易与投入计划中的关键风险。",
  path: "/tools",
  useSiteImage: true,
});

export default async function ToolsPage() {
  await requireWisePageAccount("/tools");

  return <ToolsIndexContent />;
}

function ToolsIndexContent() {
  return (
    <div className="tools-index page-container">
      <header className="tools-hero">
        <div>
          <h1>交易前，先把风险弄明白</h1>
          <p>
            用四个独立计算工具核对仓位、杠杆、风险回报与投入计划。页面不替你决定开多、开空或投入多少。
          </p>
        </div>
        <p className="tools-hero__trust">
          <ShieldIcon />
          <span>
            <strong>只在当前设备计算</strong>
            计算输入不保存，也不会上传
          </span>
        </p>
      </header>

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
