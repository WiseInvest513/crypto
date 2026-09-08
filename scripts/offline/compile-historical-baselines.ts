#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_HISTORICAL_BASELINE_PRIVATE_ROOT,
  compileHistoricalBaselines,
  type HistoricalBaselineCompilerOptions,
} from "../../src/server/offline/historical-baseline-compiler";

const HELP = `
Compile verified Binance Spot archives into the six-stream runtime baseline.

Usage:
  pnpm history:build -- --from <first-archive-month> --to <last-complete-month>

Required:
  --from           First complete UTC archive month (YYYY-MM)
  --to             Last complete UTC archive month (YYYY-MM)

Optional:
  --private-root   Raw/intermediate root (default: ${DEFAULT_HISTORICAL_BASELINE_PRIVATE_ROOT})
  --concurrency    Concurrent archive streams, 1-3 (default: 2)
  --refresh        Download ZIP files again; checksums are always refreshed
  --help           Show this message

Intraday source gaps are preserved as audited segments and are never filled.
Any daily source gap fails the build because it would break EMA200 regimes.
`.trim();

async function main(argv: readonly string[]): Promise<void> {
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const options = parseArgs(argv);
  const result = await compileHistoricalBaselines(options);
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "complete",
        fromMonth: result.artifact.fromMonth,
        toMonth: result.artifact.toMonth,
        generatedAt: result.artifact.generatedAt,
        datasetVersion: result.artifact.datasetVersion,
        artifactSha256: result.artifactSha256,
        streams: result.artifact.baselines.map((entry) => ({
          asset: entry.asset,
          interval: entry.interval,
          sourceRows: entry.baseline.source.sourceRowCount,
          candles: entry.baseline.source.closedCandleCount,
          excludedUnalignedCandles:
            entry.baseline.source.excludedUnalignedCandleCount,
          excludedLegacyZeroVolumePlaceholders:
            entry.baseline.source
              .excludedLegacyZeroVolumePlaceholderCount,
          segments: entry.baseline.source.segmentCount,
          gaps: entry.baseline.source.gapCount,
          missingCandles: entry.baseline.source.missingCandleCount,
          fingerprints: entry.baseline.fingerprintCount,
          completeEvents: entry.baseline.events.completeEventCount,
        })),
        artifact: result.artifactPath,
        manifest: result.manifestPath,
      },
      null,
      2,
    )}\n`,
  );
}

export function parseArgs(
  argv: readonly string[],
): HistoricalBaselineCompilerOptions {
  const allowedValueFlags = new Set([
    "--from",
    "--to",
    "--private-root",
    "--concurrency",
  ]);
  const allowedBooleanFlags = new Set(["--refresh"]);
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (allowedBooleanFlags.has(flag)) {
      if (parsed[toProperty(flag)] !== undefined) {
        throw new TypeError(`Duplicate argument: ${flag}`);
      }
      parsed[toProperty(flag)] = true;
      continue;
    }
    if (!allowedValueFlags.has(flag)) {
      throw new TypeError(`Unknown argument: ${flag}`);
    }
    const property = toProperty(flag);
    if (parsed[property] !== undefined) {
      throw new TypeError(`Duplicate argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError(`Missing value for ${flag}.`);
    }
    parsed[property] = value;
    index += 1;
  }
  if (typeof parsed.from !== "string" || typeof parsed.to !== "string") {
    throw new TypeError("Both --from and --to are required.");
  }
  return {
    from: parsed.from,
    to: parsed.to,
    privateRoot:
      typeof parsed.privateRoot === "string" ? parsed.privateRoot : undefined,
    concurrency:
      typeof parsed.concurrency === "string"
        ? parseConcurrency(parsed.concurrency)
        : undefined,
    refresh: parsed.refresh === true,
  };
}

function parseConcurrency(value: string): number {
  if (!/^[1-3]$/.test(value)) {
    throw new TypeError("--concurrency must be an integer from 1 to 3.");
  }
  return Number(value);
}

function toProperty(flag: string): string {
  return flag
    .slice(2)
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const cliArguments =
  process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2);

if (
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(cliArguments).catch((error: unknown) => {
    process.stderr.write(
      `Historical baseline compile failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
