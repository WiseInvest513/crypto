import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStore: vi.fn(),
  requireSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/strategy/strategy-studio-request", () => ({
  requireStrategyStudioMutationSession: mocks.requireSession,
}));
vi.mock("@/server/strategy/strategy-studio-store", () => ({
  createStrategyStudioStore: mocks.createStore,
}));

import {
  publishStrategyStudioAction,
  saveStrategyStudioAction,
  withdrawStrategyStudioAction,
} from "@/app/studio/strategies/actions";
import { LocalStrategyStoreError } from "@/server/strategy/local-strategy-store";

const REVIEWER_TOKEN = Buffer.alloc(32, 27).toString("base64url");
const REVIEWER_DIGEST = createHash("sha256")
  .update(REVIEWER_TOKEN, "utf8")
  .digest("hex");
const IDLE = { status: "idle" as const, message: "" };

function session(role: "editor" | "reviewer") {
  return {
    config: {
      enabled: true as const,
      reviewer: { tokenDigest: REVIEWER_DIGEST },
    },
    session: {
      role,
      subject: role === "editor" ? "strategy-editor" : "strategy-reviewer",
      displayName: role === "editor" ? "Wise 编辑" : "Wise 复核",
    },
    csrfToken: "csrf",
    sessionToken: "session",
  };
}

function withdrawalForm(token = REVIEWER_TOKEN): FormData {
  const form = new FormData();
  form.set("csrfToken", "csrf");
  form.set("asset", "btc");
  form.set("generation", "8");
  form.set("strategyId", "wise-btc-publication");
  form.set("revision", "3");
  form.set("reason", "来源条件已经变化");
  form.set("staffToken", token);
  form.set("confirmed", "yes");
  return form;
}

describe("strategy studio Server Action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the reviewer role before any draft storage is opened", async () => {
    mocks.requireSession.mockResolvedValue(session("reviewer"));
    const result = await saveStrategyStudioAction(IDLE, new FormData());

    expect(result).toMatchObject({ status: "error", message: /不是编辑者/u });
    expect(mocks.createStore).not.toHaveBeenCalled();
  });

  it.each([
    ["STRATEGY_STUDIO_UNAUTHORIZED", "登录已失效"],
    ["STRATEGY_STUDIO_INVALID_ORIGIN", "请求来源校验失败"],
  ])("fails closed when request validation raises %s", async (code, copy) => {
    mocks.requireSession.mockRejectedValue(new Error(code));
    const result = await saveStrategyStudioAction(IDLE, new FormData());

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining(copy) });
    expect(mocks.createStore).not.toHaveBeenCalled();
  });

  it("requires reviewer reauthentication before publication storage", async () => {
    mocks.requireSession.mockResolvedValue(session("reviewer"));
    const form = new FormData();
    form.set("csrfToken", "csrf");
    form.set("confirmed", "yes");
    form.set("staffToken", Buffer.alloc(32, 28).toString("base64url"));

    const result = await publishStrategyStudioAction(IDLE, form);
    expect(result).toMatchObject({ status: "error", message: /令牌验证失败/u });
    expect(mocks.createStore).not.toHaveBeenCalled();
  });

  it("withdraws only the explicitly submitted publication identity", async () => {
    const withdrawLatestPublication = vi.fn().mockResolvedValue({
      generation: 9,
      value: { kind: "withdrawal" },
    });
    mocks.requireSession.mockResolvedValue(session("reviewer"));
    mocks.createStore.mockReturnValue({ withdrawLatestPublication });

    const result = await withdrawStrategyStudioAction(
      IDLE,
      withdrawalForm(),
    );

    expect(withdrawLatestPublication).toHaveBeenCalledWith({
      asset: "btc",
      strategyId: "wise-btc-publication",
      revision: 3,
      expectedGeneration: 8,
      withdrawnBy: "strategy-reviewer",
      reason: "来源条件已经变化",
    });
    expect(result).toEqual({
      status: "success",
      message: "当前发布版本已撤回，不会回退旧判断。",
      generation: 9,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/studio/strategies");
  });

  it("returns a refresh-safe error when withdrawal loses the generation race", async () => {
    mocks.requireSession.mockResolvedValue(session("reviewer"));
    mocks.createStore.mockReturnValue({
      withdrawLatestPublication: vi.fn().mockRejectedValue(
        new LocalStrategyStoreError("stale_generation", "stale"),
      ),
    });

    const result = await withdrawStrategyStudioAction(
      IDLE,
      withdrawalForm(),
    );
    expect(result).toEqual({
      status: "error",
      message: "内容已在另一个窗口更新，请刷新页面后重试。",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
