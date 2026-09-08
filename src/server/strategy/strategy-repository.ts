import "server-only";

import type { Asset } from "@/lib/market/live-chart";

export type TradeStrategyRepositoryStatus =
  | "unpublished"
  | "scheduled"
  | "expired"
  | "withdrawn"
  | "unavailable";

export type TradeStrategyRepositoryDisclosure =
  | Readonly<{ kind: "strategy"; value: unknown }>
  | Readonly<{
      kind: "status";
      state: TradeStrategyRepositoryStatus;
    }>;

/**
 * Private content-source boundary. A future CMS or database adapter belongs
 * behind this interface and must never be imported by a Client Component.
 */
export interface TradeStrategyRepository {
  /**
   * Resolve the one strategy that is effective at the captured time. The
   * adapter must fail closed on overlapping active publications or corrupt
   * storage; drafts and scheduled revisions may never hide an active record.
   */
  getDisclosure(
    asset: Asset,
    at: number,
  ): Promise<TradeStrategyRepositoryDisclosure>;
}

/**
 * Production-safe default while no private strategy CMS is connected.
 * Real strategies and example prices are intentionally absent from Git.
 */
export const emptyTradeStrategyRepository: TradeStrategyRepository =
  Object.freeze({
    getDisclosure: async () =>
      ({ kind: "status", state: "unpublished" }) as const,
  });
