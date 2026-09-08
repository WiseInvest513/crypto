import { Suspense, type ReactNode } from "react";
import type { ToolDefinition } from "@/lib/tools/catalog";
import type { ToolAssetSlug } from "@/lib/tools/tool-navigation";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/config/site";
import { BackToToolsLink } from "./back-to-tools-link";
import { ShareToolLink } from "./share-tool-link";
import {
  ToolAssetContextPanel,
  ToolNextStepsPanel,
} from "./tool-navigation-panels";
import {
  ToolAssetContextFromQuery,
  ToolNextStepsFromQuery,
} from "./tool-query-navigation";

export function ToolPageShell({
  tool,
  asset,
  children,
}: {
  tool: ToolDefinition;
  asset?: ToolAssetSlug | null;
  children: ReactNode;
}) {
  const assetResolvedOnServer = asset !== undefined;

  return (
    <div className="tool-page page-container">
      <BreadcrumbJsonLd
        origin={SITE_URL}
        items={[
          { name: "加密工具", path: "/tools" },
          { name: tool.shortTitle, path: tool.href },
        ]}
      />
      <BackToToolsLink currentLabel={tool.shortTitle} />

      <header className="tool-heading">
        <div className="tool-heading__copy">
          <h1>{tool.title}</h1>
          <p>{tool.question}</p>
          <span className="tool-local-label">
            <LockIcon /> 本地计算，不保存输入
          </span>
        </div>
        <div className="tool-heading__actions">
          <ShareToolLink href={tool.href} />
        </div>
      </header>

      {assetResolvedOnServer ? (
        asset ? <ToolAssetContextPanel asset={asset} /> : null
      ) : (
        <Suspense fallback={null}>
          <ToolAssetContextFromQuery />
        </Suspense>
      )}

      <ol className="tool-progress" aria-label="计算流程">
        {getToolSteps(tool.slug).map((step, index) => (
          <li key={step}>
            <span aria-hidden="true">{index + 1}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>

      <div className="calculator-workspace">
        <section className="calculator-surface" aria-label={tool.title}>
          {children}
        </section>
      </div>

      <details className="calculator-guide">
        <summary>
          <span>
            <strong>公式与使用边界</strong>
            <small>查看计算口径、输出与未计因素</small>
          </span>
          <ChevronIcon />
        </summary>
        <div className="calculator-guide__body">
          <section aria-labelledby="calculator-formula-title">
            <h2 id="calculator-formula-title">计算公式</h2>
            <ol>
              {tool.formula.map((formula) => (
                <li key={formula}>{formula}</li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="calculator-output-title">
            <h2 id="calculator-output-title">你会得到</h2>
            <ul>
              {tool.outputs.map((output) => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          </section>
          <section className="calculator-guide__warning" aria-labelledby="calculator-caveat-title">
            <h2 id="calculator-caveat-title">使用边界</h2>
            <p>{tool.caveat}</p>
          </section>
        </div>
      </details>

      {assetResolvedOnServer ? (
        <ToolNextStepsPanel asset={asset ?? null} toolSlug={tool.slug} />
      ) : (
        <Suspense
          fallback={<ToolNextStepsPanel asset={null} toolSlug={tool.slug} />}
        >
          <ToolNextStepsFromQuery toolSlug={tool.slug} />
        </Suspense>
      )}

      <p className="tool-disclaimer">
        计算结果仅用于教育与计划整理，不构成交易建议。市场波动、执行条件和交易所规则都可能令实际结果不同。
      </p>
    </div>
  );
}

function getToolSteps(toolSlug: ToolDefinition["slug"]): readonly string[] {
  if (toolSlug === "dca") {
    return ["设置投入计划", "匹配历史日线", "查看回看结果"];
  }

  if (toolSlug === "risk-reward") {
    return ["设置价格计划", "检查价格关系", "查看风险回报"];
  }

  return ["填写计算条件", "确认价格情景", "查看估算结果"];
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      <rect x="4.25" y="8.25" width="11.5" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.75 8.25V6.5a3.25 3.25 0 0 1 6.5 0v1.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none">
      <path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}
