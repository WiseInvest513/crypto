import "server-only";

import type { UserAccess } from "@/lib/access/user-access";
import { canAccessFeature } from "@/lib/access/user-access";
import type { Asset } from "@/lib/market/live-chart";
import {
  parseTradeStrategy,
  resolveTradeStrategyDisplayState,
  toActiveTradeStrategyView,
  type ActiveTradeStrategyView,
} from "@/lib/strategy/trade-strategy";
import {
  type TradeStrategyRepository,
} from "./strategy-repository";
import { createConfiguredTradeStrategyRepository } from "./configured-strategy-repository";

export type TradeStrategyDisclosure =
  | Readonly<{ kind: "locked"; asset: Asset }>
  | Readonly<{
      kind: "status";
      asset: Asset;
      state:
        | "unpublished"
        | "scheduled"
        | "expired"
        | "withdrawn"
        | "unavailable";
    }>
  | Readonly<{
      kind: "active";
      asset: Asset;
      strategy: ActiveTradeStrategyView;
    }>;

export type TradeStrategyServiceDependencies = Readonly<{
  repository?: TradeStrategyRepository;
  now?: () => number;
}>;

/**
 * Access-first disclosure gate. Non-VIP callers do not invoke the private
 * repository and receive no hint about whether a strategy exists.
 */
export async function loadTradeStrategyDisclosure(
  asset: Asset,
  access: Promise<UserAccess>,
  dependencies: TradeStrategyServiceDependencies = {},
): Promise<TradeStrategyDisclosure> {
  let resolvedAccess: UserAccess;
  try {
    resolvedAccess = await access;
  } catch {
    return locked(asset);
  }

  if (!canAccessFeature(resolvedAccess, "editorial.tradeStrategy")) {
    return locked(asset);
  }

  const repository =
    dependencies.repository ?? createConfiguredTradeStrategyRepository();
  const now = (dependencies.now ?? Date.now)();
  let repositoryDisclosure;
  try {
    repositoryDisclosure = await repository.getDisclosure(asset, now);
  } catch {
    return status(asset, "unavailable");
  }

  if (repositoryDisclosure.kind === "status") {
    return status(asset, repositoryDisclosure.state);
  }

  try {
    const strategy = parseTradeStrategy(repositoryDisclosure.value);
    if (strategy.asset !== asset) return status(asset, "unavailable");

    const state = resolveTradeStrategyDisplayState(strategy, now);
    if (state !== "active") return status(asset, state);

    return Object.freeze({
      kind: "active",
      asset,
      strategy: toActiveTradeStrategyView(strategy),
    });
  } catch {
    return status(asset, "unavailable");
  }
}

function locked(asset: Asset): TradeStrategyDisclosure {
  return Object.freeze({ kind: "locked", asset });
}

function status(
  asset: Asset,
  state: Extract<TradeStrategyDisclosure, { kind: "status" }>["state"],
): TradeStrategyDisclosure {
  return Object.freeze({ kind: "status", asset, state });
}
