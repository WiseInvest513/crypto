import "server-only";

/**
 * Homepage editorial content is intentionally edited by people.
 *
 * Set `publicationStatus` to `published` only after content, sources, review
 * time, effective time, and expiry have all been verified. Each daily item
 * must reference source IDs declared on its entry. Market figures do not
 * belong in Market Status or Wise Take; their schema rejects numeric market
 * values, which must come from the market data service.
 */
export const homepageEditorialDraft = {
  marketStatus: {
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: [],
    content: null,
  },
  todayInCrypto: {
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: [],
    content: null,
  },
  wiseTake: {
    publicationStatus: "unpublished",
    effectiveAt: null,
    validUntil: null,
    lastReviewedAt: null,
    sources: [],
    content: null,
  },
} as const;
