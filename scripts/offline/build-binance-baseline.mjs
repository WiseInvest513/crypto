#!/usr/bin/env node

import process from "node:process";
import {
  assertArchiveRequest,
  buildArchiveDescriptor,
  buildBinanceHistoryBaseline,
} from "../../src/server/offline/binance-archive.mjs";

const HELP = `
Build a verified Binance Spot monthly-kline baseline without involving a web request.

Usage:
  pnpm history:download -- --symbol BTCUSDT --interval 1h --from 2024-01 --to 2024-03

Required:
  --symbol         BTCUSDT or ETHUSDT
  --interval       1h, 4h, or 1d
  --from           First complete UTC month (YYYY-MM)
  --to             Last complete UTC month (YYYY-MM)

Optional:
  --private-root   Private raw/cache root (default: .wise-crypto-private/binance-history)
  --verified-root  Private versioned intermediate root (must remain below --private-root)
  --refresh        Download files again instead of reusing verified local raw files
  --allow-gaps     Allow aligned missing buckets for 1h/4h and audit them; never valid for 1d
  --dry-run        Print the exact official URLs; do not download or write
  --help            Show this message
`.trim();

async function main(argv) {
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const args = parseArgs(argv);
  const request = assertArchiveRequest(args);
  if (args.dryRun) {
    const descriptors = request.months.map((month) => buildArchiveDescriptor(request.symbol, request.interval, month));
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      symbol: request.symbol,
      interval: request.interval,
      months: descriptors.map(({ month, zipUrl, checksumUrl }) => ({ month, zipUrl, checksumUrl })),
    }, null, 2)}\n`);
    return;
  }
  const result = await buildBinanceHistoryBaseline(args);
  process.stdout.write(`${JSON.stringify({
    status: "complete",
    outputRoot: result.outputRoot,
    artifact: result.artifactName,
    manifest: result.manifestName,
    datasetVersion: result.manifest.datasetVersion,
    sourceRowCount: result.manifest.coverage.sourceRowCount,
    candleCount: result.manifest.coverage.candleCount,
    excludedUnalignedCandleCount:
      result.manifest.coverage.excludedUnalignedCandleCount,
    excludedLegacyZeroVolumePlaceholderCount:
      result.manifest.coverage.excludedLegacyZeroVolumePlaceholderCount,
    gapCount: result.manifest.coverage.gapCount,
    missingCandleCount: result.manifest.coverage.missingCandleCount,
    segmentCount: result.manifest.coverage.segmentCount,
    legacyMillisecondCloseTimeNormalizationCount:
      result.manifest.coverage.legacyMillisecondCloseTimeNormalizationCount,
  }, null, 2)}\n`);
}

function parseArgs(argv) {
  const allowedValueFlags = new Set(["--symbol", "--interval", "--from", "--to", "--private-root", "--verified-root"]);
  const allowedBooleanFlags = new Set(["--refresh", "--allow-gaps", "--dry-run"]);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (allowedBooleanFlags.has(flag)) {
      parsed[toProperty(flag)] = true;
      continue;
    }
    if (!allowedValueFlags.has(flag)) {
      throw new TypeError(`Unknown argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError(`Missing value for ${flag}.`);
    }
    parsed[toProperty(flag)] = value;
    index += 1;
  }
  for (const required of ["symbol", "interval", "from", "to"]) {
    if (!parsed[required]) {
      throw new TypeError(`Missing required argument: --${required}.`);
    }
  }
  return parsed;
}

function toProperty(flag) {
  return flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

const cliArguments = process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);
main(cliArguments).catch((error) => {
  process.stderr.write(`History baseline build failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
