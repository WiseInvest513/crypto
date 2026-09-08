import "server-only";

import {
  parseStoredTradeStrategyDraft,
  type StoredTradeStrategyDraft,
} from "@/lib/strategy/trade-strategy-authoring";
import {
  createLocalStrategyStore,
  type LocalStrategyStore,
} from "./local-strategy-store";
import type { StrategyStudioRuntimeConfig } from "./staff-runtime-config";

export function createStrategyStudioStore(
  config: Extract<StrategyStudioRuntimeConfig, { enabled: true }>,
): LocalStrategyStore<StoredTradeStrategyDraft> {
  return createLocalStrategyStore({
    directory: config.storeDirectory,
    encryptionKey: config.encryptionKey,
    parseDraft(input) {
      const parsed = parseStoredTradeStrategyDraft(input);
      if (!parsed.ok) {
        throw new Error("STRATEGY_STUDIO_INVALID_STORED_DRAFT");
      }
      return parsed.value;
    },
  });
}
