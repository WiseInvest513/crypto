import { describe, expect, it } from "vitest";
import {
  formatToolMoney,
  formatToolPercent,
  formatToolPrice,
  formatToolQuantity,
  formatToolRatio,
} from "../../src/lib/tools/formatters";

describe("tool result formatters", () => {
  it("uses bounded display precision without turning non-zero values into zero", () => {
    expect(formatToolMoney(0.001, "USDT")).toBe("<0.01 USDT");
    expect(formatToolMoney(-0.001, "USD")).toBe(">-0.01 USD");
    expect(formatToolQuantity(0.000000001, "BTC")).toBe("<0.00000001 BTC");
    expect(formatToolPercent(0.001)).toBe("<0.01%");
    expect(formatToolRatio(0.001)).toBe("1 : <0.01");
  });

  it("keeps useful precision for sub-unit prices while grouping larger values", () => {
    expect(formatToolPrice(0.00012345, "USDT")).toBe("0.00012345 USDT");
    expect(formatToolPrice(100_000.5, "USDT")).toBe("100,000.50 USDT");
    expect(formatToolQuantity(1.234567891, "ETH")).toBe("1.23456789 ETH");
  });

  it("never exposes non-finite values", () => {
    expect(formatToolMoney(Number.NaN)).toBe("—");
    expect(formatToolPrice(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatToolQuantity(Number.NEGATIVE_INFINITY)).toBe("—");
    expect(formatToolPercent(Number.NaN)).toBe("—");
    expect(formatToolRatio(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
