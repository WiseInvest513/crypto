import "server-only";

import type {
  AvailableMarketDatum,
  DataScope,
  DataSource,
  ErrorMarketDatum,
  MarketCapability,
  MarketDatum,
} from "../contracts/market-data";
import { toDataError } from "../errors/provider-error";
import type { CachePolicy } from "./policies";

export type Clock = {
  now(): number;
};

export type ValidatedMarketValue<T> = {
  capability: MarketCapability;
  value: T;
  source: DataSource;
  scope: DataScope;
  updatedAt: string;
  provenance: "live" | "derived" | "synthetic";
};

type CacheEntry<T> = {
  payload: ValidatedMarketValue<T>;
  retrievedAt: string;
  storedAtMs: number;
  expiresAtMs: number;
};

type RetryBackoffEntry<T> = {
  result: MarketDatum<T>;
  expiresAtMs: number;
};

type CacheReadOptions<T> = {
  key: string;
  capability: MarketCapability;
  source: DataSource;
  scope: DataScope;
  policy: CachePolicy;
  load: () => Promise<ValidatedMarketValue<T>>;
};

const systemClock: Clock = { now: () => Date.now() };
const DEFAULT_MAX_ENTRIES = 256;
const MAX_RETRY_BACKOFF_MILLISECONDS = 30_000;

export class ResilientMarketCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly retryBackoffs = new Map<
    string,
    RetryBackoffEntry<unknown>
  >();
  private readonly inFlight = new Map<
    string,
    Promise<MarketDatum<unknown>>
  >();
  private readonly clock: Clock;
  private readonly maxEntries: number;

  constructor(
    clock: Clock = systemClock,
    maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive safe integer.");
    }
    this.clock = clock;
    this.maxEntries = maxEntries;
  }

  async read<T>({
    key,
    capability,
    source,
    scope,
    policy,
    load,
  }: CacheReadOptions<T>): Promise<MarketDatum<T>> {
    const nowMs = this.clock.now();
    this.pruneExpired(nowMs);
    const cached = this.entries.get(key) as CacheEntry<T> | undefined;

    if (
      cached &&
      nowMs - cached.storedAtMs < policy.revalidateSeconds * 1_000
    ) {
      return this.toAvailable(cached, policy, "hit", null);
    }

    const retryBackoff = this.retryBackoffs.get(key) as
      | RetryBackoffEntry<T>
      | undefined;
    if (retryBackoff && nowMs < retryBackoff.expiresAtMs) {
      return {
        ...retryBackoff.result,
        cache: { ...retryBackoff.result.cache, status: "hit" },
      };
    }
    if (retryBackoff) {
      this.retryBackoffs.delete(key);
    }

    const active = this.inFlight.get(key) as
      | Promise<MarketDatum<T>>
      | undefined;
    if (active) {
      return active;
    }

    const pending = this.refresh(
      { key, capability, source, scope, policy, load },
      cached,
    );
    this.inFlight.set(key, pending as Promise<MarketDatum<unknown>>);

    try {
      return await pending;
    } finally {
      if (this.inFlight.get(key) === pending) {
        this.inFlight.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.retryBackoffs.clear();
  }

  private async refresh<T>(
    {
      key,
      capability,
      source,
      scope,
      policy,
      load,
    }: CacheReadOptions<T>,
    cached: CacheEntry<T> | undefined,
  ): Promise<MarketDatum<T>> {
    try {
      const payload = await load();
      const storedAtMs = this.clock.now();
      const retrievedAt = new Date(storedAtMs).toISOString();
      const entry: CacheEntry<T> = {
        payload,
        retrievedAt,
        storedAtMs,
        expiresAtMs:
          storedAtMs +
          Math.max(
            policy.revalidateSeconds,
            policy.staleIfErrorSeconds,
          ) *
            1_000,
      };
      this.entries.delete(key);
      this.entries.set(key, entry);
      this.enforceCapacity(this.entries);
      this.retryBackoffs.delete(key);
      return this.toAvailable(entry, policy, "miss", null);
    } catch (error) {
      const dataError = toDataError(error);
      const failedAtMs = this.clock.now();
      if (
        cached &&
        failedAtMs - cached.storedAtMs <=
          policy.staleIfErrorSeconds * 1_000
      ) {
        const result = this.toAvailable(cached, policy, "hit", dataError);
        if (dataError.retryable) {
          this.storeRetryBackoff(
            key,
            result,
            failedAtMs,
            policy,
            cached.expiresAtMs,
          );
        }
        return result;
      }

      const failedAt = new Date(failedAtMs).toISOString();
      const result: ErrorMarketDatum = {
        status: "error",
        capability,
        value: null,
        source,
        scope,
        updatedAt: null,
        retrievedAt: failedAt,
        loading: false,
        stale: false,
        cache: {
          status: "miss",
          revalidateSeconds: policy.revalidateSeconds,
          staleIfErrorSeconds: policy.staleIfErrorSeconds,
        },
        error: dataError,
      };
      if (dataError.retryable) {
        this.storeRetryBackoff(key, result, failedAtMs, policy);
      }
      return result;
    }
  }

  private pruneExpired(nowMs: number): void {
    for (const [key, entry] of this.entries) {
      if (nowMs >= entry.expiresAtMs) {
        this.entries.delete(key);
      }
    }

    for (const [key, entry] of this.retryBackoffs) {
      if (nowMs >= entry.expiresAtMs) {
        this.retryBackoffs.delete(key);
      }
    }
  }

  private storeRetryBackoff<T>(
    key: string,
    result: MarketDatum<T>,
    failedAtMs: number,
    policy: CachePolicy,
    hardExpiryMs?: number,
  ): void {
    const retryBackoffMs = Math.min(
      policy.revalidateSeconds * 1_000,
      MAX_RETRY_BACKOFF_MILLISECONDS,
    );
    const expiresAtMs = Math.min(
      failedAtMs + retryBackoffMs,
      hardExpiryMs ?? Number.POSITIVE_INFINITY,
    );
    if (expiresAtMs <= failedAtMs) {
      return;
    }
    this.retryBackoffs.delete(key);
    this.retryBackoffs.set(key, { result, expiresAtMs });
    this.enforceCapacity(this.retryBackoffs);
  }

  private enforceCapacity<T>(map: Map<string, T>): void {
    while (map.size > this.maxEntries) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      map.delete(oldestKey);
    }
  }

  private toAvailable<T>(
    entry: CacheEntry<T>,
    policy: CachePolicy,
    cacheStatus: "hit" | "miss",
    error: AvailableMarketDatum<T>["error"],
  ): AvailableMarketDatum<T> {
    const sourceAgeMs = this.clock.now() - Date.parse(entry.payload.updatedAt);
    const stale =
      error !== null || sourceAgeMs > policy.maxSourceAgeSeconds * 1_000;

    return {
      status: stale ? "stale" : "fresh",
      capability: entry.payload.capability,
      value: entry.payload.value,
      source: entry.payload.source,
      scope: entry.payload.scope,
      updatedAt: entry.payload.updatedAt,
      retrievedAt: entry.retrievedAt,
      loading: false,
      stale,
      provenance: entry.payload.provenance,
      cache: {
        status: cacheStatus,
        revalidateSeconds: policy.revalidateSeconds,
        staleIfErrorSeconds: policy.staleIfErrorSeconds,
      },
      error,
    };
  }
}
