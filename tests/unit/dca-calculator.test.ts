import { describe, expect, it } from "vitest";
import {
  calculateDca,
  type DcaDailyPrice,
  type DcaInput,
} from "../../src/lib/tools";

describe("DCA calculator", () => {
  it("calculates totals, average cost, ending value and return", () => {
    const result = calculateDca({
      amountPerPurchase: 100,
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      schedule: { frequency: "daily" },
      dailyPrices: prices([
        ["2026-01-01", 100],
        ["2026-01-02", 200],
        ["2026-01-03", 400],
      ]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scheduledPurchaseCount).toBe(3);
      expect(result.value.totalInvested).toBe(300);
      expect(result.value.totalQuantity).toBeCloseTo(1.75, 12);
      expect(result.value.averageCost).toBeCloseTo(171.42857142857142, 12);
      expect(result.value.valuationDate).toBe("2026-01-03");
      expect(result.value.valuationPrice).toBe(400);
      expect(result.value.endingValue).toBeCloseTo(700, 12);
      expect(result.value.profitLoss).toBeCloseTo(400, 12);
      expect(result.value.returnPercent).toBeCloseTo(133.33333333333331, 12);
      expect(result.value.model).toBe("utc-close-price-before-costs");
    }
  });

  it("generates weekly dates by UTC weekday across a DST boundary", () => {
    const result = calculateDca({
      amountPerPurchase: 50,
      startDate: "2026-03-07",
      endDate: "2026-03-23",
      schedule: { frequency: "weekly", dayOfWeek: 1 },
      dailyPrices: prices([
        ["2026-03-09", 100],
        ["2026-03-16", 100],
        ["2026-03-23", 100],
      ]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executions.map((item) => item.scheduledDate)).toEqual([
        "2026-03-09",
        "2026-03-16",
        "2026-03-23",
      ]);
    }
  });

  it("uses the UTC month end when the requested monthly day does not exist", () => {
    const result = calculateDca({
      amountPerPurchase: 100,
      startDate: "2026-01-30",
      endDate: "2026-04-30",
      schedule: { frequency: "monthly", dayOfMonth: 31 },
      dailyPrices: prices([
        ["2026-01-31", 100],
        ["2026-02-28", 100],
        ["2026-03-31", 100],
        ["2026-04-30", 100],
      ]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executions.map((item) => item.scheduledDate)).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
      ]);
    }
  });

  it("uses February 29 as the month end in a UTC leap year", () => {
    const result = calculateDca({
      amountPerPurchase: 100,
      startDate: "2028-02-01",
      endDate: "2028-02-29",
      schedule: { frequency: "monthly", dayOfMonth: 31 },
      dailyPrices: prices([["2028-02-29", 100]]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executions[0]).toMatchObject({
        scheduledDate: "2028-02-29",
        executedDate: "2028-02-29",
        usedNextAvailablePrice: false,
      });
    }
  });

  it("uses the next valid daily close for a missing scheduled day", () => {
    const result = calculateDca({
      amountPerPurchase: 100,
      startDate: "2026-01-05",
      endDate: "2026-01-12",
      schedule: { frequency: "weekly", dayOfWeek: 1 },
      dailyPrices: prices([
        ["2026-01-04", 50],
        ["2026-01-06", 100],
        ["2026-01-12", 200],
      ]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executions).toMatchObject([
        {
          scheduledDate: "2026-01-05",
          executedDate: "2026-01-06",
          usedNextAvailablePrice: true,
          price: 100,
          quantity: 1,
        },
        {
          scheduledDate: "2026-01-12",
          executedDate: "2026-01-12",
          usedNextAvailablePrice: false,
          price: 200,
          quantity: 0.5,
        },
      ]);
    }
  });

  it("uses the next valid close as the explicit end-date valuation", () => {
    const result = calculateDca({
      amountPerPurchase: 100,
      startDate: "2026-01-12",
      endDate: "2026-01-12",
      schedule: { frequency: "daily" },
      dailyPrices: prices([["2026-01-13", 125]]),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executions[0]).toMatchObject({
        scheduledDate: "2026-01-12",
        executedDate: "2026-01-13",
        usedNextAvailablePrice: true,
      });
      expect(result.value.valuationDate).toBe("2026-01-13");
      expect(result.value.valuationPrice).toBe(125);
    }
  });

  it.each([
    {
      label: "zero amount",
      override: { amountPerPurchase: 0 },
      code: "must_be_positive",
    },
    {
      label: "negative amount",
      override: { amountPerPurchase: -1 },
      code: "must_be_positive",
    },
    {
      label: "NaN amount",
      override: { amountPerPurchase: Number.NaN },
      code: "not_finite",
    },
    {
      label: "Infinity amount",
      override: { amountPerPurchase: Number.POSITIVE_INFINITY },
      code: "not_finite",
    },
    {
      label: "invalid start date",
      override: { startDate: "2026-02-30" },
      code: "invalid_utc_date",
    },
    {
      label: "invalid end date",
      override: { endDate: "not-a-date" },
      code: "invalid_utc_date",
    },
    {
      label: "reversed date range",
      override: { startDate: "2026-01-03", endDate: "2026-01-01" },
      code: "invalid_date_order",
    },
    {
      label: "invalid weekly day",
      override: { schedule: { frequency: "weekly", dayOfWeek: 7 } },
      code: "invalid_schedule",
    },
    {
      label: "invalid monthly day",
      override: { schedule: { frequency: "monthly", dayOfMonth: 32 } },
      code: "invalid_schedule",
    },
    {
      label: "invalid runtime frequency",
      override: { schedule: { frequency: "yearly" } },
      code: "invalid_schedule",
    },
    {
      label: "empty prices",
      override: { dailyPrices: [] },
      code: "no_price_data",
    },
  ])("rejects $label", ({ override, code }) => {
    const result = calculateDca({ ...validInput(), ...override } as DcaInput);

    expect(issueCodes(result)).toContain(code);
  });

  it.each([
    {
      label: "unsorted dates",
      dailyPrices: prices([
        ["2026-01-02", 100],
        ["2026-01-01", 100],
      ]),
    },
    {
      label: "duplicate dates",
      dailyPrices: prices([
        ["2026-01-01", 100],
        ["2026-01-01", 101],
      ]),
    },
    {
      label: "invalid candle date",
      dailyPrices: prices([["2026-02-30", 100]]),
    },
    {
      label: "zero close",
      dailyPrices: prices([["2026-01-01", 0]]),
    },
    {
      label: "NaN close",
      dailyPrices: prices([["2026-01-01", Number.NaN]]),
    },
  ])("rejects a price series with $label", ({ dailyPrices }) => {
    const result = calculateDca({ ...validInput(), dailyPrices });

    expect(issueCodes(result)).toContain("invalid_price_series");
  });

  it("rejects a range with no applicable monthly occurrence", () => {
    const result = calculateDca({
      ...validInput(),
      startDate: "2026-01-02",
      endDate: "2026-01-31",
      schedule: { frequency: "monthly", dayOfMonth: 1 },
      dailyPrices: prices([["2026-01-31", 100]]),
    });

    expect(issueCodes(result)).toContain("invalid_schedule");
  });

  it("does not look backward when the end date has no price on or after it", () => {
    const result = calculateDca({
      ...validInput(),
      endDate: "2026-01-02",
      dailyPrices: prices([["2026-01-01", 100]]),
    });

    expect(issueCodes(result)).toContain("no_price_data");
  });

  it("does not mutate the supplied price series", () => {
    const dailyPrices = prices([
      ["2026-01-01", 100],
      ["2026-01-02", 101],
    ]).map((price) => ({ ...price }));
    const snapshot = structuredClone(dailyPrices);

    calculateDca({ ...validInput(), endDate: "2026-01-02", dailyPrices });

    expect(dailyPrices).toEqual(snapshot);
  });
});

function validInput(): DcaInput {
  return {
    amountPerPurchase: 100,
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    schedule: { frequency: "daily" },
    dailyPrices: prices([["2026-01-01", 100]]),
  };
}

function prices(
  values: readonly (readonly [date: string, close: number])[],
): readonly DcaDailyPrice[] {
  return values.map(([date, close]) => ({ date, close }));
}

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
