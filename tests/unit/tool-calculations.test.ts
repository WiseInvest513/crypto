import { describe, expect, it } from "vitest";
import {
  calculateLeverage,
  calculatePositionSize,
  calculateRiskReward,
} from "../../src/lib/tools";

describe("position size calculator", () => {
  it("calculates long and short position sizes from the same risk distance", () => {
    const long = calculatePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 95,
      direction: "long",
    });
    const short = calculatePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 105,
      direction: "short",
    });

    expect(long).toEqual({
      ok: true,
      value: {
        direction: "long",
        maxRisk: 100,
        riskPerUnit: 5,
        quantity: 20,
        notional: 2_000,
        model: "price-distance-risk-before-costs",
      },
    });
    expect(short).toEqual({
      ok: true,
      value: {
        direction: "short",
        maxRisk: 100,
        riskPerUnit: 5,
        quantity: 20,
        notional: 2_000,
        model: "price-distance-risk-before-costs",
      },
    });
  });

  it.each([
    { field: "balance", value: 0, code: "must_be_positive" },
    { field: "balance", value: -1, code: "must_be_positive" },
    { field: "balance", value: Number.NaN, code: "not_finite" },
    {
      field: "balance",
      value: Number.POSITIVE_INFINITY,
      code: "not_finite",
    },
    { field: "riskPercent", value: 0, code: "must_be_positive" },
    { field: "entryPrice", value: 0, code: "must_be_positive" },
    { field: "stopPrice", value: -1, code: "must_be_positive" },
  ] as const)("rejects invalid $field input", ({ field, value, code }) => {
    const result = calculatePositionSize({
      balance: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 90,
      direction: "long",
      [field]: value,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field, code }));
    }
  });

  it("rejects an invalid runtime direction", () => {
    const result = calculateLeverage({
      direction: "flat" as "long",
      entryPrice: 100,
      exitPrice: 110,
      notional: 1_000,
      leverage: 2,
    });

    expect(issueCodes(result)).toContain("invalid_direction");
  });

  it("rejects risk over 100 percent and invalid long/short price order", () => {
    const tooMuchRisk = calculatePositionSize({
      balance: 1_000,
      riskPercent: 101,
      entryPrice: 100,
      stopPrice: 90,
      direction: "long",
    });
    const invalidLong = calculatePositionSize({
      balance: 1_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 100,
      direction: "long",
    });
    const invalidShort = calculatePositionSize({
      balance: 1_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 99,
      direction: "short",
    });

    expect(issueCodes(tooMuchRisk)).toContain("above_maximum");
    expect(issueCodes(invalidLong)).toContain("invalid_price_order");
    expect(issueCodes(invalidShort)).toContain("invalid_price_order");
  });

  it("rejects an invalid runtime direction and arithmetic overflow", () => {
    const invalidDirection = calculatePositionSize({
      balance: 1_000,
      riskPercent: 1,
      entryPrice: 100,
      stopPrice: 90,
      direction: "sideways" as "long",
    });
    const overflow = calculatePositionSize({
      balance: Number.MAX_VALUE,
      riskPercent: 100,
      entryPrice: Number.MAX_VALUE,
      stopPrice: Number.MAX_VALUE / 2,
      direction: "long",
    });

    expect(issueCodes(invalidDirection)).toContain("invalid_direction");
    expect(issueCodes(overflow)).toContain("calculation_out_of_range");
  });
});

describe("leverage calculator", () => {
  it.each([
    { direction: "long" as const, exitPrice: 110, expectedPnl: 1_000 },
    { direction: "short" as const, exitPrice: 90, expectedPnl: 1_000 },
    { direction: "long" as const, exitPrice: 90, expectedPnl: -1_000 },
    { direction: "short" as const, exitPrice: 110, expectedPnl: -1_000 },
  ])(
    "calculates $direction PnL without treating losses as invalid",
    ({ direction, exitPrice, expectedPnl }) => {
      const result = calculateLeverage({
        direction,
        entryPrice: 100,
        exitPrice,
        notional: 10_000,
        leverage: 5,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          direction,
          quantity: 100,
          margin: 2_000,
          pnl: expectedPnl,
          roePercent: expectedPnl / 20,
          model: "linear-pnl-before-fees-funding-and-liquidation",
        });
        expect(result.value).not.toHaveProperty("liquidationPrice");
      }
    },
  );

  it("supports an unleveraged 1x calculation without inventing liquidation data", () => {
    const result = calculateLeverage({
      direction: "long",
      entryPrice: 100,
      exitPrice: 101,
      notional: 1_000,
      leverage: 1,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        direction: "long",
        quantity: 10,
        margin: 1_000,
        pnl: 10,
        roePercent: 1,
        model: "linear-pnl-before-fees-funding-and-liquidation",
      },
    });
  });

  it.each([
    { field: "entryPrice", value: 0, code: "must_be_positive" },
    { field: "exitPrice", value: -1, code: "must_be_positive" },
    { field: "notional", value: Number.NaN, code: "not_finite" },
    { field: "leverage", value: 0, code: "must_be_positive" },
    { field: "leverage", value: 0.5, code: "below_minimum" },
    {
      field: "leverage",
      value: Number.NEGATIVE_INFINITY,
      code: "not_finite",
    },
  ] as const)("rejects invalid $field input", ({ field, value, code }) => {
    const result = calculateLeverage({
      direction: "long",
      entryPrice: 100,
      exitPrice: 110,
      notional: 1_000,
      leverage: 2,
      [field]: value,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field, code }));
    }
  });

  it("rejects an invalid runtime direction", () => {
    const result = calculateRiskReward({
      direction: "flat" as "long",
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 120,
    });

    expect(issueCodes(result)).toContain("invalid_direction");
  });
});

describe("risk/reward calculator", () => {
  it("calculates a long 1:3 ratio", () => {
    const result = calculateRiskReward({
      direction: "long",
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 130,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        direction: "long",
        riskPerUnit: 10,
        rewardPerUnit: 30,
        rewardToRiskRatio: 3,
        ratio: { risk: 1, reward: 3 },
        model: "price-distance-only",
      },
    });
  });

  it("calculates a short 1:3 ratio", () => {
    const result = calculateRiskReward({
      direction: "short",
      entryPrice: 100,
      stopPrice: 110,
      targetPrice: 70,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        riskPerUnit: 10,
        rewardPerUnit: 30,
        rewardToRiskRatio: 3,
        ratio: { risk: 1, reward: 3 },
      });
    }
  });

  it.each([
    {
      direction: "long" as const,
      entryPrice: 100,
      stopPrice: 100,
      targetPrice: 110,
    },
    {
      direction: "long" as const,
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 100,
    },
    {
      direction: "short" as const,
      entryPrice: 100,
      stopPrice: 99,
      targetPrice: 90,
    },
    {
      direction: "short" as const,
      entryPrice: 100,
      stopPrice: 110,
      targetPrice: 100,
    },
  ])("rejects invalid $direction price order", (input) => {
    expect(issueCodes(calculateRiskReward(input))).toContain(
      "invalid_price_order",
    );
  });

  it.each([
    { field: "entryPrice", value: 0, code: "must_be_positive" },
    { field: "stopPrice", value: Number.NaN, code: "not_finite" },
    {
      field: "targetPrice",
      value: Number.POSITIVE_INFINITY,
      code: "not_finite",
    },
  ] as const)("rejects invalid $field input", ({ field, value, code }) => {
    const result = calculateRiskReward({
      direction: "long",
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 120,
      [field]: value,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(expect.objectContaining({ field, code }));
    }
  });
});

function issueCodes(
  result:
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly errors: readonly { readonly code: string }[];
      },
): readonly string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}
