import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  resolveConfiguration: vi.fn<
    () => { sessionSecret: string } | null
  >(() => ({
    sessionSecret: "test-session-secret-longer-than-thirty-two-characters",
  })),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.delete,
    get: mocks.get,
    set: mocks.set,
  })),
}));

vi.mock("@/server/auth/wise-auth-config", () => ({
  resolveWiseAuthConfiguration: mocks.resolveConfiguration,
  WISE_AUTH_CALLBACK_PATH: "/api/auth/callback/wise",
}));

import {
  readWiseSessionDurationPreference,
  saveWiseSessionDurationPreference,
} from "@/server/auth/wise-session-preference";

describe("Wise session duration handoff cookie", () => {
  beforeEach(() => {
    mocks.delete.mockReset();
    mocks.get.mockReset();
    mocks.resolveConfiguration.mockReset();
    mocks.resolveConfiguration.mockReturnValue({
      sessionSecret: "test-session-secret-longer-than-thirty-two-characters",
    });
    mocks.set.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("passes the explicit seven-day choice only to the OIDC callback", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await saveWiseSessionDurationPreference("remember-seven-days");

    expect(mocks.set).toHaveBeenCalledOnce();
    const [name, value, options] = mocks.set.mock.calls[0] ?? [];
    expect(name).toBe("wise-session-duration");
    expect(value).toMatch(
      /^v1\.\d{10}\.remember-seven-days\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/u,
    );
    expect(options).toEqual({
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/api/auth/callback/wise",
      sameSite: "lax",
      secure: true,
    });
  });

  it("accepts a valid signed choice once and removes the handoff cookie", async () => {
    await saveWiseSessionDurationPreference("remember-seven-days");
    const signedValue = mocks.set.mock.calls[0]?.[1];
    mocks.get.mockReturnValue({ value: signedValue });

    await expect(readWiseSessionDurationPreference()).resolves.toBe(
      "remember-seven-days",
    );
    expect(mocks.delete).toHaveBeenCalledWith({
      name: "wise-session-duration",
      path: "/api/auth/callback/wise",
    });
  });

  it("rejects a legal-looking seven-day value when its signature was tampered", async () => {
    await saveWiseSessionDurationPreference("default");
    const signedDefault = String(mocks.set.mock.calls[0]?.[1]);
    mocks.get.mockReturnValue({
      value: signedDefault.replace(".default.", ".remember-seven-days."),
    });

    await expect(readWiseSessionDurationPreference()).resolves.toBe("default");
  });

  it("rejects an otherwise valid preference after its fifteen-minute handoff window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));
    await saveWiseSessionDurationPreference("remember-seven-days");
    const signedValue = mocks.set.mock.calls[0]?.[1];

    vi.setSystemTime(new Date("2026-09-11T10:15:01.000Z"));
    mocks.get.mockReturnValue({ value: signedValue });

    await expect(readWiseSessionDurationPreference()).resolves.toBe("default");
  });

  it("does not create a preference without the configured signing secret", async () => {
    mocks.resolveConfiguration.mockReturnValue(null);

    await saveWiseSessionDurationPreference("remember-seven-days");

    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("fails closed to the three-day choice for a malformed value", async () => {
    mocks.get.mockReturnValue({ value: "remember-seven-days" });

    await expect(readWiseSessionDurationPreference()).resolves.toBe("default");
  });

  it("defaults when the handoff cookie is missing", async () => {
    mocks.get.mockReturnValue(undefined);

    await expect(readWiseSessionDurationPreference()).resolves.toBe("default");
    expect(mocks.delete).toHaveBeenCalledWith({
      name: "wise-session-duration",
      path: "/api/auth/callback/wise",
    });
  });
});
