import "server-only";

import { cachePolicies } from "../cache/policies";
import { ResilientMarketCache } from "../cache/resilient-market-cache";
import type {
  Asset,
  CandleRange,
  CandleSymbol,
  ChartCandle,
  ChartCandleInterval,
  ChartCandleRequest,
  DailyCandle,
  DataScope,
  ErrorMarketDatum,
  MarketDatum,
} from "../contracts/market-data";
import {
  chartCandleCapability,
  chartCandleIntervals,
  dailyCandleCapability,
  unavailableDatum,
} from "../contracts/market-data";
import type { CandleProvider } from "../contracts/providers";
import {
  ProviderError,
  toDataError,
} from "../errors/provider-error";
import {
  FetchJsonClient,
  type JsonHttpClient,
} from "../http/fetch-json";
import {
  array,
  finiteNumber,
  nonNegativeNumber,
  positiveNumber,
} from "../validation/upstream";
import { binanceSpotSource } from "./sources";

const PUBLIC_BASE_URL = "https://data-api.binance.vision";
const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MAX_CANDLES_PER_REQUEST = 1_000;
const MIN_CHART_CANDLES_PER_REQUEST = 2;
const MAX_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1_000;
const CANONICAL_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const SYMBOLS = {
  btc: "BTCUSDT",
  eth: "ETHUSDT",
} as const satisfies Record<Asset, CandleSymbol>;

const CHART_INTERVAL_MILLISECONDS = {
  "15m": 15 * 60 * 1_000,
  "1h": 60 * 60 * 1_000,
  "4h": 4 * 60 * 60 * 1_000,
  "1d": DAY_MILLISECONDS,
} as const satisfies Record<ChartCandleInterval, number>;

type BinanceSpotCandleProviderOptions = {
  cache?: ResilientMarketCache;
  http?: JsonHttpClient;
  now?: () => number;
};

type NormalizedRange = {
  endTime: number;
  firstOpenTime: number;
  lastOpenTime: number;
  limit: number;
};

type ParsedCandle = DailyCandle & {
  openedAtMilliseconds: number;
  closedAtMilliseconds: number;
};

type ParsedChartCandle = ChartCandle & {
  openedAtMilliseconds: number;
  closedAtMilliseconds: number;
};

export class BinanceSpotCandleProvider implements CandleProvider {
  readonly id = "binance-spot-candles";
  readonly mode = "live" as const;
  readonly source = binanceSpotSource;

  private readonly cache: ResilientMarketCache;
  private readonly http: JsonHttpClient;
  private readonly now: () => number;

  constructor({
    cache = new ResilientMarketCache(),
    http = new FetchJsonClient(),
    now = Date.now,
  }: BinanceSpotCandleProviderOptions = {}) {
    this.cache = cache;
    this.http = http;
    this.now = now;
  }

  async getDailyCandles(
    asset: Asset,
    range: CandleRange,
  ): Promise<MarketDatum<readonly DailyCandle[]>> {
    const capability = dailyCandleCapability(asset);
    const symbol = SYMBOLS[asset];
    const scope = candleScope(symbol);
    const nowMilliseconds = this.now();

    let normalizedRange: NormalizedRange;
    try {
      normalizedRange = normalizeRange(range, nowMilliseconds);
    } catch (error) {
      const dataError = toDataError(error);
      if (dataError.code === "no_data") {
        return unavailableDatum(capability, "no_data");
      }
      return errorDatum(
        capability,
        scope,
        dataError,
        nowMilliseconds,
      );
    }

    const result = await this.cache.read({
      key: [
        "binance-spot",
        "klines",
        symbol,
        "1d",
        normalizedRange.firstOpenTime,
        normalizedRange.lastOpenTime,
        "v1",
      ].join(":"),
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.candles,
      load: async () => {
        const payload = await this.http.get(
          buildKlineUrl(symbol, normalizedRange),
        );
        const candles = parseKlinePayload(
          payload,
          asset,
          symbol,
          normalizedRange,
          this.now(),
        );
        const latest = candles.at(-1);
        if (!latest) {
          throw new ProviderError("no_data", true);
        }
        return {
          capability,
          value: candles,
          source: this.source,
          scope,
          updatedAt: latest.closedAt,
          provenance: "live" as const,
        };
      },
    });

    return result;
  }

  async getChartCandles(
    asset: Asset,
    request: ChartCandleRequest,
  ): Promise<MarketDatum<readonly ChartCandle[]>> {
    const capability = chartCandleCapability(asset);
    const symbol = SYMBOLS[asset];
    const nowMilliseconds = this.now();

    let normalized: ChartCandleRequest;
    try {
      normalized = normalizeChartRequest(request);
    } catch (error) {
      return chartErrorDatum(
        capability,
        chartCandleScope(symbol, request.interval),
        toDataError(error),
        nowMilliseconds,
      );
    }

    const scope = chartCandleScope(symbol, normalized.interval);
    return this.cache.read({
      key: [
        "binance-spot",
        "chart-klines",
        symbol,
        normalized.interval,
        normalized.limit,
        "v1",
      ].join(":"),
      capability,
      source: this.source,
      scope,
      policy: cachePolicies.liveCandles,
      load: async () => {
        const payload = await this.http.get(
          buildChartKlineUrl(symbol, normalized),
        );
        const observedAtMilliseconds = this.now();
        const candles = parseChartKlinePayload(
          payload,
          asset,
          symbol,
          normalized,
          observedAtMilliseconds,
        );
        const latest = candles.at(-1);
        if (!latest) {
          throw new ProviderError("no_data", true);
        }
        return {
          capability,
          value: candles,
          source: this.source,
          scope,
          updatedAt:
            latest.state === "forming"
              ? new Date(observedAtMilliseconds).toISOString()
              : latest.closedAt,
          updatedAtKind:
            latest.state === "forming" ? ("observed" as const) : ("source" as const),
          provenance: "live" as const,
        };
      },
    });
  }
}

function candleScope(symbol: CandleSymbol): DataScope {
  return {
    kind: "venue",
    label: `Binance ${symbol} 现货日线（USDT，UTC）`,
  };
}

function chartCandleScope(
  symbol: CandleSymbol,
  interval: unknown,
): DataScope {
  const label =
    typeof interval === "string" ? interval : "未知周期";
  return {
    kind: "venue",
    label: `Binance ${symbol} 现货 ${label} K 线（USDT，UTC，含形成中）`,
  };
}

function errorDatum(
  capability: ReturnType<typeof dailyCandleCapability>,
  scope: DataScope,
  error: ErrorMarketDatum["error"],
  nowMilliseconds: number,
): ErrorMarketDatum {
  return {
    status: "error",
    capability,
    value: null,
    source: binanceSpotSource,
    scope,
    updatedAt: null,
    retrievedAt: new Date(nowMilliseconds).toISOString(),
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: cachePolicies.candles.revalidateSeconds,
      staleIfErrorSeconds: cachePolicies.candles.staleIfErrorSeconds,
    },
    error,
  };
}

function chartErrorDatum(
  capability: ReturnType<typeof chartCandleCapability>,
  scope: DataScope,
  error: ErrorMarketDatum["error"],
  nowMilliseconds: number,
): ErrorMarketDatum {
  return {
    status: "error",
    capability,
    value: null,
    source: binanceSpotSource,
    scope,
    updatedAt: null,
    retrievedAt: new Date(nowMilliseconds).toISOString(),
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: cachePolicies.liveCandles.revalidateSeconds,
      staleIfErrorSeconds: cachePolicies.liveCandles.staleIfErrorSeconds,
    },
    error,
  };
}

function normalizeChartRequest(
  request: ChartCandleRequest,
): ChartCandleRequest {
  if (
    !chartCandleIntervals.includes(request.interval) ||
    !Number.isSafeInteger(request.limit) ||
    request.limit < MIN_CHART_CANDLES_PER_REQUEST ||
    request.limit > MAX_CANDLES_PER_REQUEST
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  return request;
}

function normalizeRange(
  range: CandleRange,
  nowMilliseconds: number,
): NormalizedRange {
  const startTime = canonicalUtcTimestamp(range.from);
  const endTime = canonicalUtcTimestamp(range.to);

  if (
    startTime >= endTime ||
    endTime > nowMilliseconds + MAX_CLOCK_SKEW_MILLISECONDS
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  const firstOpenTime = Math.ceil(startTime / DAY_MILLISECONDS) * DAY_MILLISECONDS;
  const lastOpenTime = Math.floor(endTime / DAY_MILLISECONDS) * DAY_MILLISECONDS;
  if (firstOpenTime > lastOpenTime) {
    throw new ProviderError("no_data", true);
  }

  const limit =
    Math.floor((lastOpenTime - firstOpenTime) / DAY_MILLISECONDS) + 1;
  if (limit < 1 || limit > MAX_CANDLES_PER_REQUEST) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    endTime,
    firstOpenTime,
    lastOpenTime,
    limit,
  };
}

function canonicalUtcTimestamp(value: unknown): number {
  if (typeof value !== "string" || !CANONICAL_UTC_TIMESTAMP.test(value)) {
    throw new ProviderError("invalid_payload", false);
  }

  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  return milliseconds;
}

function buildKlineUrl(
  symbol: CandleSymbol,
  range: NormalizedRange,
): string {
  const url = new URL("/api/v3/klines", PUBLIC_BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("startTime", String(range.firstOpenTime));
  url.searchParams.set("endTime", String(range.endTime));
  url.searchParams.set("limit", String(range.limit));
  return url.toString();
}

function buildChartKlineUrl(
  symbol: CandleSymbol,
  request: ChartCandleRequest,
): string {
  const url = new URL("/api/v3/klines", PUBLIC_BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", request.interval);
  url.searchParams.set("limit", String(request.limit));
  return url.toString();
}

function parseChartKlinePayload(
  payload: unknown,
  asset: Asset,
  symbol: CandleSymbol,
  request: ChartCandleRequest,
  nowMilliseconds: number,
): readonly ChartCandle[] {
  assertNoBinanceBusinessError(payload);

  const parsed = array(payload).map((row) =>
    parseChartKlineRow(
      row,
      asset,
      symbol,
      request.interval,
      nowMilliseconds,
    ),
  );
  if (parsed.length > request.limit) {
    throw new ProviderError("invalid_payload", false);
  }

  parsed.sort(
    (left, right) => left.openedAtMilliseconds - right.openedAtMilliseconds,
  );
  const unique = new Map<number, ParsedChartCandle>();
  for (const candle of parsed) {
    const existing = unique.get(candle.openedAtMilliseconds);
    if (existing && !sameChartCandle(existing, candle)) {
      throw new ProviderError("invalid_payload", false);
    }
    unique.set(candle.openedAtMilliseconds, candle);
  }

  const candles = Array.from(unique.values());
  const formingIndexes = candles.flatMap((candle, index) =>
    candle.state === "forming" ? [index] : [],
  );
  if (
    formingIndexes.length > 1 ||
    (formingIndexes.length === 1 && formingIndexes[0] !== candles.length - 1)
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  return candles.map(toChartCandle);
}

function parseChartKlineRow(
  row: unknown,
  asset: Asset,
  symbol: CandleSymbol,
  interval: ChartCandleInterval,
  nowMilliseconds: number,
): ParsedChartCandle {
  const fields = array(row);
  if (fields.length < 7) {
    throw new ProviderError("invalid_payload", false);
  }

  const intervalMilliseconds = CHART_INTERVAL_MILLISECONDS[interval];
  const openedAtMilliseconds = unixMilliseconds(
    fields[0],
    nowMilliseconds + MAX_CLOCK_SKEW_MILLISECONDS,
  );
  const closedAtMilliseconds = unixMilliseconds(
    fields[6],
    nowMilliseconds + intervalMilliseconds + MAX_CLOCK_SKEW_MILLISECONDS,
  );
  if (
    openedAtMilliseconds % intervalMilliseconds !== 0 ||
    closedAtMilliseconds - openedAtMilliseconds !== intervalMilliseconds - 1
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  const open = positiveNumber(fields[1]);
  const high = positiveNumber(fields[2]);
  const low = positiveNumber(fields[3]);
  const close = positiveNumber(fields[4]);
  const volume = nonNegativeNumber(fields[5]);
  if (
    high < Math.max(open, close) ||
    low > Math.min(open, close) ||
    low > high
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    asset,
    symbol,
    interval,
    quoteCurrency: "USDT",
    state: closedAtMilliseconds < nowMilliseconds ? "closed" : "forming",
    openedAt: new Date(openedAtMilliseconds).toISOString(),
    closedAt: new Date(closedAtMilliseconds).toISOString(),
    open,
    high,
    low,
    close,
    volume,
    openedAtMilliseconds,
    closedAtMilliseconds,
  };
}

function toChartCandle(candle: ParsedChartCandle): ChartCandle {
  return {
    asset: candle.asset,
    symbol: candle.symbol,
    interval: candle.interval,
    quoteCurrency: candle.quoteCurrency,
    state: candle.state,
    openedAt: candle.openedAt,
    closedAt: candle.closedAt,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function parseKlinePayload(
  payload: unknown,
  asset: Asset,
  symbol: CandleSymbol,
  range: NormalizedRange,
  nowMilliseconds: number,
): readonly DailyCandle[] {
  assertNoBinanceBusinessError(payload);

  const parsed = array(payload).map((row) =>
    parseKlineRow(row, asset, symbol, nowMilliseconds),
  );
  const inRangeAndClosed = parsed.filter(
    (candle) =>
      candle.openedAtMilliseconds >= range.firstOpenTime &&
      candle.openedAtMilliseconds <= range.lastOpenTime &&
      candle.closedAtMilliseconds < nowMilliseconds,
  );
  inRangeAndClosed.sort(
    (left, right) => left.openedAtMilliseconds - right.openedAtMilliseconds,
  );

  const unique = new Map<number, ParsedCandle>();
  for (const candle of inRangeAndClosed) {
    const existing = unique.get(candle.openedAtMilliseconds);
    if (existing && !sameCandle(existing, candle)) {
      throw new ProviderError("invalid_payload", false);
    }
    unique.set(candle.openedAtMilliseconds, candle);
  }

  return Array.from(unique.values(), toDailyCandle);
}

function assertNoBinanceBusinessError(payload: unknown): void {
  if (Array.isArray(payload)) {
    return;
  }
  if (typeof payload !== "object" || payload === null) {
    throw new ProviderError("invalid_payload", false);
  }
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.code === "number" &&
    Number.isFinite(candidate.code) &&
    typeof candidate.msg === "string"
  ) {
    throw new ProviderError("upstream_error", false);
  }
  throw new ProviderError("invalid_payload", false);
}

function toDailyCandle(candle: ParsedCandle): DailyCandle {
  return {
    asset: candle.asset,
    symbol: candle.symbol,
    interval: candle.interval,
    quoteCurrency: candle.quoteCurrency,
    openedAt: candle.openedAt,
    closedAt: candle.closedAt,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function parseKlineRow(
  row: unknown,
  asset: Asset,
  symbol: CandleSymbol,
  nowMilliseconds: number,
): ParsedCandle {
  const fields = array(row);
  if (fields.length < 7) {
    throw new ProviderError("invalid_payload", false);
  }

  const openedAtMilliseconds = unixMilliseconds(
    fields[0],
    nowMilliseconds + MAX_CLOCK_SKEW_MILLISECONDS,
  );
  const closedAtMilliseconds = unixMilliseconds(
    fields[6],
    nowMilliseconds + DAY_MILLISECONDS + MAX_CLOCK_SKEW_MILLISECONDS,
  );
  if (
    openedAtMilliseconds % DAY_MILLISECONDS !== 0 ||
    closedAtMilliseconds - openedAtMilliseconds !== DAY_MILLISECONDS - 1
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  const open = positiveNumber(fields[1]);
  const high = positiveNumber(fields[2]);
  const low = positiveNumber(fields[3]);
  const close = positiveNumber(fields[4]);
  const volume = positiveNumber(fields[5]);
  if (
    high < Math.max(open, close) ||
    low > Math.min(open, close) ||
    low > high
  ) {
    throw new ProviderError("invalid_payload", false);
  }

  return {
    asset,
    symbol,
    interval: "1d",
    quoteCurrency: "USDT",
    openedAt: new Date(openedAtMilliseconds).toISOString(),
    closedAt: new Date(closedAtMilliseconds).toISOString(),
    open,
    high,
    low,
    close,
    volume,
    openedAtMilliseconds,
    closedAtMilliseconds,
  };
}

function unixMilliseconds(value: unknown, maximum: number): number {
  const milliseconds = finiteNumber(value);
  if (
    !Number.isInteger(milliseconds) ||
    milliseconds < 1_000_000_000_000 ||
    milliseconds >= 10_000_000_000_000 ||
    milliseconds > maximum
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  return milliseconds;
}

function sameCandle(left: ParsedCandle, right: ParsedCandle): boolean {
  return (
    left.closedAtMilliseconds === right.closedAtMilliseconds &&
    left.open === right.open &&
    left.high === right.high &&
    left.low === right.low &&
    left.close === right.close &&
    left.volume === right.volume
  );
}

function sameChartCandle(
  left: ParsedChartCandle,
  right: ParsedChartCandle,
): boolean {
  return (
    left.closedAtMilliseconds === right.closedAtMilliseconds &&
    left.interval === right.interval &&
    left.state === right.state &&
    left.open === right.open &&
    left.high === right.high &&
    left.low === right.low &&
    left.close === right.close &&
    left.volume === right.volume
  );
}
