export type BinanceArchiveSymbol = "BTCUSDT" | "ETHUSDT";
export type BinanceArchiveInterval = "1h" | "4h" | "1d";

export type VerifiedArchiveCandle = Readonly<{
  symbol: BinanceArchiveSymbol;
  interval: BinanceArchiveInterval;
  openTimeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTimeMs: number;
}>;

export type BinanceArchiveGap = Readonly<{
  /** The canonical close of the last verified candle before the gap. */
  previousClosedAt: string;
  /** The aligned open of the first verified candle after the gap. */
  nextOpenedAt: string;
  missingCandleCount: number;
}>;

export type BinanceArchiveRequest = Readonly<{
  symbol: BinanceArchiveSymbol;
  interval: BinanceArchiveInterval;
  from: string;
  to: string;
  months: readonly string[];
}>;

export type BinanceArchiveBuildOptions = Readonly<{
  symbol: BinanceArchiveSymbol;
  interval: BinanceArchiveInterval;
  from: string;
  to: string;
  nowMs?: number;
  privateRoot?: string;
  verifiedRoot?: string;
  refresh?: boolean;
  /** Allowed only for intraday streams. Missing buckets remain explicit. */
  allowGaps?: boolean;
  unzipCommand?: string;
  fetchImpl?: typeof fetch;
}>;

export const BINANCE_ARCHIVE_BASE_URL: "https://data.binance.vision";
export const BINANCE_BASELINE_SCHEMA_VERSION: 2;
export const BINANCE_ARCHIVE_SYMBOLS: readonly BinanceArchiveSymbol[];
export const BINANCE_ARCHIVE_INTERVALS: readonly BinanceArchiveInterval[];

export function assertArchiveRequest(input: {
  symbol: string;
  interval: string;
  from: string;
  to: string;
  nowMs?: number;
}): BinanceArchiveRequest;

export function enumerateMonths(from: string, to: string): readonly string[];

export function buildArchiveDescriptor(
  symbol: BinanceArchiveSymbol,
  interval: BinanceArchiveInterval,
  month: string,
): Readonly<{
  symbol: BinanceArchiveSymbol;
  interval: BinanceArchiveInterval;
  month: string;
  stem: string;
  zipName: string;
  csvName: string;
  checksumName: string;
  zipUrl: string;
  checksumUrl: string;
}>;

export function parseChecksumFile(text: string, expectedZipName: string): string;
export function sha256Hex(value: string | Uint8Array): string;
export function normalizeArchiveTimestamp(raw: string): Readonly<{
  milliseconds: number;
  unit: "milliseconds" | "microseconds";
}>;

export function parseKlineCsv(
  csv: string,
  options: Readonly<{
    symbol: BinanceArchiveSymbol;
    interval: BinanceArchiveInterval;
    month: string;
    nowMs?: number;
    allowGaps?: boolean;
  }>,
): readonly VerifiedArchiveCandle[];

export function parseKlineCsvWithAudit(
  csv: string,
  options: Readonly<{
    symbol: BinanceArchiveSymbol;
    interval: BinanceArchiveInterval;
    month: string;
    nowMs?: number;
    allowGaps?: boolean;
  }>,
): Readonly<{
  candles: readonly VerifiedArchiveCandle[];
  sourceRowCount: number;
  acceptedCandleCount: number;
  excludedUnalignedCandleCount: number;
  excludedLegacyZeroVolumePlaceholderCount: number;
  gaps: readonly BinanceArchiveGap[];
  legacyMillisecondCloseTimeNormalizationCount: number;
}>;

export function validateCandleSeries(
  candles: readonly VerifiedArchiveCandle[],
  options: Readonly<{
    interval: BinanceArchiveInterval;
    nowMs?: number;
    allowGaps?: boolean;
  }>,
): readonly VerifiedArchiveCandle[];

export function findCandleGaps(
  candles: readonly VerifiedArchiveCandle[],
  interval: BinanceArchiveInterval,
): readonly BinanceArchiveGap[];

export function extractKlineCsv(
  zipPath: string,
  expectedCsvName: string,
  options?: Readonly<{ unzipCommand?: string }>,
): Promise<string>;

export function buildBinanceHistoryBaseline(options: BinanceArchiveBuildOptions): Promise<Readonly<{
  outputRoot: string;
  artifactName: string;
  manifestName: "manifest.json";
  manifest: Readonly<{
    schemaVersion: 2;
    kind: "verified-kline-intermediate";
    runtimeReady: false;
    containsHistoricalCandles: true;
    datasetVersion: string;
    generatedAt: string;
    symbol: BinanceArchiveSymbol;
    interval: BinanceArchiveInterval;
    coverage: Readonly<{
      fromMonth: string;
      toMonth: string;
      firstOpenTimeMs: number;
      lastCloseTimeMs: number;
      sourceRowCount: number;
      candleCount: number;
      excludedUnalignedCandleCount: number;
      excludedLegacyZeroVolumePlaceholderCount: number;
      gapCount: number;
      missingCandleCount: number;
      segmentCount: number;
      legacyMillisecondCloseTimeNormalizationCount: number;
    }>;
    artifact: Readonly<{ file: string; sha256: string; bytes: number }>;
    sources: readonly Readonly<{
      month: string;
      url: string;
      checksumUrl: string;
      sha256: string;
      sourceRowCount: number;
      acceptedCandleCount: number;
      excludedUnalignedCandleCount: number;
      excludedLegacyZeroVolumePlaceholderCount: number;
      legacyMillisecondCloseTimeNormalizationCount: number;
      firstOpenTimeMs: number;
      lastCloseTimeMs: number;
    }>[];
    gaps: readonly BinanceArchiveGap[];
  }>;
  verifiedCandles: readonly VerifiedArchiveCandle[];
}>>;

export function atomicWriteFile(path: string, value: string | Uint8Array): Promise<void>;
