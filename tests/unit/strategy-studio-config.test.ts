import { createHash } from "node:crypto";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isStrategyStudioStaffRole,
  loadStrategyStudioRuntimeConfig,
  verifyStrategyStudioStaffToken,
  type StrategyStudioEnvironment,
} from "@/server/strategy/staff-runtime-config";

const CWD = "/workspace/wise-crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function key(fill: number): string {
  return Buffer.alloc(32, fill).toString("base64url");
}

function completeEnvironment(): Record<string, string> {
  return {
    WISE_STRATEGY_STUDIO_MODE: "local",
    WISE_STRATEGY_STUDIO_SESSION_KEY: key(1),
    WISE_STRATEGY_STUDIO_ENCRYPTION_KEY: key(2),
    WISE_STRATEGY_STUDIO_EDITOR_TOKEN_SHA256: sha256(
      "test-only-editor-login-token",
    ),
    WISE_STRATEGY_STUDIO_EDITOR_SUBJECT: "strategy-editor",
    WISE_STRATEGY_STUDIO_EDITOR_DISPLAY_NAME: "Wise 编辑",
    WISE_STRATEGY_STUDIO_REVIEWER_TOKEN_SHA256: sha256(
      "test-only-reviewer-login-token",
    ),
    WISE_STRATEGY_STUDIO_REVIEWER_SUBJECT: "strategy-reviewer",
    WISE_STRATEGY_STUDIO_REVIEWER_DISPLAY_NAME: "Wise 审核",
  };
}

describe("strategy studio local runtime configuration", () => {
  it("stays disabled unless local mode is explicit and configuration is complete", () => {
    expect(loadStrategyStudioRuntimeConfig({}, CWD)).toEqual({
      enabled: false,
      reason: "mode_disabled",
    });

    const incomplete = completeEnvironment();
    delete incomplete.WISE_STRATEGY_STUDIO_SESSION_KEY;
    expect(loadStrategyStudioRuntimeConfig(incomplete, CWD)).toEqual({
      enabled: false,
      reason: "invalid_configuration",
    });
  });

  it("returns only validated editor/reviewer identities and private keys", () => {
    const config = loadStrategyStudioRuntimeConfig(completeEnvironment(), CWD);
    expect(config.enabled).toBe(true);
    if (!config.enabled) throw new Error("Expected enabled test config.");

    expect(config.mode).toBe("local");
    expect(config.sessionKey).toHaveLength(32);
    expect(config.encryptionKey).toHaveLength(32);
    expect(config.sessionKey).not.toEqual(config.encryptionKey);
    expect(config.editor).toMatchObject({
      role: "editor",
      subject: "strategy-editor",
      displayName: "Wise 编辑",
    });
    expect(config.reviewer).toMatchObject({
      role: "reviewer",
      subject: "strategy-reviewer",
      displayName: "Wise 审核",
    });
    expect(config.editor.tokenDigest).not.toBe(config.reviewer.tokenDigest);
    expect(config.storeDirectory).toBe(
      path.join(CWD, ".wise-crypto-private", "strategies"),
    );
    expect(JSON.stringify(config)).not.toContain(
      "test-only-editor-login-token",
    );
  });

  it.each(["VERCEL", "VERCEL_ENV", "VERCEL_URL", "CF_PAGES"])(
    "disables local mode when deployment marker %s exists",
    (marker) => {
      const environment: StrategyStudioEnvironment = {
        ...completeEnvironment(),
        [marker]: "present",
      };
      expect(loadStrategyStudioRuntimeConfig(environment, CWD)).toEqual({
        enabled: false,
        reason: "deployment_environment",
      });
    },
  );

  it("disables on any public Wise strategy environment variable, even empty", () => {
    const environment = {
      ...completeEnvironment(),
      NEXT_PUBLIC_WISE_STRATEGY_ACCIDENTAL_LEAK: "",
    };
    expect(loadStrategyStudioRuntimeConfig(environment, CWD)).toEqual({
      enabled: false,
      reason: "public_environment_variable",
    });
  });

  it("rejects malformed, reused and non-base64url secrets", () => {
    for (const update of [
      { WISE_STRATEGY_STUDIO_EDITOR_TOKEN_SHA256: "not-a-digest" },
      {
        WISE_STRATEGY_STUDIO_REVIEWER_TOKEN_SHA256:
          completeEnvironment().WISE_STRATEGY_STUDIO_EDITOR_TOKEN_SHA256,
      },
      { WISE_STRATEGY_STUDIO_SESSION_KEY: "not-a-key" },
      {
        WISE_STRATEGY_STUDIO_ENCRYPTION_KEY:
          completeEnvironment().WISE_STRATEGY_STUDIO_SESSION_KEY,
      },
    ]) {
      expect(
        loadStrategyStudioRuntimeConfig(
          { ...completeEnvironment(), ...update },
          CWD,
        ),
      ).toEqual({ enabled: false, reason: "invalid_configuration" });
    }
  });

  it("keeps staff roles separate from public regular/vip tiers", () => {
    expect(isStrategyStudioStaffRole("editor")).toBe(true);
    expect(isStrategyStudioStaffRole("reviewer")).toBe(true);
    expect(isStrategyStudioStaffRole("regular")).toBe(false);
    expect(isStrategyStudioStaffRole("vip")).toBe(false);
  });

  it("rejects unsafe identities and requires different staff subjects", () => {
    for (const update of [
      { WISE_STRATEGY_STUDIO_EDITOR_SUBJECT: "../editor" },
      { WISE_STRATEGY_STUDIO_EDITOR_DISPLAY_NAME: "编辑\n注入" },
      { WISE_STRATEGY_STUDIO_EDITOR_DISPLAY_NAME: "<script>" },
      {
        WISE_STRATEGY_STUDIO_REVIEWER_SUBJECT: "STRATEGY-EDITOR",
      },
      {
        WISE_STRATEGY_STUDIO_REVIEWER_DISPLAY_NAME: "Wise 编辑",
      },
    ]) {
      expect(
        loadStrategyStudioRuntimeConfig(
          { ...completeEnvironment(), ...update },
          CWD,
        ),
      ).toEqual({ enabled: false, reason: "invalid_configuration" });
    }
  });

  it.each([
    CWD,
    `${CWD}/src`,
    `${CWD}/src/server/private`,
    `${CWD}/public/strategies`,
    `${CWD}/docs`,
    `${CWD}/.next/data`,
  ])("rejects unsafe store root %s", (storeDirectory) => {
    const environment = {
      ...completeEnvironment(),
      WISE_STRATEGY_STUDIO_STORE_DIR: storeDirectory,
    };
    expect(loadStrategyStudioRuntimeConfig(environment, CWD)).toEqual({
      enabled: false,
      reason: "invalid_configuration",
    });
  });

  it("accepts an explicit private store directory outside protected roots", () => {
    const environment = {
      ...completeEnvironment(),
      WISE_STRATEGY_STUDIO_STORE_DIR: ".private/strategy-store",
    };
    const config = loadStrategyStudioRuntimeConfig(environment, CWD);
    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(config.storeDirectory).toBe(`${CWD}/.private/strategy-store`);
    }
  });

  it("checks login tokens by SHA-256 digest without retaining raw tokens", () => {
    const token = key(3);
    const digest = sha256(token);
    expect(verifyStrategyStudioStaffToken(token, digest)).toBe(true);
    expect(verifyStrategyStudioStaffToken(`${token}-wrong`, digest)).toBe(false);
    expect(verifyStrategyStudioStaffToken("x", sha256("x"))).toBe(false);
    expect(verifyStrategyStudioStaffToken(token, "invalid")).toBe(false);
  });
});
