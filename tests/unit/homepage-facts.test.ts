import { describe, expect, it } from "vitest";
import {
  deriveDailyMarketFacts,
  describeQuoteDirection,
} from "../../src/lib/market/homepage-facts";
import { analyzeDailyCandles } from "../../src/lib/market/technical-analysis";
import type {
  Asset,
  DailyCandle,
  PriceQuote,
} from "../../src/server/data/contracts/market-data";

const DAY_MS = 24 * 60 * 60 * 1_000;
const START_TIME = Date.parse("2026-01-01T00:00:00.000Z");

describe("homepage objective market facts", () => {
  describe("quote period direction", () => {
    it.each([
      {
        changes: [1.25, 4.5] as const,
        expected: {
          direction24h: "up",
          direction7d: "up",
          relationship: "same",
          summary: "BTC 24 小时与 7 日变化方向一致，均为上涨。",
        },
      },
      {
        changes: [-1.25, -4.5] as const,
        expected: {
          direction24h: "down",
          direction7d: "down",
          relationship: "same",
          summary: "BTC 24 小时与 7 日变化方向一致，均为下跌。",
        },
      },
      {
        changes: [0, 0] as const,
        expected: {
          direction24h: "flat",
          direction7d: "flat",
          relationship: "same",
          summary: "BTC 24 小时与 7 日变化方向一致，均为持平。",
        },
      },
    ])("describes matching directions without judgment", ({ changes, expected }) => {
      const result = describeQuoteDirection(
        quote("btc", changes[0], changes[1]),
      );

      expect(result).toMatchObject(expected);
      expect(result).toMatchObject({
        asset: "btc",
        quoteCurrency: "USD",
        change24hPercent: changes[0],
        change7dPercent: changes[1],
      });
    });

    it("describes opposite and flat directions explicitly", () => {
      expect(describeQuoteDirection(quote("eth", 2.5, -3))).toMatchObject({
        direction24h: "up",
        direction7d: "down",
        relationship: "different",
        summary: "ETH 24 小时上涨，7 日下跌，两个周期方向不同。",
      });
      expect(describeQuoteDirection(quote("eth", 0, 3))).toMatchObject({
        direction24h: "flat",
        direction7d: "up",
        relationship: "different",
        summary: "ETH 24 小时持平，7 日上涨，两个周期方向不同。",
      });
    });

    it.each([
      null,
      quote("btc", null, 1),
      quote("btc", 1, null),
      quote("btc", Number.NaN, 1),
      quote("btc", 1, Number.POSITIVE_INFINITY),
      { ...quote("btc", 1, 2), priceUsd: Number.NaN },
      { ...quote("btc", 1, 2), quoteCurrency: "USDT" } as unknown as PriceQuote,
      { ...quote("btc", 1, 2), asset: "sol" } as unknown as PriceQuote,
    ])("omits incomplete or invalid quote facts", (input) => {
      expect(describeQuoteDirection(input)).toBeNull();
    });
  });

  describe("closed USDT daily facts", () => {
    it("returns aligned structure and raw previous/20-day ranges", () => {
      const history = candlesFromCloses(
        "btc",
        Array.from({ length: 50 }, (_, index) => 100 + index),
      );
      const result = deriveDailyMarketFacts(
        "btc",
        history,
        analyzeDailyCandles(history),
      );

      expect(result).toMatchObject({
        asset: "btc",
        symbol: "BTCUSDT",
        quoteCurrency: "USDT",
        interval: "1d",
        sampleSize: 50,
        latestCloseUsdt: 149,
        summary:
          "BTC 最新已闭合日线收盘位于 MA20 上方，收盘位于 MA50 上方，MA20 位于 MA50 上方。",
        structure: {
          latestCloseUsdt: 149,
          ma20Usdt: 139.5,
          ma50Usdt: 124.5,
          priceVsMa20: "above",
          priceVsMa50: "above",
          ma20VsMa50: "above",
        },
        previousDayRange: {
          highUsdt: 158,
          lowUsdt: 138,
          summary:
            "BTC 前一根已闭合日线区间为 138.00 USDT–158.00 USDT。",
        },
        twentyDayRange: {
          candleCount: 20,
          highUsdt: 159,
          lowUsdt: 120,
          latestCloseUsdt: 149,
          position: "upper",
          summary:
            "BTC 最新已闭合日线收盘位于近 20 根日线区间的上部。",
        },
      });
      expect(result?.twentyDayRange?.positionRatio).toBeCloseTo(29 / 39);
    });

    it("emits only facts whose complete history window exists", () => {
      const nineteen = candlesFromCloses(
        "eth",
        Array.from({ length: 19 }, (_, index) => 200 + index),
      );
      const twenty = candlesFromCloses(
        "eth",
        Array.from({ length: 20 }, (_, index) => 200 + index),
      );

      expect(
        deriveDailyMarketFacts("eth", nineteen, analyzeDailyCandles(nineteen)),
      ).toMatchObject({
        summary: null,
        structure: null,
        previousDayRange: { highUsdt: 227, lowUsdt: 207 },
        twentyDayRange: null,
      });

      expect(
        deriveDailyMarketFacts("eth", twenty, analyzeDailyCandles(twenty)),
      ).toMatchObject({
        symbol: "ETHUSDT",
        summary: "ETH 最新已闭合日线收盘位于 MA20 上方。",
        structure: {
          latestCloseUsdt: 219,
          ma20Usdt: 209.5,
          ma50Usdt: null,
          priceVsMa50: null,
          ma20VsMa50: null,
        },
        twentyDayRange: { candleCount: 20 },
      });
    });

    it("handles a zero-width 20-day range without dividing by zero", () => {
      const history = candlesFromCloses(
        "btc",
        Array.from({ length: 20 }, () => 100),
        0,
      );
      const result = deriveDailyMarketFacts(
        "btc",
        history,
        analyzeDailyCandles(history),
      );

      expect(result?.twentyDayRange).toMatchObject({
        highUsdt: 100,
        lowUsdt: 100,
        latestCloseUsdt: 100,
        positionRatio: null,
        position: "flat",
        summary:
          "BTC 最新已闭合日线收盘位于近 20 根日线区间的上下沿相同的位置。",
      });
      expect(result?.structure).toMatchObject({
        priceVsMa20: "equal",
        summary: "BTC 最新已闭合日线收盘等于 MA20。",
      });
    });

    it("suppresses a mismatched technical structure but retains valid ranges", () => {
      const history = candlesFromCloses(
        "btc",
        Array.from({ length: 20 }, (_, index) => 100 + index),
      );
      const technical = analyzeDailyCandles(history);
      const mismatched = {
        ...technical,
        sampleSize: technical.sampleSize + 1,
      };

      expect(deriveDailyMarketFacts("btc", history, mismatched)).toMatchObject({
        summary: null,
        structure: null,
        previousDayRange: { highUsdt: 128, lowUsdt: 108 },
        twentyDayRange: { highUsdt: 129, lowUsdt: 90 },
      });
      expect(deriveDailyMarketFacts("btc", history, null)).toMatchObject({
        summary: null,
        structure: null,
        previousDayRange: { highUsdt: 128, lowUsdt: 108 },
        twentyDayRange: { highUsdt: 129, lowUsdt: 90 },
      });
    });

    it.each([
      (history: readonly DailyCandle[]) => [
        ...history.slice(0, -1),
        { ...history.at(-1)!, quoteCurrency: "USD" },
      ],
      (history: readonly DailyCandle[]) => [
        ...history.slice(0, -1),
        { ...history.at(-1)!, asset: "eth" },
      ],
      (history: readonly DailyCandle[]) => [
        ...history.slice(0, -1),
        { ...history.at(-1)!, symbol: "ETHUSDT" },
      ],
      (history: readonly DailyCandle[]) => [
        ...history.slice(0, -1),
        { ...history.at(-1)!, high: Number.NaN },
      ],
      (history: readonly DailyCandle[]) => [
        ...history.slice(0, -1),
        { ...history.at(-1)!, openedAt: history.at(-2)!.openedAt },
      ],
    ])("fails closed for mixed-scope or invalid candle input", (mutate) => {
      const history = candlesFromCloses(
        "btc",
        Array.from({ length: 20 }, (_, index) => 100 + index),
      );
      const invalid = mutate(history) as readonly DailyCandle[];

      expect(
        deriveDailyMarketFacts("btc", invalid, analyzeDailyCandles(history)),
      ).toBeNull();
    });

    it("returns null for no history and never mutates valid inputs", () => {
      const history = candlesFromCloses(
        "btc",
        Array.from({ length: 20 }, (_, index) => 100 + index),
      ).map((candle) => ({ ...candle }));
      const technical = analyzeDailyCandles(history);
      const snapshot = structuredClone(history);

      expect(deriveDailyMarketFacts("btc", [], analyzeDailyCandles([]))).toBeNull();
      expect(deriveDailyMarketFacts("btc", null, null)).toBeNull();
      deriveDailyMarketFacts("btc", Object.freeze(history), technical);
      expect(history).toEqual(snapshot);
    });
  });
});

function quote(
  asset: Asset,
  change24hPercent: number | null,
  change7dPercent: number | null,
): PriceQuote {
  return {
    asset,
    quoteCurrency: "USD",
    priceUsd: asset === "btc" ? 80_000 : 2_500,
    change24hPercent,
    change7dPercent,
    marketCapUsd: null,
  };
}

function candlesFromCloses(
  asset: Asset,
  closes: readonly number[],
  spread = 10,
): readonly DailyCandle[] {
  const symbol = asset === "btc" ? "BTCUSDT" : "ETHUSDT";
  return closes.map((close, index) => ({
    asset,
    symbol,
    interval: "1d",
    quoteCurrency: "USDT",
    openedAt: new Date(START_TIME + index * DAY_MS).toISOString(),
    closedAt: new Date(START_TIME + (index + 1) * DAY_MS - 1).toISOString(),
    open: close,
    high: close + spread,
    low: close - spread,
    close,
    volume: 1_000 + index,
  }));
}
