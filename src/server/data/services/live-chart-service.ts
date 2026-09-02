import "server-only";

import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
  MarketDatum,
} from "../contracts/market-data";
import {
  chartCandleCapability,
  chartCandleIntervals,
} from "../contracts/market-data";
import type { MarketProviderRegistry } from "../contracts/providers";
import {
  recoverSettled,
  type SettledMarketDatum,
} from "./market-datum-utils";

export const liveChartModes = ["full", "tail"] as const;
export type LiveChartMode = (typeof liveChartModes)[number];

export const LIVE_CHART_FULL_LIMIT = 1_000;
export const LIVE_CHART_TAIL_LIMIT = 3;

export function isChartCandleInterval(
  value: string | null,
): value is ChartCandleInterval {
  return value !== null && chartCandleIntervals.some((item) => item === value);
}

export function isLiveChartMode(value: string | null): value is LiveChartMode {
  return value !== null && liveChartModes.some((item) => item === value);
}

export async function getAssetLiveChartDatum(
  registry: MarketProviderRegistry,
  asset: Asset,
  interval: ChartCandleInterval,
  mode: LiveChartMode = "full",
  now: () => number = Date.now,
): Promise<MarketDatum<readonly ChartCandle[]>> {
  const request = registry.candles.getChartCandles(asset, {
    interval,
    limit:
      mode === "full" ? LIVE_CHART_FULL_LIMIT : LIVE_CHART_TAIL_LIMIT,
  });
  const [result] = await Promise.allSettled([request]);

  return recoverSettled(
    result as SettledMarketDatum<readonly ChartCandle[]>,
    chartCandleCapability(asset),
    registry.candles.source,
    {
      kind: "venue",
      label: `Binance ${asset.toUpperCase()}USDT 现货 ${interval} K 线（USDT，UTC，含形成中）`,
    },
    now,
  );
}
