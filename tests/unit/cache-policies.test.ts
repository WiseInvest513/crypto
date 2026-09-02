import { describe, expect, it } from "vitest";
import { cachePolicies } from "../../src/server/data/cache/policies";

describe("market cache policies", () => {
  it("never waits beyond a capability's source freshness SLA to revalidate", () => {
    for (const [name, policy] of Object.entries(cachePolicies)) {
      expect(
        policy.revalidateSeconds,
        `${name} revalidation must not exceed maximum source age`,
      ).toBeLessThanOrEqual(policy.maxSourceAgeSeconds);
    }
  });

  it("retains the intended freshness windows for actively changing CMC data", () => {
    expect(cachePolicies.quote).toMatchObject({
      revalidateSeconds: 5 * 60,
      maxSourceAgeSeconds: 5 * 60,
    });
    expect(cachePolicies.global).toMatchObject({
      revalidateSeconds: 15 * 60,
      maxSourceAgeSeconds: 15 * 60,
    });
    expect(cachePolicies.liquidations).toMatchObject({
      revalidateSeconds: 5 * 60,
      maxSourceAgeSeconds: 5 * 60,
    });
  });
});
