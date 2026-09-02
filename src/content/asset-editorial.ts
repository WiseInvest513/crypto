import "server-only";

/**
 * BTC and ETH key levels and Wise Scenarios are intentionally human-authored.
 *
 * Do not publish an entry until its sources, review time, active window and
 * invalidation conditions have all been verified. Key-level prices use USDT
 * because the Phase 4 chart source is the corresponding USDT market. Leaving
 * an entry unpublished with null content is the safe default; the application
 * must never manufacture a level or scenario to fill this file.
 */
export const assetEditorialDraft = {
  btc: {
    keyLevels: {
      publicationStatus: "unpublished",
      effectiveAt: null,
      validUntil: null,
      lastReviewedAt: null,
      sources: [],
      content: null,
    },
    wiseScenario: {
      publicationStatus: "unpublished",
      effectiveAt: null,
      validUntil: null,
      lastReviewedAt: null,
      sources: [],
      content: null,
    },
  },
  eth: {
    keyLevels: {
      publicationStatus: "unpublished",
      effectiveAt: null,
      validUntil: null,
      lastReviewedAt: null,
      sources: [],
      content: null,
    },
    wiseScenario: {
      publicationStatus: "unpublished",
      effectiveAt: null,
      validUntil: null,
      lastReviewedAt: null,
      sources: [],
      content: null,
    },
  },
} as const;
