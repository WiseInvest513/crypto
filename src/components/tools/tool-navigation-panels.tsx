import Link from "next/link";
import type { ToolSlug } from "@/lib/tools/catalog";
import {
  getToolAssetLabel,
  getToolNextSteps,
  type ToolAssetSlug,
} from "@/lib/tools/tool-navigation";

export function ToolAssetContextPanel({
  asset,
}: {
  asset: ToolAssetSlug;
}) {
  const assetLabel = getToolAssetLabel(asset);

  return (
    <aside
      className="tool-asset-context"
      aria-label={`${assetLabel} 工具上下文`}
    >
      <div>
        <span>来自 {assetLabel} 资产工作台</span>
        <p>这里只保留资产名称；价格、余额、交易计划和计算结果均未带入。</p>
      </div>
      <Link href={`/${asset}`}>返回 {assetLabel} 工作台</Link>
    </aside>
  );
}

export function ToolNextStepsPanel({
  toolSlug,
  asset,
}: {
  toolSlug: ToolSlug;
  asset: ToolAssetSlug | null;
}) {
  const nextSteps = getToolNextSteps(toolSlug, asset);

  return (
    <section className="tool-next-steps" aria-labelledby="tool-next-steps-title">
      <header>
        <div>
          <p className="panel-kicker">中性下一步</p>
          <h2 id="tool-next-steps-title">
            {toolSlug === "dca" ? "继续查看长期结构" : "继续检查计划"}
          </h2>
        </div>
        <p>
          {toolSlug === "dca"
            ? "下方只返回资产工作台，不会携带定投计划或计算结果。"
            : "下方只打开空白工具；资产名称可保留，但不会携带任何金融输入或计算结果。"}
        </p>
      </header>
      <div className="tool-next-steps__links">
        {nextSteps.map((step) => (
          <Link href={step.href} key={step.href}>
            <span>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
