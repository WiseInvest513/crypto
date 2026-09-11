import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isWiseAuthConfigured: vi.fn(),
  isWiseLocalDevelopmentRequest: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/auth/wise-auth-config", () => ({
  isWiseAuthConfigured: mocks.isWiseAuthConfigured,
}));
vi.mock("@/server/auth/wise-local-development", () => ({
  isWiseLocalDevelopmentRequest: mocks.isWiseLocalDevelopmentRequest,
}));

import { resolveWiseAccountState } from "@/server/auth/wise-session";

describe("Wise session resolution", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.isWiseAuthConfigured.mockReset();
    mocks.isWiseLocalDevelopmentRequest.mockReset();
    mocks.isWiseAuthConfigured.mockReturnValue(false);
    mocks.isWiseLocalDevelopmentRequest.mockResolvedValue(false);
  });

  it("uses a fixed regular account for an eligible local development request", async () => {
    mocks.isWiseLocalDevelopmentRequest.mockResolvedValue(true);

    await expect(resolveWiseAccountState()).resolves.toEqual({
      status: "authenticated",
      account: {
        authenticationSource: "local-development",
        displayName: "本地开发用户",
        email: null,
        emailVerified: null,
        imageUrl: null,
        label: "普通用户",
        membershipAccessFresh: true,
        membershipTier: "MEMBER",
        principal: {
          subject: "local-development",
          tier: "regular",
        },
        wiseId: "LOCAL-DEVELOPMENT",
      },
    });
    expect(mocks.isWiseAuthConfigured).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("does not create a development identity when the request is ineligible", async () => {
    await expect(resolveWiseAccountState()).resolves.toEqual({
      status: "disabled",
    });
    expect(mocks.isWiseAuthConfigured).toHaveBeenCalledOnce();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("keeps the base session but downgrades expired VIP proof to regular access", async () => {
    mocks.isWiseAuthConfigured.mockReturnValue(true);
    mocks.auth.mockResolvedValue({
      user: {
        id: "Y123456789",
        wiseId: "Y123456789",
        name: "Wise Member",
        email: "member@example.com",
        wiseEmailVerified: true,
        image: "https://www.wise-invest.org/avatar.png",
        membershipTier: "VIP",
        wiseIdentityExpiresAt: Math.floor(Date.now() / 1_000) - 1,
      },
    });

    await expect(resolveWiseAccountState()).resolves.toEqual({
      status: "authenticated",
      account: {
        authenticationSource: "wise-id",
        displayName: "Wise Member",
        email: "member@example.com",
        emailVerified: true,
        imageUrl: "https://www.wise-invest.org/avatar.png",
        label: "VIP 用户",
        membershipAccessFresh: false,
        membershipTier: "VIP",
        principal: {
          subject: "Y123456789",
          tier: "regular",
        },
        wiseId: "Y123456789",
      },
    });
  });
});
