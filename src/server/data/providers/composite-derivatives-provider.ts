import "server-only";

import type {
  Asset,
  FundingReading,
  LiquidationsReading,
  MarketDatum,
  OpenInterestReading,
} from "../contracts/market-data";
import type {
  DerivativesProvider,
  FundingOpenInterestProvider,
  LiquidationsProvider,
} from "../contracts/providers";

export class CompositeDerivativesProvider implements DerivativesProvider {
  readonly id = "composite-derivatives";
  readonly mode = "live" as const;
  readonly source = null;

  constructor(
    private readonly venueProvider: FundingOpenInterestProvider,
    private readonly liquidationsProvider: LiquidationsProvider,
  ) {}

  getFunding(asset: Asset): Promise<MarketDatum<FundingReading>> {
    return this.venueProvider.getFunding(asset);
  }

  getOpenInterest(asset: Asset): Promise<MarketDatum<OpenInterestReading>> {
    return this.venueProvider.getOpenInterest(asset);
  }

  getLiquidations(): Promise<MarketDatum<LiquidationsReading>> {
    return this.liquidationsProvider.getLiquidations();
  }
}
