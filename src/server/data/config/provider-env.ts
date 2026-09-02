import "server-only";

export type MarketProviderConfig = {
  coinMarketCapApiKey: string | null;
};

export function readMarketProviderConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): MarketProviderConfig {
  if (environment.NEXT_PUBLIC_COINMARKETCAP_API_KEY?.trim()) {
    throw new Error(
      "CoinMarketCap credentials must never use a NEXT_PUBLIC_* variable.",
    );
  }

  return {
    coinMarketCapApiKey:
      environment.COINMARKETCAP_API_KEY?.trim() || null,
  };
}
