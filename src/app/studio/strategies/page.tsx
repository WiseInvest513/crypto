import type { Asset } from "@/lib/market/live-chart";
import {
  resolveTradeStrategyDisplayState,
  toActiveTradeStrategyView,
  type ActiveTradeStrategyView,
  type TradeStrategy,
} from "@/lib/strategy/trade-strategy";
import type { StoredTradeStrategyDraft } from "@/lib/strategy/trade-strategy-authoring";
import type { LocalStrategyPublicationRecord } from "@/server/strategy/local-strategy-store";
import { loadStrategyStudioRuntimeConfig } from "@/server/strategy/staff-runtime-config";
import { readStrategyStudioPageSession } from "@/server/strategy/strategy-studio-request";
import { createStrategyStudioStore } from "@/server/strategy/strategy-studio-store";
import { captureStrategyStudioNow } from "@/server/strategy/strategy-studio-clock";
import {
  StrategyStudioLogin,
  StrategyStudioWorkspace,
} from "@/components/strategy-studio/strategy-studio";
import {
  loginStrategyStudioAction,
  logoutStrategyStudioAction,
  publishStrategyStudioAction,
  returnStrategyStudioAction,
  saveStrategyStudioAction,
  submitStrategyStudioAction,
  withdrawStrategyStudioAction,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudioSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function StrategyStudioPage({
  searchParams,
}: {
  searchParams: StudioSearchParams;
}) {
  const query = await searchParams;
  const asset = readAssetQuery(query.asset);
  const notice = readNotice(query.notice);
  const config = loadStrategyStudioRuntimeConfig();

  if (!config.enabled) {
    return (
      <StrategyStudioLogin disabledReason={disabledReason(config.reason)} />
    );
  }

  const pageSession = await readStrategyStudioPageSession(config);
  if (pageSession === null) {
    return (
      <StrategyStudioLogin
        loginAction={loginStrategyStudioAction}
        notice={notice === "invalid" ? "访问令牌无效，请重新输入。" : null}
      />
    );
  }

  let workspace:
    | Readonly<{
        generation: number;
        draft: StoredTradeStrategyDraft | null;
        reviewCandidate: TradeStrategy | null;
        reviewFeedback: Readonly<{
          reason: string;
          returnedBy: string;
          returnedAt: string;
        }> | null;
        currentPublished: ActiveTradeStrategyView | null;
        editVersion: number | null;
      }>
    | undefined;
  try {
    const store = createStrategyStudioStore(config);
    const snapshot = await store.readSnapshot();
    const requestNow = captureStrategyStudioNow();
    const state = snapshot.assets[asset];
    const canReadWorking =
      pageSession.session.role === "editor" || state.reviewCandidate !== null;
    const working = canReadWorking ? state.workingDraft : null;

    workspace = {
      generation: snapshot.generation,
      draft: working
        ? { ...working.value, author: "Wise 编辑" }
        : null,
      reviewCandidate: state.reviewCandidate
        ? {
            ...state.reviewCandidate.strategy,
            author: "Wise 编辑",
            reviewer: null,
          }
        : null,
      reviewFeedback: working?.reviewFeedback
        ? { ...working.reviewFeedback, returnedBy: "Wise 独立复核" }
        : null,
      currentPublished: projectPublishedStrategy(
        latestRelevantPublication(state.publicationRecords, requestNow),
      ),
      editVersion: working?.editVersion ?? null,
    };
  } catch {
    return (
      <StrategyStudioLogin disabledReason="本地加密存储无法验证。系统没有重置或覆盖任何内容，请检查密钥与存储文件。" />
    );
  }

  return (
    <StrategyStudioWorkspace
      key={`${asset}:${pageSession.session.role}`}
      principal={{
        role: pageSession.session.role,
        displayName: pageSession.session.displayName,
      }}
      sessionExpiresAt={pageSession.session.expiresAt}
      csrfToken={pageSession.csrfToken}
      selectedAsset={asset}
      draft={workspace.draft}
      reviewCandidate={workspace.reviewCandidate}
      reviewFeedback={workspace.reviewFeedback}
      currentPublished={workspace.currentPublished}
      generation={workspace.generation}
      editVersion={workspace.editVersion}
      actions={{
        save: saveStrategyStudioAction,
        submit: submitStrategyStudioAction,
        return: returnStrategyStudioAction,
        publish: publishStrategyStudioAction,
        withdraw: withdrawStrategyStudioAction,
        logout: logoutStrategyStudioAction,
      }}
    />
  );
}

function readAssetQuery(value: string | string[] | undefined): Asset {
  return value === "eth" ? "eth" : "btc";
}

function readNotice(
  value: string | string[] | undefined,
): "invalid" | "disabled" | null {
  if (value === "invalid" || value === "disabled") return value;
  return null;
}

function disabledReason(
  reason:
    | "mode_disabled"
    | "deployment_environment"
    | "public_environment_variable"
    | "invalid_configuration",
): string {
  return {
    mode_disabled:
      "本地创作模式尚未开启。按照 README 配置独立的编辑、复核凭证后再启用。",
    deployment_environment:
      "检测到部署环境；本地文件发布台不会在生产或预览部署中运行。",
    public_environment_variable:
      "检测到公开前缀的策略变量。请删除公开变量，所有凭证和密钥必须仅存在于服务端。",
    invalid_configuration:
      "本地配置不完整或不安全。系统保持关闭，不会读取或重置现有策略文件。",
  }[reason];
}

function latestRelevantPublication(
  records: readonly LocalStrategyPublicationRecord[],
  now: number,
) {
  const withdrawn = new Set(
    records
      .filter((record) => record.kind === "withdrawal")
      .map((record) => `${record.strategyId}:${record.revision}`),
  );
  const publications = records
    .filter((record) => record.kind === "publication")
    .map((record) => record.strategy)
    .filter(
      (strategy) => !withdrawn.has(`${strategy.id}:${strategy.revision}`),
    );
  const active = publications.filter(
    (strategy) => resolveTradeStrategyDisplayState(strategy, now) === "active",
  );
  if (active.length === 1) return active[0];
  if (active.length > 1) return null;

  const nextScheduled = publications
    .filter(
      (strategy) =>
        resolveTradeStrategyDisplayState(strategy, now) === "scheduled",
    )
    .sort(
      (left, right) =>
        Date.parse(left.validFrom ?? "") - Date.parse(right.validFrom ?? ""),
    )[0];
  return nextScheduled ?? publications.at(-1) ?? null;
}

function projectPublishedStrategy(strategy: TradeStrategy | null) {
  return strategy === null ? null : toActiveTradeStrategyView(strategy);
}
