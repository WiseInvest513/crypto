import type {
  Asset,
  ChartCandle,
  ChartCandleInterval,
} from "@/server/data/contracts/market-data";
import {
  assertChartSeries,
  buildLiveChartPoints,
  chartIntervalMilliseconds,
  type LiveChartPoint,
} from "./live-chart";

export const HISTORICAL_CONTEXT_ALGORITHM_VERSION =
  "closed-ema-context-v2" as const;
export const HISTORICAL_CONTEXT_HORIZONS = [6, 12, 24] as const;
export const HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES = 20;

export type HistoricalContextInterval = Exclude<
  ChartCandleInterval,
  "15m"
>;
export type HistoricalContextHorizon =
  (typeof HISTORICAL_CONTEXT_HORIZONS)[number];
export type HistoricalContextEmaKey = "ema10" | "ema20" | "ema50";
export type HistoricalContextPriceRelation = "above" | "below" | "equal";
export type HistoricalContextOrdering =
  | "short_above_long"
  | "short_below_long"
  | "mixed";

export type HistoricalContextCurrent = Readonly<{
  openedAt: string;
  closedAt: string;
  close: number;
  fingerprint: string;
  barsInState: number;
  ema: Readonly<Record<HistoricalContextEmaKey, number>>;
  priceRelations: Readonly<
    Record<HistoricalContextEmaKey, HistoricalContextPriceRelation>
  >;
  ordering: Readonly<{
    state: HistoricalContextOrdering;
    expression: string;
  }>;
}>;

export type HistoricalContextSample = Readonly<{
  /** Sufficiency of the strictest, 24-bar independent direction cohort. */
  status: "sufficient" | "insufficient";
  closedCandleCount: number;
  candidateEventCount: number;
  eventCount: number;
  excludedIncompleteEventCount: number;
  minimumDirectionSampleCount: typeof HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES;
  range: Readonly<{
    fromOpenedAt: string;
    toClosedAt: string;
  }>;
  eventRange: Readonly<{
    firstEventOpenedAt: string;
    lastEventOpenedAt: string;
  }> | null;
}>;

export type HistoricalContextHorizonStatistics = Readonly<{
  bars: HistoricalContextHorizon;
  /** All complete entry events used for distribution and excursion facts. */
  sampleCount: number;
  /**
   * Chronologically selected events separated by at least this horizon. Only
   * this non-overlapping cohort may be used for the direction share.
   */
  independentSampleCount: number;
  medianReturnPercent: number | null;
  q25ReturnPercent: number | null;
  q75ReturnPercent: number | null;
  maxUpsidePercent: number | null;
  maxDownsidePercent: number | null;
  /**
   * Mechanical share of independent samples whose horizon close exceeded the
   * event close. This is deliberately unavailable below the published sample
   * threshold and must not be presented as a forecast probability or win rate.
   */
  positiveReturnRatePercent: number | null;
}>;

export type HistoricalContextCase = Readonly<{
  /** Selected from the complete all-event 24-bar return distribution. */
  representativeOf: "q25" | "median" | "q75";
  eventOpenedAt: string;
  eventClosedAt: string;
  eventClose: number;
  outcomes: readonly Readonly<{
    bars: HistoricalContextHorizon;
    returnPercent: number;
    maxUpsidePercent: number;
    maxDownsidePercent: number;
  }>[];
}>;

export type HistoricalContextEventSummary = Readonly<{
  status: "sufficient" | "insufficient";
  eventCount: number;
  eventRange: Readonly<{
    firstEventOpenedAt: string;
    lastEventOpenedAt: string;
  }> | null;
  horizons: readonly HistoricalContextHorizonStatistics[];
  cases: readonly HistoricalContextCase[];
}>;

export type HistoricalContextAnalysis = Readonly<{
  asset: Asset;
  symbol: ChartCandle["symbol"];
  interval: HistoricalContextInterval;
  algorithmVersion: typeof HISTORICAL_CONTEXT_ALGORITHM_VERSION;
  latestClosedAt: string;
  current: HistoricalContextCurrent;
  sample: HistoricalContextSample;
  horizons: readonly HistoricalContextHorizonStatistics[];
  cases: readonly HistoricalContextCase[];
}>;

export type HistoricalContextState = Readonly<{
  fingerprint: string;
  ema: HistoricalContextCurrent["ema"];
  priceRelations: HistoricalContextCurrent["priceRelations"];
  ordering: HistoricalContextCurrent["ordering"];
}>;

export type HistoricalContextEventOutcomeObservation = Readonly<{
  bars: HistoricalContextHorizon;
  /** Closed timestamp of the last candle included in this forward window. */
  horizonClosedAt: string;
  returnPercent: number;
  maxUpsidePercent: number;
  maxDownsidePercent: number;
}>;

/**
 * Raw, JSON-safe event observation used before cohort statistics are reduced.
 * `segmentIndex` and the segment-local `pointIndex` prevent independent-window
 * selection from silently crossing a known archive gap.
 */
export type HistoricalContextEventObservation = Readonly<{
  segmentIndex: number;
  pointIndex: number;
  eventOpenedAt: string;
  eventClosedAt: string;
  eventClose: number;
  outcomes: readonly HistoricalContextEventOutcomeObservation[];
}>;

/**
 * Compares the latest closed EMA10/20/50 state with earlier entries into the
 * exact same state. The function is intentionally an event study rather than
 * a signal generator: it emits observed distributions and never a direction,
 * recommendation, target, or probability.
 *
 * Every input candle is validated before the optional forming tail is removed.
 * An historical event is counted only on the first closed candle after its
 * fingerprint changes into the current fingerprint, and only when all 24
 * subsequent closed candles exist. This keeps the three horizon cohorts equal
 * and prevents a still-unobserved future from entering the result.
 */
export function analyzeHistoricalContext(
  candles: readonly ChartCandle[],
): HistoricalContextAnalysis | null {
  if (candles.length === 0) {
    return null;
  }

  assertChartSeries(candles);
  assertContiguousSingleScope(candles);

  const interval = candles[0].interval;
  if (interval === "15m") {
    return null;
  }

  const closedCandles = candles.filter((candle) => candle.state === "closed");
  if (closedCandles.length < 50) {
    return null;
  }

  const points = buildLiveChartPoints(closedCandles);
  const states = points.map(buildHistoricalContextState);
  const latestPoint = points.at(-1)!;
  const latestState = states.at(-1);
  if (latestState === null || latestState === undefined) {
    return null;
  }

  const maximumHorizon = HISTORICAL_CONTEXT_HORIZONS.at(-1)!;
  const currentStateStartIndex = findCurrentStateStartIndex(
    states,
    latestState.fingerprint,
  );
  const candidates: number[] = [];
  let previousFingerprint: string | null = null;

  for (const [index, state] of states.entries()) {
    if (state === null) {
      previousFingerprint = null;
      continue;
    }

    // The first calculable EMA50 point has no prior comparable fingerprint,
    // so treating it as an entry would manufacture a warm-up event.
    if (
      previousFingerprint !== null &&
      state.fingerprint === latestState.fingerprint &&
      previousFingerprint !== latestState.fingerprint &&
      index !== currentStateStartIndex
    ) {
      candidates.push(index);
    }
    previousFingerprint = state.fingerprint;
  }

  const eligibleIndexes = candidates.filter(
    (index) => index + maximumHorizon < points.length,
  );
  const eventSummary = summarizeHistoricalContextEventIndexes(
    points,
    eligibleIndexes,
  );
  const firstCandle = closedCandles[0];

  return {
    asset: latestPoint.asset,
    symbol: latestPoint.symbol,
    interval: interval as HistoricalContextInterval,
    algorithmVersion: HISTORICAL_CONTEXT_ALGORITHM_VERSION,
    latestClosedAt: latestPoint.closedAt,
    current: {
      openedAt: latestPoint.openedAt,
      closedAt: latestPoint.closedAt,
      close: latestPoint.close,
      fingerprint: latestState.fingerprint,
      barsInState: states.length - currentStateStartIndex,
      ema: latestState.ema,
      priceRelations: latestState.priceRelations,
      ordering: latestState.ordering,
    },
    sample: {
      status: eventSummary.status,
      closedCandleCount: closedCandles.length,
      candidateEventCount: candidates.length,
      eventCount: eventSummary.eventCount,
      excludedIncompleteEventCount:
        candidates.length - eventSummary.eventCount,
      minimumDirectionSampleCount:
        HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES,
      range: {
        fromOpenedAt: firstCandle.openedAt,
        toClosedAt: latestPoint.closedAt,
      },
      eventRange: eventSummary.eventRange,
    },
    horizons: eventSummary.horizons,
    cases: eventSummary.cases,
  };
}

/** Shared fingerprint implementation for recent and long-term event studies. */
export function buildHistoricalContextState(
  point: LiveChartPoint,
): HistoricalContextState | null {
  if (point.ema10 === null || point.ema20 === null || point.ema50 === null) {
    return null;
  }
  if (
    !Number.isFinite(point.ema10) ||
    !Number.isFinite(point.ema20) ||
    !Number.isFinite(point.ema50)
  ) {
    throw new TypeError("Historical context EMA values must be finite.");
  }

  const ema = {
    ema10: point.ema10,
    ema20: point.ema20,
    ema50: point.ema50,
  } as const;
  const priceRelations = {
    ema10: compare(point.close, ema.ema10),
    ema20: compare(point.close, ema.ema20),
    ema50: compare(point.close, ema.ema50),
  } as const;
  const ordering = buildOrdering(ema);
  const normalizedOrdering = ordering.expression.replaceAll(" ", "");
  const fingerprint = [
    `price:${priceRelations.ema10},${priceRelations.ema20},${priceRelations.ema50}`,
    `order:${ordering.state}:${normalizedOrdering}`,
  ].join("|");

  return { fingerprint, ema, priceRelations, ordering };
}

function buildOrdering(
  ema: Readonly<Record<HistoricalContextEmaKey, number>>,
): HistoricalContextCurrent["ordering"] {
  const state =
    ema.ema10 > ema.ema20 && ema.ema20 > ema.ema50
      ? "short_above_long"
      : ema.ema10 < ema.ema20 && ema.ema20 < ema.ema50
        ? "short_below_long"
        : "mixed";
  const ranked = (Object.entries(ema) as [HistoricalContextEmaKey, number][])
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return emaPeriod(left[0]) - emaPeriod(right[0]);
    });
  const expression = ranked.reduce((result, [key, value], index) => {
    const label = key.toUpperCase();
    if (index === 0) {
      return label;
    }
    const previousValue = ranked[index - 1][1];
    return `${result}${previousValue === value ? " = " : " > "}${label}`;
  }, "");

  return { state, expression };
}

function emaPeriod(key: HistoricalContextEmaKey): number {
  return key === "ema10" ? 10 : key === "ema20" ? 20 : 50;
}

function compare(
  left: number,
  right: number,
): HistoricalContextPriceRelation {
  return left > right ? "above" : left < right ? "below" : "equal";
}

function findCurrentStateStartIndex(
  states: readonly (HistoricalContextState | null)[],
  fingerprint: string,
): number {
  let index = states.length - 1;
  while (index > 0 && states[index - 1]?.fingerprint === fingerprint) {
    index -= 1;
  }
  return index;
}

/**
 * Applies the shared 6/12/24-bar outcome, quantile, excursion and
 * non-overlapping direction-share rules to caller-selected event entries.
 */
export function summarizeHistoricalContextEventIndexes(
  points: readonly LiveChartPoint[],
  eventIndexes: readonly number[],
): HistoricalContextEventSummary {
  return summarizeHistoricalContextEventObservations(
    buildHistoricalContextEventObservations(points, eventIndexes, 0),
  );
}

/**
 * Materializes caller-selected entries before any aggregate is calculated.
 * The returned observations can be concatenated across strictly separated
 * candle segments and then reduced once, so quantiles always use raw outcomes
 * instead of an average of already-aggregated segment statistics.
 */
export function buildHistoricalContextEventObservations(
  points: readonly LiveChartPoint[],
  eventIndexes: readonly number[],
  segmentIndex: number,
): readonly HistoricalContextEventObservation[] {
  assertChartSeries(points);
  assertHistoricalEventIndexes(points, eventIndexes);
  if (!Number.isSafeInteger(segmentIndex) || segmentIndex < 0) {
    throw new TypeError("Historical event segment index must be a safe count.");
  }

  return eventIndexes.map((index) =>
    buildHistoricalEvent(points, index, segmentIndex),
  );
}

/**
 * Reduces raw event observations across one or more archive segments. Events
 * are ordered by their actual timestamps for ranges and quantiles, while the
 * direction cohort is selected independently inside each segment.
 */
export function summarizeHistoricalContextEventObservations(
  observations: readonly HistoricalContextEventObservation[],
): HistoricalContextEventSummary {
  const events = [...observations].sort(compareHistoricalEventObservations);
  assertHistoricalEventObservations(events);
  const independentEventsByHorizon = new Map(
    HISTORICAL_CONTEXT_HORIZONS.map((bars) => [
      bars,
      selectIndependentEvents(events, bars),
    ]),
  );
  const maximumHorizon = HISTORICAL_CONTEXT_HORIZONS.at(-1)!;
  const maximumHorizonIndependentCount =
    independentEventsByHorizon.get(maximumHorizon)?.length ?? 0;
  const firstEvent = events[0];
  const lastEvent = events.at(-1);

  return {
    status:
      maximumHorizonIndependentCount >=
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
        ? "sufficient"
        : "insufficient",
    eventCount: events.length,
    eventRange:
      firstEvent && lastEvent
        ? {
            firstEventOpenedAt: firstEvent.eventOpenedAt,
            lastEventOpenedAt: lastEvent.eventOpenedAt,
          }
        : null,
    horizons: HISTORICAL_CONTEXT_HORIZONS.map((bars) =>
      summarizeHorizon(
        events,
        independentEventsByHorizon.get(bars) ?? [],
        bars,
      ),
    ),
    cases: selectRepresentativeCases(events),
  };
}

function assertHistoricalEventIndexes(
  points: readonly LiveChartPoint[],
  eventIndexes: readonly number[],
): void {
  let previous = -1;
  const maximumHorizon = HISTORICAL_CONTEXT_HORIZONS.at(-1)!;
  for (const index of eventIndexes) {
    if (
      !Number.isSafeInteger(index) ||
      index <= previous ||
      index < 0 ||
      index + maximumHorizon >= points.length ||
      points[index]?.state !== "closed"
    ) {
      throw new TypeError(
        "Historical event indexes must be ordered, unique, closed, and complete.",
      );
    }
    previous = index;
  }
}

function buildHistoricalEvent(
  points: readonly LiveChartPoint[],
  pointIndex: number,
  segmentIndex: number,
): HistoricalContextEventObservation {
  const point = points[pointIndex];
  return {
    segmentIndex,
    pointIndex,
    eventOpenedAt: point.openedAt,
    eventClosedAt: point.closedAt,
    eventClose: point.close,
    outcomes: HISTORICAL_CONTEXT_HORIZONS.map((bars) =>
      buildEventOutcome(points, pointIndex, bars),
    ),
  };
}

function buildEventOutcome(
  points: readonly LiveChartPoint[],
  pointIndex: number,
  bars: HistoricalContextHorizon,
): HistoricalContextEventOutcomeObservation {
  const eventClose = points[pointIndex].close;
  const future = points.slice(pointIndex + 1, pointIndex + bars + 1);
  if (future.length !== bars) {
    throw new RangeError("Historical event does not have a complete future horizon.");
  }

  let highest = Number.NEGATIVE_INFINITY;
  let lowest = Number.POSITIVE_INFINITY;
  for (const point of future) {
    highest = Math.max(highest, point.high);
    lowest = Math.min(lowest, point.low);
  }
  const returnPercent = percentChange(future.at(-1)!.close, eventClose);
  const maxUpsidePercent = percentChange(highest, eventClose);
  const maxDownsidePercent = percentChange(lowest, eventClose);

  return {
    bars,
    horizonClosedAt: future.at(-1)!.closedAt,
    returnPercent,
    maxUpsidePercent,
    maxDownsidePercent,
  };
}

function summarizeHorizon(
  events: readonly HistoricalContextEventObservation[],
  independentEvents: readonly HistoricalContextEventObservation[],
  bars: HistoricalContextHorizon,
): HistoricalContextHorizonStatistics {
  const outcomes = events.map((event) =>
    event.outcomes.find((outcome) => outcome.bars === bars),
  );
  if (outcomes.some((outcome) => outcome === undefined)) {
    throw new TypeError("Historical event horizon is incomplete.");
  }
  const complete = outcomes as readonly HistoricalContextEventOutcomeObservation[];
  if (complete.length === 0) {
    return {
      bars,
      sampleCount: 0,
      independentSampleCount: 0,
      medianReturnPercent: null,
      q25ReturnPercent: null,
      q75ReturnPercent: null,
      maxUpsidePercent: null,
      maxDownsidePercent: null,
      positiveReturnRatePercent: null,
    };
  }

  const returns = complete.map((outcome) => outcome.returnPercent);
  const independentReturns = independentEvents.map(
    (event) =>
      event.outcomes.find((outcome) => outcome.bars === bars)!.returnPercent,
  );
  return {
    bars,
    sampleCount: complete.length,
    independentSampleCount: independentReturns.length,
    medianReturnPercent: quantile(returns, 0.5),
    q25ReturnPercent: quantile(returns, 0.25),
    q75ReturnPercent: quantile(returns, 0.75),
    maxUpsidePercent: Math.max(
      ...complete.map((outcome) => outcome.maxUpsidePercent),
    ),
    maxDownsidePercent: Math.min(
      ...complete.map((outcome) => outcome.maxDownsidePercent),
    ),
    positiveReturnRatePercent:
      independentReturns.length >=
      HISTORICAL_CONTEXT_MINIMUM_DIRECTION_SAMPLES
      ? (independentReturns.filter((value) => value > 0).length /
          independentReturns.length) *
        100
      : null,
  };
}

/**
 * Equal-length forward windows are made non-overlapping by taking the earliest
 * eligible entry and then the next entry at least `bars` indexes later. For
 * equal window lengths this greedy selection yields a deterministic maximum
 * count without choosing observations based on their eventual returns.
 */
function selectIndependentEvents(
  events: readonly HistoricalContextEventObservation[],
  bars: HistoricalContextHorizon,
): readonly HistoricalContextEventObservation[] {
  const selected: HistoricalContextEventObservation[] = [];
  const previousBySegment = new Map<number, HistoricalContextEventObservation>();
  for (const event of events) {
    const previous = previousBySegment.get(event.segmentIndex);
    if (
      previous === undefined ||
      (event.pointIndex - previous.pointIndex >= bars &&
        Date.parse(event.eventClosedAt) >=
          Date.parse(
            previous.outcomes.find((outcome) => outcome.bars === bars)!
              .horizonClosedAt,
          ))
    ) {
      selected.push(event);
      previousBySegment.set(event.segmentIndex, event);
    }
  }
  return selected;
}

function selectRepresentativeCases(
  events: readonly HistoricalContextEventObservation[],
): readonly HistoricalContextCase[] {
  if (events.length === 0) {
    return [];
  }

  const twentyFourBarReturns = events.map(
    (event) => event.outcomes.find((outcome) => outcome.bars === 24)!.returnPercent,
  );
  const targets = [
    { representativeOf: "q25" as const, value: quantile(twentyFourBarReturns, 0.25) },
    { representativeOf: "median" as const, value: quantile(twentyFourBarReturns, 0.5) },
    { representativeOf: "q75" as const, value: quantile(twentyFourBarReturns, 0.75) },
  ];
  const selected = new Set<number>();

  return targets.slice(0, Math.min(3, events.length)).map((target) => {
    let selectedIndex = -1;
    let selectedDistance = Number.POSITIVE_INFINITY;
    for (const [index, event] of events.entries()) {
      if (selected.has(index)) {
        continue;
      }
      const outcome = event.outcomes.find((item) => item.bars === 24)!;
      const distance = Math.abs(outcome.returnPercent - target.value);
      // Prefer the more recent case when two observations are equally close.
      if (distance <= selectedDistance) {
        selectedIndex = index;
        selectedDistance = distance;
      }
    }
    selected.add(selectedIndex);
    const event = events[selectedIndex];
    return {
      representativeOf: target.representativeOf,
      eventOpenedAt: event.eventOpenedAt,
      eventClosedAt: event.eventClosedAt,
      eventClose: event.eventClose,
      outcomes: event.outcomes.map((outcome) => ({
        bars: outcome.bars,
        returnPercent: outcome.returnPercent,
        maxUpsidePercent: outcome.maxUpsidePercent,
        maxDownsidePercent: outcome.maxDownsidePercent,
      })),
    };
  });
}

function compareHistoricalEventObservations(
  left: HistoricalContextEventObservation,
  right: HistoricalContextEventObservation,
): number {
  return (
    Date.parse(left.eventOpenedAt) - Date.parse(right.eventOpenedAt) ||
    left.segmentIndex - right.segmentIndex ||
    left.pointIndex - right.pointIndex
  );
}

function assertHistoricalEventObservations(
  events: readonly HistoricalContextEventObservation[],
): void {
  const previousBySegment = new Map<
    number,
    HistoricalContextEventObservation
  >();
  let previousOpenedAt = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (
      !Number.isSafeInteger(event.segmentIndex) ||
      event.segmentIndex < 0 ||
      !Number.isSafeInteger(event.pointIndex) ||
      event.pointIndex < 0 ||
      !Number.isFinite(event.eventClose) ||
      event.eventClose <= 0 ||
      !Array.isArray(event.outcomes) ||
      event.outcomes.length !== HISTORICAL_CONTEXT_HORIZONS.length
    ) {
      throw new TypeError("Invalid historical event observation.");
    }
    const eventOpenedAt = Date.parse(event.eventOpenedAt);
    const eventClosedAt = Date.parse(event.eventClosedAt);
    if (
      !Number.isFinite(eventOpenedAt) ||
      !Number.isFinite(eventClosedAt) ||
      eventOpenedAt <= previousOpenedAt ||
      eventClosedAt < eventOpenedAt
    ) {
      throw new TypeError("Historical event timestamps must be ordered.");
    }
    const previous = previousBySegment.get(event.segmentIndex);
    if (
      previous !== undefined &&
      (event.pointIndex <= previous.pointIndex ||
        eventOpenedAt <= Date.parse(previous.eventOpenedAt))
    ) {
      throw new TypeError(
        "Historical events must be unique and ordered inside each segment.",
      );
    }
    for (const [index, bars] of HISTORICAL_CONTEXT_HORIZONS.entries()) {
      const outcome = event.outcomes[index];
      const horizonClosedAt = Date.parse(outcome?.horizonClosedAt);
      if (
        outcome?.bars !== bars ||
        !Number.isFinite(horizonClosedAt) ||
        horizonClosedAt < eventClosedAt ||
        !Number.isFinite(outcome.returnPercent) ||
        !Number.isFinite(outcome.maxUpsidePercent) ||
        !Number.isFinite(outcome.maxDownsidePercent)
      ) {
        throw new TypeError("Invalid historical event outcome observation.");
      }
    }
    previousBySegment.set(event.segmentIndex, event);
    previousOpenedAt = eventOpenedAt;
  }
}

function quantile(values: readonly number[], probability: number): number {
  if (values.length === 0 || probability < 0 || probability > 1) {
    throw new RangeError("A quantile requires values and a probability from 0 to 1.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  const result = lower + (upper - lower) * (position - lowerIndex);
  assertFiniteResult(result);
  return result;
}

function percentChange(value: number, basis: number): number {
  const result = ((value - basis) / basis) * 100;
  assertFiniteResult(result);
  return result;
}

function assertContiguousSingleScope(candles: readonly ChartCandle[]): void {
  const reference = candles[0];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    if (
      current.asset !== reference.asset ||
      current.symbol !== reference.symbol ||
      current.interval !== reference.interval ||
      current.quoteCurrency !== reference.quoteCurrency ||
      Date.parse(current.openedAt) - Date.parse(previous.openedAt) !==
        chartIntervalMilliseconds[reference.interval]
    ) {
      throw new TypeError(
        "Historical context candles must be contiguous and share one scope.",
      );
    }
  }
}

function assertFiniteResult(value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError("Historical context calculation must be finite.");
  }
}
