import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import {
  HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
  HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
  HISTORICAL_BASELINE_SCOPE,
  canonicalHistoricalBaselineJson,
  type HistoricalBaselineArtifactEntry,
  type HistoricalBaselineBuildManifest,
  type HistoricalBaselineRuntimeArtifact,
} from "@/lib/market/historical-baseline-artifact";
import {
  buildDailyMarketRegimeSeries,
  buildLongTermHistoricalBaseline,
} from "@/lib/market/historical-baseline";
import {
  analyzeHistoricalContext,
  type HistoricalContextAnalysis,
} from "@/lib/market/historical-context";
import { chartIntervalMilliseconds } from "@/lib/market/live-chart";
import {
  chartCandleCapability,
  historicalContextCapability,
  type Asset,
  type AvailableMarketDatum,
  type ChartCandle,
  type ChartCandleInterval,
  type MarketCapability,
  type MarketDatum,
} from "@/server/data/contracts/market-data";
import { binanceSpotSource } from "@/server/data/providers/sources";
import {
  deriveLongTermHistoryDatum,
  deriveMarketCycleDatum,
} from "@/server/data/services/long-term-history-service";

const START = Date.parse("2024-01-01T00:00:00.000Z");
const ARCHIVE_DAYS = 230;
const NOW = Date.parse("2024-09-01T00:00:00.000Z");
const SOURCE = binanceSpotSource;
const HISTORY_SOURCE = {
  id: "wise-crypto-historical-context",
  label: "Wise Crypto 近期历史情景计算",
  url: "https://crypto.wise-invest.org",
  components: [SOURCE],
} as const;
let artifactMemo: HistoricalBaselineRuntimeArtifact | null = null;
let manifestMemo: HistoricalBaselineBuildManifest | null = null;

function candles(
  asset: Asset,
  interval: Exclude<ChartCandleInterval, "15m">,
  count: number,
): readonly ChartCandle[] {
  const duration = chartIntervalMilliseconds[interval];
  const base = asset === "btc" ? 50_000 : 2_500;
  return Array.from({ length: count }, (_, index) => {
    const openedAt = START + index * duration;
    const close = base * (
      1 +
      index * 0.000003 +
      Math.sin(index / 8) * 0.018 +
      Math.sin(index / 31) * 0.009
    );
    const previousClose = index === 0
      ? close
      : base * (
          1 +
          (index - 1) * 0.000003 +
          Math.sin((index - 1) / 8) * 0.018 +
          Math.sin((index - 1) / 31) * 0.009
        );
    return {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      interval,
      quoteCurrency: "USDT",
      state: "closed",
      openedAt: new Date(openedAt).toISOString(),
      closedAt: new Date(openedAt + duration - 1).toISOString(),
      open: previousClose,
      high: Math.max(previousClose, close) * 1.003,
      low: Math.min(previousClose, close) * 0.997,
      close,
      volume: 100 + (index % 47),
    };
  });
}

function runtimeArtifact(): HistoricalBaselineRuntimeArtifact {
  if (artifactMemo !== null) return artifactMemo;
  const entries: HistoricalBaselineArtifactEntry[] = [];
  for (const asset of ["btc", "eth"] as const) {
    const dailyCandles = candles(asset, "1d", ARCHIVE_DAYS);
    const regimes = buildDailyMarketRegimeSeries(dailyCandles)!;
    const dailyVersion = asset === "btc" ? "b".repeat(64) : "e".repeat(64);
    for (const [index, interval] of (["1h", "4h", "1d"] as const).entries()) {
      const count = interval === "1h"
        ? ARCHIVE_DAYS * 24
        : interval === "4h"
          ? ARCHIVE_DAYS * 6
          : ARCHIVE_DAYS;
      const baseline = buildLongTermHistoricalBaseline(
        interval === "1d" ? dailyCandles : candles(asset, interval, count),
        regimes,
      )!;
      entries.push({
        asset,
        symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
        interval,
        eventDatasetVersion: interval === "1d"
          ? dailyVersion
          : String(asset === "btc" ? index + 1 : index + 4).repeat(64).slice(0, 64),
        dailyDatasetVersion: dailyVersion,
        baseline,
      });
    }
  }
  const canonicalPayload = {
    schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
    kind: "historical-baseline-runtime",
    scope: HISTORICAL_BASELINE_SCOPE,
    fromMonth: "2024-01",
    toMonth: "2024-08",
    baselines: entries,
  } as const;
  artifactMemo = {
    ...canonicalPayload,
    generatedAt: "2024-08-31T00:00:00.000Z",
    datasetVersion: createHash("sha256")
      .update(canonicalHistoricalBaselineJson(canonicalPayload))
      .digest("hex"),
  };
  return artifactMemo;
}

function runtimeManifest(): HistoricalBaselineBuildManifest {
  if (manifestMemo !== null) return manifestMemo;
  const artifact = runtimeArtifact();
  const artifactText = `${JSON.stringify(artifact)}\n`;
  manifestMemo = {
    schemaVersion: HISTORICAL_BASELINE_MANIFEST_SCHEMA_VERSION,
    kind: "historical-baseline-audit",
    scope: HISTORICAL_BASELINE_SCOPE,
    generatedAt: artifact.generatedAt,
    fromMonth: artifact.fromMonth,
    toMonth: artifact.toMonth,
    datasetVersion: artifact.datasetVersion,
    artifact: {
      file: "src/server/data/generated/historical-baselines.json",
      sha256: createHash("sha256").update(artifactText).digest("hex"),
      bytes: Buffer.byteLength(artifactText),
    },
    streams: artifact.baselines.map((entry) => ({
      asset: entry.asset,
      symbol: entry.symbol,
      interval: entry.interval,
      eventDatasetVersion: entry.eventDatasetVersion,
      dailyDatasetVersion: entry.dailyDatasetVersion,
      coverage: {
        fromMonth: artifact.fromMonth,
        toMonth: artifact.toMonth,
        firstOpenedAt: entry.baseline.source.fromOpenedAt,
        lastClosedAt: entry.baseline.source.toClosedAt,
        sourceRowCount: entry.baseline.source.sourceRowCount,
        closedCandleCount: entry.baseline.source.closedCandleCount,
        excludedUnalignedCandleCount:
          entry.baseline.source.excludedUnalignedCandleCount,
        excludedLegacyZeroVolumePlaceholderCount:
          entry.baseline.source.excludedLegacyZeroVolumePlaceholderCount,
        gapCount: entry.baseline.source.gapCount,
        missingCandleCount: entry.baseline.source.missingCandleCount,
        segmentCount: entry.baseline.source.segmentCount,
        legacyMillisecondCloseTimeNormalizationCount: 0,
      },
      sourceFiles: buildManifestSourceFiles(entry, artifact.fromMonth, artifact.toMonth),
      gaps: [],
    })),
  };
  return manifestMemo;
}

function buildManifestSourceFiles(
  entry: HistoricalBaselineArtifactEntry,
  fromMonth: string,
  toMonth: string,
): HistoricalBaselineBuildManifest["streams"][number]["sourceFiles"] {
  const duration = chartIntervalMilliseconds[entry.interval];
  const sourceFrom = Date.parse(entry.baseline.source.fromOpenedAt);
  const sourceTo = Date.parse(entry.baseline.source.toClosedAt);
  return enumerateMonths(fromMonth, toMonth).map((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthStart = Date.UTC(year, monthNumber - 1, 1);
    const nextMonth = Date.UTC(year, monthNumber, 1);
    const firstOpenedAt = Math.max(sourceFrom, monthStart);
    const lastOpenedAt = Math.min(sourceTo + 1 - duration, nextMonth - duration);
    const acceptedCandleCount = (lastOpenedAt - firstOpenedAt) / duration + 1;
    const url = `https://data.binance.vision/data/spot/monthly/klines/${entry.symbol}/${entry.interval}/${entry.symbol}-${entry.interval}-${month}.zip`;
    return {
      month,
      url,
      checksumUrl: `${url}.CHECKSUM`,
      sha256: createHash("sha256")
        .update(`${entry.symbol}:${entry.interval}:${month}`)
        .digest("hex"),
      sourceRowCount: acceptedCandleCount,
      acceptedCandleCount,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      legacyMillisecondCloseTimeNormalizationCount: 0,
      firstOpenedAt: new Date(firstOpenedAt).toISOString(),
      lastClosedAt: new Date(lastOpenedAt + duration - 1).toISOString(),
    };
  });
}

function enumerateMonths(fromMonth: string, toMonth: string): readonly string[] {
  const result: string[] = [];
  const [fromYear, fromValue] = fromMonth.split("-").map(Number);
  const [toYear, toValue] = toMonth.split("-").map(Number);
  let cursor = Date.UTC(fromYear, fromValue - 1, 1);
  const end = Date.UTC(toYear, toValue - 1, 1);
  while (cursor <= end) {
    result.push(new Date(cursor).toISOString().slice(0, 7));
    const date = new Date(cursor);
    cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  return result;
}

function available<T>(
  capability: MarketCapability,
  value: T,
): AvailableMarketDatum<T> {
  return {
    status: "fresh",
    capability,
    value,
    source: SOURCE,
    scope: { kind: "venue", label: "BTCUSDT test" },
    updatedAt: "2024-08-30T23:59:59.999Z",
    retrievedAt: new Date(NOW).toISOString(),
    loading: false,
    stale: false,
    cache: { status: "hit", revalidateSeconds: 60, staleIfErrorSeconds: 300 },
    error: null,
    provenance: "live",
  };
}

function inputs() {
  // Current 1h observation ends halfway through day 235. The still-future
  // daily close for that UTC day is present in the provider payload but must
  // not enter the regime used by this event.
  const hourly = candles("btc", "1h", 234 * 24 + 12);
  const analysis = analyzeHistoricalContext(hourly.slice(-1_000))!;
  const daily = candles("btc", "1d", 235);
  return {
    analysis,
    daily,
    history: {
      ...available(historicalContextCapability("btc"), analysis),
      source: HISTORY_SOURCE,
      scope: { kind: "derived" as const, label: "BTCUSDT 1h test history" },
      provenance: "derived" as const,
    },
    dailyDatum: available(chartCandleCapability("btc"), daily),
  };
}

describe("long-term history server projection", () => {
  it("returns a compact chronological daily cycle whose final item is current", () => {
    const { dailyDatum, daily } = inputs();
    const result = deriveMarketCycleDatum("btc", dailyDatum, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    });

    expect(result).toMatchObject({
      status: "fresh",
      capability: "analysis.btc-market-cycle",
      provenance: "derived",
      updatedAt: daily.at(-1)!.closedAt,
      value: {
        asset: "btc",
        symbol: "BTCUSDT",
        current: { endedAt: daily.at(-1)!.closedAt, endedBy: "coverage_end" },
        coverage: {
          archiveToClosedAt: runtimeArtifact().baselines[0]
            .baseline.dailyRegimeSource.toClosedAt,
          continuedToClosedAt: daily.at(-1)!.closedAt,
        },
      },
    });
    if (result.status !== "fresh") throw new Error("Expected fresh cycle.");
    expect(result.value.timeline.length).toBeLessThanOrEqual(7);
    expect(result.value.timeline.at(-1)).toEqual(result.value.current);
    expect(result.value.timeline.map((episode) => episode.startedAt)).toEqual(
      [...result.value.timeline]
        .map((episode) => episode.startedAt)
        .sort(),
    );
    expect(result.value).not.toHaveProperty("candles");
    expect(JSON.stringify(result.value)).not.toContain('"points"');
  });

  it("ignores a forming daily candle and rejects a future candle mislabeled closed", () => {
    const { history, dailyDatum, daily } = inputs();
    const forming = {
      ...dailyDatum,
      value: daily.map((candle, index) =>
        index === daily.length - 1
          ? { ...candle, state: "forming" as const }
          : candle,
      ),
    };
    const result = deriveMarketCycleDatum("btc", forming, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    });
    expect(result).toMatchObject({
      status: "fresh",
      updatedAt: daily.at(-2)!.closedAt,
      value: {
        current: { endedAt: daily.at(-2)!.closedAt },
        coverage: { continuedToClosedAt: daily.at(-2)!.closedAt },
      },
    });
    const longHistory = deriveLongTermHistoryDatum(
      "btc",
      "1h",
      history,
      forming,
      {
        artifact: runtimeArtifact(),
        manifest: runtimeManifest(),
        now: () => NOW,
      },
    );
    if (
      result.status !== "fresh" ||
      longHistory.status !== "fresh"
    ) {
      throw new Error("Expected aligned fresh cycle projections.");
    }
    expect(result.value.current.regime).toBe(longHistory.value.current.regime);
    expect(result.value.current.endedAt).toBe(
      longHistory.value.current.regimeAsOf,
    );

    const futureClosed = {
      ...dailyDatum,
      value: daily.map((candle, index) =>
        index === daily.length - 1
          ? { ...candle, closedAt: new Date(NOW + 1).toISOString() }
          : candle,
      ),
    };
    expect(deriveMarketCycleDatum("btc", futureClosed, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    })).toMatchObject({
      status: "error",
      value: null,
      error: { code: "invalid_payload", retryable: false },
    });
  });

  it("fails closed when the checked artifact is unavailable or invalid", () => {
    const { history, dailyDatum } = inputs();
    const unavailable = deriveLongTermHistoryDatum("btc", "1h", history, dailyDatum, {
      artifact: {
        schemaVersion: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
        kind: "historical-baseline-unavailable",
        reason: "offline_build_required",
      },
      manifest: runtimeManifest(),
      now: () => NOW,
    });
    expect(unavailable).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-long-term-history",
      reason: "no_data",
      value: null,
    });
    expect(deriveLongTermHistoryDatum("btc", "1h", history, dailyDatum, {
      artifact: { kind: "forged" },
      manifest: runtimeManifest(),
      now: () => NOW,
    })).toMatchObject({ status: "unavailable", reason: "no_data" });
  });

  it("requires a byte-exact artifact and audit-manifest pair", () => {
    const { history, dailyDatum } = inputs();
    const wrongBytes = structuredClone(runtimeManifest());
    (wrongBytes.artifact as { bytes: number }).bytes += 1;
    const wrongGeneratedAt = structuredClone(runtimeManifest());
    (wrongGeneratedAt as { generatedAt: string }).generatedAt =
      "2024-08-30T00:00:00.000Z";

    for (const dependencies of [
      { artifact: runtimeArtifact(), now: () => NOW },
      { manifest: runtimeManifest(), now: () => NOW },
      { artifact: runtimeArtifact(), manifest: wrongBytes, now: () => NOW },
      {
        artifact: runtimeArtifact(),
        manifest: wrongGeneratedAt,
        now: () => NOW,
      },
    ]) {
      expect(
        deriveLongTermHistoryDatum(
          "btc",
          "1h",
          history,
          dailyDatum,
          dependencies,
        ),
      ).toMatchObject({ status: "unavailable", reason: "no_data" });
    }
  });

  it("returns only the current, all-market and same-regime projection", () => {
    const { history, dailyDatum, daily } = inputs();
    const result = deriveLongTermHistoryDatum("btc", "1h", history, dailyDatum, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    });
    expect(result).toMatchObject({
      status: "fresh",
      capability: "analysis.btc-long-term-history",
      provenance: "derived",
      value: {
        asset: "btc",
        interval: "1h",
        current: {
          fingerprint: history.value.current.fingerprint,
          // Day 235 has not closed at the current 1h event; day 234 is the
          // newest daily fact that can be used without look-ahead.
          regimeAsOf: daily[233].closedAt,
        },
        versions: {
          artifactSchema: HISTORICAL_BASELINE_ARTIFACT_SCHEMA_VERSION,
          dataset: runtimeArtifact().datasetVersion,
        },
      },
    });
    expect(result.value).not.toHaveProperty("fingerprints");
    expect(result.value).not.toHaveProperty("sources");
    expect(JSON.stringify(result)).not.toMatch(/"(?:candles|eventRecords|rawEvents)":/);
  });

  it("isolates a daily continuation gap as a retryable long-history error", () => {
    const { history, daily } = inputs();
    const gapAfterArchive = available(
      chartCandleCapability("btc"),
      daily.slice(ARCHIVE_DAYS + 1),
    );
    const result = deriveLongTermHistoryDatum("btc", "1h", history, gapAfterArchive, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    });
    expect(result).toMatchObject({
      status: "error",
      value: null,
      error: { code: "no_data", retryable: true },
    });
  });

  it("rejects a recent fingerprint produced by a different algorithm version", () => {
    const { history, dailyDatum } = inputs();
    const mismatched = {
      ...history,
      value: {
        ...history.value,
        algorithmVersion: "closed-ema-context-future",
      },
    } as unknown as typeof history;
    const result = deriveLongTermHistoryDatum("btc", "1h", mismatched, dailyDatum, {
      artifact: runtimeArtifact(),
      manifest: runtimeManifest(),
      now: () => NOW,
    });
    expect(result).toMatchObject({
      status: "error",
      value: null,
      error: { code: "invalid_payload", retryable: false },
    });
  });

  it.each(["history", "daily"] as const)(
    "rejects a forged %s source instead of mixing another venue into Binance history",
    (target) => {
      const { history, dailyDatum } = inputs();
      const forgedSource = {
        id: "alternate-venue",
        label: "Alternate Venue",
        url: "https://example.com/market",
      };
      const forgedHistory = target === "history"
        ? {
            ...history,
            source: { ...HISTORY_SOURCE, components: [forgedSource] },
          }
        : history;
      const forgedDaily = target === "daily"
        ? { ...dailyDatum, source: forgedSource }
        : dailyDatum;
      const result = deriveLongTermHistoryDatum(
        "btc",
        "1h",
        forgedHistory,
        forgedDaily,
        {
          artifact: runtimeArtifact(),
          manifest: runtimeManifest(),
          now: () => NOW,
        },
      );

      expect(result).toMatchObject({
        status: "error",
        value: null,
        error: { code: "invalid_payload", retryable: false },
      });
      expect(JSON.stringify(result)).not.toContain("alternate-venue");
    },
  );

  it("keeps 15m explicitly unsupported without inspecting an artifact", () => {
    const { history, dailyDatum } = inputs();
    const result = deriveLongTermHistoryDatum(
      "btc",
      "15m",
      history as unknown as MarketDatum<HistoricalContextAnalysis>,
      dailyDatum,
      { artifact: { secret: "must-not-be-read" }, now: () => NOW },
    );
    expect(result).toMatchObject({
      status: "unavailable",
      capability: "analysis.btc-long-term-history",
      reason: "unsupported",
    });
  });
});
