import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
  HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
  HISTORICAL_BASELINE_SCOPE,
  assertHistoricalBaselineBuildManifest,
  assertHistoricalBaselineRuntimeArtifact,
  canonicalHistoricalBaselineJson,
  type HistoricalBaselineArtifactEntry,
  type HistoricalBaselineBuildManifest,
  type HistoricalBaselineManifestSourceFile,
  type HistoricalBaselineManifestStream,
  type HistoricalBaselineRuntimeArtifact,
} from "@/lib/market/historical-baseline-artifact";
import {
  assertDailyMarketRegimeSeries,
  assertLongTermHistoricalBaseline,
  buildDailyMarketRegimeSeries,
  buildLongTermHistoricalBaselineFromSegments,
  type DailyMarketRegimeSeries,
  type LongTermHistoricalBaselineInterval,
} from "@/lib/market/historical-baseline";
import type {
  Asset,
  ChartCandle,
} from "@/server/data/contracts/market-data";

import {
  assertArchiveRequest,
  atomicWriteFile,
  buildBinanceHistoryBaseline,
  findCandleGaps,
  validateCandleSeries,
  type BinanceArchiveBuildOptions,
  type BinanceArchiveInterval,
  type BinanceArchiveSymbol,
  type VerifiedArchiveCandle,
} from "./binance-archive.mjs";

export const DEFAULT_HISTORICAL_BASELINE_PRIVATE_ROOT =
  ".wise-crypto-private/binance-history";
export const DEFAULT_HISTORICAL_BASELINE_ARTIFACT_PATH =
  "src/server/data/generated/historical-baselines.json";
export const DEFAULT_HISTORICAL_BASELINE_MANIFEST_PATH =
  "data/history-baselines/v2/manifest.json";
export const DEFAULT_HISTORICAL_BASELINE_CONCURRENCY = 2;

export type HistoricalBaselineCompilerOptions = Readonly<{
  from: string;
  to: string;
  privateRoot?: string;
  artifactPath?: string;
  manifestPath?: string;
  refresh?: boolean;
  concurrency?: number;
  nowMs?: number;
}>;

type ArchiveBuildResult = Awaited<
  ReturnType<typeof buildBinanceHistoryBaseline>
>;

export type HistoricalBaselineCompilerDependencies = Readonly<{
  buildArchive?: (
    options: BinanceArchiveBuildOptions,
  ) => Promise<ArchiveBuildResult>;
  writeAtomic?: typeof atomicWriteFile;
  readPublished?: (path: string) => Promise<string | Uint8Array>;
}>;

export type HistoricalBaselineCompileResult = Readonly<{
  artifactPath: string;
  manifestPath: string;
  artifactSha256: string;
  artifact: HistoricalBaselineRuntimeArtifact;
  manifest: HistoricalBaselineBuildManifest;
}>;

type StreamDescriptor = Readonly<{
  asset: Asset;
  symbol: BinanceArchiveSymbol;
  interval: BinanceArchiveInterval;
}>;

type VerifiedStream = Readonly<{
  descriptor: StreamDescriptor;
  manifest: ArchiveBuildResult["manifest"];
  candles: readonly ChartCandle[];
}>;

const STREAMS: readonly StreamDescriptor[] = [
  { asset: "btc", symbol: "BTCUSDT", interval: "1h" },
  { asset: "btc", symbol: "BTCUSDT", interval: "4h" },
  { asset: "btc", symbol: "BTCUSDT", interval: "1d" },
  { asset: "eth", symbol: "ETHUSDT", interval: "1h" },
  { asset: "eth", symbol: "ETHUSDT", interval: "4h" },
  { asset: "eth", symbol: "ETHUSDT", interval: "1d" },
];

/**
 * Builds every supported long-history stream in an explicit offline command.
 * No page, Route Handler or public service imports this module.
 */
export async function compileHistoricalBaselines(
  options: HistoricalBaselineCompilerOptions,
  dependencies: HistoricalBaselineCompilerDependencies = {},
): Promise<HistoricalBaselineCompileResult> {
  const normalized = normalizeCompilerOptions(options);
  const buildArchive = dependencies.buildArchive ?? buildBinanceHistoryBaseline;
  const writeAtomic = dependencies.writeAtomic ?? atomicWriteFile;
  const readPublished = dependencies.readPublished ?? readFile;
  const loadStream = async (
    descriptor: StreamDescriptor,
  ): Promise<VerifiedStream> => {
    const result = await buildArchive({
      symbol: descriptor.symbol,
      interval: descriptor.interval,
      from: normalized.from,
      to: normalized.to,
      nowMs: normalized.nowMs,
      privateRoot: normalized.privateRoot,
      refresh: normalized.refresh,
      allowGaps: descriptor.interval !== "1d",
    });
    assertArchiveResult(
      result,
      descriptor,
      normalized.from,
      normalized.to,
      normalized.nowMs,
    );
    return {
      descriptor,
      manifest: result.manifest,
      candles: result.verifiedCandles.map((candle) =>
        toClosedChartCandle(descriptor.asset, candle),
      ),
    };
  };
  // Download each daily source once, seed both assets' regimes, and fail the
  // cross-cycle gate before spending time on lower-period archives.
  const dailyStreams = await mapConcurrent(
    STREAMS.filter((stream) => stream.interval === "1d"),
    normalized.concurrency,
    loadStream,
  );
  const dailyRegimes = buildDailyRegimesByAsset(dailyStreams);
  assertMechanicalBullBearCoverage(dailyRegimes);
  const lowerPeriodStreams = await mapConcurrent(
    STREAMS.filter((stream) => stream.interval !== "1d"),
    normalized.concurrency,
    loadStream,
  );
  const unorderedStreams = [...dailyStreams, ...lowerPeriodStreams];
  const verifiedStreams = STREAMS.map((stream) =>
    requireVerifiedStream(unorderedStreams, stream.asset, stream.interval),
  );

  const entries: HistoricalBaselineArtifactEntry[] = [];
  const manifestStreams: HistoricalBaselineManifestStream[] = [];
  for (const stream of verifiedStreams) {
    const dailyStream = requireVerifiedStream(
      verifiedStreams,
      stream.descriptor.asset,
      "1d",
    );
    const dailyRegime = dailyRegimes.get(stream.descriptor.asset)!;
    const baseline = buildLongTermHistoricalBaselineFromSegments(
      splitClosedCandleSegments(stream.candles),
      dailyRegime,
      {
        sourceRowCount: stream.manifest.coverage.sourceRowCount,
        excludedUnalignedCandleCount:
          stream.manifest.coverage.excludedUnalignedCandleCount,
        excludedLegacyZeroVolumePlaceholderCount:
          stream.manifest.coverage
            .excludedLegacyZeroVolumePlaceholderCount,
      },
    );
    if (baseline === null) {
      throw new TypeError(
        `Archive did not produce a ${stream.descriptor.asset} ${stream.descriptor.interval} baseline.`,
      );
    }
    assertLongTermHistoricalBaseline(baseline);
    assertBaselineSourceMatchesArchive(baseline.source, stream.manifest.coverage);
    const eventDatasetVersion = stream.manifest.datasetVersion;
    const dailyDatasetVersion = dailyStream.manifest.datasetVersion;
    entries.push({
      asset: stream.descriptor.asset,
      symbol: stream.descriptor.symbol,
      interval: stream.descriptor.interval,
      eventDatasetVersion,
      dailyDatasetVersion,
      baseline,
    });
    manifestStreams.push(
      toManifestStream(
        stream,
        normalized.from,
        normalized.to,
        eventDatasetVersion,
        dailyDatasetVersion,
      ),
    );
  }

  assertCrossRegimeEventCoverage(entries);
  const generatedAt = new Date(normalized.nowMs).toISOString();
  const datasetVersion = computeArtifactDatasetVersion({
    fromMonth: normalized.from,
    toMonth: normalized.to,
    baselines: entries,
  });
  const artifact: HistoricalBaselineRuntimeArtifact = {
    schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
    kind: "historical-baseline-runtime",
    scope: HISTORICAL_BASELINE_SCOPE,
    generatedAt,
    fromMonth: normalized.from,
    toMonth: normalized.to,
    datasetVersion,
    baselines: entries,
  };
  assertHistoricalBaselineRuntimeArtifact(artifact);

  // Runtime output stays compact and is hashed byte-for-byte as published.
  const artifactText = `${JSON.stringify(artifact)}\n`;
  const artifactSha256 = sha256(artifactText);
  const manifest: HistoricalBaselineBuildManifest = {
    schemaVersion: HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
    kind: "historical-baseline-audit",
    scope: HISTORICAL_BASELINE_SCOPE,
    generatedAt,
    fromMonth: normalized.from,
    toMonth: normalized.to,
    datasetVersion,
    artifact: {
      file: DEFAULT_HISTORICAL_BASELINE_ARTIFACT_PATH,
      sha256: artifactSha256,
      bytes: Buffer.byteLength(artifactText),
    },
    streams: manifestStreams,
  };
  assertHistoricalBaselineBuildManifest(manifest, {
    artifactSha256,
    datasetVersion,
  });
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

  // The manifest is prepared first; the runtime artifact is the activation
  // point and is therefore renamed last. Both published byte sequences are
  // read back before the build is reported as complete.
  await writeAtomic(normalized.manifestPath, manifestText);
  const publishedManifest = await readPublished(normalized.manifestPath);
  if (Buffer.from(publishedManifest).toString("utf8") !== manifestText) {
    throw new Error("Published historical baseline manifest failed its byte audit.");
  }
  await writeAtomic(normalized.artifactPath, artifactText);
  const publishedArtifact = Buffer.from(
    await readPublished(normalized.artifactPath),
  );
  if (
    publishedArtifact.byteLength !== manifest.artifact.bytes ||
    sha256(publishedArtifact) !== manifest.artifact.sha256
  ) {
    throw new Error("Published historical baseline artifact failed its byte audit.");
  }
  return {
    artifactPath: normalized.artifactPath,
    manifestPath: normalized.manifestPath,
    artifactSha256,
    artifact,
    manifest,
  };
}

export function computeArtifactDatasetVersion(input: Readonly<{
  fromMonth: string;
  toMonth: string;
  baselines: readonly HistoricalBaselineArtifactEntry[];
}>): string {
  return sha256(
    canonicalHistoricalBaselineJson({
      schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
      kind: "historical-baseline-runtime",
      scope: HISTORICAL_BASELINE_SCOPE,
      fromMonth: input.fromMonth,
      toMonth: input.toMonth,
      baselines: input.baselines,
    }),
  );
}

export function assertMechanicalBullBearCoverage(
  regimes: ReadonlyMap<Asset, DailyMarketRegimeSeries>,
): void {
  for (const asset of ["btc", "eth"] as const) {
    const series = regimes.get(asset);
    if (!series) {
      throw new TypeError(`Missing ${asset} daily regime series.`);
    }
    assertDailyMarketRegimeSeries(series);
    for (const regime of ["bull", "bear"] as const) {
      const coverage = series.regimeSummary[regime];
      if (coverage.dailyCandleCount < 1 || coverage.segmentCount < 2) {
        throw new TypeError(
          `${asset.toUpperCase()} archive needs at least two verified mechanical ${regime} segments.`,
        );
      }
    }
  }
}

export function assertCrossRegimeEventCoverage(
  entries: readonly HistoricalBaselineArtifactEntry[],
): void {
  for (const asset of ["btc", "eth"] as const) {
    for (const interval of ["1h", "4h", "1d"] as const) {
      const entry = entries.find(
        (candidate) =>
          candidate.asset === asset && candidate.interval === interval,
      );
      if (!entry) {
        throw new TypeError(`Missing ${asset} ${interval} baseline entry.`);
      }
      for (const regime of ["bull", "bear"] as const) {
        const count = entry.baseline.fingerprints.reduce(
          (total, fingerprint) =>
            total + fingerprint.regimes[regime].eventCount,
          0,
        );
        if (count < 1) {
          throw new TypeError(
            `${asset.toUpperCase()} ${interval} archive has no complete historical events in the mechanical ${regime} regime.`,
          );
        }
      }
    }
  }
}

export function toClosedChartCandle(
  asset: Asset,
  candle: VerifiedArchiveCandle,
): ChartCandle {
  const expectedSymbol = asset === "btc" ? "BTCUSDT" : "ETHUSDT";
  if (candle.symbol !== expectedSymbol) {
    throw new TypeError("Archive candle asset and symbol do not match.");
  }
  return {
    asset,
    symbol: candle.symbol,
    interval: candle.interval,
    quoteCurrency: "USDT",
    state: "closed",
    openedAt: new Date(candle.openTimeMs).toISOString(),
    closedAt: new Date(candle.closeTimeMs).toISOString(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function buildDailyRegimesByAsset(
  streams: readonly VerifiedStream[],
): ReadonlyMap<Asset, DailyMarketRegimeSeries> {
  const result = new Map<Asset, DailyMarketRegimeSeries>();
  for (const asset of ["btc", "eth"] as const) {
    const stream = requireVerifiedStream(streams, asset, "1d");
    const series = buildDailyMarketRegimeSeries(stream.candles);
    if (series === null) {
      throw new TypeError(
        `${asset.toUpperCase()} daily archive cannot seed EMA200 regimes.`,
      );
    }
    assertDailyMarketRegimeSeries(series);
    result.set(asset, series);
  }
  return result;
}

function toManifestStream(
  stream: VerifiedStream,
  fromMonth: string,
  toMonth: string,
  eventDatasetVersion: string,
  dailyDatasetVersion: string,
): HistoricalBaselineManifestStream {
  const sourceFiles: HistoricalBaselineManifestSourceFile[] =
    stream.manifest.sources.map((source) => ({
      month: source.month,
      url: source.url,
      checksumUrl: source.checksumUrl,
      sha256: source.sha256,
      sourceRowCount: source.sourceRowCount,
      acceptedCandleCount: source.acceptedCandleCount,
      excludedUnalignedCandleCount:
        source.excludedUnalignedCandleCount,
      excludedLegacyZeroVolumePlaceholderCount:
        source.excludedLegacyZeroVolumePlaceholderCount,
      legacyMillisecondCloseTimeNormalizationCount:
        source.legacyMillisecondCloseTimeNormalizationCount,
      firstOpenedAt: new Date(source.firstOpenTimeMs).toISOString(),
      lastClosedAt: new Date(source.lastCloseTimeMs).toISOString(),
    }));
  const first = sourceFiles[0];
  const last = sourceFiles.at(-1)!;
  return {
    asset: stream.descriptor.asset,
    symbol: stream.descriptor.symbol,
    interval: stream.descriptor.interval,
    eventDatasetVersion,
    dailyDatasetVersion,
    coverage: {
      fromMonth,
      toMonth,
      firstOpenedAt: first.firstOpenedAt,
      lastClosedAt: last.lastClosedAt,
      sourceRowCount: stream.manifest.coverage.sourceRowCount,
      closedCandleCount: stream.manifest.coverage.candleCount,
      excludedUnalignedCandleCount:
        stream.manifest.coverage.excludedUnalignedCandleCount,
      excludedLegacyZeroVolumePlaceholderCount:
        stream.manifest.coverage
          .excludedLegacyZeroVolumePlaceholderCount,
      gapCount: stream.manifest.coverage.gapCount,
      missingCandleCount: stream.manifest.coverage.missingCandleCount,
      segmentCount: stream.manifest.coverage.segmentCount,
      legacyMillisecondCloseTimeNormalizationCount:
        stream.manifest.coverage
          .legacyMillisecondCloseTimeNormalizationCount,
    },
    sourceFiles,
    gaps: stream.manifest.gaps,
  };
}

function assertArchiveResult(
  result: ArchiveBuildResult,
  descriptor: StreamDescriptor,
  from: string,
  to: string,
  nowMs: number,
): void {
  const manifest = result.manifest;
  validateCandleSeries(result.verifiedCandles, {
    interval: descriptor.interval,
    nowMs,
    allowGaps: descriptor.interval !== "1d",
  });
  const computedGaps = findCandleGaps(
    result.verifiedCandles,
    descriptor.interval,
  );
  const sourceRowCount = manifest.sources.reduce(
    (count, source) => count + source.sourceRowCount,
    0,
  );
  const sourceAcceptedCandleCount = manifest.sources.reduce(
    (count, source) => count + source.acceptedCandleCount,
    0,
  );
  const excludedUnalignedCandleCount = manifest.sources.reduce(
    (count, source) => count + source.excludedUnalignedCandleCount,
    0,
  );
  const excludedLegacyZeroVolumePlaceholderCount =
    manifest.sources.reduce(
      (count, source) =>
        count + source.excludedLegacyZeroVolumePlaceholderCount,
      0,
    );
  const sourceNormalizationCount = manifest.sources.reduce(
    (count, source) =>
      count + source.legacyMillisecondCloseTimeNormalizationCount,
    0,
  );
  const missingCandleCount = computedGaps.reduce(
    (count, gap) => count + gap.missingCandleCount,
    0,
  );
  if (
    manifest.kind !== "verified-kline-intermediate" ||
    manifest.runtimeReady !== false ||
    manifest.containsHistoricalCandles !== true ||
    manifest.symbol !== descriptor.symbol ||
    manifest.interval !== descriptor.interval ||
    manifest.coverage.fromMonth !== from ||
    manifest.coverage.toMonth !== to ||
    manifest.coverage.candleCount !== result.verifiedCandles.length ||
    manifest.coverage.sourceRowCount !== sourceRowCount ||
    manifest.coverage.candleCount !== sourceAcceptedCandleCount ||
    manifest.coverage.excludedUnalignedCandleCount !==
      excludedUnalignedCandleCount ||
    manifest.coverage.excludedLegacyZeroVolumePlaceholderCount !==
      excludedLegacyZeroVolumePlaceholderCount ||
    sourceRowCount !==
      sourceAcceptedCandleCount +
        excludedUnalignedCandleCount +
        excludedLegacyZeroVolumePlaceholderCount ||
    manifest.coverage.gapCount !== computedGaps.length ||
    manifest.coverage.missingCandleCount !== missingCandleCount ||
    manifest.coverage.segmentCount !== computedGaps.length + 1 ||
    manifest.coverage.legacyMillisecondCloseTimeNormalizationCount !==
      sourceNormalizationCount ||
    JSON.stringify(manifest.gaps) !== JSON.stringify(computedGaps) ||
    (descriptor.interval === "1d" &&
      (computedGaps.length > 0 ||
        excludedUnalignedCandleCount > 0 ||
        excludedLegacyZeroVolumePlaceholderCount > 0)) ||
    manifest.sources.length === 0 ||
    manifest.sources.some(
      (source) =>
        !/^[a-f0-9]{64}$/.test(source.sha256) ||
        !Number.isSafeInteger(source.sourceRowCount) ||
        source.sourceRowCount < 1 ||
        !Number.isSafeInteger(source.acceptedCandleCount) ||
        source.acceptedCandleCount < 1 ||
        !Number.isSafeInteger(source.excludedUnalignedCandleCount) ||
        source.excludedUnalignedCandleCount < 0 ||
        !Number.isSafeInteger(
          source.excludedLegacyZeroVolumePlaceholderCount,
        ) ||
        source.excludedLegacyZeroVolumePlaceholderCount < 0 ||
        source.sourceRowCount !==
          source.acceptedCandleCount +
            source.excludedUnalignedCandleCount +
            source.excludedLegacyZeroVolumePlaceholderCount ||
        !Number.isSafeInteger(
          source.legacyMillisecondCloseTimeNormalizationCount,
        ) ||
        source.legacyMillisecondCloseTimeNormalizationCount < 0 ||
        source.legacyMillisecondCloseTimeNormalizationCount >
          source.acceptedCandleCount,
    )
  ) {
    throw new TypeError("Invalid verified Binance archive intermediate.");
  }
}

export function splitClosedCandleSegments(
  candles: readonly ChartCandle[],
): readonly (readonly ChartCandle[])[] {
  if (candles.length === 0) {
    throw new TypeError("Cannot segment an empty verified candle stream.");
  }
  const duration =
    candles[0].interval === "1h"
      ? 60 * 60 * 1_000
      : candles[0].interval === "4h"
        ? 4 * 60 * 60 * 1_000
        : candles[0].interval === "1d"
          ? 24 * 60 * 60 * 1_000
          : null;
  if (duration === null) {
    throw new TypeError("Historical baseline segments do not support 15m candles.");
  }

  const segments: ChartCandle[][] = [[candles[0]]];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const candle = candles[index];
    const delta = Date.parse(candle.openedAt) - Date.parse(previous.openedAt);
    if (delta < duration || delta % duration !== 0) {
      throw new TypeError(
        "Verified archive candles must be ordered on whole interval boundaries.",
      );
    }
    if (delta > duration) {
      if (candle.interval === "1d") {
        throw new TypeError("Daily archive gaps cannot seed market regimes.");
      }
      segments.push([]);
    }
    segments.at(-1)!.push(candle);
  }
  return segments;
}

function assertBaselineSourceMatchesArchive(
  source: HistoricalBaselineArtifactEntry["baseline"]["source"],
  coverage: ArchiveBuildResult["manifest"]["coverage"],
): void {
  if (
    source.closedCandleCount !== coverage.candleCount ||
    source.sourceRowCount !== coverage.sourceRowCount ||
    source.excludedUnalignedCandleCount !==
      coverage.excludedUnalignedCandleCount ||
    source.excludedLegacyZeroVolumePlaceholderCount !==
      coverage.excludedLegacyZeroVolumePlaceholderCount ||
    source.segmentCount !== coverage.segmentCount ||
    source.gapCount !== coverage.gapCount ||
    source.missingCandleCount !== coverage.missingCandleCount ||
    source.fromOpenedAt !== new Date(coverage.firstOpenTimeMs).toISOString() ||
    source.toClosedAt !== new Date(coverage.lastCloseTimeMs).toISOString()
  ) {
    throw new TypeError(
      "Segmented historical baseline source does not match its verified archive audit.",
    );
  }
}

function requireVerifiedStream(
  streams: readonly VerifiedStream[],
  asset: Asset,
  interval: LongTermHistoricalBaselineInterval,
): VerifiedStream {
  const stream = streams.find(
    (candidate) =>
      candidate.descriptor.asset === asset &&
      candidate.descriptor.interval === interval,
  );
  if (!stream) {
    throw new TypeError(`Missing verified ${asset} ${interval} archive stream.`);
  }
  return stream;
}

function normalizeCompilerOptions(options: HistoricalBaselineCompilerOptions) {
  if (!options || typeof options !== "object") {
    throw new TypeError("Historical baseline compiler options are required.");
  }
  const nowMs = options.nowMs ?? Date.now();
  const concurrency =
    options.concurrency ?? DEFAULT_HISTORICAL_BASELINE_CONCURRENCY;
  if (
    !Number.isSafeInteger(nowMs) ||
    nowMs <= 0 ||
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 3
  ) {
    throw new TypeError("Invalid historical baseline compiler limits.");
  }
  // Reuse the downloader's canonical month and current-month validation.
  assertArchiveRequest({
    symbol: "BTCUSDT",
    interval: "1d",
    from: options.from,
    to: options.to,
    nowMs,
  });
  const privateRoot = resolve(
    options.privateRoot ?? DEFAULT_HISTORICAL_BASELINE_PRIVATE_ROOT,
  );
  const artifactPath = resolve(
    options.artifactPath ?? DEFAULT_HISTORICAL_BASELINE_ARTIFACT_PATH,
  );
  const manifestPath = resolve(
    options.manifestPath ?? DEFAULT_HISTORICAL_BASELINE_MANIFEST_PATH,
  );
  return {
    from: options.from,
    to: options.to,
    nowMs,
    concurrency,
    privateRoot,
    artifactPath,
    manifestPath,
    refresh: options.refresh === true,
  } as const;
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(values[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
