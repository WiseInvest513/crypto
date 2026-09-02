import "server-only";

import type { MarketProviderRegistry } from "../contracts/providers";
import { createMarketProviderRegistry } from "../provider-registry";
import { MockMarketProvider } from "./mock-market-provider";

export type RuntimeEnvironment = "development" | "test" | "production";

type TestingRegistryOptions = {
  runtime: RuntimeEnvironment;
  enableSyntheticData: boolean;
};

export function createTestingRegistry({
  runtime,
  enableSyntheticData,
}: TestingRegistryOptions): MarketProviderRegistry {
  if (!enableSyntheticData) {
    return createMarketProviderRegistry();
  }

  if (runtime === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Synthetic market data is forbidden in production.");
  }

  const mock = new MockMarketProvider();
  return Object.freeze({
    spot: mock,
    candles: mock,
    sentiment: mock,
    derivatives: mock,
    fundFlows: mock,
  });
}
