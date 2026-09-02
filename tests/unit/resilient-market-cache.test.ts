import { describe, expect, it, vi } from "vitest";
import type { CachePolicy } from "../../src/server/data/cache/policies";
import { ResilientMarketCache } from "../../src/server/data/cache/resilient-market-cache";
import { ProviderError } from "../../src/server/data/errors/provider-error";

const BASE_TIME = Date.parse("2026-08-28T12:00:00.000Z");
const source = {
  id: "test-source",
  label: "Test source",
  url: "https://example.test",
};
const scope = { kind: "global" as const, label: "Test scope" };
const policy: CachePolicy = {
  revalidateSeconds: 10,
  staleIfErrorSeconds: 30,
  maxSourceAgeSeconds: 60,
};

describe("ResilientMarketCache", () => {
  it("reports cache miss then hit without reloading", async () => {
    let current = BASE_TIME;
    const cache = new ResilientMarketCache({ now: () => current });
    const load = vi.fn(async () => ({
      capability: "spot.market-cap" as const,
      value: { totalMarketCapUsd: 10 },
      source,
      scope,
      updatedAt: new Date(current - 1_000).toISOString(),
      provenance: "live" as const,
    }));

    const first = await cache.read({
      key: "global",
      capability: "spot.market-cap",
      source,
      scope,
      policy,
      load,
    });
    current += 5_000;
    const second = await cache.read({
      key: "global",
      capability: "spot.market-cap",
      source,
      scope,
      policy,
      load,
    });

    expect(first.cache.status).toBe("miss");
    expect(second.cache.status).toBe("hit");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves last-known-good as stale and never lets an error overwrite it", async () => {
    let current = BASE_TIME;
    let shouldFail = false;
    const cache = new ResilientMarketCache({ now: () => current });
    const load = vi.fn(async () => {
      if (shouldFail) {
        throw new ProviderError("rate_limited", true);
      }
      return {
        capability: "spot.market-cap" as const,
        value: { totalMarketCapUsd: 10 },
        source,
        scope,
        updatedAt: new Date(BASE_TIME - 1_000).toISOString(),
        provenance: "live" as const,
      };
    });
    const options = {
      key: "global",
      capability: "spot.market-cap" as const,
      source,
      scope,
      policy,
      load,
    };

    await cache.read(options);
    current += 11_000;
    shouldFail = true;
    const fallback = await cache.read(options);
    current = BASE_TIME + 31_000;
    const expired = await cache.read(options);

    expect(fallback).toMatchObject({
      status: "stale",
      value: { totalMarketCapUsd: 10 },
      stale: true,
      cache: { status: "hit" },
      error: { code: "rate_limited", retryable: true },
    });
    expect(expired).toMatchObject({
      status: "error",
      value: null,
      cache: { status: "miss" },
      error: { code: "rate_limited" },
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("never serves a stale retry-backoff result past the cache hard expiry", async () => {
    let current = BASE_TIME;
    let shouldFail = false;
    const cache = new ResilientMarketCache({ now: () => current });
    const load = vi.fn(async () => {
      if (shouldFail) {
        throw new ProviderError("timeout", true);
      }
      return {
        capability: "spot.market-cap" as const,
        value: { totalMarketCapUsd: 10 },
        source,
        scope,
        updatedAt: new Date(BASE_TIME - 1_000).toISOString(),
        provenance: "live" as const,
      };
    });
    const options = {
      key: "hard-expiry-global",
      capability: "spot.market-cap" as const,
      source,
      scope,
      policy,
      load,
    };

    await cache.read(options);
    current = BASE_TIME + 29_000;
    shouldFail = true;
    await expect(cache.read(options)).resolves.toMatchObject({
      status: "stale",
    });
    current = BASE_TIME + 31_000;
    await expect(cache.read(options)).resolves.toMatchObject({
      status: "error",
      value: null,
    });

    expect(load).toHaveBeenCalledTimes(3);
  });

  it("marks a successfully fetched but old source timestamp as stale", async () => {
    const cache = new ResilientMarketCache({ now: () => BASE_TIME });
    const result = await cache.read({
      key: "old-source",
      capability: "spot.market-cap",
      source,
      scope,
      policy,
      load: async () => ({
        capability: "spot.market-cap" as const,
        value: { totalMarketCapUsd: 10 },
        source,
        scope,
        updatedAt: new Date(BASE_TIME - 61_000).toISOString(),
        provenance: "live" as const,
      }),
    });

    expect(result).toMatchObject({
      status: "stale",
      stale: true,
      cache: { status: "miss" },
      error: null,
    });
  });

  it("coalesces concurrent misses for the same cache key", async () => {
    const cache = new ResilientMarketCache({ now: () => BASE_TIME });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = vi.fn(async () => {
      await gate;
      return {
        capability: "spot.market-cap" as const,
        value: { totalMarketCapUsd: 10 },
        source,
        scope,
        updatedAt: new Date(BASE_TIME - 1_000).toISOString(),
        provenance: "live" as const,
      };
    });
    const options = {
      key: "concurrent-global",
      capability: "spot.market-cap" as const,
      source,
      scope,
      policy,
      load,
    };

    const first = cache.read(options);
    const second = cache.read(options);
    release();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("backs off repeated failures without replacing last-known-good data", async () => {
    let current = BASE_TIME;
    const cache = new ResilientMarketCache({ now: () => current });
    const load = vi.fn(async () => {
      throw new ProviderError("timeout", true);
    });
    const options = {
      key: "failing-global",
      capability: "spot.market-cap" as const,
      source,
      scope,
      policy,
      load,
    };

    const first = await cache.read(options);
    current += 5_000;
    const backoff = await cache.read(options);
    current += 6_000;
    const retried = await cache.read(options);

    expect(first).toMatchObject({
      status: "error",
      cache: { status: "miss" },
    });
    expect(backoff).toMatchObject({
      status: "error",
      cache: { status: "hit" },
    });
    expect(retried).toMatchObject({
      status: "error",
      cache: { status: "miss" },
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not back off non-retryable validation failures", async () => {
    let current = BASE_TIME;
    const cache = new ResilientMarketCache({ now: () => current });
    const load = vi.fn(async () => {
      throw new ProviderError("invalid_payload", false);
    });
    const options = {
      key: "invalid-global",
      capability: "spot.market-cap" as const,
      source,
      scope,
      policy,
      load,
    };

    await cache.read(options);
    current += 1_000;
    await cache.read(options);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("bounds retained entries and evicts the oldest cache key", async () => {
    const cache = new ResilientMarketCache({ now: () => BASE_TIME }, 1);
    const load = vi.fn(async () => ({
      capability: "spot.market-cap" as const,
      value: { totalMarketCapUsd: 10 },
      source,
      scope,
      updatedAt: new Date(BASE_TIME - 1_000).toISOString(),
      provenance: "live" as const,
    }));
    const readKey = (key: string) =>
      cache.read({
        key,
        capability: "spot.market-cap",
        source,
        scope,
        policy,
        load,
      });

    await readKey("first");
    await readKey("second");
    await readKey("first");

    expect(load).toHaveBeenCalledTimes(3);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid capacity of %s",
    (capacity) => {
      expect(
        () => new ResilientMarketCache({ now: () => BASE_TIME }, capacity),
      ).toThrow("maxEntries must be a positive safe integer");
    },
  );
});
