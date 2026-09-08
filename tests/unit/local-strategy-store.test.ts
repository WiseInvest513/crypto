import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLocalStrategyStore,
  LOCAL_STRATEGY_STORE_FILENAME,
  LOCAL_STRATEGY_STORE_MARKER_FILENAME,
  LocalStrategyStoreError,
  resolveLocalStrategyDisclosure,
  type LocalStrategyPublicationRecord,
  type LocalStrategyStore,
} from "@/server/strategy/local-strategy-store";
import { parseTradeStrategy } from "@/lib/strategy/trade-strategy";
import { tradeStrategyFixture } from "../fixtures/trade-strategy";

const KEY = Buffer.alloc(32, 0x37);
const NOW = Date.parse("2026-09-06T12:00:00Z");
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixtureStore(clock = () => NOW): Promise<{
  root: string;
  store: LocalStrategyStore<unknown>;
}> {
  const root = await mkdtemp(join(tmpdir(), "wise-strategy-store-"));
  roots.push(root);
  return {
    root,
    store: createLocalStrategyStore({
      directory: root,
      encryptionKey: KEY,
      clock,
    }),
  };
}

function publication(
  revision = 3,
  validFrom = "2026-09-06T00:00:00Z",
  validUntil = "2026-09-07T00:00:00Z",
) {
  const value = tradeStrategyFixture();
  value.revision = revision;
  value.validFrom = validFrom;
  value.validUntil = validUntil;
  value.createdAt = "2026-09-05T00:00:00Z";
  value.reviewedAt = "2026-09-05T01:00:00Z";
  value.publishedAt = "2026-09-05T02:00:00Z";
  return value;
}

function reviewCandidate(value = publication()) {
  return {
    ...value,
    storedStatus: "in_review",
    reviewer: null,
    reviewedAt: null,
    publishedAt: null,
  };
}

async function stageAndPublish(
  store: LocalStrategyStore<unknown>,
  expectedGeneration: number,
  value: ReturnType<typeof publication>,
): Promise<number> {
  const saved = await store.saveWorkingDraft({
    asset: "btc",
    value: { headline: `draft-${value.revision}` },
    expectedGeneration,
    expectedEditVersion: null,
  });
  const frozen = await store.freezeReviewCandidate({
    asset: "btc",
    strategy: reviewCandidate(value),
    expectedGeneration: saved.generation,
    expectedEditVersion: saved.value.editVersion,
  });
  const published = await store.publishReviewCandidate({
    asset: "btc",
    strategy: value,
    expectedGeneration: frozen.generation,
    expectedEditVersion: frozen.value.editVersion,
  });
  return published.generation;
}

describe("local private strategy store", () => {
  it("persists only an authenticated encrypted envelope with mode 0600", async () => {
    const { root, store } = await fixtureStore();
    await store.saveWorkingDraft({
      asset: "btc",
      value: { headline: "DRAFT_SECRET_SENTINEL" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });

    const file = join(root, LOCAL_STRATEGY_STORE_FILENAME);
    const encoded = await readFile(file, "utf8");
    expect(encoded).not.toContain("DRAFT_SECRET_SENTINEL");
    expect(JSON.parse(encoded)).toMatchObject({
      format: "wise-crypto-private-strategy-store",
      version: 1,
      algorithm: "aes-256-gcm",
    });
    expect((await lstat(file)).mode & 0o777).toBe(0o600);
  });

  it("atomically replaces snapshots and leaves no lock or temporary file", async () => {
    const { root, store } = await fixtureStore();
    const first = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "first" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });
    const second = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "second" },
      expectedGeneration: first.generation,
      expectedEditVersion: first.value.editVersion,
    });

    await expect(store.readSnapshot()).resolves.toMatchObject({
      generation: 2,
      assets: {
        btc: {
          workingDraft: {
            editVersion: second.value.editVersion,
            value: { marker: "second" },
          },
        },
      },
    });
    expect((await readdir(root)).sort()).toEqual(
      [
        LOCAL_STRATEGY_STORE_FILENAME,
        LOCAL_STRATEGY_STORE_MARKER_FILENAME,
      ].sort(),
    );
  });

  it("does not silently recreate an initialized store whose snapshot disappeared", async () => {
    const { root, store } = await fixtureStore();
    const saved = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "initialized" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });
    await unlink(join(root, LOCAL_STRATEGY_STORE_FILENAME));

    await expect(store.readSnapshot()).rejects.toMatchObject({
      code: "corrupt_store",
    });
    await expect(store.resolvePublicDisclosure("btc", NOW)).resolves.toEqual({
      kind: "status",
      state: "unavailable",
    });
    await expect(
      store.saveWorkingDraft({
        asset: "btc",
        value: { marker: "must-not-reinitialize" },
        expectedGeneration: saved.generation,
        expectedEditVersion: saved.value.editVersion,
      }),
    ).rejects.toMatchObject({ code: "corrupt_store" });
    expect(await readdir(root)).toContain(
      LOCAL_STRATEGY_STORE_MARKER_FILENAME,
    );
  });

  it("enforces both global generation and per-draft editVersion locks", async () => {
    const { store } = await fixtureStore();
    const first = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "one" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });

    await expect(
      store.saveWorkingDraft({
        asset: "btc",
        value: { marker: "stale-generation" },
        expectedGeneration: 0,
        expectedEditVersion: first.value.editVersion,
      }),
    ).rejects.toMatchObject({ code: "stale_generation" });
    await expect(
      store.saveWorkingDraft({
        asset: "btc",
        value: { marker: "stale-edit" },
        expectedGeneration: first.generation,
        expectedEditVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "stale_edit_version" });
  });

  it("persists review feedback until the author saves a new edit", async () => {
    let now = NOW;
    const { root, store } = await fixtureStore(() => now);
    const saved = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "before-review" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });
    const frozen = await store.freezeReviewCandidate({
      asset: "btc",
      strategy: reviewCandidate(),
      expectedGeneration: saved.generation,
      expectedEditVersion: saved.value.editVersion,
    });
    now = Date.parse("2026-09-06T12:05:00Z");
    const returned = await store.returnReviewCandidate({
      asset: "btc",
      returnedBy: "Independent Reviewer",
      reason: "请补充失效条件的原始依据。",
      expectedGeneration: frozen.generation,
      expectedEditVersion: frozen.value.editVersion,
    });
    expect(returned.value.reviewFeedback).toEqual({
      reason: "请补充失效条件的原始依据。",
      returnedBy: "Independent Reviewer",
      returnedAt: "2026-09-06T12:05:00.000Z",
    });

    const reopened = createLocalStrategyStore({
      directory: root,
      encryptionKey: KEY,
    });
    await expect(reopened.readAsset("btc")).resolves.toMatchObject({
      reviewCandidate: null,
      workingDraft: { reviewFeedback: returned.value.reviewFeedback },
    });

    const resaved = await reopened.saveWorkingDraft({
      asset: "btc",
      value: { marker: "after-feedback" },
      expectedGeneration: returned.generation,
      expectedEditVersion: returned.value.editVersion,
    });
    expect(resaved.value.reviewFeedback).toBeNull();
  });

  it("rejects overlapping publication windows and pure reads fail closed", async () => {
    const { store } = await fixtureStore();
    const first = publication(
      3,
      "2026-09-06T00:00:00Z",
      "2026-09-08T00:00:00Z",
    );
    let generation = await stageAndPublish(store, 0, first);
    const overlapping = publication(
      4,
      "2026-09-07T00:00:00Z",
      "2026-09-09T00:00:00Z",
    );
    const saved = await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "overlap" },
      expectedGeneration: generation,
      expectedEditVersion: null,
    });
    const frozen = await store.freezeReviewCandidate({
      asset: "btc",
      strategy: reviewCandidate(overlapping),
      expectedGeneration: saved.generation,
      expectedEditVersion: saved.value.editVersion,
    });
    generation = frozen.generation;

    await expect(
      store.publishReviewCandidate({
        asset: "btc",
        strategy: overlapping,
        expectedGeneration: generation,
        expectedEditVersion: frozen.value.editVersion,
      }),
    ).rejects.toMatchObject({ code: "publication_overlap" });

    const conflictingRecords: LocalStrategyPublicationRecord[] = [
      { kind: "publication", sequence: 1, strategy: parseTradeStrategy(first) },
      {
        kind: "publication",
        sequence: 2,
        strategy: parseTradeStrategy(overlapping),
      },
    ];
    expect(
      resolveLocalStrategyDisclosure(
        conflictingRecords,
        "btc",
        Date.parse("2026-09-07T12:00:00Z"),
      ),
    ).toEqual({ kind: "status", state: "unavailable" });
  });

  it("uses a half-open active window", async () => {
    const { store } = await fixtureStore();
    await stageAndPublish(store, 0, publication());

    await expect(
      store.resolvePublicDisclosure(
        "btc",
        Date.parse("2026-09-06T00:00:00Z"),
      ),
    ).resolves.toMatchObject({ kind: "strategy" });
    await expect(
      store.resolvePublicDisclosure(
        "btc",
        Date.parse("2026-09-07T00:00:00Z"),
      ),
    ).resolves.toEqual({ kind: "status", state: "expired" });
  });

  it("keeps an active strategy visible when a future schedule is withdrawn", async () => {
    const { store } = await fixtureStore();
    let generation = await stageAndPublish(
      store,
      0,
      publication(
        3,
        "2026-09-06T00:00:00Z",
        "2026-09-07T00:00:00Z",
      ),
    );
    generation = await stageAndPublish(
      store,
      generation,
      publication(
        4,
        "2026-09-08T00:00:00Z",
        "2026-09-09T00:00:00Z",
      ),
    );

    const withdrawal = await store.withdrawLatestPublication({
      asset: "btc",
      strategyId: "btc-manual-plan",
      revision: 4,
      withdrawnBy: "Independent Reviewer",
      reason: "The future thesis is no longer current.",
      expectedGeneration: generation,
    });

    expect(withdrawal.value).toMatchObject({
      kind: "withdrawal",
      strategyId: "btc-manual-plan",
      revision: 4,
    });
    await expect(store.resolvePublicDisclosure("btc", NOW)).resolves.toMatchObject(
      {
        kind: "strategy",
        value: { revision: 3 },
      },
    );
  });

  it("targets withdrawal explicitly, rejects duplicates and never falls back to expired history", async () => {
    const { store } = await fixtureStore();
    let generation = await stageAndPublish(
      store,
      0,
      publication(
        2,
        "2026-09-05T03:00:00Z",
        "2026-09-06T00:00:00Z",
      ),
    );
    generation = await stageAndPublish(
      store,
      generation,
      publication(
        3,
        "2026-09-06T00:00:00Z",
        "2026-09-07T00:00:00Z",
      ),
    );
    const withdrawal = await store.withdrawLatestPublication({
      asset: "btc",
      strategyId: "btc-manual-plan",
      revision: 3,
      withdrawnBy: "Independent Reviewer",
      reason: "Source assumptions changed.",
      expectedGeneration: generation,
    });

    expect(withdrawal.value).toMatchObject({
      kind: "withdrawal",
      strategyId: "btc-manual-plan",
      revision: 3,
    });
    await expect(store.resolvePublicDisclosure("btc", NOW)).resolves.toEqual({
      kind: "status",
      state: "withdrawn",
    });

    await expect(
      store.withdrawLatestPublication({
        asset: "btc",
        strategyId: "btc-manual-plan",
        revision: 3,
        withdrawnBy: "Independent Reviewer",
        reason: "Duplicate attempt.",
        expectedGeneration: withdrawal.generation,
      }),
    ).rejects.toMatchObject({ code: "invalid_transition" });

    const replacement = publication(
      4,
      "2026-09-06T00:00:00Z",
      "2026-09-07T00:00:00Z",
    );
    await expect(
      stageAndPublish(store, withdrawal.generation, replacement),
    ).resolves.toBe(10);
  });

  it("fails closed when a withdrawal targets an unknown publication", () => {
    const published = parseTradeStrategy(publication());
    const records: LocalStrategyPublicationRecord[] = [
      { kind: "publication", sequence: 1, strategy: published },
      {
        kind: "withdrawal",
        sequence: 2,
        strategyId: "missing-strategy",
        revision: 99,
        withdrawnAt: "2026-09-06T12:00:00Z",
        withdrawnBy: "Independent Reviewer",
        reason: "Invalid target.",
      },
    ];

    expect(resolveLocalStrategyDisclosure(records, "btc", NOW)).toEqual({
      kind: "status",
      state: "unavailable",
    });
  });

  it("fails closed when ciphertext is damaged and never auto-resets the file", async () => {
    const { root, store } = await fixtureStore();
    await store.saveWorkingDraft({
      asset: "btc",
      value: { marker: "must-survive" },
      expectedGeneration: 0,
      expectedEditVersion: null,
    });
    const file = join(root, LOCAL_STRATEGY_STORE_FILENAME);
    const envelope = JSON.parse(await readFile(file, "utf8")) as {
      ciphertext: string;
    };
    const original = envelope.ciphertext;
    envelope.ciphertext = `${original[0] === "A" ? "B" : "A"}${original.slice(1)}`;
    await writeFile(file, JSON.stringify(envelope), { mode: 0o600 });

    await expect(store.resolvePublicDisclosure("btc", NOW)).resolves.toEqual({
      kind: "status",
      state: "unavailable",
    });
    await expect(store.readSnapshot()).rejects.toBeInstanceOf(
      LocalStrategyStoreError,
    );
    expect(await readFile(file, "utf8")).toContain(envelope.ciphertext);
  });

  it("recovers only a verifiably stale same-host lock with a dead owner", async () => {
    const { root } = await fixtureStore();
    const lock = join(root, ".strategy-store.lock");
    await mkdir(lock, { mode: 0o700 });
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({
        version: 1,
        pid: 2_147_483_647,
        hostname: hostname(),
        nonce: "00000000-0000-4000-8000-000000000000",
        createdAt: Date.now() - 60_000,
      }),
      { mode: 0o600 },
    );
    const store = createLocalStrategyStore({
      directory: root,
      encryptionKey: KEY,
      lockTimeoutMs: 200,
      staleLockMs: 10,
    });

    await expect(
      store.saveWorkingDraft({
        asset: "btc",
        value: { marker: "after-stale-lock" },
        expectedGeneration: 0,
        expectedEditVersion: null,
      }),
    ).resolves.toMatchObject({ generation: 1 });
    expect(await readdir(root)).not.toContain(".strategy-store.lock");
  });

  it("rejects an existing store directory with group or world permissions", async () => {
    if (typeof process.getuid !== "function") return;
    const { root, store } = await fixtureStore();
    await chmod(root, 0o755);

    await expect(store.readSnapshot()).rejects.toMatchObject({
      code: "invalid_configuration",
    });
  });

  it("times out on a held directory lock and rejects path-like asset input", async () => {
    const { root } = await fixtureStore();
    const store = createLocalStrategyStore({
      directory: root,
      encryptionKey: KEY,
      lockTimeoutMs: 5,
    });
    await mkdir(join(root, ".strategy-store.lock"));
    await expect(
      store.saveWorkingDraft({
        asset: "btc",
        value: {},
        expectedGeneration: 0,
        expectedEditVersion: null,
      }),
    ).rejects.toMatchObject({ code: "lock_timeout" });
    await expect(
      store.readAsset("../eth" as "eth"),
    ).rejects.toMatchObject({ code: "invalid_asset" });
  });
});
