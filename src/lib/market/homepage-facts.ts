import type {
  Asset,
  DailyCandle,
  PriceQuote,
} from "@/server/data/contracts/market-data";
import type {
  RelativePosition,
  TechnicalAnalysisResult,
} from "./technical-analysis";

export type ChangeDirection = "up" | "down" | "flat";

export type QuoteDirectionFact = Readonly<{
  kind: "quote-period-direction";
  asset: Asset;
  quoteCurrency: "USD";
  change24hPercent: number;
  change7dPercent: number;
  direction24h: ChangeDirection;
  direction7d: ChangeDirection;
  relationship: "same" | "different";
  summary: string;
}>;

export type DailyStructureFact = Readonly<{
  latestCloseUsdt: number;
  ma20Usdt: number;
  ma50Usdt: number | null;
  priceVsMa20: RelativePosition;
  priceVsMa50: RelativePosition | null;
  ma20VsMa50: RelativePosition | null;
  summary: string;
}>;

export type ClosedDailyRangeFact = Readonly<{
  openedAt: string;
  closedAt: string;
  highUsdt: number;
  lowUsdt: number;
  summary: string;
}>;

export type TwentyDayRangePosition =
  | "lower"
  | "middle"
  | "upper"
  | "flat";

export type TwentyDayRangeFact = Readonly<{
  candleCount: 20;
  fromOpenedAt: string;
  throughClosedAt: string;
  highUsdt: number;
  lowUsdt: number;
  latestCloseUsdt: number;
  /** 0 is the range low and 1 is the range high; null for a zero-width range. */
  positionRatio: number | null;
  position: TwentyDayRangePosition;
  summary: string;
}>;

export type DailyMarketFacts = Readonly<{
  asset: Asset;
  symbol: "BTCUSDT" | "ETHUSDT";
  quoteCurrency: "USDT";
  interval: "1d";
  sampleSize: number;
  latestOpenedAt: string;
  latestClosedAt: string;
  latestCloseUsdt: number;
  /** A display-ready neutral structure fact, or null without a full MA20. */
  summary: string | null;
  structure: DailyStructureFact | null;
  previousDayRange: ClosedDailyRangeFact | null;
  twentyDayRange: TwentyDayRangeFact | null;
}>;

const EXPECTED_SYMBOL = {
  btc: "BTCUSDT",
  eth: "ETHUSDT",
} as const;

const TWENTY_DAY_WINDOW = 20;
const LOWER_THIRD = 1 / 3;
const UPPER_THIRD = 2 / 3;

/**
 * Describes the two percentage changes carried by one normalized USD quote.
 * Keeping both periods on the same PriceQuote prevents accidental comparison
 * across providers or quote snapshots.
 */
export function describeQuoteDirection(
  quote: PriceQuote | null,
): QuoteDirectionFact | null {
  if (!isValidPriceQuoteForDirection(quote)) {
    return null;
  }

  const change24hPercent = quote.change24hPercent;
  const change7dPercent = quote.change7dPercent;
  if (change24hPercent === null || change7dPercent === null) {
    return null;
  }

  const direction24h = classifyChange(change24hPercent);
  const direction7d = classifyChange(change7dPercent);
  const relationship =
    direction24h === direction7d ? "same" : "different";

  return {
    kind: "quote-period-direction",
    asset: quote.asset,
    quoteCurrency: "USD",
    change24hPercent,
    change7dPercent,
    direction24h,
    direction7d,
    relationship,
    summary: quoteDirectionSummary(
      quote.asset,
      direction24h,
      direction7d,
      relationship,
    ),
  };
}

/**
 * Derives mechanical observations from one asset's ascending, already-closed
 * Binance Spot USDT daily series. Invalid or mixed-scope candle input fails
 * closed. A mismatched technical result suppresses only the MA structure; the
 * independently valid candle ranges remain available.
 */
export function deriveDailyMarketFacts(
  asset: Asset,
  candles: readonly DailyCandle[] | null,
  technical: TechnicalAnalysisResult | null,
): DailyMarketFacts | null {
  if (
    !isSupportedAsset(asset) ||
    candles === null ||
    !validateDailyCandles(asset, candles)
  ) {
    return null;
  }

  const latest = candles.at(-1);
  if (latest === undefined) {
    return null;
  }

  const structure = deriveDailyStructure(asset, candles, technical);
  const previousDayRange = derivePreviousDayRange(asset, candles);
  const twentyDayRange = deriveTwentyDayRange(asset, candles);

  return {
    asset,
    symbol: EXPECTED_SYMBOL[asset],
    quoteCurrency: "USDT",
    interval: "1d",
    sampleSize: candles.length,
    latestOpenedAt: latest.openedAt,
    latestClosedAt: latest.closedAt,
    latestCloseUsdt: latest.close,
    summary: structure?.summary ?? null,
    structure,
    previousDayRange,
    twentyDayRange,
  };
}

function isValidPriceQuoteForDirection(
  quote: PriceQuote | null,
): quote is PriceQuote & {
  change24hPercent: number;
  change7dPercent: number;
} {
  return (
    quote !== null &&
    isSupportedAsset(quote.asset) &&
    quote.quoteCurrency === "USD" &&
    isPositiveFinite(quote.priceUsd) &&
    (quote.change24hPercent === null ||
      Number.isFinite(quote.change24hPercent)) &&
    (quote.change7dPercent === null || Number.isFinite(quote.change7dPercent))
  );
}

function classifyChange(value: number): ChangeDirection {
  if (value > 0) {
    return "up";
  }
  if (value < 0) {
    return "down";
  }
  return "flat";
}

function quoteDirectionSummary(
  asset: Asset,
  direction24h: ChangeDirection,
  direction7d: ChangeDirection,
  relationship: QuoteDirectionFact["relationship"],
): string {
  const symbol = asset.toUpperCase();
  if (relationship === "same") {
    const descriptions = {
      up: "均为上涨",
      down: "均为下跌",
      flat: "均为持平",
    } as const;
    return `${symbol} 24 小时与 7 日变化方向一致，${descriptions[direction24h]}。`;
  }

  return `${symbol} 24 小时${directionLabel(direction24h)}，7 日${directionLabel(direction7d)}，两个周期方向不同。`;
}

function directionLabel(direction: ChangeDirection): string {
  const labels = {
    up: "上涨",
    down: "下跌",
    flat: "持平",
  } as const;
  return labels[direction];
}

function deriveDailyStructure(
  asset: Asset,
  candles: readonly DailyCandle[],
  technical: TechnicalAnalysisResult | null,
): DailyStructureFact | null {
  if (technical === null || !technicalMatchesCandles(candles, technical)) {
    return null;
  }

  const latest = candles.at(-1);
  const latestTechnical = technical.latest;
  if (
    latest === undefined ||
    latestTechnical === null ||
    !isPositiveFinite(latestTechnical.ma20)
  ) {
    return null;
  }

  const ma20Usdt = latestTechnical.ma20;
  const ma50Usdt = isPositiveFinite(latestTechnical.ma50)
    ? latestTechnical.ma50
    : null;
  const priceVsMa20 = compare(latest.close, ma20Usdt);
  const priceVsMa50 =
    ma50Usdt === null ? null : compare(latest.close, ma50Usdt);
  const ma20VsMa50 =
    ma50Usdt === null ? null : compare(ma20Usdt, ma50Usdt);

  return {
    latestCloseUsdt: latest.close,
    ma20Usdt,
    ma50Usdt,
    priceVsMa20,
    priceVsMa50,
    ma20VsMa50,
    summary: dailyStructureSummary(
      asset,
      priceVsMa20,
      priceVsMa50,
      ma20VsMa50,
    ),
  };
}

function dailyStructureSummary(
  asset: Asset,
  priceVsMa20: RelativePosition,
  priceVsMa50: RelativePosition | null,
  ma20VsMa50: RelativePosition | null,
): string {
  const symbol = asset.toUpperCase();
  const parts = [
    `${symbol} 最新已闭合日线${relativePositionPhrase("收盘", "MA20", priceVsMa20)}`,
  ];

  if (priceVsMa50 !== null) {
    parts.push(relativePositionPhrase("收盘", "MA50", priceVsMa50));
  }
  if (ma20VsMa50 !== null) {
    parts.push(relativePositionPhrase("MA20", "MA50", ma20VsMa50));
  }

  return `${parts.join("，")}。`;
}

function relativePositionPhrase(
  subject: string,
  reference: string,
  position: RelativePosition,
): string {
  const spacedSubject = subject.startsWith("MA") ? `${subject} ` : subject;
  if (position === "equal") {
    return `${spacedSubject}等于 ${reference}`;
  }
  return `${spacedSubject}位于 ${reference} ${position === "above" ? "上方" : "下方"}`;
}

function derivePreviousDayRange(
  asset: Asset,
  candles: readonly DailyCandle[],
): ClosedDailyRangeFact | null {
  const previous = candles.at(-2);
  if (previous === undefined) {
    return null;
  }

  return {
    openedAt: previous.openedAt,
    closedAt: previous.closedAt,
    highUsdt: previous.high,
    lowUsdt: previous.low,
    summary: `${asset.toUpperCase()} 前一根已闭合日线区间为 ${formatUsdt(previous.low)}–${formatUsdt(previous.high)}。`,
  };
}

function deriveTwentyDayRange(
  asset: Asset,
  candles: readonly DailyCandle[],
): TwentyDayRangeFact | null {
  if (candles.length < TWENTY_DAY_WINDOW) {
    return null;
  }

  const window = candles.slice(-TWENTY_DAY_WINDOW);
  const latest = window.at(-1);
  const first = window[0];
  if (latest === undefined || first === undefined) {
    return null;
  }

  let highUsdt = Number.NEGATIVE_INFINITY;
  let lowUsdt = Number.POSITIVE_INFINITY;
  for (const candle of window) {
    highUsdt = Math.max(highUsdt, candle.high);
    lowUsdt = Math.min(lowUsdt, candle.low);
  }

  if (!isPositiveFinite(highUsdt) || !isPositiveFinite(lowUsdt)) {
    return null;
  }

  const width = highUsdt - lowUsdt;
  const positionRatio = width === 0 ? null : (latest.close - lowUsdt) / width;
  if (positionRatio !== null && !Number.isFinite(positionRatio)) {
    return null;
  }
  const position = classifyTwentyDayPosition(positionRatio);

  return {
    candleCount: TWENTY_DAY_WINDOW,
    fromOpenedAt: first.openedAt,
    throughClosedAt: latest.closedAt,
    highUsdt,
    lowUsdt,
    latestCloseUsdt: latest.close,
    positionRatio,
    position,
    summary: twentyDayRangeSummary(asset, position),
  };
}

function classifyTwentyDayPosition(
  ratio: number | null,
): TwentyDayRangePosition {
  if (ratio === null) {
    return "flat";
  }
  if (ratio < LOWER_THIRD) {
    return "lower";
  }
  if (ratio > UPPER_THIRD) {
    return "upper";
  }
  return "middle";
}

function twentyDayRangeSummary(
  asset: Asset,
  position: TwentyDayRangePosition,
): string {
  const labels = {
    lower: "下部",
    middle: "中部",
    upper: "上部",
    flat: "上下沿相同的位置",
  } as const;
  return `${asset.toUpperCase()} 最新已闭合日线收盘位于近 20 根日线区间的${labels[position]}。`;
}

function technicalMatchesCandles(
  candles: readonly DailyCandle[],
  technical: TechnicalAnalysisResult,
): boolean {
  if (
    technical.sampleSize !== candles.length ||
    technical.points.length !== candles.length
  ) {
    return false;
  }

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const point = technical.points[index];
    if (
      point === undefined ||
      point.openedAt !== candle.openedAt ||
      point.closedAt !== candle.closedAt ||
      point.price !== candle.close ||
      !isNullablePositiveFinite(point.ma20) ||
      !isNullablePositiveFinite(point.ma50)
    ) {
      return false;
    }
  }

  const latestPoint = technical.points.at(-1) ?? null;
  if (latestPoint === null) {
    return technical.latest === null;
  }

  const latest = technical.latest;
  return (
    latest !== null &&
    latest.openedAt === latestPoint.openedAt &&
    latest.closedAt === latestPoint.closedAt &&
    latest.price === latestPoint.price &&
    latest.ma20 === latestPoint.ma20 &&
    latest.ma50 === latestPoint.ma50
  );
}

function validateDailyCandles(
  asset: Asset,
  candles: readonly DailyCandle[],
): boolean {
  if (candles.length === 0) {
    return false;
  }

  let previousOpenedAt = Number.NEGATIVE_INFINITY;
  for (const candle of candles) {
    const openedAt = parseCanonicalTimestamp(candle.openedAt);
    const closedAt = parseCanonicalTimestamp(candle.closedAt);
    if (
      candle.asset !== asset ||
      candle.symbol !== EXPECTED_SYMBOL[asset] ||
      candle.quoteCurrency !== "USDT" ||
      candle.interval !== "1d" ||
      openedAt === null ||
      closedAt === null ||
      openedAt <= previousOpenedAt ||
      closedAt <= openedAt ||
      !isValidOhlcv(candle)
    ) {
      return false;
    }
    previousOpenedAt = openedAt;
  }

  return true;
}

function isValidOhlcv(candle: DailyCandle): boolean {
  const prices = [candle.open, candle.high, candle.low, candle.close];
  return (
    prices.every(isPositiveFinite) &&
    Number.isFinite(candle.volume) &&
    candle.volume >= 0 &&
    candle.high >= Math.max(candle.open, candle.close, candle.low) &&
    candle.low <= Math.min(candle.open, candle.close, candle.high)
  );
}

function isNullablePositiveFinite(value: number | null): boolean {
  return value === null || isPositiveFinite(value);
}

function isPositiveFinite(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function isSupportedAsset(value: string): value is Asset {
  return value === "btc" || value === "eth";
}

function compare(left: number, right: number): RelativePosition {
  if (left > right) {
    return "above";
  }
  if (left < right) {
    return "below";
  }
  return "equal";
}

function parseCanonicalTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : null;
}

function formatUsdt(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} USDT`;
}
