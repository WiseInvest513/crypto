import type {
  Asset,
  CandleSymbol,
  MarketDatum,
} from "@/server/data/contracts/market-data";

export const pricePerformanceWindows = ["1d", "7d", "30d"] as const;
export type PricePerformanceWindow = (typeof pricePerformanceWindows)[number];

export type PricePerformanceReading = {
  asset: Asset;
  symbol: CandleSymbol;
  quoteCurrency: "USDT";
  window: PricePerformanceWindow;
  openPrice: number;
  latestPrice: number;
  changePercent: number;
  /** Actual comparison timestamps; rolling windows are minute-aligned. */
  openTime: string;
  closeTime: string;
  basis: "rolling-ticker" | "minute-anchor";
};

export type PricePerformanceSnapshot = {
  asset: Asset;
  windows: readonly {
    window: PricePerformanceWindow;
    datum: MarketDatum<PricePerformanceReading>;
  }[];
};
