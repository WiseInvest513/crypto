import { createHash } from "node:crypto";

import type {
  Asset,
  CandleSymbol,
} from "@/server/data/contracts/market-data";
import {
  assertLongTermHistoricalBaseline,
  type LongTermHistoricalBaseline,
  type LongTermHistoricalBaselineInterval,
} from "./historical-baseline";
import { chartIntervalMilliseconds } from "./live-chart";

export const HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION =
  "wise-crypto-historical-baseline-artifact-v5" as const;
export const HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION =
  "wise-crypto-historical-baseline-manifest-v5" as const;
export const HISTORICAL_BASELINE_DATASET_VERSION_PATTERN =
  /^[a-f0-9]{64}$/;

export const HISTORICAL_BASELINE_SCOPE = Object.freeze({
  provider: "binance-public-data",
  venue: "Binance",
  market: "spot",
  quoteCurrency: "USDT",
  timezone: "UTC",
} as const);

export const HISTORICAL_BASELINE_ASSETS = ["btc", "eth"] as const;
export const HISTORICAL_BASELINE_INTERVALS = ["1h", "4h", "1d"] as const;

export type HistoricalBaselineArtifactScope =
  typeof HISTORICAL_BASELINE_SCOPE;

export type HistoricalBaselineArtifactEntry = Readonly<{
  asset: Asset;
  symbol: CandleSymbol;
  interval: LongTermHistoricalBaselineInterval;
  /** SHA-256 version of the verified archive used for this event stream. */
  eventDatasetVersion: string;
  /** SHA-256 version of the asset's verified 1d archive used for regimes. */
  dailyDatasetVersion: string;
  baseline: LongTermHistoricalBaseline;
}>;

export type HistoricalBaselineRuntimeArtifact = Readonly<{
  schemaVersion: typeof HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION;
  kind: "historical-baseline-runtime";
  scope: HistoricalBaselineArtifactScope;
  generatedAt: string;
  fromMonth: string;
  toMonth: string;
  /** SHA-256 of the canonical data-and-algorithm payload, excluding generatedAt. */
  datasetVersion: string;
  baselines: readonly HistoricalBaselineArtifactEntry[];
}>;

/**
 * A checked-in, fail-closed document used before the explicit offline build has
 * published real verified statistics. It contains no market value or sample.
 */
export type HistoricalBaselineUnavailableArtifact = Readonly<{
  schemaVersion: typeof HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION;
  kind: "historical-baseline-unavailable";
  reason: "offline_build_required";
}>;

export type HistoricalBaselineArtifactDocument =
  | HistoricalBaselineRuntimeArtifact
  | HistoricalBaselineUnavailableArtifact;

export type HistoricalBaselineManifestSourceFile = Readonly<{
  month: string;
  url: string;
  checksumUrl: string;
  sha256: string;
  sourceRowCount: number;
  acceptedCandleCount: number;
  excludedUnalignedCandleCount: number;
  excludedLegacyZeroVolumePlaceholderCount: number;
  legacyMillisecondCloseTimeNormalizationCount: number;
  firstOpenedAt: string;
  lastClosedAt: string;
}>;

/** Exact source discontinuity retained only by the offline audit manifest. */
export type HistoricalBaselineManifestGap = Readonly<{
  previousClosedAt: string;
  nextOpenedAt: string;
  missingCandleCount: number;
}>;

export type HistoricalBaselineManifestStream = Readonly<{
  asset: Asset;
  symbol: CandleSymbol;
  interval: LongTermHistoricalBaselineInterval;
  eventDatasetVersion: string;
  dailyDatasetVersion: string;
  coverage: Readonly<{
    fromMonth: string;
    toMonth: string;
    firstOpenedAt: string;
    lastClosedAt: string;
    sourceRowCount: number;
    closedCandleCount: number;
    excludedUnalignedCandleCount: number;
    excludedLegacyZeroVolumePlaceholderCount: number;
    gapCount: number;
    missingCandleCount: number;
    segmentCount: number;
    legacyMillisecondCloseTimeNormalizationCount: number;
  }>;
  sourceFiles: readonly HistoricalBaselineManifestSourceFile[];
  gaps: readonly HistoricalBaselineManifestGap[];
}>;

export type HistoricalBaselineBuildManifest = Readonly<{
  schemaVersion: typeof HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION;
  kind: "historical-baseline-audit";
  scope: HistoricalBaselineArtifactScope;
  generatedAt: string;
  fromMonth: string;
  toMonth: string;
  datasetVersion: string;
  artifact: Readonly<{
    file: "src/server/data/generated/historical-baselines.json";
    sha256: string;
    bytes: number;
  }>;
  streams: readonly HistoricalBaselineManifestStream[];
}>;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const EXPECTED_ENTRY_KEYS = [
  "asset",
  "baseline",
  "dailyDatasetVersion",
  "eventDatasetVersion",
  "interval",
  "symbol",
] as const;
const EXPECTED_RUNTIME_KEYS = [
  "baselines",
  "datasetVersion",
  "fromMonth",
  "generatedAt",
  "kind",
  "schemaVersion",
  "scope",
  "toMonth",
] as const;

export function parseHistoricalBaselineArtifactDocument(
  value: unknown,
): HistoricalBaselineArtifactDocument {
  if (
    isRecord(value) &&
    value.kind === "historical-baseline-unavailable"
  ) {
    assertExactKeys(value, ["kind", "reason", "schemaVersion"]);
    if (
      value.schemaVersion !== HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION ||
      value.reason !== "offline_build_required"
    ) {
      throw new TypeError("Invalid unavailable historical baseline artifact.");
    }
    return value as HistoricalBaselineUnavailableArtifact;
  }
  assertHistoricalBaselineRuntimeArtifact(value);
  return value;
}

export function parseHistoricalBaselineRuntimeArtifact(
  value: unknown,
): HistoricalBaselineRuntimeArtifact | null {
  const document = parseHistoricalBaselineArtifactDocument(value);
  return document.kind === "historical-baseline-runtime" ? document : null;
}

export function assertHistoricalBaselineRuntimeArtifact(
  value: unknown,
): asserts value is HistoricalBaselineRuntimeArtifact {
  assertJsonSafe(value);
  if (!isRecord(value)) {
    throw new TypeError("Invalid historical baseline runtime artifact.");
  }
  assertExactKeys(value, EXPECTED_RUNTIME_KEYS);
  if (
    value.schemaVersion !== HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION ||
    value.kind !== "historical-baseline-runtime" ||
    !isCanonicalTimestamp(value.generatedAt) ||
    !isMonth(value.fromMonth) ||
    !isMonth(value.toMonth) ||
    value.fromMonth > value.toMonth ||
    !isDatasetVersion(value.datasetVersion) ||
    !Array.isArray(value.baselines)
  ) {
    throw new TypeError("Invalid historical baseline runtime artifact.");
  }
  assertHistoricalBaselineScope(value.scope);
  assertCompleteEntrySet(
    value.baselines,
    value.fromMonth,
    value.toMonth,
    value.generatedAt,
  );
  assertNoRawHistoryPayload(value);
  const expectedDatasetVersion = createHash("sha256")
    .update(
      canonicalHistoricalBaselineJson({
        schemaVersion: value.schemaVersion,
        kind: value.kind,
        scope: value.scope,
        fromMonth: value.fromMonth,
        toMonth: value.toMonth,
        baselines: value.baselines,
      }),
    )
    .digest("hex");
  if (value.datasetVersion !== expectedDatasetVersion) {
    throw new TypeError(
      "Historical baseline datasetVersion does not match its canonical payload.",
    );
  }
}

export function assertHistoricalBaselineBuildManifest(
  value: unknown,
  expected?: Readonly<{
    artifactSha256: string;
    datasetVersion: string;
  }>,
): asserts value is HistoricalBaselineBuildManifest {
  assertJsonSafe(value);
  if (!isRecord(value)) {
    throw new TypeError("Invalid historical baseline build manifest.");
  }
  assertExactKeys(value, [
    "artifact",
    "datasetVersion",
    "fromMonth",
    "generatedAt",
    "kind",
    "schemaVersion",
    "scope",
    "streams",
    "toMonth",
  ]);
  if (
    value.schemaVersion !== HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION ||
    value.kind !== "historical-baseline-audit" ||
    !isCanonicalTimestamp(value.generatedAt) ||
    !isMonth(value.fromMonth) ||
    !isMonth(value.toMonth) ||
    value.fromMonth > value.toMonth ||
    !isDatasetVersion(value.datasetVersion) ||
    !isRecord(value.artifact) ||
    !Array.isArray(value.streams)
  ) {
    throw new TypeError("Invalid historical baseline build manifest.");
  }
  assertHistoricalBaselineScope(value.scope);
  assertExactKeys(value.artifact, ["bytes", "file", "sha256"]);
  if (
    value.artifact.file !==
      "src/server/data/generated/historical-baselines.json" ||
    !isDatasetVersion(value.artifact.sha256) ||
    typeof value.artifact.bytes !== "number" ||
    !Number.isSafeInteger(value.artifact.bytes) ||
    value.artifact.bytes <= 0
  ) {
    throw new TypeError("Invalid historical baseline manifest artifact.");
  }
  if (
    expected &&
    (value.artifact.sha256 !== expected.artifactSha256 ||
      value.datasetVersion !== expected.datasetVersion)
  ) {
    throw new TypeError("Historical baseline manifest does not match its artifact.");
  }
  assertCompleteManifestStreamSet(
    value.streams,
    value.fromMonth,
    value.toMonth,
  );
}

export function findHistoricalBaseline(
  artifact: HistoricalBaselineRuntimeArtifact,
  asset: Asset,
  interval: LongTermHistoricalBaselineInterval,
): HistoricalBaselineArtifactEntry {
  const entry = artifact.baselines.find(
    (candidate) =>
      candidate.asset === asset && candidate.interval === interval,
  );
  if (!entry) {
    throw new TypeError(`Missing ${asset} ${interval} historical baseline.`);
  }
  return entry;
}

function assertCompleteEntrySet(
  values: readonly unknown[],
  fromMonth: string,
  toMonth: string,
  generatedAt: string,
): asserts values is readonly HistoricalBaselineArtifactEntry[] {
  const expectedKeys = expectedStreamKeys();
  if (values.length !== expectedKeys.length) {
    throw new TypeError("Historical baseline artifact must contain all six streams.");
  }
  const dailySources = new Map<Asset, string>();
  const dailyRegimePayloads = new Map<Asset, string>();

  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      throw new TypeError("Invalid historical baseline artifact entry.");
    }
    assertExactKeys(value, EXPECTED_ENTRY_KEYS);
    const expected = expectedKeys[index];
    if (
      value.asset !== expected.asset ||
      value.symbol !== expected.symbol ||
      value.interval !== expected.interval ||
      !isDatasetVersion(value.eventDatasetVersion) ||
      !isDatasetVersion(value.dailyDatasetVersion)
    ) {
      throw new TypeError("Historical baseline entries must be complete and sorted.");
    }
    assertExactRuntimeBaselineShape(value.baseline);
    assertLongTermHistoricalBaseline(value.baseline);
    const baseline = value.baseline as LongTermHistoricalBaseline;
    const generatedAtMs = Date.parse(generatedAt);
    if (
      baseline.asset !== value.asset ||
      baseline.symbol !== value.symbol ||
      baseline.interval !== value.interval ||
      baseline.quoteCurrency !== HISTORICAL_BASELINE_SCOPE.quoteCurrency ||
      monthOf(baseline.source.fromOpenedAt) !== fromMonth ||
      monthOf(baseline.source.toClosedAt) !== toMonth ||
      monthOf(baseline.dailyRegimeSource.fromOpenedAt) !== fromMonth ||
      monthOf(baseline.dailyRegimeSource.toClosedAt) !== toMonth ||
      Date.parse(baseline.source.toClosedAt) > generatedAtMs ||
      Date.parse(baseline.dailyRegimeSource.toClosedAt) > generatedAtMs ||
      (value.interval === "1d" &&
        value.eventDatasetVersion !== value.dailyDatasetVersion)
    ) {
      throw new TypeError("Historical baseline entry scope is inconsistent.");
    }
    const priorDailyVersion = dailySources.get(value.asset as Asset);
    if (
      priorDailyVersion !== undefined &&
      priorDailyVersion !== value.dailyDatasetVersion
    ) {
      throw new TypeError("An asset cannot mix daily regime dataset versions.");
    }
    dailySources.set(value.asset as Asset, value.dailyDatasetVersion as string);
    const dailyPayload = canonicalJson(baseline.dailyRegimeSource);
    const priorDailyPayload = dailyRegimePayloads.get(value.asset as Asset);
    if (priorDailyPayload !== undefined && priorDailyPayload !== dailyPayload) {
      throw new TypeError("An asset cannot mix daily regime source summaries.");
    }
    dailyRegimePayloads.set(value.asset as Asset, dailyPayload);
  }
}

function assertCompleteManifestStreamSet(
  values: readonly unknown[],
  fromMonth: string,
  toMonth: string,
): asserts values is readonly HistoricalBaselineManifestStream[] {
  const expectedKeys = expectedStreamKeys();
  if (values.length !== expectedKeys.length) {
    throw new TypeError("Historical baseline manifest must contain all six streams.");
  }
  const dailyVersions = new Map<Asset, string>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      throw new TypeError("Invalid historical baseline manifest stream.");
    }
    assertExactKeys(value, [
      "asset",
      "coverage",
      "dailyDatasetVersion",
      "eventDatasetVersion",
      "gaps",
      "interval",
      "sourceFiles",
      "symbol",
    ]);
    const expected = expectedKeys[index];
    if (
      value.asset !== expected.asset ||
      value.symbol !== expected.symbol ||
      value.interval !== expected.interval ||
      !isDatasetVersion(value.eventDatasetVersion) ||
      !isDatasetVersion(value.dailyDatasetVersion) ||
      !isRecord(value.coverage) ||
      !Array.isArray(value.sourceFiles) ||
      !Array.isArray(value.gaps)
    ) {
      throw new TypeError("Historical baseline manifest streams must be complete and sorted.");
    }
    const priorDailyVersion = dailyVersions.get(value.asset as Asset);
    if (
      priorDailyVersion !== undefined &&
      priorDailyVersion !== value.dailyDatasetVersion
    ) {
      throw new TypeError("Manifest streams cannot mix daily dataset versions.");
    }
    dailyVersions.set(value.asset as Asset, value.dailyDatasetVersion as string);
    if (
      value.interval === "1d" &&
      value.eventDatasetVersion !== value.dailyDatasetVersion
    ) {
      throw new TypeError("The 1d event and daily dataset versions must match.");
    }
    assertManifestCoverageAndSources(
      value.coverage,
      value.sourceFiles,
      value.gaps,
      expected,
      fromMonth,
      toMonth,
    );
  }
}

function assertManifestCoverageAndSources(
  coverage: Record<string, unknown>,
  sourceFiles: readonly unknown[],
  gaps: readonly unknown[],
  stream: ReturnType<typeof expectedStreamKeys>[number],
  fromMonth: string,
  toMonth: string,
): void {
  assertExactKeys(coverage, [
    "closedCandleCount",
    "excludedLegacyZeroVolumePlaceholderCount",
    "excludedUnalignedCandleCount",
    "firstOpenedAt",
    "fromMonth",
    "gapCount",
    "lastClosedAt",
    "legacyMillisecondCloseTimeNormalizationCount",
    "missingCandleCount",
    "segmentCount",
    "sourceRowCount",
    "toMonth",
  ]);
  if (
    coverage.fromMonth !== fromMonth ||
    coverage.toMonth !== toMonth ||
    !isCanonicalTimestamp(coverage.firstOpenedAt) ||
    !isCanonicalTimestamp(coverage.lastClosedAt) ||
    typeof coverage.closedCandleCount !== "number" ||
    !Number.isSafeInteger(coverage.closedCandleCount) ||
    coverage.closedCandleCount <= 0 ||
    !isPositiveSafeInteger(coverage.sourceRowCount) ||
    !isNonNegativeSafeInteger(coverage.excludedUnalignedCandleCount) ||
    !isNonNegativeSafeInteger(
      coverage.excludedLegacyZeroVolumePlaceholderCount,
    ) ||
    coverage.sourceRowCount !==
      coverage.closedCandleCount +
        coverage.excludedUnalignedCandleCount +
        coverage.excludedLegacyZeroVolumePlaceholderCount ||
    !isNonNegativeSafeInteger(coverage.gapCount) ||
    !isNonNegativeSafeInteger(coverage.missingCandleCount) ||
    !isPositiveSafeInteger(coverage.segmentCount) ||
    typeof coverage.legacyMillisecondCloseTimeNormalizationCount !==
      "number" ||
    !Number.isSafeInteger(
      coverage.legacyMillisecondCloseTimeNormalizationCount,
    ) ||
    coverage.legacyMillisecondCloseTimeNormalizationCount < 0
  ) {
    throw new TypeError("Invalid historical baseline manifest coverage.");
  }
  const months = enumerateMonths(fromMonth, toMonth);
  if (sourceFiles.length !== months.length) {
    throw new TypeError("Manifest must retain one source record per requested month.");
  }
  const duration = chartIntervalMilliseconds[stream.interval];
  const validatedGaps = gaps.map((gap, index) => {
    if (!isRecord(gap)) {
      throw new TypeError("Invalid historical baseline gap record.");
    }
    assertExactKeys(gap, [
      "missingCandleCount",
      "nextOpenedAt",
      "previousClosedAt",
    ]);
    if (
      !isCanonicalTimestamp(gap.previousClosedAt) ||
      !isCanonicalTimestamp(gap.nextOpenedAt) ||
      !isPositiveSafeInteger(gap.missingCandleCount)
    ) {
      throw new TypeError("Invalid historical baseline gap record.");
    }
    const previousClosedMs = Date.parse(gap.previousClosedAt);
    const nextOpenedMs = Date.parse(gap.nextOpenedAt);
    const missingDuration = nextOpenedMs - (previousClosedMs + 1);
    const prior = index === 0 ? null : gaps[index - 1];
    if (
      (previousClosedMs + 1) % duration !== 0 ||
      nextOpenedMs % duration !== 0 ||
      missingDuration <= 0 ||
      missingDuration % duration !== 0 ||
      gap.missingCandleCount !== missingDuration / duration ||
      (isRecord(prior) &&
        isCanonicalTimestamp(prior.nextOpenedAt) &&
        previousClosedMs <= Date.parse(prior.nextOpenedAt))
    ) {
      throw new TypeError("Historical baseline gaps must be aligned and sorted.");
    }
    return {
      previousClosedMs,
      nextOpenedMs,
      missingCandleCount: gap.missingCandleCount,
    };
  });
  if (
    stream.interval === "1d" &&
    (validatedGaps.length > 0 ||
      coverage.excludedUnalignedCandleCount !== 0 ||
      coverage.excludedLegacyZeroVolumePlaceholderCount !== 0)
  ) {
    throw new TypeError(
      "Daily regime archives cannot contain gaps or unaligned exclusions.",
    );
  }
  const totalMissingCandles = validatedGaps.reduce(
    (total, gap) => total + gap.missingCandleCount,
    0,
  );
  if (
    coverage.gapCount !== validatedGaps.length ||
    coverage.missingCandleCount !== totalMissingCandles ||
    coverage.segmentCount !== validatedGaps.length + 1
  ) {
    throw new TypeError("Historical baseline gap coverage does not match its audit records.");
  }

  let totalSourceRows = 0;
  let totalAcceptedCandles = 0;
  let totalExcludedUnalignedCandles = 0;
  let totalExcludedLegacyZeroVolumePlaceholders = 0;
  let totalLegacyBoundaryNormalizations = 0;
  let firstOpenedAt: string | null = null;
  let previousLastMs: number | null = null;
  let lastClosedAt: string | null = null;
  const accountedGapIndexes = new Set<number>();
  for (const [index, source] of sourceFiles.entries()) {
    if (!isRecord(source)) {
      throw new TypeError("Invalid historical baseline source record.");
    }
    assertExactKeys(source, [
      "checksumUrl",
      "acceptedCandleCount",
      "excludedLegacyZeroVolumePlaceholderCount",
      "excludedUnalignedCandleCount",
      "firstOpenedAt",
      "lastClosedAt",
      "legacyMillisecondCloseTimeNormalizationCount",
      "month",
      "sha256",
      "sourceRowCount",
      "url",
    ]);
    const month = months[index];
    const expectedUrl =
      `https://data.binance.vision/data/spot/monthly/klines/` +
      `${stream.symbol}/${stream.interval}/` +
      `${stream.symbol}-${stream.interval}-${month}.zip`;
    if (
      source.month !== month ||
      source.url !== expectedUrl ||
      source.checksumUrl !== `${expectedUrl}.CHECKSUM` ||
      !isDatasetVersion(source.sha256) ||
      !isPositiveSafeInteger(source.sourceRowCount) ||
      !isPositiveSafeInteger(source.acceptedCandleCount) ||
      !isNonNegativeSafeInteger(source.excludedUnalignedCandleCount) ||
      !isNonNegativeSafeInteger(
        source.excludedLegacyZeroVolumePlaceholderCount,
      ) ||
      source.sourceRowCount !==
        source.acceptedCandleCount +
          source.excludedUnalignedCandleCount +
          source.excludedLegacyZeroVolumePlaceholderCount ||
      typeof source.legacyMillisecondCloseTimeNormalizationCount !==
        "number" ||
      !Number.isSafeInteger(
        source.legacyMillisecondCloseTimeNormalizationCount,
      ) ||
      source.legacyMillisecondCloseTimeNormalizationCount < 0 ||
      source.legacyMillisecondCloseTimeNormalizationCount >
        source.acceptedCandleCount ||
      !isCanonicalTimestamp(source.firstOpenedAt) ||
      !isCanonicalTimestamp(source.lastClosedAt)
    ) {
      throw new TypeError("Invalid historical baseline source record.");
    }
    const sourceFirst = Date.parse(source.firstOpenedAt as string);
    const sourceLast = Date.parse(source.lastClosedAt as string);
    const internalGapIndexes = validatedGaps.flatMap((gap, gapIndex) =>
      gap.previousClosedMs >= sourceFirst && gap.nextOpenedMs <= sourceLast
        ? [gapIndex]
        : [],
    );
    const internalMissingCandles = internalGapIndexes.reduce(
      (total, gapIndex) =>
        total + validatedGaps[gapIndex].missingCandleCount,
      0,
    );
    internalGapIndexes.forEach((gapIndex) => accountedGapIndexes.add(gapIndex));
    if (
      monthOf(source.firstOpenedAt as string) !== month ||
      sourceFirst % duration !== 0 ||
      (sourceLast + 1) % duration !== 0 ||
      sourceLast - sourceFirst !==
        ((source.acceptedCandleCount as number) +
          internalMissingCandles) *
          duration -
          1
    ) {
      throw new TypeError("Historical baseline source coverage is not auditable.");
    }
    if (previousLastMs !== null && sourceFirst !== previousLastMs + 1) {
      const boundaryGapIndex = validatedGaps.findIndex(
        (gap) =>
          gap.previousClosedMs === previousLastMs &&
          gap.nextOpenedMs === sourceFirst,
      );
      if (boundaryGapIndex < 0) {
        throw new TypeError("Historical baseline source boundary gap is not audited.");
      }
      accountedGapIndexes.add(boundaryGapIndex);
    }
    firstOpenedAt ??= source.firstOpenedAt as string;
    previousLastMs = sourceLast;
    lastClosedAt = source.lastClosedAt as string;
    totalSourceRows += source.sourceRowCount as number;
    totalAcceptedCandles += source.acceptedCandleCount as number;
    totalExcludedUnalignedCandles +=
      source.excludedUnalignedCandleCount as number;
    totalExcludedLegacyZeroVolumePlaceholders +=
      source.excludedLegacyZeroVolumePlaceholderCount as number;
    totalLegacyBoundaryNormalizations +=
      source.legacyMillisecondCloseTimeNormalizationCount as number;
  }
  if (
    coverage.sourceRowCount !== totalSourceRows ||
    coverage.closedCandleCount !== totalAcceptedCandles ||
    coverage.excludedUnalignedCandleCount !==
      totalExcludedUnalignedCandles ||
    coverage.excludedLegacyZeroVolumePlaceholderCount !==
      totalExcludedLegacyZeroVolumePlaceholders ||
    accountedGapIndexes.size !== validatedGaps.length ||
    coverage.legacyMillisecondCloseTimeNormalizationCount !==
      totalLegacyBoundaryNormalizations ||
    coverage.firstOpenedAt !== firstOpenedAt ||
    coverage.lastClosedAt !== lastClosedAt ||
    (firstOpenedAt !== null &&
      lastClosedAt !== null &&
      Date.parse(lastClosedAt) - Date.parse(firstOpenedAt) !==
        (totalAcceptedCandles + totalMissingCandles) * duration - 1)
  ) {
    throw new TypeError("Historical baseline coverage does not match its sources.");
  }
}

function assertHistoricalBaselineScope(
  value: unknown,
): asserts value is HistoricalBaselineArtifactScope {
  if (!isRecord(value)) {
    throw new TypeError("Invalid historical baseline scope.");
  }
  assertExactKeys(value, [
    "market",
    "provider",
    "quoteCurrency",
    "timezone",
    "venue",
  ]);
  for (const [key, expected] of Object.entries(HISTORICAL_BASELINE_SCOPE)) {
    if (value[key] !== expected) {
      throw new TypeError("Invalid historical baseline scope.");
    }
  }
}

function assertExactRuntimeBaselineShape(value: unknown): void {
  const baseline = exactRecord(value, [
    "algorithmVersion",
    "asset",
    "dailyRegimeSource",
    "episodeAlgorithmVersion",
    "eventStudyAlgorithmVersion",
    "events",
    "fingerprintCount",
    "fingerprints",
    "interval",
    "quoteCurrency",
    "regimeAlgorithmVersion",
    "schemaVersion",
    "source",
    "symbol",
  ]);
  exactRecord(baseline.source, [
    "closedCandleCount",
    "excludedLegacyZeroVolumePlaceholderCount",
    "excludedUnalignedCandleCount",
    "fromOpenedAt",
    "gapCount",
    "missingCandleCount",
    "segmentCount",
    "sourceRowCount",
    "toClosedAt",
  ]);
  const daily = exactRecord(baseline.dailyRegimeSource, [
    "episodeAlgorithmVersion",
    "episodeDistributions",
    "episodes",
    "fromOpenedAt",
    "pointCount",
    "regimeSummary",
    "sourceCandleCount",
    "terminal",
    "toClosedAt",
  ]);
  const regimeSummary = exactRecord(daily.regimeSummary, [
    "bear",
    "bull",
    "transition",
  ]);
  for (const regime of HISTORICAL_BASELINE_REGIMES) {
    exactRecord(regimeSummary[regime], [
      "dailyCandleCount",
      "firstClosedAt",
      "lastClosedAt",
      "segmentCount",
    ]);
  }
  if (!Array.isArray(daily.episodes)) {
    throw new TypeError("Invalid runtime daily regime episodes.");
  }
  for (const valueEpisode of daily.episodes) {
    exactRecord(valueEpisode, [
      "closedDailyCandleCount",
      "durationDays",
      "endClose",
      "endedAt",
      "endedBy",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "regime",
      "returnPercent",
      "startClose",
      "startedAt",
      "startedBy",
    ]);
  }
  const episodeDistributions = exactRecord(daily.episodeDistributions, [
    "bear",
    "bull",
    "transition",
  ]);
  for (const regime of HISTORICAL_BASELINE_REGIMES) {
    const distribution = exactRecord(episodeDistributions[regime], [
      "durationDays",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "returnPercent",
      "sampleCount",
    ]);
    for (const metric of [
      "durationDays",
      "maxDrawdownPercent",
      "peakCloseReturnPercent",
      "returnPercent",
    ] as const) {
      exactRecord(distribution[metric], ["median", "q25", "q75"]);
    }
  }
  exactRecord(daily.terminal, [
    "algorithmVersion",
    "asset",
    "close",
    "closedAt",
    "ema200",
    "ema50",
    "quoteCurrency",
    "regime",
    "symbol",
  ]);
  exactRecord(baseline.events, [
    "candidateEventCount",
    "completeEventCount",
    "excludedIncompleteEventCount",
    "unclassifiedEventCount",
  ]);
  if (!Array.isArray(baseline.fingerprints)) {
    throw new TypeError("Invalid runtime historical baseline fingerprints.");
  }
  for (const valueFingerprint of baseline.fingerprints) {
    const fingerprint = exactRecord(valueFingerprint, [
      "all",
      "fingerprint",
      "ordering",
      "priceRelations",
      "regimes",
      "unclassifiedEventCount",
    ]);
    exactRecord(fingerprint.priceRelations, ["ema10", "ema20", "ema50"]);
    exactRecord(fingerprint.ordering, ["expression", "state"]);
    assertExactRuntimeCohortShape(fingerprint.all);
    const regimes = exactRecord(fingerprint.regimes, [
      "bear",
      "bull",
      "transition",
    ]);
    for (const regime of HISTORICAL_BASELINE_REGIMES) {
      assertExactRuntimeCohortShape(regimes[regime]);
    }
  }
}

const HISTORICAL_BASELINE_REGIMES = [
  "bull",
  "bear",
  "transition",
] as const;

function assertExactRuntimeCohortShape(value: unknown): void {
  const cohort = exactRecord(value, [
    "eventCount",
    "eventRange",
    "horizons",
    "status",
  ]);
  if (cohort.eventRange !== null) {
    exactRecord(cohort.eventRange, [
      "firstEventOpenedAt",
      "lastEventOpenedAt",
    ]);
  }
  if (!Array.isArray(cohort.horizons)) {
    throw new TypeError("Invalid runtime historical baseline horizons.");
  }
  for (const horizon of cohort.horizons) {
    exactRecord(horizon, [
      "bars",
      "independentSampleCount",
      "maxDownsidePercent",
      "maxUpsidePercent",
      "medianReturnPercent",
      "positiveReturnRatePercent",
      "q25ReturnPercent",
      "q75ReturnPercent",
      "sampleCount",
    ]);
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("Invalid runtime historical baseline object.");
  }
  assertExactKeys(value, keys);
  return value;
}

function assertNoRawHistoryPayload(value: unknown): void {
  const disallowedKeys = new Set([
    "candles",
    "points",
    "cases",
    "eventRecords",
    "rawEvents",
  ]);
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    for (const [key, child] of Object.entries(candidate)) {
      if (disallowedKeys.has(key)) {
        throw new TypeError("Runtime historical baseline cannot contain raw history records.");
      }
      visit(child);
    }
  };
  visit(value);
}

function assertJsonSafe(value: unknown, seen = new Set<object>()): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Historical baseline artifacts require finite JSON numbers.");
    }
    return;
  }
  if (typeof value !== "object" || seen.has(value)) {
    throw new TypeError("Historical baseline artifacts must be acyclic JSON values.");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonSafe(item, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Historical baseline artifacts require plain JSON objects.");
    }
    Object.values(value as Record<string, unknown>).forEach((item) =>
      assertJsonSafe(item, seen),
    );
  }
  seen.delete(value);
}

function expectedStreamKeys(): readonly Readonly<{
  asset: Asset;
  symbol: CandleSymbol;
  interval: LongTermHistoricalBaselineInterval;
}>[] {
  return HISTORICAL_BASELINE_ASSETS.flatMap((asset) =>
    HISTORICAL_BASELINE_INTERVALS.map((interval) => ({
      asset,
      symbol: (asset === "btc" ? "BTCUSDT" : "ETHUSDT") as CandleSymbol,
      interval,
    })),
  );
}

function enumerateMonths(from: string, to: string): readonly string[] {
  const start = monthTimestamp(from);
  const end = monthTimestamp(to);
  const months: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end) {
    months.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function monthTimestamp(value: string): number {
  if (!isMonth(value)) {
    throw new TypeError("Invalid historical baseline UTC month.");
  }
  const [year, month] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, 1);
}

function monthOf(value: string): string {
  return value.slice(0, 7);
}

function isMonth(value: unknown): value is string {
  if (typeof value !== "string" || !MONTH_PATTERN.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 7) === value;
}

function isDatasetVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    HISTORICAL_BASELINE_DATASET_VERSION_PATTERN.test(value)
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && value > 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError("Historical baseline artifact contains unexpected fields.");
  }
}

export function canonicalHistoricalBaselineJson(value: unknown): string {
  assertJsonSafe(value);
  return canonicalJson(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
