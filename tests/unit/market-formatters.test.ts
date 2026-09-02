import { describe, expect, it } from "vitest";
import {
  directionFor,
  formatCompactNumber,
  formatCompactUsd,
  formatEthBtcRatio,
  formatFundingRate,
  formatPercent,
  formatTradingDate,
  formatUsdPrice,
  formatUtcDateTime,
  translateSentimentClassification,
} from "../../src/lib/market/formatters";

describe("homepage market formatters", () => {
  it("formats prices, market totals, and signed fund flows", () => {
    expect(formatUsdPrice(110_000.25)).toBe("$110,000.25");
    expect(formatCompactUsd(3_500_000_000_000)).toBe("$3.50 万亿");
    expect(formatCompactUsd(5_200_000_000)).toBe("$52.00 亿");
    expect(formatCompactNumber(5_200_000_000)).toBe("52.00 亿");
    expect(formatCompactUsd(-120_000_000, true)).toBe("-$1.20 亿");
    expect(formatCompactUsd(0, true)).toBe("$0");
  });

  it("promotes compact units when rounding reaches the next boundary", () => {
    expect(formatCompactUsd(9_999.999)).toBe("$1.00 万");
    expect(formatCompactUsd(99_999_999)).toBe("$1.00 亿");
    expect(formatCompactNumber(999_999_999_999)).toBe("1.00 万亿");
  });

  it("keeps percent and funding units distinct", () => {
    expect(formatPercent(56.4)).toBe("56.40%");
    expect(formatPercent(1.25, true)).toBe("+1.25%");
    expect(formatPercent(-1.25, true)).toBe("-1.25%");
    expect(formatPercent(0, true)).toBe("0.00%");
    expect(formatFundingRate(0.0001)).toBe("0.0100%");
  });

  it("formats ETH/BTC and known provider sentiment classifications", () => {
    expect(formatEthBtcRatio(0.04)).toBe("0.04000 BTC");
    expect(translateSentimentClassification("Extreme Fear")).toBe("极度恐慌");
    expect(translateSentimentClassification("Fear")).toBe("恐慌");
    expect(translateSentimentClassification("Neutral")).toBe("中性");
    expect(translateSentimentClassification("Greed")).toBe("贪婪");
    expect(translateSentimentClassification("Extreme Greed")).toBe("极度贪婪");
    expect(translateSentimentClassification("Unrecognized")).toBe(
      "供应商分类未识别",
    );
  });

  it("uses deterministic UTC time labels", () => {
    expect(formatUtcDateTime("2026-08-29T12:34:56.000Z")).toBe(
      "2026-08-29 12:34 UTC",
    );
    expect(formatTradingDate("2026-08-29")).toBe("2026-08-29");
    expect(formatTradingDate("2026-02-30")).toBe("—");
  });

  it("never exposes NaN, Infinity, or invalid dates", () => {
    expect(formatUsdPrice(Number.NaN)).toBe("—");
    expect(formatCompactUsd(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatCompactNumber(Number.NEGATIVE_INFINITY)).toBe("—");
    expect(formatPercent(Number.NEGATIVE_INFINITY)).toBe("—");
    expect(formatFundingRate(Number.NaN)).toBe("—");
    expect(formatEthBtcRatio(Number.NaN)).toBe("—");
    expect(formatUtcDateTime("invalid")).toBe("—");
    expect(directionFor(Number.NaN)).toBe("neutral");
  });
});
