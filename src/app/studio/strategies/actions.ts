"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Asset } from "@/lib/market/live-chart";
import {
  buildPublishedTradeStrategy,
  parseTradeStrategyDraftInput,
  validateTradeStrategyReadyForReview,
  type StoredTradeStrategyDraft,
  type TradeStrategyAuthoringIssue,
  type TradeStrategyDraftInput,
} from "@/lib/strategy/trade-strategy-authoring";
import { parseTradeStrategy } from "@/lib/strategy/trade-strategy";
import {
  LocalStrategyStoreError,
  type LocalStrategyAssetState,
  type LocalStrategyStoreSnapshot,
} from "@/server/strategy/local-strategy-store";
import {
  loadStrategyStudioRuntimeConfig,
  verifyStrategyStudioStaffToken,
} from "@/server/strategy/staff-runtime-config";
import {
  createStrategyStudioSessionToken,
  STRATEGY_STUDIO_SESSION_COOKIE_NAME,
  STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS,
} from "@/server/strategy/staff-session";
import { assertStrategyStudioMutationOrigin } from "@/server/strategy/strategy-studio-origin";
import { requireStrategyStudioMutationSession } from "@/server/strategy/strategy-studio-request";
import { createStrategyStudioStore } from "@/server/strategy/strategy-studio-store";

type ActionIssue = Readonly<{ path: string; message: string }>;
type ActionResult = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  errors?: readonly ActionIssue[];
  generation?: number;
}>;

const STUDIO_PATH = "/studio/strategies";
const MAX_DRAFT_PAYLOAD_BYTES = 60 * 1024;
const MINIMUM_LOGIN_DURATION_MS = 350;

export async function loginStrategyStudioAction(
  formData: FormData,
): Promise<void> {
  const startedAt = Date.now();
  await assertCurrentMutationOrigin();
  const config = loadStrategyStudioRuntimeConfig();
  if (!config.enabled) redirect(`${STUDIO_PATH}?notice=disabled`);

  const submittedToken = formData.get("staffToken");
  const editorMatches = verifyStrategyStudioStaffToken(
    submittedToken,
    config.editor.tokenDigest,
  );
  const reviewerMatches = verifyStrategyStudioStaffToken(
    submittedToken,
    config.reviewer.tokenDigest,
  );
  const staff = editorMatches
    ? config.editor
    : reviewerMatches
      ? config.reviewer
      : null;
  await waitForMinimumLoginDuration(startedAt);
  if (staff === null) redirect(`${STUDIO_PATH}?notice=invalid`);

  const sessionToken = createStrategyStudioSessionToken(
    {
      role: staff.role,
      subject: staff.subject,
      displayName: staff.displayName,
    },
    config.sessionKey,
  );
  const cookieStore = await cookies();
  cookieStore.set(
    STRATEGY_STUDIO_SESSION_COOKIE_NAME,
    sessionToken,
    STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS,
  );
  redirect(STUDIO_PATH);
}

export async function saveStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireStrategyStudioMutationSession(
      formData.get("csrfToken"),
    );
    if (context.session.role !== "editor") return wrongRole("编辑者");

    const input = readDraftMutationInput(formData);
    if (!input.ok) return input.result;
    const store = createStrategyStudioStore(context.config);
    const snapshot = await store.readSnapshot();
    const prepared = prepareStoredDraft(
      snapshot,
      input.asset,
      input.draft,
      input.draftId,
      context.session.subject,
    );
    const saved = await store.saveWorkingDraft({
      asset: input.asset,
      value: prepared,
      expectedGeneration: input.generation,
      expectedEditVersion: input.editVersion,
    });
    revalidatePath(STUDIO_PATH);
    return success("草稿已安全保存。", saved.generation);
  } catch (error) {
    return safeFailure(error);
  }
}

export async function submitStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireStrategyStudioMutationSession(
      formData.get("csrfToken"),
    );
    if (context.session.role !== "editor") return wrongRole("编辑者");

    const input = readDraftMutationInput(formData);
    if (!input.ok) return input.result;
    const ready = validateTradeStrategyReadyForReview(input.draft);
    if (!ready.ok) return issuesFailure("还有内容未达到送审要求。", ready.errors);

    const store = createStrategyStudioStore(context.config);
    const snapshot = await store.readSnapshot();
    const prepared = prepareStoredDraft(
      snapshot,
      input.asset,
      ready.value,
      input.draftId,
      context.session.subject,
    );
    const saved = await store.saveWorkingDraft({
      asset: input.asset,
      value: prepared,
      expectedGeneration: input.generation,
      expectedEditVersion: input.editVersion,
    });
    const candidate = parseTradeStrategy({
      schemaVersion: 1,
      id: prepared.id,
      revision: prepared.revision,
      asset: ready.value.asset,
      storedStatus: "in_review",
      bias: ready.value.bias,
      headline: ready.value.headline,
      summary: ready.value.summary,
      timeframes: [...ready.value.timeframes],
      priceZones: ready.value.priceZones.map((zone) => ({
        ...zone,
        sourceIds: [...zone.sourceIds],
      })),
      confirmationConditions: [...ready.value.confirmationConditions],
      invalidationConditions: [...ready.value.invalidationConditions],
      watchItems: [...ready.value.watchItems],
      riskDisclosure: ready.value.riskDisclosure,
      author: prepared.author,
      reviewer: null,
      sources: ready.value.sources.map((source) => ({ ...source })),
      createdAt: prepared.createdAt,
      reviewedAt: null,
      publishedAt: null,
      validFrom: ready.value.validFrom,
      validUntil: ready.value.validUntil,
    });
    const frozen = await store.freezeReviewCandidate({
      asset: input.asset,
      strategy: candidate,
      expectedGeneration: saved.generation,
      expectedEditVersion: saved.value.editVersion,
    });
    revalidatePath(STUDIO_PATH);
    return success("策略已冻结并提交复核。", frozen.generation);
  } catch (error) {
    return safeFailure(error);
  }
}

export async function returnStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireStrategyStudioMutationSession(
      formData.get("csrfToken"),
    );
    if (context.session.role !== "reviewer") return wrongRole("复核者");
    const asset = readAsset(formData.get("asset"));
    const generation = readNonNegativeInteger(
      formData.get("generation"),
      "generation",
    );
    const editVersion = readPositiveInteger(
      formData.get("editVersion"),
      "editVersion",
    );
    const reason = readBoundedText(formData.get("reason"), "reason", 500);
    const store = createStrategyStudioStore(context.config);
    const returned = await store.returnReviewCandidate({
      asset,
      expectedGeneration: generation,
      expectedEditVersion: editVersion,
      returnedBy: context.session.subject,
      reason,
    });
    revalidatePath(STUDIO_PATH);
    return success("已退回编辑者修改，复核意见已保留。", returned.generation);
  } catch (error) {
    return safeFailure(error);
  }
}

export async function publishStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireStrategyStudioMutationSession(
      formData.get("csrfToken"),
    );
    if (context.session.role !== "reviewer") return wrongRole("复核者");
    if (formData.get("confirmed") !== "yes") {
      return errorResult("发布前必须明确确认内容与有效窗口。", [
        { path: "confirmed", message: "请勾选发布确认。" },
      ]);
    }
    if (
      !verifyStrategyStudioStaffToken(
        formData.get("staffToken"),
        context.config.reviewer.tokenDigest,
      )
    ) {
      return errorResult("复核者令牌验证失败。", [
        { path: "staffToken", message: "请重新输入复核者本地访问令牌。" },
      ]);
    }

    const asset = readAsset(formData.get("asset"));
    const generation = readNonNegativeInteger(
      formData.get("generation"),
      "generation",
    );
    const editVersion = readPositiveInteger(
      formData.get("editVersion"),
      "editVersion",
    );
    const store = createStrategyStudioStore(context.config);
    const state = await store.readAsset(asset);
    const candidate = requireCandidate(state, editVersion);
    const working = state.workingDraft!;
    const publishedAt = new Date().toISOString();
    const publication = buildPublishedTradeStrategy(working.value.content, {
      id: candidate.strategy.id,
      revision: candidate.strategy.revision,
      author: candidate.strategy.author,
      reviewer: context.session.subject,
      createdAt: candidate.strategy.createdAt,
      reviewedAt: publishedAt,
      publishedAt,
      validFrom: candidate.strategy.validFrom,
      validUntil: candidate.strategy.validUntil,
    });
    if (!publication.ok) {
      return issuesFailure("发布前最终校验未通过。", publication.errors);
    }

    const result = await store.publishReviewCandidate({
      asset,
      strategy: publication.value,
      expectedGeneration: generation,
      expectedEditVersion: editVersion,
    });
    revalidatePath(STUDIO_PATH);
    return success("策略已发布为不可变快照。", result.generation);
  } catch (error) {
    return safeFailure(error);
  }
}

export async function withdrawStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireStrategyStudioMutationSession(
      formData.get("csrfToken"),
    );
    if (context.session.role !== "reviewer") return wrongRole("复核者");
    if (formData.get("confirmed") !== "yes") {
      return errorResult("撤回前必须明确确认。", [
        { path: "confirmed", message: "请勾选撤回确认。" },
      ]);
    }
    if (
      !verifyStrategyStudioStaffToken(
        formData.get("staffToken"),
        context.config.reviewer.tokenDigest,
      )
    ) {
      return errorResult("复核者令牌验证失败。", [
        { path: "staffToken", message: "请重新输入复核者本地访问令牌。" },
      ]);
    }
    const asset = readAsset(formData.get("asset"));
    const generation = readNonNegativeInteger(
      formData.get("generation"),
      "generation",
    );
    const strategyIdValue = formData.get("strategyId");
    if (typeof strategyIdValue !== "string") {
      throw new Error("STRATEGY_STUDIO_INVALID_STRATEGY_ID");
    }
    const strategyId = readSafeId(strategyIdValue);
    const revision = readPositiveInteger(
      formData.get("revision"),
      "revision",
    );
    const reason = readBoundedText(formData.get("reason"), "reason", 500);
    const store = createStrategyStudioStore(context.config);
    const result = await store.withdrawLatestPublication({
      asset,
      strategyId,
      revision,
      expectedGeneration: generation,
      withdrawnBy: context.session.subject,
      reason,
    });
    revalidatePath(STUDIO_PATH);
    return success("当前发布版本已撤回，不会回退旧判断。", result.generation);
  } catch (error) {
    return safeFailure(error);
  }
}

export async function logoutStrategyStudioAction(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireStrategyStudioMutationSession(formData.get("csrfToken"));
    const cookieStore = await cookies();
    cookieStore.set(STRATEGY_STUDIO_SESSION_COOKIE_NAME, "", {
      ...STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS,
      expires: new Date(0),
      maxAge: 0,
    });
  } catch {
    // Logout remains idempotent; an invalid session still lands on login.
  }
  redirect(STUDIO_PATH);
}

function readDraftMutationInput(formData: FormData):
  | Readonly<{
      ok: true;
      asset: Asset;
      generation: number;
      editVersion: number | null;
      draftId: string | null;
      draft: TradeStrategyDraftInput;
    }>
  | Readonly<{ ok: false; result: ActionResult }> {
  try {
    const asset = readAsset(formData.get("asset"));
    const generation = readNonNegativeInteger(
      formData.get("generation"),
      "generation",
    );
    const editVersion = readNullablePositiveInteger(
      formData.get("editVersion"),
      "editVersion",
    );
    const draftIdValue = formData.get("draftId");
    const draftId =
      typeof draftIdValue === "string" && draftIdValue !== ""
        ? readSafeId(draftIdValue)
        : null;
    const payload = formData.get("draft");
    if (
      typeof payload !== "string" ||
      Buffer.byteLength(payload, "utf8") > MAX_DRAFT_PAYLOAD_BYTES
    ) {
      return {
        ok: false,
        result: errorResult("草稿数据无效或过大。"),
      };
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(payload) as unknown;
    } catch {
      return { ok: false, result: errorResult("草稿数据无法解析。") };
    }
    const parsed = parseTradeStrategyDraftInput(decoded);
    if (!parsed.ok) {
      return {
        ok: false,
        result: issuesFailure("请修正草稿中的格式问题。", parsed.errors),
      };
    }
    if (parsed.value.asset !== asset) {
      return { ok: false, result: errorResult("资产分区与草稿不一致。") };
    }
    return {
      ok: true,
      asset,
      generation,
      editVersion,
      draftId,
      draft: parsed.value,
    };
  } catch (error) {
    return { ok: false, result: safeFailure(error) };
  }
}

function prepareStoredDraft(
  snapshot: LocalStrategyStoreSnapshot<StoredTradeStrategyDraft>,
  asset: Asset,
  content: TradeStrategyDraftInput,
  submittedDraftId: string | null,
  author: string,
): StoredTradeStrategyDraft {
  const current = snapshot.assets[asset].workingDraft?.value ?? null;
  if (current !== null && submittedDraftId !== current.id) {
    throw new LocalStrategyStoreError(
      "stale_edit_version",
      "Draft identity changed.",
    );
  }
  if (current === null && submittedDraftId !== null) {
    throw new LocalStrategyStoreError(
      "stale_edit_version",
      "Draft no longer exists.",
    );
  }
  const now = new Date().toISOString();
  const revision =
    current?.revision ?? nextRevision(snapshot.assets[asset]);
  return {
    schemaVersion: 1,
    id: current?.id ?? `wise-${asset}-${randomUUID()}`,
    revision,
    storedStatus: "draft",
    content,
    author: current?.author ?? author,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
}

function nextRevision(
  state: LocalStrategyAssetState<StoredTradeStrategyDraft>,
): number {
  return (
    state.publicationRecords.reduce(
      (maximum, record) =>
        record.kind === "publication"
          ? Math.max(maximum, record.strategy.revision)
          : maximum,
      0,
    ) + 1
  );
}

function requireCandidate(
  state: LocalStrategyAssetState<StoredTradeStrategyDraft>,
  editVersion: number,
) {
  if (
    state.reviewCandidate === null ||
    state.workingDraft === null ||
    state.reviewCandidate.editVersion !== editVersion ||
    state.workingDraft.editVersion !== editVersion
  ) {
    throw new LocalStrategyStoreError(
      "stale_edit_version",
      "Review candidate changed.",
    );
  }
  return state.reviewCandidate;
}

async function assertCurrentMutationOrigin(): Promise<void> {
  const requestHeaders = await headers();
  assertStrategyStudioMutationOrigin({
    origin: requestHeaders.get("origin"),
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  });
}

async function waitForMinimumLoginDuration(startedAt: number): Promise<void> {
  const remaining = MINIMUM_LOGIN_DURATION_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

function readAsset(value: FormDataEntryValue | null): Asset {
  if (value !== "btc" && value !== "eth") {
    throw new Error("STRATEGY_STUDIO_INVALID_ASSET");
  }
  return value;
}

function readNonNegativeInteger(
  value: FormDataEntryValue | null,
  field: string,
): number {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`STRATEGY_STUDIO_INVALID_${field.toUpperCase()}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`STRATEGY_STUDIO_INVALID_${field.toUpperCase()}`);
  }
  return parsed;
}

function readPositiveInteger(
  value: FormDataEntryValue | null,
  field: string,
): number {
  const parsed = readNonNegativeInteger(value, field);
  if (parsed < 1) throw new Error(`STRATEGY_STUDIO_INVALID_${field.toUpperCase()}`);
  return parsed;
}

function readNullablePositiveInteger(
  value: FormDataEntryValue | null,
  field: string,
): number | null {
  return value === null || value === ""
    ? null
    : readPositiveInteger(value, field);
}

function readSafeId(value: string): string {
  if (value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error("STRATEGY_STUDIO_INVALID_DRAFT_ID");
  }
  return value;
}

function readBoundedText(
  value: FormDataEntryValue | null,
  field: string,
  maximum: number,
): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`STRATEGY_STUDIO_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function success(message: string, generation: number): ActionResult {
  return { status: "success", message, generation };
}

function wrongRole(requiredRole: string): ActionResult {
  return errorResult(`当前身份不是${requiredRole}，无法执行此操作。`);
}

function issuesFailure(
  message: string,
  issues: readonly TradeStrategyAuthoringIssue[],
): ActionResult {
  return errorResult(
    message,
    issues.map(({ path, message: issueMessage }) => ({
      path: path.replace(/^draft\./u, ""),
      message: issueMessage,
    })),
  );
}

function errorResult(
  message: string,
  errors?: readonly ActionIssue[],
): ActionResult {
  return { status: "error", message, ...(errors ? { errors } : {}) };
}

function safeFailure(error: unknown): ActionResult {
  if (error instanceof LocalStrategyStoreError) {
    if (
      error.code === "stale_generation" ||
      error.code === "stale_edit_version"
    ) {
      return errorResult("内容已在另一个窗口更新，请刷新页面后重试。");
    }
    if (error.code === "publication_overlap") {
      return errorResult("有效时间与现有发布版本重叠，请退回后调整窗口。");
    }
    if (error.code === "invalid_transition") {
      return errorResult("当前工作流状态不允许此操作，请刷新后确认。");
    }
  }
  if (error instanceof Error && error.message === "STRATEGY_STUDIO_UNAUTHORIZED") {
    return errorResult("登录已失效或请求校验失败，请重新进入发布台。");
  }
  if (error instanceof Error && error.message === "STRATEGY_STUDIO_INVALID_ORIGIN") {
    return errorResult("请求来源校验失败，发布台只允许在本机 2222 端口操作。");
  }
  return errorResult("操作未完成。数据没有被覆盖，请刷新后重试。");
}
