import "server-only";

import { assetEditorialDraft } from "../../content/asset-editorial";
import {
  parseAssetEditorialConfig,
  type AssetEditorialAsset,
  type AssetEditorialEntries,
} from "../../lib/editorial/asset-editorial";
import {
  canAccessFeature,
  type UserAccess,
} from "../../lib/access/user-access";

const assetEditorialConfig = parseAssetEditorialConfig(assetEditorialDraft);
const REDACTED_ASSET_EDITORIAL: AssetEditorialEntries = Object.freeze({
  keyLevels: Object.freeze({
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: Object.freeze([]),
    content: null,
  }),
  wiseScenario: Object.freeze({
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: Object.freeze([]),
    content: null,
  }),
});

export type AssetEditorialPayload = {
  asset: AssetEditorialAsset;
  config: AssetEditorialEntries;
  now: number;
};

function loadAssetEditorial(
  asset: AssetEditorialAsset,
  now: () => number = Date.now,
): AssetEditorialPayload {
  return {
    asset,
    config: assetEditorialConfig[asset],
    now: now(),
  };
}

/**
 * Server-side disclosure boundary for premium editorial. Callers that have not
 * resolved a verified VIP identity receive a metadata-free empty payload.
 */
export async function loadAssetEditorialForAccess(
  asset: AssetEditorialAsset,
  access: Promise<UserAccess>,
  now: () => number = Date.now,
): Promise<AssetEditorialPayload> {
  const resolvedAccess = await access;

  if (!canAccessFeature(resolvedAccess, "editorial.tradeStrategy")) {
    return {
      asset,
      config: REDACTED_ASSET_EDITORIAL,
      now: now(),
    };
  }

  return loadAssetEditorial(asset, now);
}
