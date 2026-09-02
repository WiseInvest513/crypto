import Link from "next/link";
import type { ReactNode } from "react";
import type { ToolDefinition } from "@/lib/tools/catalog";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/config/site";
import { ShareToolLink } from "./share-tool-link";

export function ToolPageShell({
  tool,
  children,
}: {
  tool: ToolDefinition;
  children: ReactNode;
}) {
  return (
    <div className="tool-page page-container">
      <BreadcrumbJsonLd
        origin={SITE_URL}
        items={[
          { name: "加密工具", path: "/tools" },
          { name: tool.shortTitle, path: tool.href },
        ]}
      />
      <nav className="tool-breadcrumb" aria-label="面包屑导航">
        <Link href="/tools">加密工具</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tool.shortTitle}</span>
      </nav>

      <header className="tool-heading">
        <div>
          <p className="page-kicker">决策工具 · {tool.index}</p>
          <h1>{tool.title}</h1>
          <p>{tool.description}</p>
        </div>
        <div className="tool-heading__actions">
          <span className="tool-local-label">本地计算 · 不保存输入</span>
          <ShareToolLink href={tool.href} />
        </div>
      </header>

      <div className="calculator-workspace">
        <section className="calculator-surface" aria-label={`${tool.shortTitle}计算器`}>
          {children}
        </section>
        <aside className="calculator-guide" aria-labelledby="calculator-guide-title">
          <section>
            <p className="panel-kicker">计算口径</p>
            <h2 id="calculator-guide-title">公式与边界</h2>
            <ol>
              {tool.formula.map((formula) => (
                <li key={formula}>{formula}</li>
              ))}
            </ol>
          </section>
          <section>
            <h3>本工具输出</h3>
            <ul>
              {tool.outputs.map((output) => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          </section>
          <section className="calculator-guide__warning">
            <h3>使用前请注意</h3>
            <p>{tool.caveat}</p>
          </section>
        </aside>
      </div>

      <p className="tool-disclaimer">
        计算结果仅用于教育与计划整理，不构成交易建议。市场波动、执行条件和交易所规则都可能令实际结果不同。
      </p>
    </div>
  );
}
