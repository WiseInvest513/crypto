import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
  HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
  assertHistoricalBaselineBuildManifest,
  assertHistoricalBaselineRuntimeArtifact,
  parseHistoricalBaselineArtifactDocument,
} from "@/lib/market/historical-baseline-artifact";
import {
  assertCrossRegimeEventCoverage,
  compileHistoricalBaselines,
  computeArtifactDatasetVersion,
} from "@/server/offline/historical-baseline-compiler";
import type {
  BinanceArchiveBuildOptions,
  VerifiedArchiveCandle,
} from "@/server/offline/binance-archive.mjs";

const FROM = "2020-01";
const TO = "2020-12";
const START = Date.UTC(2020, 0, 1);
const END = Date.UTC(2021, 0, 1);
const NOW = Date.UTC(2021, 2, 1);

describe("historical baseline runtime artifact", () => {
  it("compiles all six streams, preserves every official checksum record, and publishes no raw history", async () => {
    const writes: { path: string; value: string }[] = [];
    const result = await compileHistoricalBaselines(
      {
        from: FROM,
        to: TO,
        nowMs: NOW,
        artifactPath: "/tmp/wise-crypto-test/runtime.json",
        manifestPath: "/tmp/wise-crypto-test/manifest.json",
        concurrency: 2,
      },
      {
        buildArchive: fakeArchiveBuilder("cycles-gap"),
        writeAtomic: async (path, value) => {
          writes.push({ path, value: String(value) });
        },
        readPublished: async (path) =>
          [...writes].reverse().find((write) => write.path === path)!.value,
      },
    );

    expect(writes).toHaveLength(2);
    expect(writes[0].path).toBe("/tmp/wise-crypto-test/manifest.json");
    expect(writes[1].path).toBe("/tmp/wise-crypto-test/runtime.json");
    const manifestValue: unknown = JSON.parse(writes[0].value);
    const artifactValue: unknown = JSON.parse(writes[1].value);
    expect(() => assertHistoricalBaselineRuntimeArtifact(artifactValue)).not.toThrow();
    expect(() =>
      assertHistoricalBaselineBuildManifest(manifestValue, {
        artifactSha256: sha256(writes[1].value),
        datasetVersion: result.artifact.datasetVersion,
      }),
    ).not.toThrow();
    expect(result.artifact).toMatchObject({
      schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
      kind: "historical-baseline-runtime",
      fromMonth: FROM,
      toMonth: TO,
    });
    expect(result.manifest).toMatchObject({
      schemaVersion: HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
      kind: "historical-baseline-audit",
    });
    expect(result.artifact.baselines).toHaveLength(6);
    expect(result.manifest.streams).toHaveLength(6);
    expect(
      result.artifact.baselines
        .filter((entry) => entry.interval !== "1d")
        .every(
          (entry) =>
            entry.baseline.source.gapCount === 1 &&
            entry.baseline.source.missingCandleCount === 2 &&
            entry.baseline.source.segmentCount === 2 &&
            entry.baseline.source.excludedUnalignedCandleCount === 43 &&
            entry.baseline.source
              .excludedLegacyZeroVolumePlaceholderCount === 1 &&
            entry.baseline.source.sourceRowCount ===
              entry.baseline.source.closedCandleCount + 44,
        ),
    ).toBe(true);
    expect(
      result.manifest.streams
        .filter((stream) => stream.interval !== "1d")
        .every(
          (stream) =>
            stream.gaps.length === 1 &&
            stream.gaps[0].missingCandleCount === 2,
        ),
    ).toBe(true);
    expect(
      result.manifest.streams.every(
        (stream) => stream.sourceFiles.length === 12,
      ),
    ).toBe(true);
    expect(result.manifest.streams[0].sourceFiles[0]).toMatchObject({
      month: "2020-01",
      url: "https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2020-01.zip",
      checksumUrl: "https://data.binance.vision/data/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2020-01.zip.CHECKSUM",
      sourceRowCount: 744,
      acceptedCandleCount: 744,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      legacyMillisecondCloseTimeNormalizationCount: 0,
    });
    expect(writes[1].value).not.toMatch(
      /"(?:candles|points|cases|eventRecords|rawEvents)"/,
    );
    expect(
      computeArtifactDatasetVersion({
        fromMonth: result.artifact.fromMonth,
        toMonth: result.artifact.toMonth,
        baselines: result.artifact.baselines,
      }),
    ).toBe(result.artifact.datasetVersion);

    const missingOneStreamRegime = structuredClone(
      result.artifact.baselines,
    );
    for (const fingerprint of missingOneStreamRegime[0].baseline.fingerprints) {
      (
        fingerprint.regimes.bull as {
          eventCount: number;
        }
      ).eventCount = 0;
    }
    expect(() =>
      assertCrossRegimeEventCoverage(missingOneStreamRegime),
    ).toThrow("BTC 1h archive has no complete historical events");

    const brokenHash = structuredClone(result.manifest);
    (brokenHash.streams[0].sourceFiles[0] as { sha256: string }).sha256 =
      "BAD";
    expect(() => assertHistoricalBaselineBuildManifest(brokenHash)).toThrow(
      "source record",
    );
    const brokenChecksumUrl = structuredClone(result.manifest);
    (
      brokenChecksumUrl.streams[0].sourceFiles[0] as {
        checksumUrl: string;
      }
    ).checksumUrl += "?unverified=1";
    expect(() =>
      assertHistoricalBaselineBuildManifest(brokenChecksumUrl),
    ).toThrow("source record");
    const brokenNormalizationTotal = structuredClone(result.manifest);
    (
      brokenNormalizationTotal.streams[0].coverage as {
        legacyMillisecondCloseTimeNormalizationCount: number;
      }
    ).legacyMillisecondCloseTimeNormalizationCount = 1;
    expect(() =>
      assertHistoricalBaselineBuildManifest(brokenNormalizationTotal),
    ).toThrow("coverage does not match");
    const brokenPlaceholderTotal = structuredClone(result.manifest);
    (
      brokenPlaceholderTotal.streams[0].coverage as {
        excludedLegacyZeroVolumePlaceholderCount: number;
      }
    ).excludedLegacyZeroVolumePlaceholderCount += 1;
    expect(() =>
      assertHistoricalBaselineBuildManifest(brokenPlaceholderTotal),
    ).toThrow("manifest coverage");

    const brokenDatasetVersion = structuredClone(result.artifact);
    (brokenDatasetVersion as { datasetVersion: string }).datasetVersion =
      "0".repeat(64);
    expect(() =>
      assertHistoricalBaselineRuntimeArtifact(brokenDatasetVersion),
    ).toThrow("datasetVersion does not match");
    const injectedRows = structuredClone(result.artifact);
    (
      injectedRows.baselines[0].baseline.source as unknown as {
        rows: unknown[];
      }
    ).rows = [];
    expect(() =>
      assertHistoricalBaselineRuntimeArtifact(injectedRows),
    ).toThrow("unexpected fields");
    const injectedSourceFiles = structuredClone(result.artifact);
    (
      injectedSourceFiles.baselines[0].baseline
        .dailyRegimeSource as unknown as { sourceFiles: unknown[] }
    ).sourceFiles = [];
    expect(() =>
      assertHistoricalBaselineRuntimeArtifact(injectedSourceFiles),
    ).toThrow("unexpected fields");
    const generatedBeforeCoverage = structuredClone(result.artifact);
    (generatedBeforeCoverage as { generatedAt: string }).generatedAt =
      "2020-06-01T00:00:00.000Z";
    expect(() =>
      assertHistoricalBaselineRuntimeArtifact(generatedBeforeCoverage),
    ).toThrow("scope is inconsistent");
    const declaredRangeMismatch = structuredClone(result.artifact);
    (declaredRangeMismatch as { fromMonth: string }).fromMonth = "2019-12";
    expect(() =>
      assertHistoricalBaselineRuntimeArtifact(declaredRangeMismatch),
    ).toThrow("scope is inconsistent");
    const brokenGap = structuredClone(result.manifest);
    (
      brokenGap.streams[0].gaps[0] as {
        missingCandleCount: number;
      }
    ).missingCandleCount += 1;
    expect(() => assertHistoricalBaselineBuildManifest(brokenGap)).toThrow(
      "aligned and sorted",
    );
  });

  it("accepts only the explicit fail-closed prebuild sentinel", () => {
    expect(
      parseHistoricalBaselineArtifactDocument({
        schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
        kind: "historical-baseline-unavailable",
        reason: "offline_build_required",
      }),
    ).toMatchObject({ kind: "historical-baseline-unavailable" });
    expect(() =>
      parseHistoricalBaselineArtifactDocument({
        schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
        kind: "historical-baseline-unavailable",
        reason: "network_error",
      }),
    ).toThrow("Invalid unavailable");
  });

  it("fails the bull/bear gate before atomically replacing either published file", async () => {
    const writeAtomic = vi.fn();
    await expect(
      compileHistoricalBaselines(
        {
          from: FROM,
          to: TO,
          nowMs: NOW,
          artifactPath: "/tmp/wise-crypto-test/runtime.json",
          manifestPath: "/tmp/wise-crypto-test/manifest.json",
        },
        {
          buildArchive: fakeArchiveBuilder("rising"),
          writeAtomic,
        },
      ),
    ).rejects.toThrow("at least two verified mechanical");
    expect(writeAtomic).not.toHaveBeenCalled();
  });

  it("publishes the runtime activation last and rejects a failed byte readback", async () => {
    const writes: { path: string; value: string }[] = [];
    await expect(
      compileHistoricalBaselines(
        {
          from: FROM,
          to: TO,
          nowMs: NOW,
          artifactPath: "/tmp/wise-crypto-test/runtime.json",
          manifestPath: "/tmp/wise-crypto-test/manifest.json",
        },
        {
          buildArchive: fakeArchiveBuilder("cycles-gap"),
          writeAtomic: async (path, value) => {
            writes.push({ path, value: String(value) });
          },
          readPublished: async (path) => {
            const published = [...writes]
              .reverse()
              .find((write) => write.path === path)!.value;
            return path.endsWith("runtime.json")
              ? `${published}corrupt`
              : published;
          },
        },
      ),
    ).rejects.toThrow("artifact failed its byte audit");
    expect(writes.map((write) => write.path)).toEqual([
      "/tmp/wise-crypto-test/manifest.json",
      "/tmp/wise-crypto-test/runtime.json",
    ]);
  });
});

function fakeArchiveBuilder(mode: "cycles" | "cycles-gap" | "rising") {
  return async (options: BinanceArchiveBuildOptions) => {
    const candles = generateCandles(options, mode);
    const gaps = findGaps(candles, options.interval);
    const months = enumerateMonths(options.from, options.to);
    const sources = months.map((month) => {
      const monthly = candles.filter(
        (candle) =>
          new Date(candle.openTimeMs).toISOString().slice(0, 7) === month,
      );
      const first = monthly[0];
      const last = monthly.at(-1)!;
      const stem = `${options.symbol}-${options.interval}-${month}.zip`;
      const url =
        `https://data.binance.vision/data/spot/monthly/klines/` +
        `${options.symbol}/${options.interval}/${stem}`;
      const excludedUnalignedCandleCount =
        mode === "cycles-gap" &&
        options.interval !== "1d" &&
        month === "2020-02"
          ? 43
          : 0;
      const excludedLegacyZeroVolumePlaceholderCount =
        mode === "cycles-gap" &&
        options.interval !== "1d" &&
        month === "2020-02"
          ? 1
          : 0;
      return {
        month,
        url,
        checksumUrl: `${url}.CHECKSUM`,
        sha256: sha256(`${options.symbol}:${options.interval}:${month}`),
        sourceRowCount:
          monthly.length +
          excludedUnalignedCandleCount +
          excludedLegacyZeroVolumePlaceholderCount,
        acceptedCandleCount: monthly.length,
        excludedUnalignedCandleCount,
        excludedLegacyZeroVolumePlaceholderCount,
        legacyMillisecondCloseTimeNormalizationCount: 0,
        firstOpenTimeMs: first.openTimeMs,
        lastCloseTimeMs: last.closeTimeMs,
      };
    });
    const datasetVersion = sha256(
      `${options.symbol}:${options.interval}:${options.from}:${options.to}:${mode}`,
    );
    return {
      outputRoot: "/tmp/wise-crypto-test/private",
      artifactName: `baseline-${datasetVersion}.json`,
      manifestName: "manifest.json" as const,
      manifest: {
        schemaVersion: 2 as const,
        kind: "verified-kline-intermediate" as const,
        runtimeReady: false as const,
        containsHistoricalCandles: true as const,
        datasetVersion,
        generatedAt: new Date(options.nowMs ?? NOW).toISOString(),
        symbol: options.symbol,
        interval: options.interval,
        coverage: {
          fromMonth: options.from,
          toMonth: options.to,
          firstOpenTimeMs: candles[0].openTimeMs,
          lastCloseTimeMs: candles.at(-1)!.closeTimeMs,
          sourceRowCount: sources.reduce(
            (count, source) => count + source.sourceRowCount,
            0,
          ),
          candleCount: candles.length,
          excludedUnalignedCandleCount: sources.reduce(
            (count, source) =>
              count + source.excludedUnalignedCandleCount,
            0,
          ),
          excludedLegacyZeroVolumePlaceholderCount: sources.reduce(
            (count, source) =>
              count + source.excludedLegacyZeroVolumePlaceholderCount,
            0,
          ),
          gapCount: gaps.length,
          missingCandleCount: gaps.reduce(
            (count, gap) => count + gap.missingCandleCount,
            0,
          ),
          segmentCount: gaps.length + 1,
          legacyMillisecondCloseTimeNormalizationCount: 0,
        },
        artifact: {
          file: `baseline-${datasetVersion}.json`,
          sha256: datasetVersion,
          bytes: 1,
        },
        sources,
        gaps,
      },
      verifiedCandles: candles,
    };
  };
}

function generateCandles(
  options: BinanceArchiveBuildOptions,
  mode: "cycles" | "cycles-gap" | "rising",
): readonly VerifiedArchiveCandle[] {
  const step =
    options.interval === "1h"
      ? 60 * 60 * 1_000
      : options.interval === "4h"
        ? 4 * 60 * 60 * 1_000
        : 24 * 60 * 60 * 1_000;
  const count = (END - START) / step;
  return Array.from({ length: count }, (_, index) => {
    const openTimeMs = START + index * step;
    const day = (openTimeMs - START) / (24 * 60 * 60 * 1_000);
    const phase = day + (openTimeMs % (24 * 60 * 60 * 1_000)) / (24 * 60 * 60 * 1_000);
    const close =
      mode === "rising"
        ? 1_000 + phase
        : 1_100 + 360 * Math.sin((phase / 55) * Math.PI * 2) +
          18 * Math.sin((index / 11) * Math.PI * 2);
    const priorPhase = phase - step / (24 * 60 * 60 * 1_000);
    const open =
      mode === "rising"
        ? 1_000 + Math.max(0, priorPhase)
        : 1_100 +
          360 * Math.sin((priorPhase / 55) * Math.PI * 2) +
          18 * Math.sin(((index - 1) / 11) * Math.PI * 2);
    return {
      symbol: options.symbol,
      interval: options.interval,
      openTimeMs,
      open,
      high: Math.max(open, close) + 3,
      low: Math.min(open, close) - 3,
      close,
      volume: 100 + (index % 37),
      closeTimeMs: openTimeMs + step - 1,
    };
  }).filter(
    (_, index) =>
      mode !== "cycles-gap" ||
      options.interval === "1d" ||
      (index !== 900 && index !== 901),
  );
}

function findGaps(
  candles: readonly VerifiedArchiveCandle[],
  interval: "1h" | "4h" | "1d",
) {
  const step =
    interval === "1h"
      ? 60 * 60 * 1_000
      : interval === "4h"
        ? 4 * 60 * 60 * 1_000
        : 24 * 60 * 60 * 1_000;
  return candles.slice(1).flatMap((candle, index) => {
    const previous = candles[index];
    const delta = candle.openTimeMs - previous.openTimeMs;
    return delta === step
      ? []
      : [{
          previousClosedAt: new Date(previous.closeTimeMs).toISOString(),
          nextOpenedAt: new Date(candle.openTimeMs).toISOString(),
          missingCandleCount: delta / step - 1,
        }];
  });
}

function enumerateMonths(from: string, to: string): readonly string[] {
  const [startYear, startMonth] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = Date.UTC(endYear, endMonth - 1, 1);
  const months: string[] = [];
  while (cursor.getTime() <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
