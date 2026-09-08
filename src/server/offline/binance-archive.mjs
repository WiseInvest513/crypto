import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

export const BINANCE_ARCHIVE_BASE_URL = "https://data.binance.vision";
export const BINANCE_BASELINE_SCHEMA_VERSION = 2;
export const BINANCE_ARCHIVE_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT"]);
export const BINANCE_ARCHIVE_INTERVALS = Object.freeze(["1h", "4h", "1d"]);

const INTERVAL_MILLISECONDS = Object.freeze({
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": 24 * 60 * 60 * 1_000,
});
const MICROSECOND_THRESHOLD = 1_000_000_000_000_000n;
const MILLISECOND_THRESHOLD = 1_000_000_000_000n;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_CSV_BYTES = 128 * 1024 * 1024;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER = /^(?:0|[1-9]\d*)$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function assertArchiveRequest({ symbol, interval, from, to, nowMs = Date.now() }) {
  assertNowMs(nowMs);
  if (!BINANCE_ARCHIVE_SYMBOLS.includes(symbol)) {
    throw new TypeError(`Unsupported symbol: ${String(symbol)}`);
  }
  if (!BINANCE_ARCHIVE_INTERVALS.includes(interval)) {
    throw new TypeError(`Unsupported interval: ${String(interval)}`);
  }
  const fromMs = parseMonth(from);
  const toMs = parseMonth(to);
  if (fromMs > toMs) {
    throw new RangeError("Archive month range must be chronological.");
  }
  const currentMonth = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), 1);
  if (toMs >= currentMonth) {
    throw new RangeError("Monthly archives must end before the current UTC month.");
  }
  const months = enumerateMonths(from, to);
  if (months.length > 240) {
    throw new RangeError("Archive build is limited to 240 explicitly requested months.");
  }
  return Object.freeze({ symbol, interval, from, to, months });
}

export function enumerateMonths(from, to) {
  const start = parseMonth(from);
  const end = parseMonth(to);
  if (start > end) {
    throw new RangeError("Archive month range must be chronological.");
  }
  const months = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function buildArchiveDescriptor(symbol, interval, month) {
  assertScope(symbol, interval);
  parseMonth(month);
  const stem = `${symbol}-${interval}-${month}`;
  const path = `/data/spot/monthly/klines/${symbol}/${interval}/${stem}.zip`;
  return Object.freeze({
    symbol,
    interval,
    month,
    stem,
    zipName: `${stem}.zip`,
    csvName: `${stem}.csv`,
    checksumName: `${stem}.zip.CHECKSUM`,
    zipUrl: `${BINANCE_ARCHIVE_BASE_URL}${path}`,
    checksumUrl: `${BINANCE_ARCHIVE_BASE_URL}${path}.CHECKSUM`,
  });
}

export function parseChecksumFile(text, expectedZipName) {
  if (typeof text !== "string" || !/^[A-Za-z0-9-]+\.zip$/.test(expectedZipName)) {
    throw new TypeError("Invalid checksum input.");
  }
  const lines = text.trim().split(/\r?\n/);
  if (lines.length !== 1) {
    throw new TypeError("Checksum file must contain exactly one record.");
  }
  const match = /^([a-fA-F0-9]{64})\s+\*?([^/\\\s]+)$/.exec(lines[0]);
  if (!match || match[2] !== expectedZipName) {
    throw new TypeError("Checksum file does not name the expected archive.");
  }
  return match[1].toLowerCase();
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeArchiveTimestamp(raw) {
  if (typeof raw !== "string" || !INTEGER.test(raw)) {
    throw new TypeError("Archive timestamp must be an unsigned integer string.");
  }
  const value = BigInt(raw);
  let milliseconds;
  let unit;
  if (value >= MICROSECOND_THRESHOLD) {
    milliseconds = value / 1_000n;
    unit = "microseconds";
  } else if (value >= MILLISECOND_THRESHOLD && value < 10_000_000_000_000n) {
    milliseconds = value;
    unit = "milliseconds";
  } else {
    throw new RangeError("Archive timestamp has an unsupported precision or range.");
  }
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Archive timestamp exceeds JavaScript's safe range.");
  }
  return Object.freeze({ milliseconds: Number(milliseconds), unit });
}

export function parseKlineCsv(csv, { symbol, interval, month, nowMs = Date.now(), allowGaps = false }) {
  return parseKlineCsvWithAudit(csv, { symbol, interval, month, nowMs, allowGaps }).candles;
}

export function parseKlineCsvWithAudit(csv, { symbol, interval, month, nowMs = Date.now(), allowGaps = false }) {
  try {
    assertScope(symbol, interval);
    assertGapMode(interval, allowGaps);
    parseMonth(month);
    assertNowMs(nowMs);
    if (typeof csv !== "string" || csv.length === 0) {
      throw new TypeError("Archive CSV must be non-empty text.");
    }
    const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new TypeError("Archive CSV has no records.");
    }
    const records = lines.map((line, index) => parseKlineRow(line, {
      symbol,
      interval,
      month,
      nowMs,
      rowNumber: index + 1,
    }));
    const acceptedRecords = records.filter(
      (record) => record.kind === "accepted",
    );
    const excludedUnalignedCandleCount = records.filter(
      (record) => record.kind === "excluded-unaligned",
    ).length;
    const excludedLegacyZeroVolumePlaceholderCount = records.filter(
      (record) => record.kind === "excluded-legacy-zero-volume-placeholder",
    ).length;
    const candles = acceptedRecords.map((record) => record.candle);
    if (candles.length === 0) {
      const reason = excludedUnalignedCandleCount === records.length
        ? `legacy intraday candle(s) not aligned to a UTC ${interval} boundary`
        : excludedLegacyZeroVolumePlaceholderCount === records.length
          ? "legacy intraday zero-volume placeholder row(s)"
          : "excluded legacy intraday row(s)";
      throw new TypeError(
        `Archive CSV contains only ${records.length} ${reason}; exclusions cannot remove the entire source month.`,
      );
    }
    validateCandleSeries(candles, { interval, nowMs, allowGaps });
    return Object.freeze({
      candles,
      sourceRowCount: lines.length,
      acceptedCandleCount: candles.length,
      excludedUnalignedCandleCount,
      excludedLegacyZeroVolumePlaceholderCount,
      gaps: Object.freeze(findCandleGaps(candles, interval)),
      legacyMillisecondCloseTimeNormalizationCount: acceptedRecords.reduce(
        (count, record) =>
          count + (record.legacyMillisecondCloseTimeNormalized ? 1 : 0),
        0,
      ),
    });
  } catch (error) {
    throw withArchiveContext(error, { symbol, interval, month });
  }
}

export function validateCandleSeries(candles, { interval, nowMs = Date.now(), allowGaps = false }) {
  assertNowMs(nowMs);
  assertGapMode(interval, allowGaps);
  if (!BINANCE_ARCHIVE_INTERVALS.includes(interval) || !Array.isArray(candles) || candles.length === 0) {
    throw new TypeError("A supported interval and non-empty candle array are required.");
  }
  const step = INTERVAL_MILLISECONDS[interval];
  const seen = new Set();
  for (const [index, candle] of candles.entries()) {
    if (!Number.isSafeInteger(candle.openTimeMs) || !Number.isSafeInteger(candle.closeTimeMs)) {
      throw new TypeError(`Candle ${index + 1} has an invalid timestamp.`);
    }
    if (seen.has(candle.openTimeMs)) {
      throw new TypeError(`Candle ${index + 1} duplicates an open timestamp.`);
    }
    seen.add(candle.openTimeMs);
    if (candle.closeTimeMs !== candle.openTimeMs + step - 1) {
      throw new TypeError(`Candle ${index + 1} does not span one complete ${interval} interval.`);
    }
    if (candle.openTimeMs % step !== 0) {
      throw new TypeError(`Candle ${index + 1} is not aligned to a UTC ${interval} boundary.`);
    }
    if (candle.closeTimeMs >= nowMs) {
      throw new RangeError(`Candle ${index + 1} is future or still forming.`);
    }
    if (index > 0) {
      const expectedOpenTimeMs = candles[index - 1].openTimeMs + step;
      const delta = candle.openTimeMs - candles[index - 1].openTimeMs;
      if (
        (!allowGaps && candle.openTimeMs !== expectedOpenTimeMs) ||
        (allowGaps && (delta < step || delta % step !== 0))
      ) {
        throw new TypeError(
          `Candle ${index + 1} is out of order or the series is not contiguous: expected ${new Date(expectedOpenTimeMs).toISOString()}, received ${new Date(candle.openTimeMs).toISOString()}.`,
        );
      }
    }
  }
  return candles;
}

export function findCandleGaps(candles, interval) {
  if (!BINANCE_ARCHIVE_INTERVALS.includes(interval) || !Array.isArray(candles)) {
    throw new TypeError("A supported interval and candle array are required.");
  }
  const step = INTERVAL_MILLISECONDS[interval];
  const gaps = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const next = candles[index];
    const delta = next.openTimeMs - previous.openTimeMs;
    if (delta > step) {
      gaps.push(Object.freeze({
        previousClosedAt: new Date(previous.closeTimeMs).toISOString(),
        nextOpenedAt: new Date(next.openTimeMs).toISOString(),
        missingCandleCount: delta / step - 1,
      }));
    }
  }
  return gaps;
}

export async function extractKlineCsv(zipPath, expectedCsvName, options = {}) {
  if (basename(zipPath) === zipPath || !/^[A-Za-z0-9-]+\.csv$/.test(expectedCsvName)) {
    throw new TypeError("Archive extraction requires an explicit path and safe CSV name.");
  }
  const command = options.unzipCommand ?? "unzip";
  const listing = await runCommand(command, ["-Z1", zipPath], 1024 * 1024);
  const entries = listing.toString("utf8").trim().split(/\r?\n/).filter(Boolean);
  if (entries.length !== 1 || entries[0] !== expectedCsvName) {
    throw new TypeError("Archive must contain exactly the expected root-level CSV file.");
  }
  const output = await runCommand(command, ["-p", zipPath, expectedCsvName], MAX_CSV_BYTES);
  return output.toString("utf8");
}

export async function buildBinanceHistoryBaseline(options) {
  const nowMs = options.nowMs ?? Date.now();
  const request = assertArchiveRequest({ ...options, nowMs });
  const allowGaps = options.allowGaps === true;
  assertGapMode(request.interval, allowGaps);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }
  const privateRoot = resolve(options.privateRoot ?? ".wise-crypto-private/binance-history");
  const verifiedRoot = resolve(options.verifiedRoot ?? join(privateRoot, "verified"));
  const verifiedRelative = relative(privateRoot, verifiedRoot);
  if (verifiedRelative === "" || verifiedRelative.startsWith("..") || isAbsolute(verifiedRelative)) {
    throw new TypeError("Verified candle artifacts must stay below the private root.");
  }
  const rawRoot = join(privateRoot, "raw", "spot", "monthly", "klines", request.symbol, request.interval);
  const cacheRoot = join(
    privateRoot,
    "cache",
    `v${BINANCE_BASELINE_SCHEMA_VERSION}`,
    request.symbol,
    request.interval,
  );
  await Promise.all([mkdir(rawRoot, { recursive: true }), mkdir(cacheRoot, { recursive: true })]);

  const sourceFiles = [];
  const candles = [];
  for (const month of request.months) {
    const descriptor = buildArchiveDescriptor(request.symbol, request.interval, month);
    try {
    const zipPath = join(rawRoot, descriptor.zipName);
    const checksumPath = join(rawRoot, descriptor.checksumName);
    // Always refresh the tiny official checksum. A cached ZIP is reusable only
    // after it still matches the checksum published for this build.
    await ensureDownloaded(descriptor.checksumUrl, checksumPath, fetchImpl, true);
    await ensureDownloaded(descriptor.zipUrl, zipPath, fetchImpl, options.refresh === true);
    const expectedHash = parseChecksumFile(await readFile(checksumPath, "utf8"), descriptor.zipName);
    const archive = await readFile(zipPath);
    const actualHash = sha256Hex(archive);
    if (actualHash !== expectedHash) {
      throw new Error(`SHA-256 mismatch for ${descriptor.zipName}.`);
    }
    const csv = await extractKlineCsv(zipPath, descriptor.csvName, { unzipCommand: options.unzipCommand });
    const parsedMonth = parseKlineCsvWithAudit(csv, {
      symbol: request.symbol,
      interval: request.interval,
      month,
      nowMs,
      allowGaps,
    });
    const monthCandles = parsedMonth.candles;
    const previousCandle = candles.at(-1);
    if (previousCandle) {
      validateCandleSeries([previousCandle, monthCandles[0]], {
        interval: request.interval,
        nowMs,
        allowGaps,
      });
    }
    await atomicWriteJson(join(cacheRoot, `${descriptor.stem}.${actualHash}.json`), {
      schemaVersion: BINANCE_BASELINE_SCHEMA_VERSION,
      sourceSha256: actualHash,
      symbol: request.symbol,
      interval: request.interval,
      month,
      sourceRowCount: parsedMonth.sourceRowCount,
      acceptedCandleCount: parsedMonth.acceptedCandleCount,
      excludedUnalignedCandleCount:
        parsedMonth.excludedUnalignedCandleCount,
      excludedLegacyZeroVolumePlaceholderCount:
        parsedMonth.excludedLegacyZeroVolumePlaceholderCount,
      legacyMillisecondCloseTimeNormalizationCount:
        parsedMonth.legacyMillisecondCloseTimeNormalizationCount,
      gapCount: parsedMonth.gaps.length,
      missingCandleCount: parsedMonth.gaps.reduce(
        (count, gap) => count + gap.missingCandleCount,
        0,
      ),
      gaps: parsedMonth.gaps,
      candles: monthCandles.map(compactCandle),
    });
    sourceFiles.push({
      month,
      url: descriptor.zipUrl,
      checksumUrl: descriptor.checksumUrl,
      sha256: actualHash,
      sourceRowCount: parsedMonth.sourceRowCount,
      acceptedCandleCount: monthCandles.length,
      excludedUnalignedCandleCount:
        parsedMonth.excludedUnalignedCandleCount,
      excludedLegacyZeroVolumePlaceholderCount:
        parsedMonth.excludedLegacyZeroVolumePlaceholderCount,
      legacyMillisecondCloseTimeNormalizationCount:
        parsedMonth.legacyMillisecondCloseTimeNormalizationCount,
      firstOpenTimeMs: monthCandles[0].openTimeMs,
      lastCloseTimeMs: monthCandles.at(-1).closeTimeMs,
    });
    candles.push(...monthCandles);
    } catch (error) {
      throw withArchiveContext(error, descriptor);
    }
  }
  try {
    validateCandleSeries(candles, {
      interval: request.interval,
      nowMs,
      allowGaps,
    });
  } catch (error) {
    throw withArchiveContext(error, {
      symbol: request.symbol,
      interval: request.interval,
      month: request.to,
    });
  }
  const gaps = findCandleGaps(candles, request.interval);
  const missingCandleCount = gaps.reduce(
    (count, gap) => count + gap.missingCandleCount,
    0,
  );

  const baselineCore = {
    schemaVersion: BINANCE_BASELINE_SCHEMA_VERSION,
    provider: "binance-public-data",
    market: "spot",
    symbol: request.symbol,
    interval: request.interval,
    timestampUnit: "milliseconds",
    coverage: {
      fromMonth: request.from,
      toMonth: request.to,
      firstOpenTimeMs: candles[0].openTimeMs,
      lastCloseTimeMs: candles.at(-1).closeTimeMs,
      sourceRowCount: sourceFiles.reduce(
        (count, source) => count + source.sourceRowCount,
        0,
      ),
      candleCount: candles.length,
      excludedUnalignedCandleCount: sourceFiles.reduce(
        (count, source) => count + source.excludedUnalignedCandleCount,
        0,
      ),
      excludedLegacyZeroVolumePlaceholderCount: sourceFiles.reduce(
        (count, source) =>
          count + source.excludedLegacyZeroVolumePlaceholderCount,
        0,
      ),
      gapCount: gaps.length,
      missingCandleCount,
      segmentCount: gaps.length + 1,
      legacyMillisecondCloseTimeNormalizationCount: sourceFiles.reduce(
        (count, source) =>
          count + source.legacyMillisecondCloseTimeNormalizationCount,
        0,
      ),
    },
    candles: candles.map(compactCandle),
  };
  const datasetVersion = sha256Hex(stableJson(baselineCore));
  const baseline = { ...baselineCore, datasetVersion };
  const baselineText = stableJson(baseline);
  const publishedBaseline = `${baselineText}\n`;
  const artifactSha256 = sha256Hex(publishedBaseline);
  const outputRoot = join(verifiedRoot, `v${BINANCE_BASELINE_SCHEMA_VERSION}`, request.symbol, request.interval);
  const artifactName = `baseline-${datasetVersion}.json`;
  const versionedManifestName = `manifest-${datasetVersion}.json`;
  const manifest = {
    schemaVersion: BINANCE_BASELINE_SCHEMA_VERSION,
    kind: "verified-kline-intermediate",
    runtimeReady: false,
    containsHistoricalCandles: true,
    datasetVersion,
    generatedAt: new Date(nowMs).toISOString(),
    symbol: request.symbol,
    interval: request.interval,
    coverage: baseline.coverage,
    artifact: {
      file: artifactName,
      sha256: artifactSha256,
      bytes: Buffer.byteLength(publishedBaseline),
    },
    sources: sourceFiles,
    gaps,
  };
  await mkdir(outputRoot, { recursive: true });
  const artifactPath = join(outputRoot, artifactName);
  await atomicWriteFile(artifactPath, publishedBaseline);
  const publishedBytes = await readFile(artifactPath);
  if (
    publishedBytes.byteLength !== manifest.artifact.bytes ||
    sha256Hex(publishedBytes) !== manifest.artifact.sha256
  ) {
    throw new Error("Published verified candle artifact failed its byte audit.");
  }
  await atomicWriteJson(join(outputRoot, versionedManifestName), manifest);
  await atomicWriteJson(join(outputRoot, "manifest.json"), manifest);
  return Object.freeze({
    outputRoot,
    artifactName,
    manifestName: "manifest.json",
    manifest,
    verifiedCandles: Object.freeze([...candles]),
  });
}

export async function atomicWriteFile(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, value, { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    try {
      const temporaryStat = await stat(temporary);
      if (temporaryStat.isFile()) {
        await unlink(temporary);
      }
    } catch {}
    throw error;
  }
}

function parseKlineRow(line, { symbol, interval, month, nowMs, rowNumber }) {
  const columns = line.split(",");
  if (columns.length !== 12) {
    throw new TypeError(`CSV row ${rowNumber} must contain exactly 12 columns.`);
  }
  const openTime = normalizeArchiveTimestamp(columns[0]);
  const closeTime = normalizeArchiveTimestamp(columns[6]);
  if (openTime.unit !== closeTime.unit) {
    throw new TypeError(`CSV row ${rowNumber} mixes timestamp units.`);
  }
  if (
    openTime.unit === "microseconds" &&
    (BigInt(columns[0]) % 1_000n !== 0n || BigInt(columns[6]) % 1_000n !== 999n)
  ) {
    throw new TypeError(
      `CSV row ${rowNumber} has a sub-millisecond K-line boundary.`,
    );
  }
  const step = INTERVAL_MILLISECONDS[interval];
  const expectedCloseTimeMs = openTime.milliseconds + step - 1;
  const legacyMillisecondCloseTimeNormalized =
    openTime.unit === "milliseconds" &&
    closeTime.milliseconds !== expectedCloseTimeMs &&
    closeTime.milliseconds >= openTime.milliseconds &&
    closeTime.milliseconds <= openTime.milliseconds + step;
  const normalizedCloseTimeMs = legacyMillisecondCloseTimeNormalized
    ? expectedCloseTimeMs
    : closeTime.milliseconds;
  if (new Date(openTime.milliseconds).toISOString().slice(0, 7) !== month) {
    throw new TypeError(`CSV row ${rowNumber} falls outside ${month}.`);
  }
  const open = parseDecimal(columns[1], "open", rowNumber, true);
  const high = parseDecimal(columns[2], "high", rowNumber, true);
  const low = parseDecimal(columns[3], "low", rowNumber, true);
  const close = parseDecimal(columns[4], "close", rowNumber, true);
  const volume = parseDecimal(columns[5], "volume", rowNumber, false);
  const quoteVolume = parseDecimal(
    columns[7],
    "quote volume",
    rowNumber,
    false,
  );
  const tradeCount = parseInteger(columns[8], "trade count", rowNumber);
  const takerBuyBaseVolume = parseDecimal(
    columns[9],
    "taker buy base volume",
    rowNumber,
    false,
  );
  const takerBuyQuoteVolume = parseDecimal(
    columns[10],
    "taker buy quote volume",
    rowNumber,
    false,
  );
  parseDecimal(columns[11], "ignore", rowNumber, false);
  if (high < Math.max(open, low, close) || low > Math.min(open, high, close)) {
    throw new TypeError(`CSV row ${rowNumber} violates OHLC bounds.`);
  }
  const isLegacyZeroVolumePlaceholder =
    openTime.unit === "milliseconds" &&
    interval !== "1d" &&
    openTime.milliseconds % step === 0 &&
    closeTime.milliseconds >= openTime.milliseconds - step &&
    closeTime.milliseconds < openTime.milliseconds &&
    open === high &&
    open === low &&
    open === close &&
    volume === 0 &&
    quoteVolume === 0 &&
    tradeCount === 0 &&
    takerBuyBaseVolume === 0 &&
    takerBuyQuoteVolume === 0 &&
    expectedCloseTimeMs < nowMs;
  if (isLegacyZeroVolumePlaceholder) {
    return Object.freeze({
      kind: "excluded-legacy-zero-volume-placeholder",
    });
  }
  const candle = Object.freeze({
    symbol,
    interval,
    openTimeMs: openTime.milliseconds,
    open,
    high,
    low,
    close,
    volume,
    closeTimeMs: normalizedCloseTimeMs,
  });
  if (openTime.milliseconds % step !== 0) {
    if (openTime.unit !== "milliseconds" || interval === "1d") {
      throw new TypeError(
        `CSV row ${rowNumber} is not aligned to a UTC ${interval} boundary.`,
      );
    }
    if (
      normalizedCloseTimeMs !== expectedCloseTimeMs ||
      normalizedCloseTimeMs >= nowMs
    ) {
      throw new TypeError(
        `CSV row ${rowNumber} is not a complete closed legacy ${interval} candle.`,
      );
    }
    return Object.freeze({
      kind: "excluded-unaligned",
    });
  }
  validateCandleSeries([candle], { interval, nowMs });
  return Object.freeze({
    kind: "accepted",
    candle,
    legacyMillisecondCloseTimeNormalized,
  });
}

function parseDecimal(raw, field, rowNumber, positive) {
  if (!DECIMAL.test(raw)) {
    throw new TypeError(`CSV row ${rowNumber} has an invalid ${field}.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new RangeError(`CSV row ${rowNumber} has an out-of-range ${field}.`);
  }
  return value;
}

function parseInteger(raw, field, rowNumber) {
  if (!INTEGER.test(raw)) {
    throw new TypeError(`CSV row ${rowNumber} has an invalid ${field}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`CSV row ${rowNumber} has an out-of-range ${field}.`);
  }
  return value;
}

function compactCandle(candle) {
  return [candle.openTimeMs, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.closeTimeMs];
}

function stableJson(value) {
  return JSON.stringify(value);
}

function parseMonth(value) {
  if (typeof value !== "string" || !MONTH.test(value)) {
    throw new TypeError(`Invalid UTC month: ${String(value)}`);
  }
  const [year, month] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, 1);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 7) !== value) {
    throw new TypeError(`Invalid UTC month: ${value}`);
  }
  return timestamp;
}

function assertScope(symbol, interval) {
  if (!BINANCE_ARCHIVE_SYMBOLS.includes(symbol) || !BINANCE_ARCHIVE_INTERVALS.includes(interval)) {
    throw new TypeError("Only BTCUSDT/ETHUSDT and 1h/4h/1d spot archives are supported.");
  }
}

function assertGapMode(interval, allowGaps) {
  if (typeof allowGaps !== "boolean") {
    throw new TypeError("Archive gap mode must be boolean.");
  }
  if (allowGaps && interval === "1d") {
    throw new TypeError("Daily archive gaps are never allowed.");
  }
}

function assertNowMs(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new TypeError("Archive clock must be a positive safe millisecond timestamp.");
  }
}

function withArchiveContext(error, { symbol, interval, month }) {
  const prefix = `[${String(symbol)} ${String(interval)} ${String(month)}]`;
  if (error instanceof Error && error.message.startsWith(prefix)) {
    return error;
  }
  const message = `${prefix} ${error instanceof Error ? error.message : "Unknown archive error."}`;
  if (error instanceof RangeError) return new RangeError(message);
  if (error instanceof TypeError) return new TypeError(message);
  return new Error(message);
}

async function atomicWriteJson(path, value) {
  await atomicWriteFile(path, `${stableJson(value)}\n`);
}

async function ensureDownloaded(url, path, fetchImpl, refresh) {
  if (!refresh) {
    try {
      const existing = await stat(path);
      if (existing.isFile() && existing.size > 0 && existing.size <= MAX_ARCHIVE_BYTES) return;
    } catch {}
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Binance archive request failed with HTTP ${response.status}.`);
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_ARCHIVE_BYTES) {
      throw new RangeError("Binance archive response exceeds the size limit.");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
      throw new RangeError("Binance archive response has an invalid size.");
    }
    await atomicWriteFile(path, bytes);
  } finally {
    clearTimeout(timer);
  }
}

function runCommand(command, args, maxBytes) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const output = [];
    const errors = [];
    let total = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(error);
    };
    child.stdout.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        fail(new RangeError("Uncompressed archive exceeds the size limit."));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`Archive extraction failed (${code}): ${Buffer.concat(errors).toString("utf8").trim()}`));
        return;
      }
      resolvePromise(Buffer.concat(output));
    });
  });
}
