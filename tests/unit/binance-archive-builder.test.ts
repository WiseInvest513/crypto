import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertArchiveRequest,
  buildArchiveDescriptor,
  buildBinanceHistoryBaseline,
  enumerateMonths,
  normalizeArchiveTimestamp,
  parseChecksumFile,
  parseKlineCsv,
  parseKlineCsvWithAudit,
  sha256Hex,
} from "../../src/server/offline/binance-archive.mjs";

const ZIP_FIXTURE = Buffer.from(
  "UEsDBBQAAAAIAEiNJl1jFHJFSwAAAK0AAAAWABwAQlRDVVNEVC0xaC0yMDI0LTAxLmNzdlVUCQADdzWdanc1nWp1eAsAAQT1AQAABAAAAABFjkkKwEAIBO95yxBa45L5/8eCrUM8WChtoSQMkYqqJcBNeGF7D9pgr3gid1XFuVUsRr1HXBN7j3UM0ZCGEfJr7RntvKGyeBFH+wFQSwECHgMUAAAACABIjSZdYxRyRUsAAACtAAAAFgAYAAAAAAABAAAApIEAAAAAQlRDVVNEVC0xaC0yMDI0LTAxLmNzdlVUBQADdzWdanV4CwABBPUBAAAEAAAAAFBLBQYAAAAAAQABAFwAAACbAAAAAAA=",
  "base64",
);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Binance monthly archive builder", () => {
  it("allows only the approved spot symbols, intervals, and complete UTC months", () => {
    const request = assertArchiveRequest({
      symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-03",
      nowMs: Date.UTC(2024, 4, 1),
    });
    expect(request.months).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(enumerateMonths("2023-12", "2024-02")).toEqual(["2023-12", "2024-01", "2024-02"]);
    expect(() => assertArchiveRequest({ symbol: "BNBUSDT", interval: "1h", from: "2024-01", to: "2024-01", nowMs: Date.UTC(2024, 2, 1) })).toThrow(/Unsupported symbol/);
    expect(() => assertArchiveRequest({ symbol: "BTCUSDT", interval: "15m", from: "2024-01", to: "2024-01", nowMs: Date.UTC(2024, 2, 1) })).toThrow(/Unsupported interval/);
    expect(() => assertArchiveRequest({ symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-03", nowMs: Date.UTC(2024, 2, 15) })).toThrow(/before the current UTC month/);
    expect(() => assertArchiveRequest({ symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-01", nowMs: Number.NaN })).toThrow(/clock/);
  });

  it("constructs the exact official monthly URLs and validates checksum records", () => {
    const descriptor = buildArchiveDescriptor("ETHUSDT", "4h", "2025-07");
    expect(descriptor.zipUrl).toBe("https://data.binance.vision/data/spot/monthly/klines/ETHUSDT/4h/ETHUSDT-4h-2025-07.zip");
    expect(descriptor.checksumUrl).toBe(`${descriptor.zipUrl}.CHECKSUM`);
    const hash = "a".repeat(64);
    expect(parseChecksumFile(`${hash}  ${descriptor.zipName}\n`, descriptor.zipName)).toBe(hash);
    expect(() => parseChecksumFile(`${hash}  BTCUSDT-4h-2025-07.zip\n`, descriptor.zipName)).toThrow(/expected archive/);
    expect(() => parseChecksumFile(`${hash}  ../${descriptor.zipName}\n`, descriptor.zipName)).toThrow();
  });

  it("normalizes legacy milliseconds and 2025 microseconds without precision loss", () => {
    expect(normalizeArchiveTimestamp("1704067200000")).toEqual({ milliseconds: 1704067200000, unit: "milliseconds" });
    expect(normalizeArchiveTimestamp("1735689600000000")).toEqual({ milliseconds: 1735689600000, unit: "microseconds" });
    expect(normalizeArchiveTimestamp("1735693199999999")).toEqual({ milliseconds: 1735693199999, unit: "microseconds" });
    expect(() => normalizeArchiveTimestamp("17356896000000")).toThrow(/precision or range/);
    expect(() => normalizeArchiveTimestamp("1.735e15")).toThrow(/integer string/);
  });

  it("parses strict millisecond and microsecond K-lines", () => {
    const oldOpen = Date.UTC(2024, 0, 1);
    const oldCsv = [row(oldOpen, "1h", "milliseconds"), row(oldOpen + 3_600_000, "1h", "milliseconds")].join("\n");
    const oldCandles = parseKlineCsv(oldCsv, { symbol: "BTCUSDT", interval: "1h", month: "2024-01", nowMs: Date.UTC(2024, 1, 1) });
    expect(oldCandles).toHaveLength(2);
    expect(oldCandles[1].openTimeMs).toBe(oldOpen + 3_600_000);

    const newOpen = Date.UTC(2025, 0, 1);
    const microCsv = [row(newOpen, "4h", "microseconds"), row(newOpen + 14_400_000, "4h", "microseconds")].join("\n");
    const microCandles = parseKlineCsv(microCsv, { symbol: "ETHUSDT", interval: "4h", month: "2025-01", nowMs: Date.UTC(2025, 1, 1) });
    expect(microCandles[0].openTimeMs).toBe(newOpen);
    expect(microCandles[0].closeTimeMs).toBe(newOpen + 14_400_000 - 1);
    const misalignedMicro = row(newOpen, "4h", "microseconds").replace(
      String(BigInt(newOpen) * 1_000n),
      String(BigInt(newOpen) * 1_000n + 1n),
    );
    expect(() => parseKlineCsv(misalignedMicro, { symbol: "ETHUSDT", interval: "4h", month: "2025-01", nowMs: Date.UTC(2025, 1, 1) })).toThrow(/sub-millisecond/);
  });

  it("audits only in-bucket legacy millisecond close-time normalization", () => {
    const open = Date.UTC(2017, 8, 6, 15);
    const step = 3_600_000;
    const canonical = row(open, "1h", "milliseconds");
    const legacyPlusOneMillisecond = canonical.replace(
      String(open + step - 1),
      String(open + step),
    );
    const parsed = parseKlineCsvWithAudit(legacyPlusOneMillisecond, {
      symbol: "BTCUSDT",
      interval: "1h",
      month: "2017-09",
      nowMs: Date.UTC(2017, 9, 1),
    });

    expect(parsed.candles[0].closeTimeMs).toBe(open + step - 1);
    expect(
      parsed.legacyMillisecondCloseTimeNormalizationCount,
    ).toBe(1);
    const partialOpen = Date.UTC(2017, 11, 18, 12);
    const partialCanonical = row(partialOpen, "1h", "milliseconds");
    const partialClose = partialOpen + 29 * 60_000 + 13_456;
    const partialLegacy = partialCanonical.replace(
      String(partialOpen + step - 1),
      String(partialClose),
    );
    const partialParsed = parseKlineCsvWithAudit(
      `${partialLegacy}\n${row(partialOpen + step, "1h", "milliseconds")}`,
      {
        symbol: "ETHUSDT",
        interval: "1h",
        month: "2017-12",
        nowMs: Date.UTC(2018, 0, 1),
      },
    );
    expect(partialParsed.candles[0].closeTimeMs).toBe(
      partialOpen + step - 1,
    );
    expect(
      partialParsed.legacyMillisecondCloseTimeNormalizationCount,
    ).toBe(1);
    const firstAfterOfficialGap = row(
      open + 8 * step,
      "1h",
      "milliseconds",
    );
    expect(() =>
      parseKlineCsv(
        `${legacyPlusOneMillisecond}\n${firstAfterOfficialGap}`,
        {
          symbol: "BTCUSDT",
          interval: "1h",
          month: "2017-09",
          nowMs: Date.UTC(2017, 9, 1),
        },
      ),
    ).toThrow(/not contiguous/);
    expect(() =>
      parseKlineCsv(
        canonical.replace(
          String(open + step - 1),
          String(open + step + 1),
        ),
        {
          symbol: "BTCUSDT",
          interval: "1h",
          month: "2017-09",
          nowMs: Date.UTC(2017, 9, 1),
        },
      ),
    ).toThrow(/does not span/);
    expect(() =>
      parseKlineCsv(
        canonical.replace(
          String(open + step - 1),
          String(open - 1),
        ),
        {
          symbol: "BTCUSDT",
          interval: "1h",
          month: "2017-09",
          nowMs: Date.UTC(2017, 9, 1),
        },
      ),
    ).toThrow(/does not span/);

    const microOpen = Date.UTC(2025, 0, 1);
    const microCanonical = row(microOpen, "1h", "microseconds");
    const microCanonicalClose =
      BigInt(microOpen + step - 1) * 1_000n + 999n;
    const microPlusOneMillisecond = microCanonical.replace(
      String(microCanonicalClose),
      String(BigInt(microOpen + step) * 1_000n),
    );
    expect(() =>
      parseKlineCsv(microPlusOneMillisecond, {
        symbol: "BTCUSDT",
        interval: "1h",
        month: "2025-01",
        nowMs: Date.UTC(2025, 1, 1),
      }),
    ).toThrow(/sub-millisecond/);
  });

  it("rejects malformed OHLCV, gaps, duplicates, wrong months, and forming candles", () => {
    const open = Date.UTC(2024, 0, 1);
    const options = { symbol: "BTCUSDT" as const, interval: "1h" as const, month: "2024-01", nowMs: Date.UTC(2024, 1, 1) };
    expect(() => parseKlineCsv(row(open, "1h", "milliseconds", { high: "99" }), options)).toThrow(/OHLC bounds/);
    expect(() => parseKlineCsv([row(open, "1h", "milliseconds"), row(open, "1h", "milliseconds")].join("\n"), options)).toThrow(/duplicates/);
    expect(() => parseKlineCsv([row(open, "1h", "milliseconds"), row(open + 7_200_000, "1h", "milliseconds")].join("\n"), options)).toThrow(/not contiguous/);
    expect(() => parseKlineCsv(row(open + 1_000, "1h", "milliseconds"), options)).toThrow(/UTC 1h boundary/);
    expect(() => parseKlineCsv(row(Date.UTC(2024, 1, 1), "1h", "milliseconds"), options)).toThrow(/outside 2024-01/);
    expect(() => parseKlineCsv(row(open, "1h", "milliseconds"), { ...options, nowMs: open + 3_600_000 - 1 })).toThrow(/future or still forming/);
    expect(() => parseKlineCsv("open,1,2,0.5,1,1,close,1,1,1,1,0", options)).toThrow(/timestamp/);
  });

  it("allows only explicit aligned intraday gaps and audits every missing bucket", () => {
    const open = Date.UTC(2024, 0, 1);
    const step = 3_600_000;
    const csv = [
      row(open, "1h", "milliseconds"),
      row(open + 3 * step, "1h", "milliseconds"),
    ].join("\n");
    const parsed = parseKlineCsvWithAudit(csv, {
      symbol: "BTCUSDT",
      interval: "1h",
      month: "2024-01",
      nowMs: Date.UTC(2024, 1, 1),
      allowGaps: true,
    });

    expect(parsed.gaps).toEqual([
      {
        previousClosedAt: new Date(open + step - 1).toISOString(),
        nextOpenedAt: new Date(open + 3 * step).toISOString(),
        missingCandleCount: 2,
      },
    ]);
    expect(() =>
      parseKlineCsvWithAudit(row(open, "1d", "milliseconds"), {
        symbol: "BTCUSDT",
        interval: "1d",
        month: "2024-01",
        nowMs: Date.UTC(2024, 1, 1),
        allowGaps: true,
      }),
    ).toThrow(/Daily archive gaps are never allowed/);
    expect(() =>
      parseKlineCsv(
        [
          row(open + 3 * step, "1h", "milliseconds"),
          row(open, "1h", "milliseconds"),
        ].join("\n"),
        {
          symbol: "BTCUSDT",
          interval: "1h",
          month: "2024-01",
          nowMs: Date.UTC(2024, 1, 1),
          allowGaps: true,
        },
      ),
    ).toThrow(/out of order/);
  });

  it("excludes and audits only legacy intraday rows shifted off UTC buckets", () => {
    const before = Date.UTC(2018, 1, 8, 3);
    const step = 3_600_000;
    const shift = 28 * 60_000 + 14_838;
    const shiftedRows = Array.from({ length: 43 }, (_, index) =>
      row(before + (index + 1) * step + shift, "1h", "milliseconds"),
    );
    const after = before + 44 * step;
    const parsed = parseKlineCsvWithAudit(
      [
        row(before, "1h", "milliseconds"),
        ...shiftedRows,
        row(after, "1h", "milliseconds"),
      ].join("\n"),
      {
        symbol: "BTCUSDT",
        interval: "1h",
        month: "2018-02",
        nowMs: Date.UTC(2018, 2, 1),
        allowGaps: true,
      },
    );

    expect(parsed).toMatchObject({
      sourceRowCount: 45,
      acceptedCandleCount: 2,
      excludedUnalignedCandleCount: 43,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      legacyMillisecondCloseTimeNormalizationCount: 0,
    });
    expect(parsed.candles.map((candle) => candle.openTimeMs)).toEqual([
      before,
      after,
    ]);
    expect(parsed.gaps).toEqual([
      {
        previousClosedAt: new Date(before + step - 1).toISOString(),
        nextOpenedAt: new Date(after).toISOString(),
        missingCandleCount: 43,
      },
    ]);

    const unaligned = before + step + shift;
    expect(() =>
      parseKlineCsv(row(unaligned, "1h", "microseconds"), {
        symbol: "ETHUSDT",
        interval: "1h",
        month: "2018-02",
        nowMs: Date.UTC(2018, 2, 1),
        allowGaps: true,
      }),
    ).toThrow(/\[ETHUSDT 1h 2018-02\].*not aligned/);
    expect(() =>
      parseKlineCsv(row(unaligned, "1d", "milliseconds"), {
        symbol: "BTCUSDT",
        interval: "1d",
        month: "2018-02",
        nowMs: Date.UTC(2018, 2, 1),
      }),
    ).toThrow(/\[BTCUSDT 1d 2018-02\].*not aligned/);
    expect(() =>
      parseKlineCsv(
        row(unaligned, "1h", "milliseconds", { high: "99" }),
        {
          symbol: "BTCUSDT",
          interval: "1h",
          month: "2018-02",
          nowMs: Date.UTC(2018, 2, 1),
          allowGaps: true,
        },
      ),
    ).toThrow(/OHLC bounds/);
  });

  it("excludes only bounded legacy intraday zero-volume placeholders", () => {
    const step = 3_600_000;
    const before = Date.UTC(2020, 11, 21, 13);
    const placeholderOpen = before + step;
    const placeholderClose = placeholderOpen - (12 * 60_000 + 39_475);
    const after = before + 5 * step;
    const placeholder = zeroVolumePlaceholder(
      placeholderOpen,
      placeholderClose,
      "milliseconds",
    );
    const parsed = parseKlineCsvWithAudit(
      [
        row(before, "1h", "milliseconds"),
        placeholder,
        row(after, "1h", "milliseconds"),
      ].join("\n"),
      {
        symbol: "ETHUSDT",
        interval: "1h",
        month: "2020-12",
        nowMs: Date.UTC(2021, 0, 1),
        allowGaps: true,
      },
    );

    expect(parsed).toMatchObject({
      sourceRowCount: 3,
      acceptedCandleCount: 2,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 1,
    });
    expect(parsed.candles.map((candle) => candle.openTimeMs)).toEqual([
      before,
      after,
    ]);
    expect(parsed.gaps).toEqual([
      {
        previousClosedAt: new Date(before + step - 1).toISOString(),
        nextOpenedAt: new Date(after).toISOString(),
        missingCandleCount: 4,
      },
    ]);

    const options = {
      symbol: "ETHUSDT" as const,
      interval: "1h" as const,
      month: "2020-12",
      nowMs: Date.UTC(2021, 0, 1),
      allowGaps: true,
    };
    expect(() =>
      parseKlineCsv(
        zeroVolumePlaceholder(
          placeholderOpen,
          placeholderOpen - step - 1,
          "milliseconds",
        ),
        options,
      ),
    ).toThrow(/does not span/);
    for (const nonZero of [
      { volume: "1" },
      { quoteVolume: "1" },
      { tradeCount: "1" },
      { takerBuyBaseVolume: "1" },
      { takerBuyQuoteVolume: "1" },
    ]) {
      expect(() =>
        parseKlineCsv(
          zeroVolumePlaceholder(
            placeholderOpen,
            placeholderClose,
            "milliseconds",
            nonZero,
          ),
          options,
        ),
      ).toThrow(/does not span/);
    }
    expect(() =>
      parseKlineCsv(
        zeroVolumePlaceholder(
          placeholderOpen,
          placeholderClose,
          "milliseconds",
          { close: "101" },
        ),
        options,
      ),
    ).toThrow(/OHLC bounds/);
    expect(() =>
      parseKlineCsv(
        zeroVolumePlaceholder(
          placeholderOpen,
          placeholderClose,
          "microseconds",
        ),
        options,
      ),
    ).toThrow(/does not span/);
    expect(() =>
      parseKlineCsv(
        zeroVolumePlaceholder(
          Date.UTC(2020, 11, 21),
          Date.UTC(2020, 11, 20, 23, 47, 20, 525),
          "milliseconds",
        ),
        { ...options, interval: "1d" as const, allowGaps: false },
      ),
    ).toThrow(/does not span/);
  });

  it("verifies SHA-256, extracts the expected CSV, and atomically publishes versioned artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "wise-crypto-archive-"));
    temporaryRoots.push(root);
    const privateRoot = join(root, "private");
    const archiveHash = sha256Hex(ZIP_FIXTURE);
    const fetchImpl: typeof fetch = async (url) => {
      const text = String(url);
      if (text.endsWith(".CHECKSUM")) {
        return new Response(`${archiveHash}  BTCUSDT-1h-2024-01.zip\n`, { status: 200 });
      }
      return new Response(ZIP_FIXTURE, { status: 200, headers: { "content-length": String(ZIP_FIXTURE.length) } });
    };
    const result = await buildBinanceHistoryBaseline({
      symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-01",
      nowMs: Date.UTC(2024, 2, 1), privateRoot, fetchImpl,
    });

    const manifest = JSON.parse(await readFile(join(result.outputRoot, "manifest.json"), "utf8"));
    const baselineText = await readFile(join(result.outputRoot, result.artifactName), "utf8");
    const baseline = JSON.parse(baselineText);
    expect(manifest.sources[0]).toMatchObject({
      month: "2024-01",
      sha256: archiveHash,
      sourceRowCount: 2,
      acceptedCandleCount: 2,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      legacyMillisecondCloseTimeNormalizationCount: 0,
    });
    expect(manifest).toMatchObject({ kind: "verified-kline-intermediate", runtimeReady: false, containsHistoricalCandles: true });
    expect(manifest.coverage.candleCount).toBe(2);
    expect(manifest.coverage).toMatchObject({
      sourceRowCount: 2,
      excludedUnalignedCandleCount: 0,
      excludedLegacyZeroVolumePlaceholderCount: 0,
      gapCount: 0,
      missingCandleCount: 0,
      segmentCount: 1,
    });
    expect(manifest.gaps).toEqual([]);
    expect(
      manifest.coverage.legacyMillisecondCloseTimeNormalizationCount,
    ).toBe(0);
    expect(manifest.artifact.sha256).toBe(sha256Hex(baselineText));
    expect(manifest.artifact.bytes).toBe(Buffer.byteLength(baselineText));
    expect(baseline.candles).toEqual([
      [1704067200000, 100, 105, 95, 102, 10, 1704070799999],
      [1704070800000, 102, 106, 101, 104, 11, 1704074399999],
    ]);
    expect(await readFile(join(privateRoot, "raw/spot/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2024-01.zip"))).toEqual(ZIP_FIXTURE);
    expect((await readdir(result.outputRoot)).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect((await readdir(join(privateRoot, "cache/v2/BTCUSDT/1h"))).some((name) => name.endsWith(".tmp"))).toBe(false);
    const [cacheName] = await readdir(
      join(privateRoot, "cache/v2/BTCUSDT/1h"),
    );
    const cache = JSON.parse(
      await readFile(
        join(privateRoot, "cache/v2/BTCUSDT/1h", cacheName),
        "utf8",
      ),
    );
    expect(
      cache.legacyMillisecondCloseTimeNormalizationCount,
    ).toBe(0);
  });

  it("does not publish a manifest when the official checksum does not match", async () => {
    const root = await mkdtemp(join(tmpdir(), "wise-crypto-archive-bad-"));
    temporaryRoots.push(root);
    const fetchImpl: typeof fetch = async (url) => new Response(
      String(url).endsWith(".CHECKSUM")
        ? `${"0".repeat(64)}  BTCUSDT-1h-2024-01.zip\n`
        : ZIP_FIXTURE,
      { status: 200 },
    );
    await expect(buildBinanceHistoryBaseline({
      symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-01",
      nowMs: Date.UTC(2024, 2, 1), privateRoot: join(root, "private"),
      fetchImpl,
    })).rejects.toThrow(/\[BTCUSDT 1h 2024-01\].*SHA-256 mismatch/);
    await expect(readFile(join(root, "private/verified/v2/BTCUSDT/1h/manifest.json"))).rejects.toThrow();
  });

  it("refuses to publish full-candle intermediates outside the private root", async () => {
    const root = await mkdtemp(join(tmpdir(), "wise-crypto-archive-path-"));
    temporaryRoots.push(root);
    await expect(buildBinanceHistoryBaseline({
      symbol: "BTCUSDT", interval: "1h", from: "2024-01", to: "2024-01",
      nowMs: Date.UTC(2024, 2, 1), privateRoot: join(root, "private"),
      verifiedRoot: join(root, "public-data"), fetchImpl: async () => new Response(),
    })).rejects.toThrow(/must stay below the private root/);
  });

  it("refreshes the official checksum while reusing a previously verified ZIP", async () => {
    const root = await mkdtemp(join(tmpdir(), "wise-crypto-archive-cache-"));
    temporaryRoots.push(root);
    const privateRoot = join(root, "private");
    const archiveHash = sha256Hex(ZIP_FIXTURE);
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith(".CHECKSUM")) {
        return new Response(`${archiveHash}  BTCUSDT-1h-2024-01.zip\n`, { status: 200 });
      }
      return new Response(ZIP_FIXTURE, { status: 200 });
    };
    const options = {
      symbol: "BTCUSDT" as const, interval: "1h" as const, from: "2024-01", to: "2024-01",
      nowMs: Date.UTC(2024, 2, 1), privateRoot, fetchImpl,
    };

    await buildBinanceHistoryBaseline(options);
    requestedUrls.length = 0;
    await buildBinanceHistoryBaseline(options);

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toMatch(/\.zip\.CHECKSUM$/);
  });
});

function row(openTimeMs: number, interval: "1h" | "4h" | "1d", unit: "milliseconds" | "microseconds", override: { high?: string } = {}): string {
  const step = interval === "1h" ? 3_600_000 : interval === "4h" ? 14_400_000 : 86_400_000;
  const closeTimeMs = openTimeMs + step - 1;
  const encode = (value: number, isClose = false) => unit === "milliseconds" ? String(value) : String(BigInt(value) * 1_000n + (isClose ? 999n : 0n));
  return [
    encode(openTimeMs), "100", override.high ?? "105", "95", "102", "10",
    encode(closeTimeMs, true), "1000", "20", "5", "500", "0",
  ].join(",");
}

function zeroVolumePlaceholder(
  openTimeMs: number,
  closeTimeMs: number,
  unit: "milliseconds" | "microseconds",
  override: {
    close?: string;
    volume?: string;
    quoteVolume?: string;
    tradeCount?: string;
    takerBuyBaseVolume?: string;
    takerBuyQuoteVolume?: string;
  } = {},
): string {
  const encode = (value: number, isClose = false) =>
    unit === "milliseconds"
      ? String(value)
      : String(BigInt(value) * 1_000n + (isClose ? 999n : 0n));
  return [
    encode(openTimeMs),
    "100",
    "100",
    "100",
    override.close ?? "100",
    override.volume ?? "0",
    encode(closeTimeMs, true),
    override.quoteVolume ?? "0",
    override.tradeCount ?? "0",
    override.takerBuyBaseVolume ?? "0",
    override.takerBuyQuoteVolume ?? "0",
    "0",
  ].join(",");
}
