import "server-only";

import { Suspense } from "react";
import {
  resolveAssetEditorialEntry,
  type AssetEditorialEntries,
} from "@/lib/editorial/asset-editorial";
import {
  canAccessFeature,
  type UserAccess,
} from "@/lib/access/user-access";
import { WISE_INVEST_CRYPTO_PERKS_URL } from "@/config/site";
import {
  AssetEditorialPanels,
  hasVisibleAssetEditorial,
} from "./asset-editorial-panels";
import {
  AssetMultiTimeframeLoading,
  StreamedAssetMultiTimeframe,
} from "./asset-multi-timeframe";
import type { MultiTimeframeAccessPayload } from "@/server/data/services/multi-timeframe-service";

const upcomingCapabilities = [
  {
    title: "牛熊转接标识",
    description: "待建立可追溯的周期口径、历史锚点与人工复核流程。",
    state: "规划中",
  },
  {
    title: "AI 回撤研究",
    description: "未来只展示带输入依据、生成时间与人工复核记录的分析。",
    state: "尚未接入",
  },
] as const;

export function AssetVipResearch({
  access,
  editorial,
  editorialNow,
  multiTimeframe,
  symbol,
}: {
  access: UserAccess;
  editorial: AssetEditorialEntries;
  editorialNow: number;
  multiTimeframe: Promise<MultiTimeframeAccessPayload>;
  symbol: "BTC" | "ETH";
}) {
  const canReadStrategy = canAccessFeature(access, "editorial.tradeStrategy");
  const canReadMultiTimeframe = canAccessFeature(
    access,
    "analysis.multiTimeframe",
  );
  const hasScheduledEditorial =
    canReadStrategy &&
    [
      resolveAssetEditorialEntry(editorial.keyLevels, editorialNow).state,
      resolveAssetEditorialEntry(editorial.wiseScenario, editorialNow).state,
    ].includes("scheduled");

  return (
    <>
      <section
        id="vip-research"
        className={`asset-vip-research asset-page-anchor${canReadStrategy ? " asset-vip-research--granted" : ""}`}
        aria-labelledby="asset-vip-research-title"
      >
        <header className="section-bar asset-vip-research__header">
          <div>
            <p className="panel-kicker">Wise VIP 研究台</p>
            <h2 id="asset-vip-research-title">{symbol} 行情策略台</h2>
          </div>
          <span
            className={`asset-vip-research__access asset-vip-research__access--${canReadStrategy ? "granted" : "locked"}`}
          >
            {canReadStrategy ? "VIP 权限已验证" : "普通权限 · 内容已锁定"}
          </span>
        </header>

        <div className="asset-vip-research__body">
          <div className="asset-vip-research__lead">
            <span>从 K 线事实到执行参考</span>
            <h3>先说明判断，再交代确认与失效</h3>
            <p>
              这里先把多周期客观事实整理成可读结构，再承接人工关键位、方向与时间窗口。未完成审核或已经过期的内容不会用占位数字补齐，也不会自动生成投资判断。
            </p>
            {!canReadStrategy && (
              <a
                className="asset-vip-research__cta"
                href={WISE_INVEST_CRYPTO_PERKS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看 Wise Crypto VIP 权益
                <span aria-hidden="true">↗</span>
                <span className="sr-only">（在新标签页打开）</span>
              </a>
            )}
          </div>

          <div className="asset-vip-research__capabilities">
            <article>
              <div>
                <strong>多周期客观参考</strong>
                <p>对照 15 分钟、1 小时、4 小时与日线的闭合价、EMA 和近 20 根区间。</p>
              </div>
              <span>{canReadMultiTimeframe ? "数据能力已上线" : "VIP 内容"}</span>
            </article>
            <article>
              <div>
                <strong>人工关键位与主观策略</strong>
                <p>方向、关键价格、确认条件、失效条件与有效时间必须成套发布。</p>
              </div>
              <span>{canReadStrategy ? "按审核状态展示" : "VIP 内容"}</span>
            </article>
            {upcomingCapabilities.map((capability) => (
              <article key={capability.title}>
                <div>
                  <strong>{capability.title}</strong>
                  <p>{capability.description}</p>
                </div>
                <span>{capability.state}</span>
              </article>
            ))}
          </div>
        </div>

        {!canReadStrategy && (
          <p className="asset-vip-research__boundary" role="note">
            当前默认识别为普通用户。正式接入 Wise ID 后，只有服务端确认的 VIP 身份才能取得策略正文。
          </p>
        )}

        {canReadStrategy &&
          !hasVisibleAssetEditorial(editorial, editorialNow) && (
            <div className="asset-vip-research__empty" role="status">
              <strong>
                {hasScheduledEditorial
                  ? "本期人工策略已排期，尚未生效"
                  : "本期人工策略尚未发布"}
              </strong>
              <p>
                {hasScheduledEditorial
                  ? "到达人工设定的生效时间后才会展示正文；当前不会提前披露。"
                  : "等待人工完成来源、有效期、确认条件与失效条件审核；不复用过期内容。"}
              </p>
            </div>
          )}
      </section>

      {canReadMultiTimeframe && (
        <Suspense fallback={<AssetMultiTimeframeLoading symbol={symbol} />}>
          <StreamedAssetMultiTimeframe
            payload={multiTimeframe}
            symbol={symbol}
          />
        </Suspense>
      )}

      {canReadStrategy && (
        <AssetEditorialPanels entries={editorial} now={editorialNow} />
      )}
    </>
  );
}
