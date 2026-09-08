import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWiseAuthConfigurationStatus: vi.fn(),
  resolveWiseAccountState: vi.fn(),
}));

vi.mock("@/server/auth/wise-auth-config", () => ({
  getWiseAuthConfigurationStatus: mocks.getWiseAuthConfigurationStatus,
}));

vi.mock("@/server/auth/wise-session", () => ({
  resolveWiseAccountState: mocks.resolveWiseAccountState,
}));

import { GET } from "@/app/api/account/route";

describe("Wise account route", () => {
  beforeEach(() => {
    mocks.getWiseAuthConfigurationStatus.mockReset();
    mocks.resolveWiseAccountState.mockReset();
    mocks.getWiseAuthConfigurationStatus.mockReturnValue("ready");
    mocks.resolveWiseAccountState.mockResolvedValue({ status: "anonymous" });
  });

  it("returns only the browser account summary for an authenticated session", async () => {
    mocks.resolveWiseAccountState.mockResolvedValue({
      status: "authenticated",
      account: {
        displayName: "Wise Member",
        email: "member@example.com",
        emailVerified: true,
        imageUrl: "https://www.wise-invest.org/avatar.png",
        label: "VIP+ 用户",
        membershipTier: "VIP_PLUS",
        principal: {
          subject: "Y123456789",
          tier: "vip",
        },
        wiseId: "Y123456789",
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expectPrivateAccountHeaders(response);
    await expect(response.json()).resolves.toEqual({
      status: "authenticated",
      displayName: "Wise Member",
      email: "member@example.com",
      emailVerified: true,
      imageUrl: "https://www.wise-invest.org/avatar.png",
      label: "VIP+ 用户",
      membershipTier: "VIP_PLUS",
      tier: "vip",
      wiseId: "Y123456789",
    });
  });

  it("returns an anonymous state without leaking an account-shaped payload", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expectPrivateAccountHeaders(response);
    await expect(response.json()).resolves.toEqual({ status: "anonymous" });
  });

  it("fails closed when the Wise ID server configuration is incomplete", async () => {
    mocks.getWiseAuthConfigurationStatus.mockReturnValue("misconfigured");

    const response = await GET();

    expect(response.status).toBe(503);
    expectPrivateAccountHeaders(response);
    await expect(response.json()).resolves.toEqual({ status: "error" });
    expect(mocks.resolveWiseAccountState).not.toHaveBeenCalled();
  });

  it("keeps a disabled integration distinct from a broken configuration", async () => {
    mocks.getWiseAuthConfigurationStatus.mockReturnValue("disabled");

    const response = await GET();

    expect(response.status).toBe(200);
    expectPrivateAccountHeaders(response);
    await expect(response.json()).resolves.toEqual({ status: "disabled" });
    expect(mocks.resolveWiseAccountState).not.toHaveBeenCalled();
  });

  it("does not expose session resolution failures", async () => {
    mocks.resolveWiseAccountState.mockResolvedValue({ status: "error" });

    const response = await GET();

    expect(response.status).toBe(503);
    expectPrivateAccountHeaders(response);
    await expect(response.json()).resolves.toEqual({ status: "error" });
  });
});

function expectPrivateAccountHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("content-type")).toContain("application/json");
}
