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
        <span>{assetLabel} 工具上下文</span>
        <p>仅保留资产名称，没有带入价格、余额或交易计划。</p>
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
          <h2 id="tool-next-steps-title">
            {toolSlug === "dca" ? "继续查看长期结构" : "继续检查计划"}
          </h2>
        </div>
      </header>
      <ul className="tool-next-steps__links">
        {nextSteps.map((step) => (
          <li key={step.href}>
            <Link href={step.href}>
              <span>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="tool-next-steps__privacy">
        只打开空白页面，不会传递当前输入或计算结果。
      </p>
    </section>
  );
}
