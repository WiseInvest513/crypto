"use client";

import {
  useEffect,
  useActionState,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  createBlankTradeStrategyDraft,
  TRADE_STRATEGY_AUTHORING_LIMITS,
  validateTradeStrategyReadyForReview,
  type StoredTradeStrategyDraft,
  type TradeStrategyDraftInput,
  type TradeStrategyDraftPriceZone,
  type TradeStrategyDraftSource,
} from "@/lib/strategy/trade-strategy-authoring";
import type {
  ActiveTradeStrategyView,
  TradeStrategy,
  TradeStrategyBias,
  TradeStrategyZoneRole,
} from "@/lib/strategy/trade-strategy";
import type { Asset, ChartCandleInterval } from "@/lib/market/live-chart";
import styles from "./strategy-studio.module.css";

export type StrategyStudioActionResult = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  errors?: readonly Readonly<{
    path: string;
    message: string;
  }>[];
  generation?: number;
}>;

export type StrategyStudioMutationAction = (
  previousState: StrategyStudioActionResult,
  formData: FormData,
) => Promise<StrategyStudioActionResult>;

export type StrategyStudioActions = Readonly<{
  save: StrategyStudioMutationAction;
  submit: StrategyStudioMutationAction;
  return: StrategyStudioMutationAction;
  publish: StrategyStudioMutationAction;
  withdraw: StrategyStudioMutationAction;
  logout: StrategyStudioMutationAction;
}>;

type StrategyStudioPrincipal = Readonly<{
  role: "editor" | "reviewer";
  displayName: string;
}>;

type StrategyStudioWorkspaceProps = Readonly<{
  principal: StrategyStudioPrincipal;
  sessionExpiresAt: number;
  csrfToken: string;
  selectedAsset: Asset;
  draft?: StoredTradeStrategyDraft | null;
  reviewCandidate?: TradeStrategy | null;
  reviewFeedback?: Readonly<{
    reason: string;
    returnedBy: string;
    returnedAt: string;
  }> | null;
  currentPublished?: ActiveTradeStrategyView | null;
  generation: number;
  editVersion: number | null;
  actions: StrategyStudioActions;
  flash?: StrategyStudioActionResult | null;
}>;

type StrategyStudioLoginProps = Readonly<{
  disabledReason?: string | null;
  notice?: string | null;
  loginAction?: (formData: FormData) => void | Promise<void>;
}>;

const EMPTY_ACTION_RESULT: StrategyStudioActionResult = {
  status: "idle",
  message: "",
};
const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;

const TIMEFRAME_LABELS: Record<ChartCandleInterval, string> = {
  "15m": "15 分钟",
  "1h": "1 小时",
  "4h": "4 小时",
  "1d": "日线",
};

const BIAS_OPTIONS: readonly Readonly<{
  value: TradeStrategyBias;
  label: string;
  mark: string;
}>[] = [
  { value: "bullish", label: "看多", mark: "↗" },
  { value: "neutral", label: "中性", mark: "—" },
  { value: "bearish", label: "看空", mark: "↘" },
  { value: "wait", label: "等待", mark: "○" },
];

const ZONE_OPTIONS: readonly Readonly<{
  value: TradeStrategyZoneRole;
  label: string;
}>[] = [
  { value: "resistance", label: "压力区" },
  { value: "support", label: "支撑区" },
  { value: "target", label: "目标区" },
  { value: "watch", label: "观察区" },
];

export function StrategyStudioLogin({
  disabledReason = null,
  notice = null,
  loginAction,
}: StrategyStudioLoginProps) {
  const disabled = disabledReason !== null || loginAction === undefined;

  return (
    <div className={styles.shell}>
      <StudioHeader />
      <main className={styles.loginMain}>
        <section className={styles.loginPanel} aria-labelledby="studio-login-title">
          <div className={styles.loginMark} aria-hidden="true">
            W
          </div>
          <h1 id="studio-login-title">人工策略发布台</h1>
          <p>
            这是本机私有的编辑与复核入口。输入管理员提供的高强度访问令牌继续。
          </p>
          {disabledReason !== null ? (
            <div className={styles.configurationNotice} role="status">
              <InfoIcon />
              <div>
                <strong>发布台当前未启用</strong>
                <span>{disabledReason}</span>
              </div>
            </div>
          ) : null}
          {notice !== null ? (
            <div className={styles.loginNotice} role="alert">
              {notice}
            </div>
          ) : null}
          <form action={loginAction} className={styles.loginForm}>
            <label htmlFor="strategy-studio-token">本地访问令牌</label>
            <input
              id="strategy-studio-token"
              name="staffToken"
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              required
              disabled={disabled}
            />
            <button type="submit" disabled={disabled}>
              进入发布台
            </button>
          </form>
          <p className={styles.loginBoundary}>
            令牌只用于本次本机会话；身份与角色由服务端判定，页面不提供角色切换。
          </p>
        </section>
      </main>
    </div>
  );
}

export function StrategyStudioWorkspace({
  principal,
  sessionExpiresAt,
  csrfToken,
  selectedAsset,
  draft,
  reviewCandidate = null,
  reviewFeedback = null,
  currentPublished,
  generation,
  editVersion,
  actions,
  flash = null,
}: StrategyStudioWorkspaceProps) {
  const initialContent = reviewCandidate?.asset === selectedAsset
    ? strategyToDraftInput(reviewCandidate)
    : draft?.content.asset === selectedAsset
      ? cloneDraft(draft.content)
      : createBlankTradeStrategyDraft(selectedAsset);
  const [content, setContent] = useState<TradeStrategyDraftInput>(() =>
    cloneDraft(initialContent),
  );
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);

  const [saveResult, saveAction, savePending] = useActionState(
    actions.save,
    EMPTY_ACTION_RESULT,
  );
  const [submitResult, submitAction, submitPending] = useActionState(
    actions.submit,
    EMPTY_ACTION_RESULT,
  );
  const [returnResult, returnAction, returnPending] = useActionState(
    actions.return,
    EMPTY_ACTION_RESULT,
  );
  const [publishResult, publishAction, publishPending] = useActionState(
    actions.publish,
    EMPTY_ACTION_RESULT,
  );
  const [withdrawResult, withdrawAction, withdrawPending] = useActionState(
    actions.withdraw,
    EMPTY_ACTION_RESULT,
  );
  const [logoutResult, logoutAction, logoutPending] = useActionState(
    actions.logout,
    EMPTY_ACTION_RESULT,
  );

  const isEditor = principal.role === "editor";
  const isReviewer = principal.role === "reviewer";
  const isInReview = reviewCandidate?.storedStatus === "in_review";
  const canEdit = isEditor && !isInReview;
  const canReview = isReviewer && isInReview && reviewCandidate !== null;
  const serializedDraft = useMemo(() => JSON.stringify(content), [content]);
  const readiness = useMemo(
    () => validateTradeStrategyReadyForReview(content),
    [content],
  );
  const actionResults = [
    flash,
    saveResult,
    submitResult,
    returnResult,
    publishResult,
    withdrawResult,
    logoutResult,
  ].filter(
    (result): result is StrategyStudioActionResult =>
      result !== null && result.status !== "idle",
  );
  const activeStage = isInReview ? 2 : !draft && currentPublished ? 3 : 1;
  const visiblePreview = reviewCandidate
    ? content
    : draft
      ? content
    : currentPublished?.asset === selectedAsset
      ? currentPublished
      : content;

  return (
    <div className={styles.shell}>
      <SessionExpiryBoundary expiresAt={sessionExpiresAt} />
      <StudioHeader
        principal={principal}
        logoutAction={logoutAction}
        logoutPending={logoutPending}
        csrfToken={csrfToken}
      />

      <main className={styles.page}>
        <div className={styles.titleRow}>
          <div>
            <h1>人工策略发布台</h1>
            <p>编辑、独立复核，再形成不可变的发布快照。</p>
          </div>
          <span className={styles.localOnly}>仅本机可见</span>
        </div>

        <Workflow activeStage={activeStage} />

        {reviewFeedback ? (
          <div className={styles.reviewFeedback} role="status">
            <strong>上一轮复核已退回</strong>
            <p>{reviewFeedback.reason}</p>
            <span>
              {reviewFeedback.returnedBy} · {formatBeijing(reviewFeedback.returnedAt)}
            </span>
          </div>
        ) : null}

        {actionResults.length > 0 ? (
          <div className={styles.feedbackStack} aria-live="polite">
            {actionResults.map((result, index) => (
              <div
                className={styles.feedback}
                data-status={result.status}
                role={result.status === "error" ? "alert" : "status"}
                key={`${result.status}-${result.message ?? "result"}-${index}`}
              >
                <strong>{result.status === "error" ? "操作未完成" : "操作已完成"}</strong>
                {result.message ? <span>{result.message}</span> : null}
                {result.errors && result.errors.length > 0 ? (
                  <ul>
                    {result.errors.slice(0, 6).map((error) => (
                      <li key={`${error.path}-${error.message}`}>
                        {error.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.workspaceGrid}>
          <form className={styles.editor}>
            <CommonHiddenFields
              csrfToken={csrfToken}
              selectedAsset={selectedAsset}
              generation={generation}
              editVersion={editVersion}
              draft={draft}
              serializedDraft={serializedDraft}
            />

            <fieldset className={styles.editorFieldset} disabled={!canEdit}>
              <legend className="sr-only">人工策略内容</legend>
              <OverviewSection
                content={content}
                selectedAsset={selectedAsset}
                onChange={setContent}
              />
              <PriceZonesSection content={content} onChange={setContent} />
              <ConditionsSection content={content} onChange={setContent} />
              <ReviewAndRiskSection
                content={content}
                principal={principal}
                draft={draft}
                onChange={setContent}
              />
            </fieldset>

            {isEditor ? (
              <div className={styles.editorActions}>
                <div>
                  <span>{isInReview ? "待复核期间内容只读" : "草稿将保存在本地私有存储"}</span>
                  {!readiness.ok && !isInReview ? (
                    <small>可以先保存不完整草稿；提交复核前需完成右侧检查。</small>
                  ) : null}
                </div>
                <button
                  className={styles.secondaryButton}
                  type="submit"
                  name="intent"
                  value="save"
                  formAction={saveAction}
                  disabled={!canEdit || savePending || submitPending}
                >
                  {savePending ? "正在保存…" : "保存草稿"}
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  name="intent"
                  value="submit"
                  formAction={submitAction}
                  disabled={!canEdit || !readiness.ok || savePending || submitPending}
                >
                  {submitPending ? "正在提交…" : "提交复核"}
                </button>
              </div>
            ) : null}
          </form>

          <aside className={styles.sidebar} aria-label="发布预览与检查">
            <PreviewPanel content={visiblePreview} />
            <Checklist content={content} readiness={readiness.ok} />

            {canReview ? (
              <ReviewActions
                csrfToken={csrfToken}
                selectedAsset={selectedAsset}
                generation={generation}
                editVersion={editVersion}
                candidate={reviewCandidate}
                returnAction={returnAction}
                returnPending={returnPending}
                publishAction={publishAction}
                publishPending={publishPending}
                publishConfirmed={publishConfirmed}
                onPublishConfirmed={setPublishConfirmed}
                ready={readiness.ok}
              />
            ) : null}

            {isReviewer && currentPublished?.asset === selectedAsset ? (
              <WithdrawAction
                csrfToken={csrfToken}
                selectedAsset={selectedAsset}
                generation={generation}
                editVersion={editVersion}
                strategy={currentPublished}
                action={withdrawAction}
                pending={withdrawPending}
                confirmed={withdrawConfirmed}
                onConfirmed={setWithdrawConfirmed}
              />
            ) : null}

            <VersionPanel
              generation={generation}
              draft={draft}
              reviewCandidate={reviewCandidate}
              currentPublished={currentPublished}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

function StudioHeader({
  principal,
  logoutAction,
  logoutPending = false,
  csrfToken,
}: Readonly<{
  principal?: StrategyStudioPrincipal;
  logoutAction?: (formData: FormData) => void;
  logoutPending?: boolean;
  csrfToken?: string;
}>) {
  return (
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/" aria-label="Wise Crypto 首页">
        <span aria-hidden="true">W</span>
        <strong>Wise Crypto</strong>
      </Link>
      {principal && logoutAction ? (
        <div className={styles.account}>
          <div>
            <strong>{principal.displayName}</strong>
            <span>{principal.role === "editor" ? "内部编辑" : "独立复核"}</span>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <button type="submit" disabled={logoutPending}>
              {logoutPending ? "退出中…" : "退出"}
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}

function Workflow({ activeStage }: { activeStage: number }) {
  const stages = [
    { number: 1, title: "草稿", description: "编辑中" },
    { number: 2, title: "待复核", description: "提交后进入复核" },
    { number: 3, title: "已发布", description: "发布后对外可见" },
  ];
  return (
    <ol className={styles.workflow} aria-label="策略发布流程">
      {stages.map((stage) => (
        <li
          key={stage.number}
          data-active={activeStage === stage.number ? "true" : "false"}
          data-complete={activeStage > stage.number ? "true" : "false"}
        >
          <span>{stage.number}</span>
          <div>
            <strong>{stage.title}</strong>
            <small>{stage.description}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OverviewSection({
  content,
  selectedAsset,
  onChange,
}: Readonly<{
  content: TradeStrategyDraftInput;
  selectedAsset: Asset;
  onChange: (value: TradeStrategyDraftInput) => void;
}>) {
  return (
    <StudioSection title="策略概况">
      <div className={styles.overviewGrid}>
        <div className={styles.fieldGroup}>
          <FieldLabel label="资产" />
          <div className={styles.assetSwitcher}>
            {(["btc", "eth"] as const).map((asset) => (
              <Link
                href={`/studio/strategies?asset=${asset}`}
                aria-current={selectedAsset === asset ? "page" : undefined}
                key={asset}
              >
                {asset.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <FieldLabel label="人工方向偏好" required />
          <div className={styles.biasGroup}>
            {BIAS_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="bias-control"
                  value={option.value}
                  checked={content.bias === option.value}
                  onChange={() => onChange({ ...content, bias: option.value })}
                />
                <span>{option.label}</span>
                <b aria-hidden="true">{option.mark}</b>
              </label>
            ))}
          </div>
        </div>

        <label className={styles.fieldGroup}>
          <FieldLabel label="策略标题" required />
          <input
            name="headline-control"
            type="text"
            maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.headline}
            value={content.headline}
            onChange={(event) =>
              onChange({ ...content, headline: event.currentTarget.value })
            }
          />
          <CharacterCount
            value={content.headline}
            maximum={TRADE_STRATEGY_AUTHORING_LIMITS.headline}
          />
        </label>

        <label className={`${styles.fieldGroup} ${styles.summaryField}`}>
          <FieldLabel label="策略摘要" required />
          <textarea
            name="summary-control"
            rows={5}
            maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.summary}
            value={content.summary}
            onChange={(event) =>
              onChange({ ...content, summary: event.currentTarget.value })
            }
          />
          <CharacterCount
            value={content.summary}
            maximum={TRADE_STRATEGY_AUTHORING_LIMITS.summary}
          />
        </label>

        <div className={styles.fieldGroup}>
          <FieldLabel label="适用时间维度" required />
          <div className={styles.timeframes}>
            {TIMEFRAMES.map((timeframe) => (
              <label key={timeframe}>
                <input
                  type="checkbox"
                  checked={content.timeframes.includes(timeframe)}
                  onChange={(event) => {
                    const next = event.currentTarget.checked
                      ? [...content.timeframes, timeframe]
                      : content.timeframes.filter((item) => item !== timeframe);
                    onChange({ ...content, timeframes: next });
                  }}
                />
                <span>{TIMEFRAME_LABELS[timeframe]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.windowFields}>
          <DateTimeField
            label="生效时间（北京时间）"
            value={content.validFrom}
            onChange={(value) => onChange({ ...content, validFrom: value })}
          />
          <DateTimeField
            label="失效时间（北京时间）"
            value={content.validUntil}
            onChange={(value) => onChange({ ...content, validUntil: value })}
          />
        </div>
      </div>
    </StudioSection>
  );
}

function PriceZonesSection({
  content,
  onChange,
}: Readonly<{
  content: TradeStrategyDraftInput;
  onChange: (value: TradeStrategyDraftInput) => void;
}>) {
  const updateZone = (
    index: number,
    patch: Partial<TradeStrategyDraftPriceZone>,
  ) => {
    onChange({
      ...content,
      priceZones: content.priceZones.map((zone, zoneIndex) =>
        zoneIndex === index ? { ...zone, ...patch } : zone,
      ),
    });
  };

  return (
    <StudioSection
      title="关键价格区域"
      description={`最多 ${TRADE_STRATEGY_AUTHORING_LIMITS.priceZones} 条；区域边界不会被解释为保证成交的精确点位。`}
      action={
        <button
          className={styles.addButton}
          type="button"
          disabled={content.priceZones.length >= TRADE_STRATEGY_AUTHORING_LIMITS.priceZones}
          onClick={() =>
            onChange({
              ...content,
              priceZones: [
                ...content.priceZones,
                {
                  id: nextLocalId("zone"),
                  role: null,
                  lower: null,
                  upper: null,
                  label: "",
                  rationale: "",
                  sourceIds: [],
                },
              ],
            })
          }
        >
          <PlusIcon />
          添加价格区域
        </button>
      }
    >
      {content.priceZones.length === 0 ? (
        <EmptyRows message="尚未添加价格区域" />
      ) : (
        <div className={styles.zoneList}>
          {content.priceZones.map((zone, index) => (
            <div className={styles.zoneRow} key={zone.id || `zone-${index}`}>
              <label>
                <span>角色</span>
                <select
                  value={zone.role ?? ""}
                  onChange={(event) =>
                    updateZone(index, {
                      role: (event.currentTarget.value || null) as
                        | TradeStrategyZoneRole
                        | null,
                    })
                  }
                >
                  <option value="">请选择</option>
                  {ZONE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>自定义标签</span>
                <input
                  type="text"
                  maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.zoneLabel}
                  value={zone.label}
                  onChange={(event) =>
                    updateZone(index, { label: event.currentTarget.value })
                  }
                />
              </label>
              <label>
                <span>下沿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={zone.lower ?? ""}
                  onChange={(event) =>
                    updateZone(index, {
                      lower: parseOptionalPrice(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label>
                <span>上沿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={zone.upper ?? ""}
                  onChange={(event) =>
                    updateZone(index, {
                      upper: parseOptionalPrice(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label className={styles.rationaleField}>
                <span>设定依据与理由</span>
                <textarea
                  rows={2}
                  maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.zoneRationale}
                  value={zone.rationale}
                  onChange={(event) =>
                    updateZone(index, { rationale: event.currentTarget.value })
                  }
                />
              </label>
              <label>
                <span>关联来源</span>
                <select
                  value={zone.sourceIds[0] ?? ""}
                  onChange={(event) =>
                    updateZone(index, {
                      sourceIds: event.currentTarget.value
                        ? [event.currentTarget.value]
                        : [],
                    })
                  }
                >
                  <option value="">请选择</option>
                  {content.sources.map((source, sourceIndex) => (
                    <option value={source.id} key={source.id || `source-${sourceIndex}`}>
                      {source.label || `来源 ${sourceIndex + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={`删除第 ${index + 1} 个价格区域`}
                onClick={() =>
                  onChange({
                    ...content,
                    priceZones: content.priceZones.filter(
                      (_, zoneIndex) => zoneIndex !== index,
                    ),
                  })
                }
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </StudioSection>
  );
}

function ConditionsSection({
  content,
  onChange,
}: Readonly<{
  content: TradeStrategyDraftInput;
  onChange: (value: TradeStrategyDraftInput) => void;
}>) {
  return (
    <StudioSection
      title="确认与失效"
      description="每行一项；只填写可以复核的条件，不把过程中的价格触碰写成已确认事件。"
    >
      <div className={styles.conditionsGrid}>
        <LineListField
          label="确认条件"
          required
          value={content.confirmationConditions}
          maximum={TRADE_STRATEGY_AUTHORING_LIMITS.conditions}
          onChange={(value) =>
            onChange({ ...content, confirmationConditions: value })
          }
        />
        <LineListField
          label="失效条件"
          required
          value={content.invalidationConditions}
          maximum={TRADE_STRATEGY_AUTHORING_LIMITS.conditions}
          onChange={(value) =>
            onChange({ ...content, invalidationConditions: value })
          }
        />
        <LineListField
          label="持续观察"
          value={content.watchItems}
          maximum={TRADE_STRATEGY_AUTHORING_LIMITS.watchItems}
          onChange={(value) => onChange({ ...content, watchItems: value })}
        />
      </div>
    </StudioSection>
  );
}

function ReviewAndRiskSection({
  content,
  principal,
  draft,
  onChange,
}: Readonly<{
  content: TradeStrategyDraftInput;
  principal: StrategyStudioPrincipal;
  draft?: StoredTradeStrategyDraft | null;
  onChange: (value: TradeStrategyDraftInput) => void;
}>) {
  const addSource = () => {
    if (content.sources.length >= TRADE_STRATEGY_AUTHORING_LIMITS.sources) return;
    onChange({
      ...content,
      sources: [
        ...content.sources,
        { id: nextLocalId("source"), label: "", url: "" },
      ],
    });
  };
  const updateSource = (
    index: number,
    patch: Partial<TradeStrategyDraftSource>,
  ) => {
    onChange({
      ...content,
      sources: content.sources.map((source, sourceIndex) =>
        sourceIndex === index ? { ...source, ...patch } : source,
      ),
    });
  };
  const removeSource = (index: number) => {
    const sourceId = content.sources[index]?.id;
    onChange({
      ...content,
      sources: content.sources.filter((_, sourceIndex) => sourceIndex !== index),
      priceZones: content.priceZones.map((zone) => ({
        ...zone,
        sourceIds: zone.sourceIds.filter((id) => id !== sourceId),
      })),
    });
  };

  return (
    <StudioSection
      title="审核与风险"
      description="作者和复核者由服务端身份确定；来源链接只保留在内部工作流。"
    >
      <dl className={styles.identityGrid}>
        <div>
          <dt>作者</dt>
          <dd>{draft?.author ?? (principal.role === "editor" ? principal.displayName : "待创建")}</dd>
        </div>
        <div>
          <dt>复核者</dt>
          <dd>{principal.role === "reviewer" ? principal.displayName : "由独立复核者确认"}</dd>
        </div>
      </dl>

      <div className={styles.sourcesHeader}>
        <FieldLabel label="来源参考（内部链接）" required />
        <button
          className={styles.addButton}
          type="button"
          disabled={content.sources.length >= TRADE_STRATEGY_AUTHORING_LIMITS.sources}
          onClick={addSource}
        >
          <PlusIcon />
          添加来源
        </button>
      </div>
      {content.sources.length === 0 ? (
        <EmptyRows message="尚未添加可验证来源" />
      ) : (
        <div className={styles.sourceList}>
          {content.sources.map((source, index) => (
            <div className={styles.sourceRow} key={source.id || `source-${index}`}>
              <label>
                <span>来源名称</span>
                <input
                  type="text"
                  maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.sourceLabel}
                  value={source.label}
                  onChange={(event) =>
                    updateSource(index, { label: event.currentTarget.value })
                  }
                />
              </label>
              <label>
                <span>HTTPS 链接</span>
                <input
                  type="url"
                  inputMode="url"
                  maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.sourceUrl}
                  value={source.url}
                  onChange={(event) =>
                    updateSource(index, { url: event.currentTarget.value })
                  }
                />
              </label>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={`删除第 ${index + 1} 个来源`}
                onClick={() => removeSource(index)}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className={`${styles.fieldGroup} ${styles.riskField}`}>
        <FieldLabel label="风险披露" required />
        <textarea
          rows={5}
          maxLength={TRADE_STRATEGY_AUTHORING_LIMITS.riskDisclosure}
          value={content.riskDisclosure}
          onChange={(event) =>
            onChange({ ...content, riskDisclosure: event.currentTarget.value })
          }
        />
        <CharacterCount
          value={content.riskDisclosure}
          maximum={TRADE_STRATEGY_AUTHORING_LIMITS.riskDisclosure}
        />
      </label>
    </StudioSection>
  );
}

function PreviewPanel({
  content,
}: {
  content:
    | TradeStrategyDraftInput
    | TradeStrategy
    | ActiveTradeStrategyView;
}) {
  return (
    <details className={styles.sidePanel} open data-testid="strategy-preview">
      <summary>
        <span>发布预览</span>
        <InfoIcon />
        <ChevronIcon />
      </summary>
      <div className={styles.previewBody}>
        <dl className={styles.previewOverview}>
          <PreviewValue label="资产" value={content.asset.toUpperCase()} />
          <PreviewValue label="方向偏好" value={biasLabel(content.bias)} />
          <PreviewValue label="标题" value={content.headline} />
          <PreviewValue label="摘要" value={content.summary} />
          <PreviewValue
            label="适用时间维度"
            value={content.timeframes.map((item) => TIMEFRAME_LABELS[item]).join(" · ")}
          />
          <PreviewValue label="生效时间" value={formatBeijing(content.validFrom)} />
          <PreviewValue label="失效时间" value={formatBeijing(content.validUntil)} />
        </dl>

        <PreviewSection title="关键价格区域">
          {content.priceZones.length > 0 ? (
            <ul className={styles.previewZones}>
              {content.priceZones.map((zone, index) => (
                <li key={zone.id || `preview-zone-${index}`}>
                  <span>{zoneRoleLabel(zone.role)} · {zone.label || "未命名区域"}</span>
                  <strong>{formatZone(zone.lower, zone.upper)}</strong>
                  {zone.rationale ? <small>{zone.rationale}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <span className={styles.emptyValue}>—</span>
          )}
        </PreviewSection>

        <PreviewSection title="确认与失效">
          <PreviewList label="确认条件" items={content.confirmationConditions} />
          <PreviewList label="失效条件" items={content.invalidationConditions} />
          {content.watchItems.length > 0 ? (
            <PreviewList label="持续观察" items={content.watchItems} />
          ) : null}
        </PreviewSection>

        <PreviewSection title="风险披露">
          <p className={styles.previewRisk}>{content.riskDisclosure || "—"}</p>
        </PreviewSection>
        <p className={styles.previewBoundary}>
          预览不展示来源 URL、内部身份或审计记录。
        </p>
      </div>
    </details>
  );
}

function Checklist({
  content,
  readiness,
}: Readonly<{ content: TradeStrategyDraftInput; readiness: boolean }>) {
  const hasWindow =
    content.validFrom !== null &&
    content.validUntil !== null &&
    Date.parse(content.validFrom) < Date.parse(content.validUntil);
  const checks = [
    ["已选择人工方向偏好", content.bias !== null],
    ["已填写策略标题与摘要", content.headline !== "" && content.summary !== ""],
    ["已选择至少一个适用时间维度", content.timeframes.length > 0],
    ["已设置生效与失效时间", hasWindow],
    [
      "关键价格区域完整",
      content.priceZones.length > 0 &&
        content.priceZones.every(
          (zone) =>
            zone.role !== null &&
            zone.lower !== null &&
            zone.upper !== null &&
            zone.lower <= zone.upper &&
            zone.label !== "" &&
            zone.rationale !== "" &&
            zone.sourceIds.length > 0,
        ),
    ],
    [
      "确认与失效条件完整",
      content.confirmationConditions.length > 0 &&
        content.invalidationConditions.length > 0,
    ],
    [
      "已填写可验证来源",
      content.sources.length > 0 &&
        content.sources.every(
          (source) => source.label !== "" && source.url.startsWith("https://"),
        ),
    ],
    ["已填写风险披露", content.riskDisclosure !== ""],
  ] as const;

  return (
    <details className={styles.sidePanel} open>
      <summary>
        <span>发布检查</span>
        <InfoIcon />
        <ChevronIcon />
      </summary>
      <div className={styles.checklist}>
        <ul>
          {checks.map(([label, complete]) => (
            <li data-complete={complete ? "true" : "false"} key={label}>
              <span aria-hidden="true" />
              {label}
              <b className="sr-only">{complete ? "已完成" : "未完成"}</b>
            </li>
          ))}
        </ul>
        <p data-ready={readiness ? "true" : "false"}>
          {readiness
            ? "内容已通过客户端完整性检查，服务端仍会再次验证。"
            : "尚未满足提交或发布要求。草稿仍可保存。"}
        </p>
      </div>
    </details>
  );
}

function ReviewActions({
  csrfToken,
  selectedAsset,
  generation,
  editVersion,
  candidate,
  returnAction,
  returnPending,
  publishAction,
  publishPending,
  publishConfirmed,
  onPublishConfirmed,
  ready,
}: Readonly<{
  csrfToken: string;
  selectedAsset: Asset;
  generation: number;
  editVersion: number | null;
  candidate: TradeStrategy;
  returnAction: (formData: FormData) => void;
  returnPending: boolean;
  publishAction: (formData: FormData) => void;
  publishPending: boolean;
  publishConfirmed: boolean;
  onPublishConfirmed: (value: boolean) => void;
  ready: boolean;
}>) {
  return (
    <section className={`${styles.sidePanel} ${styles.reviewActions}`}>
      <div className={styles.staticPanelTitle}>复核操作</div>
      <form action={returnAction}>
        <CommonHiddenFields
          csrfToken={csrfToken}
          selectedAsset={selectedAsset}
          generation={generation}
          editVersion={editVersion}
          draft={candidate}
        />
        <label>
          <span>退回原因</span>
          <textarea name="reason" rows={3} required maxLength={500} />
        </label>
        <button
          className={styles.secondaryButton}
          type="submit"
          disabled={returnPending || publishPending}
        >
          {returnPending ? "正在退回…" : "退回修改"}
        </button>
      </form>
      <form action={publishAction}>
        <CommonHiddenFields
          csrfToken={csrfToken}
          selectedAsset={selectedAsset}
          generation={generation}
          editVersion={editVersion}
          draft={candidate}
        />
        <label>
          <span>再次输入复核令牌</span>
          <input
            name="staffToken"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className={styles.confirmationControl}>
          <input
            name="confirmed"
            type="checkbox"
            value="yes"
            checked={publishConfirmed}
            onChange={(event) => onPublishConfirmed(event.currentTarget.checked)}
          />
          <span>我已逐项复核，将创建不可变发布快照。</span>
        </label>
        <button
          className={styles.publishButton}
          type="submit"
          disabled={!ready || !publishConfirmed || returnPending || publishPending}
        >
          {publishPending ? "正在发布…" : "发布策略"}
        </button>
      </form>
    </section>
  );
}

function WithdrawAction({
  csrfToken,
  selectedAsset,
  generation,
  editVersion,
  strategy,
  action,
  pending,
  confirmed,
  onConfirmed,
}: Readonly<{
  csrfToken: string;
  selectedAsset: Asset;
  generation: number;
  editVersion: number | null;
  strategy: Pick<ActiveTradeStrategyView, "id" | "revision" | "asset">;
  action: (formData: FormData) => void;
  pending: boolean;
  confirmed: boolean;
  onConfirmed: (value: boolean) => void;
}>) {
  return (
    <details className={`${styles.sidePanel} ${styles.withdrawPanel}`}>
      <summary>
        <span>撤回已发布策略</span>
        <ChevronIcon />
      </summary>
      <form action={action}>
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="asset" value={selectedAsset} />
        <input type="hidden" name="generation" value={generation} />
        <input type="hidden" name="editVersion" value={editVersion ?? ""} />
        <input type="hidden" name="strategyId" value={strategy.id} />
        <input type="hidden" name="revision" value={strategy.revision} />
        <label>
          <span>撤回原因</span>
          <textarea name="reason" rows={3} required maxLength={500} />
        </label>
        <label>
          <span>再次输入复核令牌</span>
          <input
            name="staffToken"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className={styles.confirmationControl}>
          <input
            name="confirmed"
            type="checkbox"
            value="yes"
            checked={confirmed}
            onChange={(event) => onConfirmed(event.currentTarget.checked)}
          />
          <span>我确认撤回当前发布版本，并保留审计记录。</span>
        </label>
        <button
          className={styles.dangerButton}
          type="submit"
          disabled={!confirmed || pending}
        >
          {pending ? "正在撤回…" : "确认撤回"}
        </button>
      </form>
    </details>
  );
}

function VersionPanel({
  generation,
  draft,
  reviewCandidate,
  currentPublished,
}: Readonly<{
  generation: number;
  draft?: StoredTradeStrategyDraft | null;
  reviewCandidate?: TradeStrategy | null;
  currentPublished?: ActiveTradeStrategyView | null;
}>) {
  return (
    <section className={`${styles.sidePanel} ${styles.versionPanel}`}>
      <div className={styles.staticPanelTitle}>版本与有效性</div>
      <dl>
        <div>
          <dt>存储代次</dt>
          <dd>{generation}</dd>
        </div>
        <div>
          <dt>草稿版本</dt>
          <dd>{draft ? `v${draft.revision}` : "—"}</dd>
        </div>
        <div>
          <dt>工作流状态</dt>
          <dd>{reviewCandidate ? "待复核" : draft ? "草稿" : "—"}</dd>
        </div>
        <div>
          <dt>已发布版本</dt>
          <dd>{currentPublished ? `v${currentPublished.revision}` : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

function StudioSection({
  title,
  description,
  action,
  children,
}: Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className={styles.editorSection}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SessionExpiryBoundary({ expiresAt }: { expiresAt: number }) {
  useEffect(() => {
    const expiresAtMs = expiresAt * 1_000;
    const expireIfNeeded = () => {
      if (Date.now() >= expiresAtMs) {
        window.location.replace("/studio/strategies");
      }
    };
    const timer = window.setTimeout(
      expireIfNeeded,
      Math.max(0, Math.min(expiresAtMs - Date.now(), 2_147_483_647)),
    );
    window.addEventListener("focus", expireIfNeeded);
    document.addEventListener("visibilitychange", expireIfNeeded);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expireIfNeeded);
      document.removeEventListener("visibilitychange", expireIfNeeded);
    };
  }, [expiresAt]);
  return null;
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <span className={styles.fieldLabel}>
      {label}
      {required ? <b aria-label="必填">*</b> : null}
    </span>
  );
}

function CharacterCount({ value, maximum }: { value: string; maximum: number }) {
  return (
    <span className={styles.characterCount} aria-hidden="true">
      {value.length}/{maximum}
    </span>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}>) {
  return (
    <label className={styles.fieldGroup}>
      <FieldLabel label={label} required />
      <input
        type="datetime-local"
        value={utcToBeijingInput(value)}
        onChange={(event) => onChange(beijingInputToUtc(event.currentTarget.value))}
      />
    </label>
  );
}

function LineListField({
  label,
  required = false,
  value,
  maximum,
  onChange,
}: Readonly<{
  label: string;
  required?: boolean;
  value: readonly string[];
  maximum: number;
  onChange: (value: readonly string[]) => void;
}>) {
  return (
    <label className={styles.lineListField}>
      <FieldLabel label={label} required={required} />
      <textarea
        rows={5}
        value={value.join("\n")}
        onChange={(event) => onChange(textToLines(event.currentTarget.value, maximum))}
      />
      <small>每行一项，最多 {maximum} 项</small>
    </label>
  );
}

function EmptyRows({ message }: { message: string }) {
  return (
    <div className={styles.emptyRows}>
      <InfoIcon />
      <span>{message}</span>
    </div>
  );
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.previewSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function PreviewList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className={styles.previewList}>
      <strong>{label}</strong>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${label}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <span>—</span>
      )}
    </div>
  );
}

function CommonHiddenFields({
  csrfToken,
  selectedAsset,
  generation,
  editVersion,
  draft,
  serializedDraft,
}: Readonly<{
  csrfToken: string;
  selectedAsset: Asset;
  generation: number;
  editVersion: number | null;
  draft?: Pick<StoredTradeStrategyDraft, "id" | "revision"> | Pick<TradeStrategy, "id" | "revision"> | null;
  serializedDraft?: string;
}>) {
  return (
    <>
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="asset" value={selectedAsset} />
      <input type="hidden" name="generation" value={generation} />
      <input type="hidden" name="editVersion" value={editVersion ?? ""} />
      <input type="hidden" name="draftId" value={draft?.id ?? ""} />
      <input type="hidden" name="revision" value={draft?.revision ?? ""} />
      {serializedDraft !== undefined ? (
        <input type="hidden" name="draft" value={serializedDraft} />
      ) : null}
    </>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6M12 7.5h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function nextLocalId(prefix: "zone" | "source"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneDraft(content: TradeStrategyDraftInput): TradeStrategyDraftInput {
  return {
    ...content,
    timeframes: [...content.timeframes],
    priceZones: content.priceZones.map((zone) => ({
      ...zone,
      sourceIds: [...zone.sourceIds],
    })),
    confirmationConditions: [...content.confirmationConditions],
    invalidationConditions: [...content.invalidationConditions],
    watchItems: [...content.watchItems],
    sources: content.sources.map((source) => ({ ...source })),
  };
}

function strategyToDraftInput(strategy: TradeStrategy): TradeStrategyDraftInput {
  return cloneDraft({
    asset: strategy.asset,
    bias: strategy.bias,
    headline: strategy.headline,
    summary: strategy.summary,
    timeframes: strategy.timeframes,
    priceZones: strategy.priceZones,
    confirmationConditions: strategy.confirmationConditions,
    invalidationConditions: strategy.invalidationConditions,
    watchItems: strategy.watchItems,
    riskDisclosure: strategy.riskDisclosure,
    sources: strategy.sources,
    validFrom: strategy.validFrom,
    validUntil: strategy.validUntil,
  });
}

function textToLines(value: string, maximum: number): readonly string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

function parseOptionalPrice(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcToBeijingInput(value: string | null): string {
  if (value === null) return "";
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "";
  return new Date(milliseconds + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function beijingInputToUtc(value: string): string | null {
  if (value === "") return null;
  const milliseconds = Date.parse(`${value}:00+08:00`);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function formatBeijing(value: string | null): string {
  if (value === null) return "—";
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(milliseconds);
}

function biasLabel(value: TradeStrategyBias | null): string {
  return BIAS_OPTIONS.find((option) => option.value === value)?.label ?? "—";
}

function zoneRoleLabel(value: TradeStrategyZoneRole | null): string {
  return ZONE_OPTIONS.find((option) => option.value === value)?.label ?? "未选择角色";
}

function formatZone(lower: number | null, upper: number | null): string {
  if (lower === null || upper === null) return "—";
  const formatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 8 });
  return `${formatter.format(lower)} — ${formatter.format(upper)} USDT`;
}
