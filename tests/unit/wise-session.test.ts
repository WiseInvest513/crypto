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
});
