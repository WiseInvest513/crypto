import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  isSafeStrategyStudioDisplayName,
  isSafeStrategyStudioSubject,
  isStrategyStudioStaffRole,
  type StrategyStudioStaffRole,
} from "./staff-runtime-config";

export const STRATEGY_STUDIO_SESSION_VERSION = 1 as const;
export const STRATEGY_STUDIO_SESSION_DURATION_SECONDS = 30 * 60;
export const STRATEGY_STUDIO_SESSION_COOKIE_NAME =
  "wise_strategy_studio_session";
export const STRATEGY_STUDIO_SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/studio/strategies",
  secure: process.env.VERCEL_ENV === "production",
  maxAge: STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
});

export type StrategyStudioSessionIdentity = Readonly<{
  role: StrategyStudioStaffRole;
  subject: string;
  displayName: string;
}>;

export type StrategyStudioSession = StrategyStudioSessionIdentity &
  Readonly<{
    version: typeof STRATEGY_STUDIO_SESSION_VERSION;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  }>;

export type CreateStrategyStudioSessionOptions = Readonly<{
  /** Epoch milliseconds. Defaults to Date.now(). */
  now?: number;
  /** A canonical 32-byte base64url nonce; injectable for deterministic tests. */
  nonce?: string;
}>;

type SessionPayload = Readonly<{
  v: typeof STRATEGY_STUDIO_SESSION_VERSION;
  role: StrategyStudioStaffRole;
  sub: string;
  name: string;
  jti: string;
  iat: number;
  exp: number;
}>;

const TOKEN_PREFIX = "v1";
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const PAYLOAD_PATTERN = /^[A-Za-z0-9_-]{1,2048}$/u;
const SESSION_PAYLOAD_KEYS = Object.freeze([
  "v",
  "role",
  "sub",
  "name",
  "jti",
  "iat",
  "exp",
] as const);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/**
 * Creates a signed, non-encrypted staff session. No login token or key is
 * serialized. Cookie I/O intentionally remains outside this pure core.
 */
export function createStrategyStudioSessionToken(
  identity: StrategyStudioSessionIdentity,
  sessionKey: Uint8Array | string,
  options: CreateStrategyStudioSessionOptions = {},
): string {
  if (
    !isStrategyStudioStaffRole(identity.role) ||
    !isSafeStrategyStudioSubject(identity.subject) ||
    !isSafeStrategyStudioDisplayName(identity.displayName)
  ) {
    throw new TypeError("Invalid strategy studio session identity.");
  }

  const key = requireKey(sessionKey);
  const now = options.now ?? Date.now();
  if (!Number.isFinite(now) || now < 0) {
    throw new TypeError("Strategy studio session time must be finite.");
  }

  const nonce = options.nonce ?? randomBytes(32).toString("base64url");
  if (!isCanonicalNonce(nonce)) {
    throw new TypeError("Strategy studio session nonce must be 32 bytes.");
  }

  const issuedAt = Math.floor(now / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(
      issuedAt + STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
    )
  ) {
    throw new TypeError("Strategy studio session time is out of range.");
  }
  const payload: SessionPayload = {
    v: STRATEGY_STUDIO_SESSION_VERSION,
    role: identity.role,
    sub: identity.subject,
    name: identity.displayName,
    jti: nonce,
    iat: issuedAt,
    exp: issuedAt + STRATEGY_STUDIO_SESSION_DURATION_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${TOKEN_PREFIX}.${encodedPayload}`;
  return `${signingInput}.${sign(signingInput, key)}`;
}

/**
 * Verifies HMAC, exact payload schema, fixed 30-minute lifetime and the
 * half-open validity window `[iat, exp)`. Returns null for every invalid token.
 */
export function verifyStrategyStudioSessionToken(
  token: unknown,
  sessionKey: Uint8Array | string,
  now = Date.now(),
): StrategyStudioSession | null {
  const key = parseKey(sessionKey);
  if (
    key === null ||
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 4_096 ||
    !Number.isFinite(now) ||
    now < 0
  ) {
    return null;
  }

  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== TOKEN_PREFIX ||
    !PAYLOAD_PATTERN.test(parts[1]) ||
    !KEY_PATTERN.test(parts[2])
  ) {
    return null;
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const providedSignature = decodeCanonicalBase64Url(parts[2], 32);
  const expectedSignature = Buffer.from(sign(signingInput, key), "base64url");
  if (
    providedSignature === null ||
    !fixedLengthEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  const payload = parsePayload(parts[1]);
  if (payload === null) return null;

  const nowSeconds = Math.floor(now / 1_000);
  if (!Number.isSafeInteger(nowSeconds)) return null;
  if (nowSeconds < payload.iat || nowSeconds >= payload.exp) return null;

  return {
    version: STRATEGY_STUDIO_SESSION_VERSION,
    role: payload.role,
    subject: payload.sub,
    displayName: payload.name,
    nonce: payload.jti,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

/** Derives a CSRF token bound to the exact signed session token. */
export function deriveStrategyStudioCsrfToken(
  sessionToken: string,
  sessionKey: Uint8Array | string,
): string {
  if (
    typeof sessionToken !== "string" ||
    sessionToken.length === 0 ||
    sessionToken.length > 4_096
  ) {
    throw new TypeError("Invalid strategy studio session token.");
  }
  const key = requireKey(sessionKey);
  return createHmac("sha256", key)
    .update("wise-crypto:strategy-studio:csrf:v1\0", "utf8")
    .update(sessionToken, "utf8")
    .digest("base64url");
}

/** Constant-time CSRF comparison after strict fixed-length decoding. */
export function verifyStrategyStudioCsrfToken(
  csrfToken: unknown,
  sessionToken: unknown,
  sessionKey: Uint8Array | string,
): boolean {
  if (
    typeof csrfToken !== "string" ||
    typeof sessionToken !== "string" ||
    !KEY_PATTERN.test(csrfToken)
  ) {
    return false;
  }

  const key = parseKey(sessionKey);
  if (key === null) return false;

  let expected: string;
  try {
    expected = deriveStrategyStudioCsrfToken(sessionToken, key);
  } catch {
    return false;
  }

  const providedBytes = decodeCanonicalBase64Url(csrfToken, 32);
  const expectedBytes = decodeCanonicalBase64Url(expected, 32);
  return (
    providedBytes !== null &&
    expectedBytes !== null &&
    fixedLengthEqual(providedBytes, expectedBytes)
  );
}

function parsePayload(encoded: string): SessionPayload | null {
  const bytes = decodeCanonicalBase64Url(encoded);
  if (bytes === null) return null;

  let json: string;
  let value: unknown;
  try {
    json = UTF8_DECODER.decode(bytes);
    value = JSON.parse(json) as unknown;
  } catch {
    return null;
  }

  if (!isExactPayloadRecord(value)) return null;
  if (JSON.stringify(value) !== json) return null;
  if (
    value.v !== STRATEGY_STUDIO_SESSION_VERSION ||
    !isStrategyStudioStaffRole(value.role) ||
    !isSafeStrategyStudioSubject(value.sub) ||
    !isSafeStrategyStudioDisplayName(value.name) ||
    !isCanonicalNonce(value.jti) ||
    typeof value.iat !== "number" ||
    !Number.isSafeInteger(value.iat) ||
    value.iat < 0 ||
    typeof value.exp !== "number" ||
    !Number.isSafeInteger(value.exp) ||
    value.exp !== value.iat + STRATEGY_STUDIO_SESSION_DURATION_SECONDS
  ) {
    return null;
  }

  return value as SessionPayload;
}

function isExactPayloadRecord(
  value: unknown,
): value is Record<(typeof SESSION_PAYLOAD_KEYS)[number], unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return (
    keys.length === SESSION_PAYLOAD_KEYS.length &&
    keys.every((key) =>
      (SESSION_PAYLOAD_KEYS as readonly string[]).includes(key),
    )
  );
}

function sign(input: string, key: Uint8Array): string {
  return createHmac("sha256", key).update(input, "utf8").digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function isCanonicalNonce(value: unknown): value is string {
  return (
    typeof value === "string" &&
    NONCE_PATTERN.test(value) &&
    decodeCanonicalBase64Url(value, 32) !== null
  );
}

function requireKey(value: Uint8Array | string): Uint8Array {
  const key = parseKey(value);
  if (key === null) {
    throw new TypeError("Strategy studio session key must be 32 bytes.");
  }
  return key;
}

function parseKey(value: Uint8Array | string): Uint8Array | null {
  if (typeof value === "string") {
    const bytes = decodeCanonicalBase64Url(value, 32);
    return bytes === null ? null : Uint8Array.from(bytes);
  }
  if (value instanceof Uint8Array && value.byteLength === 32) {
    return Uint8Array.from(value);
  }
  return null;
}

function decodeCanonicalBase64Url(
  value: string,
  expectedLength?: number,
): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  if (
    (expectedLength !== undefined && decoded.byteLength !== expectedLength) ||
    decoded.toString("base64url") !== value
  ) {
    return null;
  }
  return decoded;
}

function fixedLengthEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}
