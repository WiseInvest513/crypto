export function tradeStrategyFixture(asset: "btc" | "eth" = "btc") {
  return {
    schemaVersion: 1,
    id: `${asset}-manual-plan`,
    revision: 3,
    asset,
    storedStatus: "published",
    bias: "wait",
    headline: "PRIVATE_HEADLINE_SENTINEL",
    summary: "PRIVATE_SUMMARY_SENTINEL",
    timeframes: ["1h", "4h"],
    priceZones: [
      {
        id: "primary-watch-zone",
        role: "watch",
        lower: 71_000,
        upper: 72_000,
        label: "PRIVATE_ZONE_SENTINEL",
        rationale: "PRIVATE_RATIONALE_SENTINEL",
        sourceIds: ["research-note"],
      },
    ],
    confirmationConditions: ["PRIVATE_CONFIRMATION_SENTINEL"],
    invalidationConditions: ["PRIVATE_INVALIDATION_SENTINEL"],
    watchItems: ["PRIVATE_WATCH_SENTINEL"],
    riskDisclosure: "PRIVATE_RISK_SENTINEL",
    author: "PRIVATE_AUTHOR_SENTINEL",
    reviewer: "PRIVATE_REVIEWER_SENTINEL",
    sources: [
      {
        id: "research-note",
        label: "PRIVATE_SOURCE_SENTINEL",
        url: "https://research.example.com/wise-note",
      },
    ],
    createdAt: "2026-09-05T00:00:00Z",
    reviewedAt: "2026-09-05T01:00:00Z",
    publishedAt: "2026-09-05T02:00:00Z",
    validFrom: "2026-09-06T00:00:00Z",
    validUntil: "2026-09-07T00:00:00Z",
  };
}
