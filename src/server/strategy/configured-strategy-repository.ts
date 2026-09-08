import "server-only";

import { loadStrategyStudioRuntimeConfig } from "./staff-runtime-config";
import {
  emptyTradeStrategyRepository,
  type TradeStrategyRepository,
} from "./strategy-repository";
import { createStrategyStudioStore } from "./strategy-studio-store";

/**
 * Local authoring data is readable only when the explicit local runtime is
 * valid. Deployed environments keep the production-safe empty repository.
 */
export function createConfiguredTradeStrategyRepository(): TradeStrategyRepository {
  const config = loadStrategyStudioRuntimeConfig();
  if (!config.enabled) return emptyTradeStrategyRepository;

  const store = createStrategyStudioStore(config);
  return {
    getDisclosure: (asset, at) => store.resolvePublicDisclosure(asset, at),
  };
}
