import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createStrategyStudioSessionToken,
  deriveStrategyStudioCsrfToken,
  STRATEGY_STUDIO_SESSION_COOKIE_NAME,
  STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS,
  STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
  verifyStrategyStudioCsrfToken,
  verifyStrategyStudioSessionToken,
} from "@/server/strategy/staff-session";

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const KEY = Buffer.alloc(32, 17);
const OTHER_KEY = Buffer.alloc(32, 18);
const NONCE = Buffer.alloc(32, 19).toString("base64url");
const IDENTITY = Object.freeze({
  role: "editor" as const,
  subject: "strategy-editor",
  displayName: "Wise 编辑",
});

function signPayload(
  payload: Record<string, unknown>,
  key = KEY,
  prefix = "v1",
): string {
  return signRawJson(JSON.stringify(payload), key, prefix);
}

function signRawJson(json: string, key = KEY, prefix = "v1"): string {
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  const input = `${prefix}.${encoded}`;
  const signature = createHmac("sha256", key)
    .update(input, "utf8")
    .digest("base64url");
  return `${input}.${signature}`;
}

function validPayload(): Record<string, unknown> {
  const issuedAt = Math.floor(NOW / 1_000);
  return {
    v: 1,
    role: "editor",
    sub: "strategy-editor",
    name: "Wise 编辑",
    jti: NONCE,
    iat: issuedAt,
    exp: issuedAt + STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
  };
}

describe("strategy studio staff session", () => {
  it("creates an HMAC-SHA256 token with strict staff claims and fixed lifetime", () => {
    const token = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
      nonce: NONCE,
    });
    expect(token.split(".")).toHaveLength(3);

    expect(verifyStrategyStudioSessionToken(token, KEY, NOW)).toEqual({
      version: 1,
      role: "editor",
      subject: "strategy-editor",
      displayName: "Wise 编辑",
      nonce: NONCE,
      issuedAt: Math.floor(NOW / 1_000),
      expiresAt:
        Math.floor(NOW / 1_000) +
        STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
    });
  });

  it("uses a high-entropy nonce by default", () => {
    const first = createStrategyStudioSessionToken(IDENTITY, KEY, { now: NOW });
    const second = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
    });
    expect(first).not.toBe(second);
    const session = verifyStrategyStudioSessionToken(first, KEY, NOW);
    expect(session?.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it("enforces the half-open [iat, exp) validity window at exact expiry", () => {
    const token = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
      nonce: NONCE,
    });
    const expiry =
      NOW + STRATEGY_STUDIO_SESSION_DURATION_SECONDS * 1_000;

    expect(verifyStrategyStudioSessionToken(token, KEY, NOW - 1)).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(token, KEY, expiry - 1),
    ).not.toBeNull();
    expect(verifyStrategyStudioSessionToken(token, KEY, expiry)).toBeNull();
  });

  it("rejects payload and signature tampering", () => {
    const token = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
      nonce: NONCE,
    });
    const [prefix, payload, signature] = token.split(".");
    const payloadTail = payload.at(-1) === "A" ? "B" : "A";
    const signatureTail = signature.at(-1) === "A" ? "B" : "A";

    expect(
      verifyStrategyStudioSessionToken(
        `${prefix}.${payload.slice(0, -1)}${payloadTail}.${signature}`,
        KEY,
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(
        `${prefix}.${payload}.${signature.slice(0, -1)}${signatureTail}`,
        KEY,
        NOW,
      ),
    ).toBeNull();
  });

  it("rejects wrong role, version, duration, unknown fields and duplicate JSON keys", () => {
    expect(
      verifyStrategyStudioSessionToken(
        signPayload({ ...validPayload(), role: "vip" }),
        KEY,
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(
        signPayload({ ...validPayload(), v: 2 }),
        KEY,
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(
        signPayload({ ...validPayload(), exp: Math.floor(NOW / 1_000) + 60 }),
        KEY,
        NOW,
      ),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(
        signPayload({ ...validPayload(), extra: true }),
        KEY,
        NOW,
      ),
    ).toBeNull();

    const payload = validPayload();
    const duplicateRoleJson = JSON.stringify(payload).replace(
      '"role":"editor"',
      '"role":"editor","role":"editor"',
    );
    expect(
      verifyStrategyStudioSessionToken(
        signRawJson(duplicateRoleJson),
        KEY,
        NOW,
      ),
    ).toBeNull();
  });

  it("rejects incorrect segment count, prefix, key and malformed inputs", () => {
    const token = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
      nonce: NONCE,
    });
    const [, payload, signature] = token.split(".");

    expect(verifyStrategyStudioSessionToken("one.two", KEY, NOW)).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(`v2.${payload}.${signature}`, KEY, NOW),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(token, OTHER_KEY, NOW),
    ).toBeNull();
    expect(
      verifyStrategyStudioSessionToken(token, Buffer.alloc(31), NOW),
    ).toBeNull();
    expect(verifyStrategyStudioSessionToken(null, KEY, NOW)).toBeNull();
  });

  it("never serializes the signing key or a raw login token", () => {
    const rawLoginToken = "test-only-editor-login-token";
    const encodedKey = KEY.toString("base64url");
    const token = createStrategyStudioSessionToken(IDENTITY, encodedKey, {
      now: NOW,
      nonce: NONCE,
    });
    const payloadJson = Buffer.from(token.split(".")[1], "base64url").toString(
      "utf8",
    );

    expect(token).not.toContain(encodedKey);
    expect(token).not.toContain(rawLoginToken);
    expect(payloadJson).not.toContain(encodedKey);
    expect(payloadJson).not.toContain(rawLoginToken);
  });

  it("derives a constant-length CSRF token bound to the exact session", () => {
    const session = createStrategyStudioSessionToken(IDENTITY, KEY, {
      now: NOW,
      nonce: NONCE,
    });
    const csrf = deriveStrategyStudioCsrfToken(session, KEY);
    expect(csrf).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(verifyStrategyStudioCsrfToken(csrf, session, KEY)).toBe(true);
    expect(
      verifyStrategyStudioCsrfToken(csrf, `${session}x`, KEY),
    ).toBe(false);
    expect(
      verifyStrategyStudioCsrfToken(csrf, session, OTHER_KEY),
    ).toBe(false);
    expect(
      verifyStrategyStudioCsrfToken(`${csrf.slice(0, -1)}x`, session, KEY),
    ).toBe(false);
    expect(verifyStrategyStudioCsrfToken("short", session, KEY)).toBe(false);
  });

  it("exports hardened, path-scoped cookie options", () => {
    expect(STRATEGY_STUDIO_SESSION_COOKIE_NAME).toBe(
      "wise_strategy_studio_session",
    );
    expect(STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS).toEqual({
      httpOnly: true,
      sameSite: "strict",
      path: "/studio/strategies",
      secure: process.env.VERCEL_ENV === "production",
      maxAge: 1_800,
    });
  });
});
