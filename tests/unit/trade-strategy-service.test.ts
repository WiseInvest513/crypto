import { describe, expect, it, vi } from "vitest";
import type { UserAccess } from "@/lib/access/user-access";
import { ANONYMOUS_USER_ACCESS } from "@/lib/access/user-access";
import { loadTradeStrategyDisclosure } from "@/server/strategy/trade-strategy-service";
import { tradeStrategyFixture } from "../fixtures/trade-strategy";

const VIP: UserAccess = {
  tier: "vip",
  isAuthenticated: true,
  source: "verified-identity",
};
const REGULAR: UserAccess = {
  tier: "regular",
  isAuthenticated: true,
  source: "verified-identity",
};
const NOW = () => Date.parse("2026-09-06T12:00:00Z");

describe("private trade strategy disclosure", () => {
  it.each([
    ANONYMOUS_USER_ACCESS,
    REGULAR,
    {
      tier: "vip",
      isAuthenticated: false,
      source: "anonymous-default",
    } as UserAccess,
  ])("locks non-VIP access before reading the repository", async (access) => {
    const getDisclosure = vi.fn(async () => ({
      kind: "strategy" as const,
      value: tradeStrategyFixture(),
    }));
    await expect(
      loadTradeStrategyDisclosure("btc", Promise.resolve(access), {
        repository: { getDisclosure },
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "locked", asset: "btc" });
    expect(getDisclosure).not.toHaveBeenCalled();
  });

  it("fails closed before repository access when identity resolution rejects", async () => {
    const getDisclosure = vi.fn(async () => ({
      kind: "strategy" as const,
      value: tradeStrategyFixture(),
    }));
    await expect(
      loadTradeStrategyDisclosure(
        "btc",
        Promise.reject(new Error("identity unavailable")),
        { repository: { getDisclosure }, now: NOW },
      ),
    ).resolves.toEqual({ kind: "locked", asset: "btc" });
    expect(getDisclosure).not.toHaveBeenCalled();
  });

  it("returns only a reviewed, active strategy to verified VIP", async () => {
    const getDisclosure = vi.fn(async () => ({
      kind: "strategy" as const,
      value: tradeStrategyFixture(),
    }));
    const result = await loadTradeStrategyDisclosure(
      "btc",
      Promise.resolve(VIP),
      { repository: { getDisclosure }, now: NOW },
    );
    expect(getDisclosure).toHaveBeenCalledOnce();
    expect(getDisclosure).toHaveBeenCalledWith("btc", NOW());
    expect(result.kind).toBe("active");
    if (result.kind !== "active") throw new Error("Expected active strategy");
    expect(result.strategy.headline).toBe("PRIVATE_HEADLINE_SENTINEL");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SOURCE_SENTINEL");
  });

  it.each([
    ["draft", "unpublished", NOW],
    ["in_review", "unpublished", NOW],
    ["withdrawn", "withdrawn", NOW],
    ["published", "scheduled", () => Date.parse("2026-09-05T12:00:00Z")],
    ["published", "expired", () => Date.parse("2026-09-07T00:00:00Z")],
  ] as const)("redacts %s content as %s", async (storedStatus, state, now) => {
    const value = tradeStrategyFixture();
    value.storedStatus = storedStatus;
    const result = await loadTradeStrategyDisclosure(
      "btc",
      Promise.resolve(VIP),
      {
        repository: {
          getDisclosure: async () => ({ kind: "strategy", value }),
        },
        now,
      },
    );
    expect(result).toEqual({ kind: "status", asset: "btc", state });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_HEADLINE_SENTINEL");
    expect(JSON.stringify(result)).not.toContain("71000");
  });

  it("fails closed on repository errors, malformed content and asset crossover", async () => {
    await expect(
      loadTradeStrategyDisclosure("btc", Promise.resolve(VIP), {
        repository: {
          getDisclosure: async () => {
            throw new Error("CMS unavailable");
          },
        },
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "status", asset: "btc", state: "unavailable" });
    await expect(
      loadTradeStrategyDisclosure("btc", Promise.resolve(VIP), {
        repository: {
          getDisclosure: async () => ({
            kind: "strategy",
            value: { malformed: true },
          }),
        },
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "status", asset: "btc", state: "unavailable" });
    await expect(
      loadTradeStrategyDisclosure("btc", Promise.resolve(VIP), {
        repository: {
          getDisclosure: async () => ({
            kind: "strategy",
            value: tradeStrategyFixture("eth"),
          }),
        },
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "status", asset: "btc", state: "unavailable" });
  });

  it("keeps the production repository explicitly empty", async () => {
    await expect(
      loadTradeStrategyDisclosure("btc", Promise.resolve(VIP), { now: NOW }),
    ).resolves.toEqual({ kind: "status", asset: "btc", state: "unpublished" });
  });

  it.each(["scheduled", "expired", "withdrawn"] as const)(
    "preserves repository status %s without disclosing content",
    async (state) => {
      await expect(
        loadTradeStrategyDisclosure("btc", Promise.resolve(VIP), {
          repository: {
            getDisclosure: async () => ({ kind: "status", state }),
          },
          now: NOW,
        }),
      ).resolves.toEqual({ kind: "status", asset: "btc", state });
    },
  );
});
