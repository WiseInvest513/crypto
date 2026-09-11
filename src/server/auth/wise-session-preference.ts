import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  readWiseSessionDuration,
  type WiseSessionDuration,
} from "@/lib/auth/wise-session-policy";
import {
  resolveWiseAuthConfiguration,
  WISE_AUTH_CALLBACK_PATH,
} from "@/server/auth/wise-auth-config";

const WISE_SESSION_DURATION_COOKIE = "wise-session-duration";
const WISE_SESSION_DURATION_COOKIE_SECONDS = 15 * 60;
const WISE_SESSION_DURATION_COOKIE_VERSION = "v1";
const WISE_SESSION_DURATION_COOKIE_CONTEXT = "wise-session-duration";
const MAX_CLOCK_SKEW_SECONDS = 60;

export async function saveWiseSessionDurationPreference(
  value: unknown,
): Promise<void> {
  const duration = readWiseSessionDuration(value);
  const secret = resolveWiseAuthConfiguration()?.sessionSecret;
  if (!secret) return;

  const store = await cookies();
  store.set(WISE_SESSION_DURATION_COOKIE, createSignedPreference(duration, secret), {
    httpOnly: true,
    maxAge: WISE_SESSION_DURATION_COOKIE_SECONDS,
    path: WISE_AUTH_CALLBACK_PATH,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readWiseSessionDurationPreference(): Promise<WiseSessionDuration> {
  const store = await cookies();
  const value = store.get(WISE_SESSION_DURATION_COOKIE)?.value;

  // The preference is a short-lived handoff for one OAuth round trip. Remove
  // it at the callback even when validation fails so it cannot linger and
  // influence a later login attempt.
  store.delete({
    name: WISE_SESSION_DURATION_COOKIE,
    path: WISE_AUTH_CALLBACK_PATH,
  });

  const secret = resolveWiseAuthConfiguration()?.sessionSecret;
  if (!secret || !value) return "default";
  return verifySignedPreference(value, secret);
}

function createSignedPreference(
  duration: WiseSessionDuration,
  secret: string,
  nowMilliseconds: number = Date.now(),
): string {
  const issuedAt = Math.floor(nowMilliseconds / 1_000);
  const nonce = randomBytes(16).toString("base64url");
  const payload = [
    WISE_SESSION_DURATION_COOKIE_VERSION,
    String(issuedAt),
    duration,
    nonce,
  ].join(".");
  return `${payload}.${signPreference(payload, secret)}`;
}

function verifySignedPreference(
  value: string,
  secret: string,
  nowMilliseconds: number = Date.now(),
): WiseSessionDuration {
  if (value.length > 512 || !Number.isFinite(nowMilliseconds)) return "default";

  const [version, issuedAtText, duration, nonce, signature, ...extra] = value.split(".");
  if (
    extra.length > 0 ||
    version !== WISE_SESSION_DURATION_COOKIE_VERSION ||
    !/^\d{1,12}$/u.test(issuedAtText ?? "") ||
    (duration !== "default" && duration !== "remember-seven-days") ||
    !/^[A-Za-z0-9_-]{22}$/u.test(nonce ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/u.test(signature ?? "")
  ) {
    return "default";
  }

  const issuedAt = Number(issuedAtText);
  const now = Math.floor(nowMilliseconds / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt <= 0 ||
    issuedAt > now + MAX_CLOCK_SKEW_SECONDS ||
    now - issuedAt > WISE_SESSION_DURATION_COOKIE_SECONDS
  ) {
    return "default";
  }

  const payload = [version, issuedAtText, duration, nonce].join(".");
  const expected = Buffer.from(signPreference(payload, secret));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return "default";
  }

  return duration;
}

function signPreference(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(WISE_SESSION_DURATION_COOKIE_CONTEXT)
    .update("\0")
    .update(payload)
    .digest("base64url");
}
