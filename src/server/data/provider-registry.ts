import "server-only";

import { readMarketProviderConfig } from "./config/provider-env";
import type { MarketProviderRegistry } from "./contracts/providers";
import { AlternativeMeProvider } from "./providers/alternative-me-provider";
import { BinanceSpotCandleProvider } from "./providers/binance-spot-candle-provider";
import { BinanceUsdMProvider } from "./providers/binance-usdm-provider";
import { CoinMarketCapProvider } from "./providers/coinmarketcap-provider";
import { CompositeDerivativesProvider } from "./providers/composite-derivatives-provider";
import { FallbackMarketProvider } from "./providers/fallback-market-provider";
import { UnavailableMarketProvider } from "./providers/unavailable-market-provider";

export function createMarketProviderRegistry(): MarketProviderRegistry {
  const config = readMarketProviderConfig();
  const coinMarketCap = new CoinMarketCapProvider({
    apiKey: config.coinMarketCapApiKey,
  });
  const alternativeMe = new AlternativeMeProvider();
  const publicMarket = config.coinMarketCapApiKey
    ? new FallbackMarketProvider(coinMarketCap, alternativeMe)
    : new FallbackMarketProvider(alternativeMe, coinMarketCap);
  const candles = new BinanceSpotCandleProvider();
  const binance = new BinanceUsdMProvider();
  const derivatives = new CompositeDerivativesProvider(
    binance,
    coinMarketCap,
  );
  const unavailableFundFlows = new UnavailableMarketProvider(
    "license_restricted",
  );

  return Object.freeze({
    spot: publicMarket,
    candles,
    sentiment: publicMarket,
    derivatives,
    fundFlows: unavailableFundFlows,
  });
}

let sharedRegistry: MarketProviderRegistry | null = null;

export function getMarketProviderRegistry(): MarketProviderRegistry {
  sharedRegistry ??= createMarketProviderRegistry();
  return sharedRegistry;
}
