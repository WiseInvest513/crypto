import "server-only";

import { getMarketProviderRegistry } from "../provider-registry";
import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
  MarketDatum,
  PriceQuote,
} from "../contracts/market-data";
import {
  getAssetChartSnapshot,
  getAssetContextSnapshot,
  getAssetDetailSnapshot,
  getAssetPriceDatum,
  type AssetChartSnapshot,
  type AssetContextSnapshot,
  type AssetDetailSnapshot,
} from "./asset-detail-service";
import {
  getAssetLiveChartDatum,
  type LiveChartMode,
} from "./live-chart-service";
import {
  getMarketCoreSnapshot,
  getMarketIndicatorSnapshot,
  getMarketPulseSnapshot,
  getMarketQuoteSnapshot,
  getMarketSnapshot,
  type MarketCoreSnapshot,
  type MarketIndicatorSnapshot,
  type MarketPulseSnapshot,
  type MarketQuoteSnapshot,
  type MarketSnapshot,
} from "./market-snapshot-service";

export function loadMarketCoreSnapshot(): Promise<MarketCoreSnapshot> {
  return getMarketCoreSnapshot(getMarketProviderRegistry());
}

export function loadMarketIndicatorSnapshot(): Promise<MarketIndicatorSnapshot> {
  return getMarketIndicatorSnapshot(getMarketProviderRegistry());
}

export function loadMarketQuoteSnapshot(): Promise<MarketQuoteSnapshot> {
  return getMarketQuoteSnapshot(getMarketProviderRegistry());
}

export function loadMarketPulseSnapshot(): Promise<MarketPulseSnapshot> {
  return getMarketPulseSnapshot(getMarketProviderRegistry());
}

export function loadMarketSnapshot(): Promise<MarketSnapshot> {
  return getMarketSnapshot(getMarketProviderRegistry());
}

export function loadAssetDetailSnapshot(
  asset: Asset,
): Promise<AssetDetailSnapshot> {
  return getAssetDetailSnapshot(getMarketProviderRegistry(), asset);
}

export function loadAssetPriceDatum(
  asset: Asset,
): Promise<MarketDatum<PriceQuote>> {
  return getAssetPriceDatum(getMarketProviderRegistry(), asset);
}

export function loadAssetChartSnapshot(
  asset: Asset,
): Promise<AssetChartSnapshot> {
  return getAssetChartSnapshot(getMarketProviderRegistry(), asset);
}

export function loadAssetLiveChartDatum(
  asset: Asset,
  interval: ChartCandleInterval = "1h",
  mode: LiveChartMode = "full",
): Promise<MarketDatum<readonly ChartCandle[]>> {
  return getAssetLiveChartDatum(
    getMarketProviderRegistry(),
    asset,
    interval,
    mode,
  );
}

export function loadAssetContextSnapshot(
  asset: Asset,
): Promise<AssetContextSnapshot> {
  return getAssetContextSnapshot(getMarketProviderRegistry(), asset);
}
