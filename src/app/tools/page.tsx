import type { Metadata } from "next";
import Link from "next/link";
import { toolCatalog } from "@/lib/tools/catalog";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = createPageMetadata({
  title: "加密工具",
  description:
    "实用的加密计算工具，提供透明公式、输入校验与清晰的计算假设。",
  path: "/tools",
  useSiteImage: true,
});

export default function ToolsPage() {
  return (
    <div className="tools-index page-container">
      <header className="tools-index__heading">
        <div>
          <p className="page-kicker">决策工具</p>
          <h1>加密工具</h1>
          <p>
            把仓位、杠杆、定投与风险回报拆成可检查的公式。输入只在当前设备计算，结果不会被包装成投资判断。
          </p>
        </div>
        <dl className="tools-index__summary" aria-label="工具范围">
          <div>
            <dt>工具</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>金融输入</dt>
            <dd>仅本机</dd>
          </div>
          <div>
            <dt>计价</dt>
            <dd>透明</dd>
          </div>
        </dl>
      </header>

      <section className="tools-catalog" aria-labelledby="tools-catalog-title">
        <div className="section-bar">
          <div>
            <p className="panel-kicker">计算工作台</p>
            <h2 id="tools-catalog-title">选择一个工具</h2>
          </div>
          <span className="section-context">每个工具都有独立分享 URL</span>
        </div>
        <div className="tools-catalog__grid">
          {toolCatalog.map((tool) => (
            <Link className="tool-card" href={tool.href} key={tool.slug}>
              <span className="tool-card__index" aria-hidden="true">
                {tool.index}
              </span>
              <span className="tool-card__body">
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
                <small>{tool.outputs.join(" · ")}</small>
              </span>
              <span className="tool-card__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="tools-privacy-note" aria-labelledby="tools-privacy-title">
        <div>
          <p className="panel-kicker">隐私优先</p>
          <h2 id="tools-privacy-title">金融输入不进入 Analytics</h2>
        </div>
        <p>
          仅保留匿名的工具打开与完成事件接口；账户余额、价格、止损、目标和计算结果不会作为事件字段发送。
        </p>
      </section>
    </div>
  );
}
