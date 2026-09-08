import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { hostname as getHostname } from "node:os";
import { isAbsolute, join, normalize, parse as parsePath } from "node:path";
import type { Asset } from "@/lib/market/live-chart";
import {
  parseTradeStrategy,
  resolveTradeStrategyDisplayState,
  type TradeStrategy,
} from "@/lib/strategy/trade-strategy";

export const LOCAL_STRATEGY_STORE_FILENAME = "strategy-store.v1.enc.json";
export const LOCAL_STRATEGY_STORE_MARKER_FILENAME =
  ".strategy-store.initialized";
export const LOCAL_STRATEGY_STORE_SCHEMA_VERSION = 1 as const;

const ENVELOPE_FORMAT = "wise-crypto-private-strategy-store" as const;
const ENVELOPE_VERSION = 1 as const;
const ENVELOPE_ALGORITHM = "aes-256-gcm" as const;
const ENVELOPE_AAD = Buffer.from(
  `${ENVELOPE_FORMAT}:${ENVELOPE_VERSION}:${ENVELOPE_ALGORITHM}`,
  "utf8",
);
const STORE_LOCK_DIRECTORY = ".strategy-store.lock";
const STORE_LOCK_OWNER_FILENAME = "owner.json";
const STORE_MARKER_CONTENT = "wise-crypto-private-strategy-store:v1\n";
const LOCK_OWNER_VERSION = 1 as const;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MIN_MAX_FILE_BYTES = 4 * 1024;
const MAX_MAX_FILE_BYTES = 8 * 1024 * 1024;
const DEFAULT_LOCK_TIMEOUT_MS = 1_500;
const MAX_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const MAX_STALE_LOCK_MS = 5 * 60_000;
const MAX_PUBLICATION_RECORDS_PER_ASSET = 512;
const MAX_JSON_DEPTH = 24;
const ASSETS = ["btc", "eth"] as const;
const STRATEGY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u;

export type LocalStrategyReviewFeedback = Readonly<{
  reason: string;
  returnedBy: string;
  returnedAt: string;
}>;

export type LocalStrategyWorkingDraft<TDraft> = Readonly<{
  editVersion: number;
  value: TDraft;
  updatedAt: string;
  reviewFeedback: LocalStrategyReviewFeedback | null;
}>;

export type LocalStrategyReviewCandidate = Readonly<{
  editVersion: number;
  strategy: TradeStrategy;
  frozenAt: string;
}>;

export type LocalStrategyPublicationRecord =
  | Readonly<{
      kind: "publication";
      sequence: number;
      strategy: TradeStrategy;
    }>
  | Readonly<{
      kind: "withdrawal";
      sequence: number;
      strategyId: string;
      revision: number;
      withdrawnAt: string;
      withdrawnBy: string;
      reason: string;
    }>;

export type LocalStrategyAssetState<TDraft> = Readonly<{
  workingDraft: LocalStrategyWorkingDraft<TDraft> | null;
  reviewCandidate: LocalStrategyReviewCandidate | null;
  publicationRecords: readonly LocalStrategyPublicationRecord[];
}>;

export type LocalStrategyStoreSnapshot<TDraft> = Readonly<{
  schemaVersion: typeof LOCAL_STRATEGY_STORE_SCHEMA_VERSION;
  generation: number;
  assets: Readonly<{
    btc: LocalStrategyAssetState<TDraft>;
    eth: LocalStrategyAssetState<TDraft>;
  }>;
}>;

export type LocalStrategyPublicDisclosure =
  | Readonly<{ kind: "strategy"; value: TradeStrategy }>
  | Readonly<{
      kind: "status";
      state:
        | "unpublished"
        | "scheduled"
        | "expired"
        | "withdrawn"
        | "unavailable";
    }>;

export type LocalStrategyMutationResult<T> = Readonly<{
  generation: number;
  value: T;
}>;

export type LocalStrategyStoreOptions<TDraft> = Readonly<{
  /** Dedicated, absolute storage directory. No per-request path is accepted. */
  directory: string;
  /** Exactly 32 bytes. The store never reads keys from environment variables. */
  encryptionKey: Uint8Array;
  /** Parse and normalize a draft after both input and decrypted reads. */
  parseDraft?: (input: unknown) => TDraft;
  clock?: () => number;
  maxFileBytes?: number;
  lockTimeoutMs?: number;
  /** Recover only same-host locks whose owner PID is confirmed dead. */
  staleLockMs?: number;
}>;

export type LocalStrategyStore<TDraft> = Readonly<{
  readSnapshot(): Promise<LocalStrategyStoreSnapshot<TDraft>>;
  readAsset(asset: Asset): Promise<LocalStrategyAssetState<TDraft>>;
  saveWorkingDraft(input: {
    asset: Asset;
    value: unknown;
    expectedGeneration: number;
    expectedEditVersion: number | null;
  }): Promise<LocalStrategyMutationResult<LocalStrategyWorkingDraft<TDraft>>>;
  freezeReviewCandidate(input: {
    asset: Asset;
    strategy: unknown;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyReviewCandidate>>;
  returnReviewCandidate(input: {
    asset: Asset;
    returnedBy: string;
    reason: string;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyWorkingDraft<TDraft>>>;
  publishReviewCandidate(input: {
    asset: Asset;
    strategy: unknown;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<TradeStrategy>>;
  withdrawLatestPublication(input: {
    asset: Asset;
    strategyId: string;
    revision: number;
    withdrawnBy: string;
    reason: string;
    expectedGeneration: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyPublicationRecord>>;
  resolvePublicDisclosure(
    asset: Asset,
    now?: number,
  ): Promise<LocalStrategyPublicDisclosure>;
}>;

type EncryptedEnvelope = Readonly<{
  format: typeof ENVELOPE_FORMAT;
  version: typeof ENVELOPE_VERSION;
  algorithm: typeof ENVELOPE_ALGORITHM;
  iv: string;
  tag: string;
  ciphertext: string;
}>;

export class LocalStrategyStoreError extends Error {
  constructor(
    readonly code:
      | "invalid_configuration"
      | "invalid_asset"
      | "corrupt_store"
      | "store_too_large"
      | "lock_timeout"
      | "stale_generation"
      | "stale_edit_version"
      | "invalid_transition"
      | "publication_overlap",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalStrategyStoreError";
  }
}

/**
 * Local-only encrypted authoring store. A deployment adapter must replace this
 * implementation rather than mounting it on ephemeral production storage.
 */
export function createLocalStrategyStore<TDraft = unknown>(
  options: LocalStrategyStoreOptions<TDraft>,
): LocalStrategyStore<TDraft> {
  const config = normalizeOptions(options);

  async function readSnapshot(): Promise<LocalStrategyStoreSnapshot<TDraft>> {
    await ensureStoreDirectory(config.directory);
    return readSnapshotStrict(config);
  }

  async function readAsset(
    asset: Asset,
  ): Promise<LocalStrategyAssetState<TDraft>> {
    assertAsset(asset);
    const snapshot = await readSnapshot();
    return cloneJson(snapshot.assets[asset]) as LocalStrategyAssetState<TDraft>;
  }

  async function mutate<T>(
    expectedGeneration: number,
    updater: (
      snapshot: MutableSnapshot<TDraft>,
      timestamp: string,
    ) => T,
  ): Promise<LocalStrategyMutationResult<T>> {
    assertNonNegativeInteger(expectedGeneration, "expectedGeneration");
    await ensureStoreDirectory(config.directory);
    return withDirectoryLock(config, async () => {
      const current = await readSnapshotStrict(config);
      if (current.generation !== expectedGeneration) {
        throw new LocalStrategyStoreError(
          "stale_generation",
          "Strategy store generation changed; reload before saving.",
        );
      }

      const mutable = cloneJson(current) as MutableSnapshot<TDraft>;
      const value = updater(mutable, timestampFromClock(config.clock));
      mutable.generation += 1;
      const parsed = parseSnapshot(mutable, config.parseDraft);
      await writeSnapshotAtomic(config, parsed);
      return {
        generation: parsed.generation,
        value: cloneJson(value) as T,
      };
    });
  }

  async function saveWorkingDraft(input: {
    asset: Asset;
    value: unknown;
    expectedGeneration: number;
    expectedEditVersion: number | null;
  }): Promise<LocalStrategyMutationResult<LocalStrategyWorkingDraft<TDraft>>> {
    assertAsset(input.asset);
    if (
      input.expectedEditVersion !== null &&
      (!Number.isSafeInteger(input.expectedEditVersion) ||
        input.expectedEditVersion < 1)
    ) {
      throw invalidConfiguration("expectedEditVersion must be null or positive.");
    }
    const draft = parseAndCloneDraft(input.value, config.parseDraft);

    return mutate(input.expectedGeneration, (snapshot, timestamp) => {
      const state = snapshot.assets[input.asset];
      if (state.reviewCandidate !== null) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "A frozen review candidate must be returned or published before editing.",
        );
      }
      const currentVersion = state.workingDraft?.editVersion ?? null;
      if (currentVersion !== input.expectedEditVersion) {
        throw new LocalStrategyStoreError(
          "stale_edit_version",
          "Draft edit version changed; reload before saving.",
        );
      }
      const workingDraft: LocalStrategyWorkingDraft<TDraft> = {
        editVersion: (currentVersion ?? 0) + 1,
        value: draft,
        updatedAt: timestamp,
        reviewFeedback: null,
      };
      state.workingDraft = workingDraft;
      return workingDraft;
    });
  }

  async function freezeReviewCandidate(input: {
    asset: Asset;
    strategy: unknown;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyReviewCandidate>> {
    assertAsset(input.asset);
    assertPositiveInteger(input.expectedEditVersion, "expectedEditVersion");
    const strategy = parseTradeStrategy(input.strategy);
    if (strategy.asset !== input.asset || strategy.storedStatus !== "in_review") {
      throw new LocalStrategyStoreError(
        "invalid_transition",
        "Review candidates must match the asset and use in_review status.",
      );
    }

    return mutate(input.expectedGeneration, (snapshot, timestamp) => {
      const state = snapshot.assets[input.asset];
      if (
        state.workingDraft === null ||
        state.workingDraft.editVersion !== input.expectedEditVersion
      ) {
        throw new LocalStrategyStoreError(
          "stale_edit_version",
          "Draft edit version changed; reload before review submission.",
        );
      }
      if (state.reviewCandidate !== null) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "This asset already has a frozen review candidate.",
        );
      }
      const candidate: LocalStrategyReviewCandidate = {
        editVersion: input.expectedEditVersion,
        strategy,
        frozenAt: timestamp,
      };
      state.reviewCandidate = candidate;
      return candidate;
    });
  }

  async function returnReviewCandidate(input: {
    asset: Asset;
    returnedBy: string;
    reason: string;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyWorkingDraft<TDraft>>> {
    assertAsset(input.asset);
    assertPositiveInteger(input.expectedEditVersion, "expectedEditVersion");
    const returnedBy = mutationText(input.returnedBy, "returnedBy", 80);
    const reason = mutationText(input.reason, "reason", 500);
    return mutate(input.expectedGeneration, (snapshot, timestamp) => {
      const state = snapshot.assets[input.asset];
      if (
        state.workingDraft === null ||
        state.reviewCandidate === null ||
        state.reviewCandidate.editVersion !== input.expectedEditVersion ||
        state.workingDraft.editVersion !== input.expectedEditVersion
      ) {
        throw new LocalStrategyStoreError(
          "stale_edit_version",
          "Review candidate no longer matches the working draft.",
        );
      }
      state.reviewCandidate = null;
      state.workingDraft = {
        ...state.workingDraft,
        reviewFeedback: {
          reason,
          returnedBy,
          returnedAt: timestamp,
        },
      };
      return state.workingDraft;
    });
  }

  async function publishReviewCandidate(input: {
    asset: Asset;
    strategy: unknown;
    expectedGeneration: number;
    expectedEditVersion: number;
  }): Promise<LocalStrategyMutationResult<TradeStrategy>> {
    assertAsset(input.asset);
    assertPositiveInteger(input.expectedEditVersion, "expectedEditVersion");
    const published = parseTradeStrategy(input.strategy);
    if (published.asset !== input.asset || published.storedStatus !== "published") {
      throw new LocalStrategyStoreError(
        "invalid_transition",
        "Only a published strategy matching the selected asset can be recorded.",
      );
    }
    if (published.reviewer === published.author) {
      throw new LocalStrategyStoreError(
        "invalid_transition",
        "The reviewer must be different from the author.",
      );
    }

    return mutate(input.expectedGeneration, (snapshot) => {
      const state = snapshot.assets[input.asset];
      const frozen = state.reviewCandidate;
      if (
        frozen === null ||
        frozen.editVersion !== input.expectedEditVersion ||
        state.workingDraft?.editVersion !== input.expectedEditVersion
      ) {
        throw new LocalStrategyStoreError(
          "stale_edit_version",
          "The frozen candidate changed; reload before publishing.",
        );
      }
      if (!sameFrozenEditorialContent(frozen.strategy, published)) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "Published content must be derived from the frozen review candidate.",
        );
      }
      if (hasPublicationIdentity(state.publicationRecords, published)) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "This immutable strategy revision has already been published.",
        );
      }

      const withdrawnIdentities = collectWithdrawnIdentities(
        state.publicationRecords,
      );
      const overlapping = state.publicationRecords.some(
        (record) =>
          record.kind === "publication" &&
          !withdrawnIdentities.has(strategyIdentity(record.strategy)) &&
          windowsOverlap(record.strategy, published),
      );
      if (overlapping) {
        throw new LocalStrategyStoreError(
          "publication_overlap",
          "Published strategy windows for the same asset must not overlap.",
        );
      }

      state.publicationRecords.push({
        kind: "publication",
        sequence: state.publicationRecords.length + 1,
        strategy: published,
      });
      state.reviewCandidate = null;
      state.workingDraft = null;
      return published;
    });
  }

  async function withdrawLatestPublication(input: {
    asset: Asset;
    strategyId: string;
    revision: number;
    withdrawnBy: string;
    reason: string;
    expectedGeneration: number;
  }): Promise<LocalStrategyMutationResult<LocalStrategyPublicationRecord>> {
    assertAsset(input.asset);
    const strategyId = mutationStrategyId(input.strategyId);
    assertPositiveInteger(input.revision, "revision");
    const withdrawnBy = mutationText(input.withdrawnBy, "withdrawnBy", 80);
    const reason = mutationText(input.reason, "reason", 500);
    return mutate(input.expectedGeneration, (snapshot, timestamp) => {
      const state = snapshot.assets[input.asset];
      const targetIdentity = `${strategyId}:${input.revision}`;
      const target = state.publicationRecords.find(
        (record) =>
          record.kind === "publication" &&
          strategyIdentity(record.strategy) === targetIdentity,
      );
      if (target === undefined) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "The requested publication does not exist.",
        );
      }
      if (collectWithdrawnIdentities(state.publicationRecords).has(targetIdentity)) {
        throw new LocalStrategyStoreError(
          "invalid_transition",
          "This strategy revision has already been withdrawn.",
        );
      }
      const tombstone: LocalStrategyPublicationRecord = {
        kind: "withdrawal",
        sequence: state.publicationRecords.length + 1,
        strategyId,
        revision: input.revision,
        withdrawnAt: timestamp,
        withdrawnBy,
        reason,
      };
      state.publicationRecords.push(tombstone);
      return tombstone;
    });
  }

  async function resolvePublicDisclosure(
    asset: Asset,
    now = config.clock(),
  ): Promise<LocalStrategyPublicDisclosure> {
    assertAsset(asset);
    if (!Number.isFinite(now)) {
      throw invalidConfiguration("Disclosure time must be finite.");
    }
    const capturedNow = now;
    try {
      const snapshot = await readSnapshot();
      return resolveLocalStrategyDisclosure(
        snapshot.assets[asset].publicationRecords,
        asset,
        capturedNow,
      );
    } catch {
      return { kind: "status", state: "unavailable" };
    }
  }

  return Object.freeze({
    readSnapshot,
    readAsset,
    saveWorkingDraft,
    freezeReviewCandidate,
    returnReviewCandidate,
    publishReviewCandidate,
    withdrawLatestPublication,
    resolvePublicDisclosure,
  });
}

/** Pure public-read裁决，also used to prove overlap fail-closed behavior. */
export function resolveLocalStrategyDisclosure(
  records: readonly LocalStrategyPublicationRecord[],
  asset: Asset,
  now: number,
): LocalStrategyPublicDisclosure {
  assertAsset(asset);
  if (!Number.isFinite(now)) {
    throw invalidConfiguration("Disclosure time must be finite.");
  }
  try {
    const parsedRecords = parsePublicationRecords(records, asset);
    const withdrawnIdentities = collectWithdrawnIdentities(parsedRecords);
    const publicationRecords = parsedRecords
      .filter(
        (record): record is Extract<
          LocalStrategyPublicationRecord,
          { kind: "publication" }
        > => record.kind === "publication",
      );
    const publications = publicationRecords
      .filter(
        (record) =>
          !withdrawnIdentities.has(strategyIdentity(record.strategy)),
      )
      .map((record) => record.strategy);
    const active = publications.filter(
      (strategy) => resolveTradeStrategyDisplayState(strategy, now) === "active",
    );

    if (active.length > 1) {
      return { kind: "status", state: "unavailable" };
    }
    if (active.length === 1) {
      return { kind: "strategy", value: cloneJson(active[0]) };
    }

    if (
      publications.some(
        (strategy) =>
          resolveTradeStrategyDisplayState(strategy, now) === "scheduled",
      )
    ) {
      return { kind: "status", state: "scheduled" };
    }
    const withdrawnPublications = publicationRecords
      .filter((record) =>
        withdrawnIdentities.has(strategyIdentity(record.strategy)),
      )
      .map((record) => record.strategy);
    if (
      withdrawnPublications.some((strategy) => {
        const state = resolveTradeStrategyDisplayState(strategy, now);
        return state === "active" || state === "scheduled";
      })
    ) {
      return { kind: "status", state: "withdrawn" };
    }
    if (publications.length > 0) {
      return { kind: "status", state: "expired" };
    }
    if (withdrawnPublications.length > 0) {
      return { kind: "status", state: "withdrawn" };
    }
    return { kind: "status", state: "unpublished" };
  } catch {
    return { kind: "status", state: "unavailable" };
  }
}

type NormalizedOptions<TDraft> = Readonly<{
  directory: string;
  key: Buffer;
  parseDraft: (input: unknown) => TDraft;
  clock: () => number;
  maxFileBytes: number;
  lockTimeoutMs: number;
  staleLockMs: number;
}>;

type MutableAssetState<TDraft> = {
  workingDraft: LocalStrategyWorkingDraft<TDraft> | null;
  reviewCandidate: LocalStrategyReviewCandidate | null;
  publicationRecords: LocalStrategyPublicationRecord[];
};

type MutableSnapshot<TDraft> = {
  schemaVersion: typeof LOCAL_STRATEGY_STORE_SCHEMA_VERSION;
  generation: number;
  assets: {
    btc: MutableAssetState<TDraft>;
    eth: MutableAssetState<TDraft>;
  };
};

function normalizeOptions<TDraft>(
  options: LocalStrategyStoreOptions<TDraft>,
): NormalizedOptions<TDraft> {
  if (
    typeof options.directory !== "string" ||
    options.directory.includes("\0") ||
    !isAbsolute(options.directory) ||
    normalize(options.directory) !== options.directory ||
    options.directory === parsePath(options.directory).root
  ) {
    throw invalidConfiguration(
      "Strategy directory must be a normalized, dedicated absolute path.",
    );
  }
  if (!(options.encryptionKey instanceof Uint8Array)) {
    throw invalidConfiguration("Strategy encryption key must be bytes.");
  }
  const key = Buffer.from(options.encryptionKey);
  if (key.byteLength !== 32) {
    throw invalidConfiguration("Strategy encryption key must be exactly 32 bytes.");
  }
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  if (
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes < MIN_MAX_FILE_BYTES ||
    maxFileBytes > MAX_MAX_FILE_BYTES
  ) {
    throw invalidConfiguration(
      `maxFileBytes must be between ${MIN_MAX_FILE_BYTES} and ${MAX_MAX_FILE_BYTES}.`,
    );
  }
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(lockTimeoutMs) ||
    lockTimeoutMs < 1 ||
    lockTimeoutMs > MAX_LOCK_TIMEOUT_MS
  ) {
    throw invalidConfiguration(
      `lockTimeoutMs must be between 1 and ${MAX_LOCK_TIMEOUT_MS}.`,
    );
  }
  const staleLockMs = options.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  if (
    !Number.isSafeInteger(staleLockMs) ||
    staleLockMs < 1 ||
    staleLockMs > MAX_STALE_LOCK_MS
  ) {
    throw invalidConfiguration(
      `staleLockMs must be between 1 and ${MAX_STALE_LOCK_MS}.`,
    );
  }
  if (options.clock !== undefined && typeof options.clock !== "function") {
    throw invalidConfiguration("clock must be a function.");
  }
  if (
    options.parseDraft !== undefined &&
    typeof options.parseDraft !== "function"
  ) {
    throw invalidConfiguration("parseDraft must be a function.");
  }
  return {
    directory: options.directory,
    key,
    parseDraft:
      options.parseDraft ??
      ((input) => cloneJson(assertJsonValue(input)) as TDraft),
    clock: options.clock ?? Date.now,
    maxFileBytes,
    lockTimeoutMs,
    staleLockMs,
  };
}

function emptySnapshot<TDraft>(): LocalStrategyStoreSnapshot<TDraft> {
  return {
    schemaVersion: LOCAL_STRATEGY_STORE_SCHEMA_VERSION,
    generation: 0,
    assets: {
      btc: { workingDraft: null, reviewCandidate: null, publicationRecords: [] },
      eth: { workingDraft: null, reviewCandidate: null, publicationRecords: [] },
    },
  };
}

async function ensureStoreDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new LocalStrategyStoreError(
      "invalid_configuration",
      "Strategy storage path must be a real directory, not a symbolic link.",
    );
  }
  assertOwnedPrivatePath(
    stats,
    "Strategy storage directory",
    0o700,
    "invalid_configuration",
  );
}

async function readSnapshotStrict<TDraft>(
  config: NormalizedOptions<TDraft>,
): Promise<LocalStrategyStoreSnapshot<TDraft>> {
  const file = join(config.directory, LOCAL_STRATEGY_STORE_FILENAME);
  const initialized = await readInitializationMarker(config.directory);
  let stats;
  try {
    stats = await lstat(file);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      if (initialized) {
        throw corruptStore(
          "Initialized strategy store is missing its encrypted snapshot.",
        );
      }
      return emptySnapshot();
    }
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw corruptStore("Encrypted strategy store must be a regular file.");
  }
  assertOwnedPrivatePath(stats, "Encrypted strategy store", 0o600);
  if (stats.size > config.maxFileBytes) {
    throw new LocalStrategyStoreError(
      "store_too_large",
      "Encrypted strategy store exceeds the configured size limit.",
    );
  }
  try {
    const encoded = await readFile(file);
    if (encoded.byteLength > config.maxFileBytes) {
      throw new LocalStrategyStoreError(
        "store_too_large",
        "Encrypted strategy store exceeds the configured size limit.",
      );
    }
    const envelope = parseEnvelope(JSON.parse(encoded.toString("utf8")));
    const plaintext = decryptEnvelope(envelope, config.key);
    if (plaintext.byteLength > config.maxFileBytes) {
      throw new LocalStrategyStoreError(
        "store_too_large",
        "Decrypted strategy store exceeds the configured size limit.",
      );
    }
    return parseSnapshot(
      JSON.parse(plaintext.toString("utf8")),
      config.parseDraft,
    );
  } catch (error) {
    if (error instanceof LocalStrategyStoreError) throw error;
    throw corruptStore("Encrypted strategy store could not be authenticated.", error);
  }
}

async function writeSnapshotAtomic<TDraft>(
  config: NormalizedOptions<TDraft>,
  snapshot: LocalStrategyStoreSnapshot<TDraft>,
): Promise<void> {
  const plaintext = Buffer.from(JSON.stringify(snapshot), "utf8");
  if (plaintext.byteLength > config.maxFileBytes) {
    throw new LocalStrategyStoreError(
      "store_too_large",
      "Strategy store exceeds the configured size limit.",
    );
  }
  const envelope = encryptEnvelope(plaintext, config.key);
  const encoded = Buffer.from(JSON.stringify(envelope), "utf8");
  if (encoded.byteLength > config.maxFileBytes) {
    throw new LocalStrategyStoreError(
      "store_too_large",
      "Encrypted strategy store exceeds the configured size limit.",
    );
  }

  const target = join(config.directory, LOCAL_STRATEGY_STORE_FILENAME);
  const temporary = join(
    config.directory,
    `.${LOCAL_STRATEGY_STORE_FILENAME}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(encoded);
    await handle.sync();
    await handle.close();
    handle = null;
    await chmod(temporary, 0o600);
    await ensureInitializationMarker(config.directory);
    await rename(temporary, target);
    const directoryHandle = await open(config.directory, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    if (handle !== null) await handle.close().catch(() => undefined);
    await unlink(temporary).catch((cleanupError) => {
      if (!isNodeError(cleanupError) || cleanupError.code !== "ENOENT") {
        throw cleanupError;
      }
    });
    throw error;
  }
}

async function readInitializationMarker(directory: string): Promise<boolean> {
  const marker = join(directory, LOCAL_STRATEGY_STORE_MARKER_FILENAME);
  let stats;
  try {
    stats = await lstat(marker);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 128) {
    throw corruptStore("Strategy initialization marker is invalid.");
  }
  assertOwnedPrivatePath(stats, "Strategy initialization marker", 0o600);
  if ((await readFile(marker, "utf8")) !== STORE_MARKER_CONTENT) {
    throw corruptStore("Strategy initialization marker is invalid.");
  }
  return true;
}

async function ensureInitializationMarker(directory: string): Promise<void> {
  if (await readInitializationMarker(directory)) return;
  const marker = join(directory, LOCAL_STRATEGY_STORE_MARKER_FILENAME);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(marker, "wx", 0o600);
    await handle.writeFile(STORE_MARKER_CONTENT, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await chmod(marker, 0o600);
    const directoryHandle = await open(directory, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    if (handle !== null) await handle.close().catch(() => undefined);
    if (isNodeError(error) && error.code === "EEXIST") {
      await readInitializationMarker(directory);
      return;
    }
    throw error;
  }
}

async function withDirectoryLock<T>(
  config: NormalizedOptions<unknown>,
  operation: () => Promise<T>,
): Promise<T> {
  const lock = join(config.directory, STORE_LOCK_DIRECTORY);
  const deadline = Date.now() + config.lockTimeoutMs;
  let nonce: string | null = null;
  for (;;) {
    try {
      await mkdir(lock, { mode: 0o700 });
      nonce = randomUUID();
      try {
        await writeLockOwner(lock, nonce);
      } catch (error) {
        await unlink(join(lock, STORE_LOCK_OWNER_FILENAME)).catch(() => undefined);
        await rmdir(lock).catch(() => undefined);
        throw error;
      }
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      if (await recoverVerifiedStaleLock(lock, config.staleLockMs)) {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new LocalStrategyStoreError(
          "lock_timeout",
          "Timed out waiting for the private strategy store lock.",
        );
      }
      await delay(Math.min(20, Math.max(1, deadline - Date.now())));
    }
  }
  try {
    return await operation();
  } finally {
    if (nonce === null) {
      throw corruptStore("Strategy lock ownership was lost.");
    }
    await releaseOwnedLock(lock, nonce);
  }
}

type StoreLockOwner = Readonly<{
  version: typeof LOCK_OWNER_VERSION;
  pid: number;
  hostname: string;
  nonce: string;
  createdAt: number;
}>;

async function writeLockOwner(lock: string, nonce: string): Promise<void> {
  const value: StoreLockOwner = {
    version: LOCK_OWNER_VERSION,
    pid: process.pid,
    hostname: getHostname(),
    nonce,
    createdAt: Date.now(),
  };
  const handle = await open(join(lock, STORE_LOCK_OWNER_FILENAME), "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  const directoryHandle = await open(lock, "r");
  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

async function readLockOwner(lock: string): Promise<StoreLockOwner> {
  const lockStats = await lstat(lock);
  if (!lockStats.isDirectory() || lockStats.isSymbolicLink()) {
    throw corruptStore("Strategy lock must be a real directory.");
  }
  assertOwnedPrivatePath(lockStats, "Strategy lock directory", 0o700);
  const entries = await readdir(lock);
  if (
    entries.length !== 1 ||
    entries[0] !== STORE_LOCK_OWNER_FILENAME
  ) {
    throw corruptStore("Strategy lock ownership cannot be verified.");
  }
  const ownerFile = join(lock, STORE_LOCK_OWNER_FILENAME);
  const ownerStats = await lstat(ownerFile);
  if (
    !ownerStats.isFile() ||
    ownerStats.isSymbolicLink() ||
    ownerStats.size > 1_024
  ) {
    throw corruptStore("Strategy lock owner record is invalid.");
  }
  assertOwnedPrivatePath(ownerStats, "Strategy lock owner record", 0o600);
  const record = exactRecord(JSON.parse(await readFile(ownerFile, "utf8")), [
    "version",
    "pid",
    "hostname",
    "nonce",
    "createdAt",
  ]);
  if (record.version !== LOCK_OWNER_VERSION) {
    throw corruptStore("Strategy lock owner version is invalid.");
  }
  const pid = positiveInteger(record.pid, "lock.pid");
  const hostname = boundedText(record.hostname, "lock.hostname", 255);
  const nonce = boundedText(record.nonce, "lock.nonce", 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(nonce)) {
    throw corruptStore("Strategy lock nonce is invalid.");
  }
  const createdAt = positiveInteger(record.createdAt, "lock.createdAt");
  return { version: LOCK_OWNER_VERSION, pid, hostname, nonce, createdAt };
}

async function recoverVerifiedStaleLock(
  lock: string,
  staleLockMs: number,
): Promise<boolean> {
  let owner: StoreLockOwner;
  try {
    owner = await readLockOwner(lock);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return true;
    return false;
  }
  const now = Date.now();
  if (
    owner.hostname !== getHostname() ||
    owner.createdAt > now ||
    now - owner.createdAt < staleLockMs ||
    isProcessAlive(owner.pid)
  ) {
    return false;
  }

  const quarantine = `${lock}.stale.${randomUUID()}`;
  try {
    await rename(lock, quarantine);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return true;
    return false;
  }
  try {
    const quarantinedOwner = await readLockOwner(quarantine);
    if (quarantinedOwner.nonce !== owner.nonce) {
      throw corruptStore("Stale strategy lock changed during recovery.");
    }
    await unlink(join(quarantine, STORE_LOCK_OWNER_FILENAME));
    await rmdir(quarantine);
    return true;
  } catch (error) {
    throw corruptStore("Verified stale strategy lock could not be recovered.", error);
  }
}

async function releaseOwnedLock(lock: string, nonce: string): Promise<void> {
  const owner = await readLockOwner(lock);
  if (
    owner.nonce !== nonce ||
    owner.pid !== process.pid ||
    owner.hostname !== getHostname()
  ) {
    throw corruptStore("Strategy lock ownership changed before release.");
  }
  await unlink(join(lock, STORE_LOCK_OWNER_FILENAME));
  await rmdir(lock);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") return false;
    return true;
  }
}

function encryptEnvelope(plaintext: Buffer, key: Buffer): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENVELOPE_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    algorithm: ENVELOPE_ALGORITHM,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptEnvelope(envelope: EncryptedEnvelope, key: Buffer): Buffer {
  const iv = decodeBase64Url(envelope.iv, 12, "iv");
  const tag = decodeBase64Url(envelope.tag, 16, "tag");
  const ciphertext = decodeBase64Url(
    envelope.ciphertext,
    undefined,
    "ciphertext",
  );
  if (ciphertext.byteLength === 0) throw corruptStore("Ciphertext is empty.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(ENVELOPE_AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function parseEnvelope(value: unknown): EncryptedEnvelope {
  const record = exactRecord(value, [
    "format",
    "version",
    "algorithm",
    "iv",
    "tag",
    "ciphertext",
  ]);
  if (
    record.format !== ENVELOPE_FORMAT ||
    record.version !== ENVELOPE_VERSION ||
    record.algorithm !== ENVELOPE_ALGORITHM ||
    typeof record.iv !== "string" ||
    typeof record.tag !== "string" ||
    typeof record.ciphertext !== "string"
  ) {
    throw corruptStore("Encrypted strategy envelope is invalid.");
  }
  return record as EncryptedEnvelope;
}

function parseSnapshot<TDraft>(
  value: unknown,
  parseDraft: (input: unknown) => TDraft,
): LocalStrategyStoreSnapshot<TDraft> {
  const record = exactRecord(value, ["schemaVersion", "generation", "assets"]);
  if (record.schemaVersion !== LOCAL_STRATEGY_STORE_SCHEMA_VERSION) {
    throw corruptStore("Strategy store schema version is unsupported.");
  }
  const generation = nonNegativeInteger(record.generation, "generation");
  const assetsRecord = exactRecord(record.assets, ["btc", "eth"]);
  const snapshot: LocalStrategyStoreSnapshot<TDraft> = {
    schemaVersion: LOCAL_STRATEGY_STORE_SCHEMA_VERSION,
    generation,
    assets: {
      btc: parseAssetState(assetsRecord.btc, "btc", parseDraft),
      eth: parseAssetState(assetsRecord.eth, "eth", parseDraft),
    },
  };
  return cloneJson(snapshot);
}

function parseAssetState<TDraft>(
  value: unknown,
  asset: Asset,
  parseDraft: (input: unknown) => TDraft,
): LocalStrategyAssetState<TDraft> {
  const record = exactRecord(value, [
    "workingDraft",
    "reviewCandidate",
    "publicationRecords",
  ]);
  const workingDraft =
    record.workingDraft === null
      ? null
      : parseWorkingDraft(record.workingDraft, parseDraft);
  const reviewCandidate =
    record.reviewCandidate === null
      ? null
      : parseReviewCandidate(record.reviewCandidate, asset);
  if (
    reviewCandidate !== null &&
    (workingDraft === null ||
      workingDraft.editVersion !== reviewCandidate.editVersion)
  ) {
    throw corruptStore("Frozen candidate does not match its working draft.");
  }
  return {
    workingDraft,
    reviewCandidate,
    publicationRecords: parsePublicationRecords(record.publicationRecords, asset),
  };
}

function parseWorkingDraft<TDraft>(
  value: unknown,
  parseDraft: (input: unknown) => TDraft,
): LocalStrategyWorkingDraft<TDraft> {
  const record = exactRecord(value, [
    "editVersion",
    "value",
    "updatedAt",
    "reviewFeedback",
  ]);
  return {
    editVersion: positiveInteger(record.editVersion, "editVersion"),
    value: parseAndCloneDraft(record.value, parseDraft),
    updatedAt: timestamp(record.updatedAt, "updatedAt"),
    reviewFeedback:
      record.reviewFeedback === null
        ? null
        : parseReviewFeedback(record.reviewFeedback),
  };
}

function parseReviewFeedback(value: unknown): LocalStrategyReviewFeedback {
  const record = exactRecord(value, ["reason", "returnedBy", "returnedAt"]);
  return {
    reason: boundedText(record.reason, "reviewFeedback.reason", 500),
    returnedBy: boundedText(
      record.returnedBy,
      "reviewFeedback.returnedBy",
      80,
    ),
    returnedAt: timestamp(record.returnedAt, "reviewFeedback.returnedAt"),
  };
}

function parseReviewCandidate(
  value: unknown,
  asset: Asset,
): LocalStrategyReviewCandidate {
  const record = exactRecord(value, ["editVersion", "strategy", "frozenAt"]);
  const strategy = parseTradeStrategy(record.strategy);
  if (strategy.asset !== asset || strategy.storedStatus !== "in_review") {
    throw corruptStore("Frozen review candidate has an invalid asset or status.");
  }
  return {
    editVersion: positiveInteger(record.editVersion, "editVersion"),
    strategy,
    frozenAt: timestamp(record.frozenAt, "frozenAt"),
  };
}

function parsePublicationRecords(
  value: unknown,
  asset: Asset,
): readonly LocalStrategyPublicationRecord[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_PUBLICATION_RECORDS_PER_ASSET
  ) {
    throw corruptStore("Publication history is invalid or too large.");
  }
  const identities = new Set<string>();
  const withdrawnIdentities = new Set<string>();
  return value.map((entry, index) => {
    const record = exactRecordByKind(entry);
    const sequence = positiveInteger(record.sequence, "sequence");
    if (sequence !== index + 1) {
      throw corruptStore("Publication sequence must be contiguous.");
    }
    if (record.kind === "publication") {
      const strategy = parseTradeStrategy(record.strategy);
      if (strategy.asset !== asset || strategy.storedStatus !== "published") {
        throw corruptStore("Publication has an invalid asset or status.");
      }
      const identity = strategyIdentity(strategy);
      if (identities.has(identity)) {
        throw corruptStore("Immutable strategy revisions must be unique.");
      }
      identities.add(identity);
      return { kind: "publication", sequence, strategy };
    }
    const strategyId = storedStrategyId(record.strategyId);
    const revision = positiveInteger(record.revision, "revision");
    const identity = `${strategyId}:${revision}`;
    if (!identities.has(identity)) {
      throw corruptStore("Withdrawal must target an existing publication.");
    }
    if (withdrawnIdentities.has(identity)) {
      throw corruptStore("A strategy revision cannot be withdrawn twice.");
    }
    withdrawnIdentities.add(identity);
    return {
      kind: "withdrawal",
      sequence,
      strategyId,
      revision,
      withdrawnAt: timestamp(record.withdrawnAt, "withdrawnAt"),
      withdrawnBy: boundedText(record.withdrawnBy, "withdrawnBy", 80),
      reason: boundedText(record.reason, "reason", 500),
    };
  });
}

function exactRecordByKind(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw corruptStore("Publication record must be an object.");
  }
  const kind = (value as Record<string, unknown>).kind;
  if (kind === "publication") {
    return exactRecord(value, ["kind", "sequence", "strategy"]);
  }
  if (kind === "withdrawal") {
    return exactRecord(value, [
      "kind",
      "sequence",
      "strategyId",
      "revision",
      "withdrawnAt",
      "withdrawnBy",
      "reason",
    ]);
  }
  throw corruptStore("Publication record kind is invalid.");
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw corruptStore("Strategy store structure is invalid.");
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw corruptStore("Strategy store contains unknown or missing fields.");
  }
  return record;
}

function collectWithdrawnIdentities(
  records: readonly LocalStrategyPublicationRecord[],
): ReadonlySet<string> {
  return new Set(
    records
      .filter(
        (record): record is Extract<
          LocalStrategyPublicationRecord,
          { kind: "withdrawal" }
        > => record.kind === "withdrawal",
      )
      .map((record) => `${record.strategyId}:${record.revision}`),
  );
}

function strategyIdentity(strategy: TradeStrategy): string {
  return `${strategy.id}:${strategy.revision}`;
}

function hasPublicationIdentity(
  records: readonly LocalStrategyPublicationRecord[],
  strategy: TradeStrategy,
): boolean {
  return records.some(
    (record) =>
      record.kind === "publication" &&
      record.strategy.id === strategy.id &&
      record.strategy.revision === strategy.revision,
  );
}

function windowsOverlap(left: TradeStrategy, right: TradeStrategy): boolean {
  const leftStart = Date.parse(left.validFrom ?? "");
  const leftEnd = Date.parse(left.validUntil ?? "");
  const rightStart = Date.parse(right.validFrom ?? "");
  const rightEnd = Date.parse(right.validUntil ?? "");
  return leftStart < rightEnd && rightStart < leftEnd;
}

function sameFrozenEditorialContent(
  frozen: TradeStrategy,
  published: TradeStrategy,
): boolean {
  const project = (strategy: TradeStrategy) => ({
    schemaVersion: strategy.schemaVersion,
    id: strategy.id,
    revision: strategy.revision,
    asset: strategy.asset,
    bias: strategy.bias,
    headline: strategy.headline,
    summary: strategy.summary,
    timeframes: strategy.timeframes,
    priceZones: strategy.priceZones,
    confirmationConditions: strategy.confirmationConditions,
    invalidationConditions: strategy.invalidationConditions,
    watchItems: strategy.watchItems,
    riskDisclosure: strategy.riskDisclosure,
    author: strategy.author,
    sources: strategy.sources,
    createdAt: strategy.createdAt,
    validFrom: strategy.validFrom,
    validUntil: strategy.validUntil,
  });
  return JSON.stringify(project(frozen)) === JSON.stringify(project(published));
}

function parseAndCloneDraft<TDraft>(
  value: unknown,
  parseDraft: (input: unknown) => TDraft,
): TDraft {
  try {
    const parsed = parseDraft(cloneJson(assertJsonValue(value)));
    return cloneJson(assertJsonValue(parsed)) as TDraft;
  } catch (error) {
    if (error instanceof LocalStrategyStoreError) throw error;
    throw corruptStore("Working draft failed schema validation.", error);
  }
}

function assertJsonValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_JSON_DEPTH) {
    throw corruptStore("Stored JSON exceeds the maximum nesting depth.");
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw corruptStore("Numbers must be finite.");
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => assertJsonValue(entry, depth + 1));
    return value;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw corruptStore("Unsafe JSON property name.");
      }
      assertJsonValue(entry, depth + 1);
    }
    return value;
  }
  throw corruptStore("Only JSON-compatible draft values can be stored.");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function decodeBase64Url(
  value: string,
  expectedBytes: number | undefined,
  field: string,
): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw corruptStore(`Envelope ${field} is not canonical base64url.`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.toString("base64url") !== value ||
    (expectedBytes !== undefined && decoded.byteLength !== expectedBytes)
  ) {
    throw corruptStore(`Envelope ${field} has an invalid length.`);
  }
  return decoded;
}

function timestampFromClock(clock: () => number): string {
  const value = clock();
  if (!Number.isFinite(value)) throw invalidConfiguration("clock returned invalid time.");
  return new Date(value).toISOString();
}

function timestamp(value: unknown, field: string): string {
  const result = boundedText(value, field, 40);
  const match = UTC_TIMESTAMP.exec(result);
  if (match === null || !Number.isFinite(Date.parse(result))) {
    throw corruptStore(`${field} must be a UTC timestamp.`);
  }
  const canonical = new Date(result).toISOString();
  if (Date.parse(canonical) !== Date.parse(result)) {
    throw corruptStore(`${field} is not a real UTC timestamp.`);
  }
  return result;
}

function boundedText(value: unknown, field: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw corruptStore(`${field} is invalid.`);
  }
  return value;
}

function mutationText(value: unknown, field: string, maximum: number): string {
  try {
    return boundedText(value, field, maximum);
  } catch {
    throw invalidConfiguration(
      `${field} must be trimmed text up to ${maximum} characters.`,
    );
  }
}

function storedStrategyId(value: unknown): string {
  const result = boundedText(value, "strategyId", 80);
  if (!STRATEGY_ID.test(result)) {
    throw corruptStore("strategyId must be a kebab-case identifier.");
  }
  return result;
}

function mutationStrategyId(value: unknown): string {
  try {
    return storedStrategyId(value);
  } catch {
    throw invalidConfiguration("strategyId must be a kebab-case identifier.");
  }
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw corruptStore(`${field} must be a non-negative safe integer.`);
  }
  return value as number;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw corruptStore(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalidConfiguration(`${field} must be a non-negative safe integer.`);
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw invalidConfiguration(`${field} must be a positive safe integer.`);
  }
}

function assertAsset(asset: unknown): asserts asset is Asset {
  if (!ASSETS.includes(asset as Asset)) {
    throw new LocalStrategyStoreError(
      "invalid_asset",
      "Only btc and eth strategy partitions are supported.",
    );
  }
}

function invalidConfiguration(message: string): LocalStrategyStoreError {
  return new LocalStrategyStoreError("invalid_configuration", message);
}

function corruptStore(message: string, cause?: unknown): LocalStrategyStoreError {
  return new LocalStrategyStoreError("corrupt_store", message, { cause });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function assertOwnedPrivatePath(
  stats: Readonly<{ uid: number; mode: number }>,
  label: string,
  expectedOwnerMode: number,
  code: "invalid_configuration" | "corrupt_store" = "corrupt_store",
): void {
  if (typeof process.getuid !== "function") return;
  const permissions = stats.mode & 0o777;
  if (
    stats.uid !== process.getuid() ||
    permissions !== expectedOwnerMode
  ) {
    throw new LocalStrategyStoreError(
      code,
      `${label} must be owned by the current user with mode ${expectedOwnerMode.toString(8)}.`,
    );
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
