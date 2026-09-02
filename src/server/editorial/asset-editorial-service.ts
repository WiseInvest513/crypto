import "server-only";

import { assetEditorialDraft } from "../../content/asset-editorial";
import {
  parseAssetEditorialConfig,
  type AssetEditorialAsset,
  type AssetEditorialEntries,
} from "../../lib/editorial/asset-editorial";

const assetEditorialConfig = parseAssetEditorialConfig(assetEditorialDraft);

export type AssetEditorialPayload = {
  asset: AssetEditorialAsset;
  config: AssetEditorialEntries;
  now: number;
};

export function loadAssetEditorial(
  asset: AssetEditorialAsset,
  now: () => number = Date.now,
): AssetEditorialPayload {
  return {
    asset,
    config: assetEditorialConfig[asset],
    now: now(),
  };
}
