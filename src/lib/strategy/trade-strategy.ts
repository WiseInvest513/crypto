import type { Asset, ChartCandleInterval } from "@/lib/market/live-chart";

export const TRADE_STRATEGY_SCHEMA_VERSION = 1 as const;

export type TradeStrategyBias = "bullish" | "bearish" | "neutral" | "wait";
export type StoredTradeStrategyStatus =
  | "draft"
  | "in_review"
  | "published"
  | "withdrawn";
export type TradeStrategyDisplayState =
  | "active"
  | "scheduled"
  | "expired"
  | "unpublished"
  | "withdrawn";
export type TradeStrategyZoneRole =
  | "support"
  | "resistance"
  | "target"
  | "watch";

export type TradeStrategySource = Readonly<{
  id: string;
  label: string;
  url: string;
}>;

export type TradeStrategyPriceZone = Readonly<{
  id: string;
  role: TradeStrategyZoneRole;
  lower: number;
  upper: number;
  label: string;
  rationale: string;
  sourceIds: readonly string[];
}>;

export type TradeStrategy = Readonly<{
  schemaVersion: typeof TRADE_STRATEGY_SCHEMA_VERSION;
  id: string;
  revision: number;
  asset: Asset;
  storedStatus: StoredTradeStrategyStatus;
  bias: TradeStrategyBias;
  headline: string;
  summary: string;
  timeframes: readonly ChartCandleInterval[];
  priceZones: readonly TradeStrategyPriceZone[];
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  watchItems: readonly string[];
  riskDisclosure: string;
  author: string;
  reviewer: string | null;
  sources: readonly TradeStrategySource[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
}>;

/**
 * Minimal DTO allowed to cross the private strategy disclosure boundary.
 * Source URLs, storage state and draft metadata intentionally stay server-side.
 */
export type ActiveTradeStrategyView = Readonly<{
  id: string;
  revision: number;
  asset: Asset;
  bias: TradeStrategyBias;
  headline: string;
  summary: string;
  timeframes: readonly ChartCandleInterval[];
  priceZones: readonly Readonly<{
    id: string;
    role: TradeStrategyZoneRole;
    lower: number;
    upper: number;
    label: string;
    rationale: string;
  }>[];
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  watchItems: readonly string[];
  riskDisclosure: string;
  author: string;
  reviewer: string;
  reviewedAt: string;
  validFrom: string;
  validUntil: string;
}>;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u;
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "api_key",
  "apikey",
  "api-key",
  "key",
  "secret",
  "signature",
  "sig",
  "auth",
  "authorization",
  "access_token",
]);
const STRATEGY_INTERVALS = new Set<ChartCandleInterval>([
  "15m",
  "1h",
  "4h",
  "1d",
]);

export function parseTradeStrategy(input: unknown): TradeStrategy {
  const record = asExactRecord(input, "strategy", [
    "schemaVersion",
    "id",
    "revision",
    "asset",
    "storedStatus",
    "bias",
    "headline",
    "summary",
    "timeframes",
    "priceZones",
    "confirmationConditions",
    "invalidationConditions",
    "watchItems",
    "riskDisclosure",
    "author",
    "reviewer",
    "sources",
    "createdAt",
    "reviewedAt",
    "publishedAt",
    "validFrom",
    "validUntil",
  ]);

  if (record.schemaVersion !== TRADE_STRATEGY_SCHEMA_VERSION) {
    throw new Error(
      `strategy.schemaVersion must be ${TRADE_STRATEGY_SCHEMA_VERSION}.`,
    );
  }

  const storedStatus = asOneOf(
    record.storedStatus,
    "strategy.storedStatus",
    ["draft", "in_review", "published", "withdrawn"] as const,
  );
  const sources = asSources(record.sources, "strategy.sources");
  const knownSourceIds = new Set(sources.map((source) => source.id));
  const strategy: TradeStrategy = {
    schemaVersion: TRADE_STRATEGY_SCHEMA_VERSION,
    id: asId(record.id, "strategy.id"),
    revision: asPositiveInteger(record.revision, "strategy.revision"),
    asset: asOneOf(record.asset, "strategy.asset", ["btc", "eth"] as const),
    storedStatus,
    bias: asOneOf(record.bias, "strategy.bias", [
      "bullish",
      "bearish",
      "neutral",
      "wait",
    ] as const),
    headline: asBoundedString(record.headline, "strategy.headline", 100),
    summary: asBoundedString(record.summary, "strategy.summary", 600),
    timeframes: asTimeframes(record.timeframes, "strategy.timeframes"),
    priceZones: asPriceZones(
      record.priceZones,
      "strategy.priceZones",
      knownSourceIds,
    ),
    confirmationConditions: asStringList(
      record.confirmationConditions,
      "strategy.confirmationConditions",
      1,
      8,
      240,
    ),
    invalidationConditions: asStringList(
      record.invalidationConditions,
      "strategy.invalidationConditions",
      1,
      8,
      240,
    ),
    watchItems: asStringList(
      record.watchItems,
      "strategy.watchItems",
      0,
      8,
      240,
    ),
    riskDisclosure: asBoundedString(
      record.riskDisclosure,
      "strategy.riskDisclosure",
      500,
    ),
    author: asBoundedString(record.author, "strategy.author", 80),
    reviewer: asNullableString(record.reviewer, "strategy.reviewer", 80),
    sources,
    createdAt: asTimestamp(record.createdAt, "strategy.createdAt"),
    reviewedAt: asNullableTimestamp(
      record.reviewedAt,
      "strategy.reviewedAt",
    ),
    publishedAt: asNullableTimestamp(
      record.publishedAt,
      "strategy.publishedAt",
    ),
    validFrom: asNullableTimestamp(record.validFrom, "strategy.validFrom"),
    validUntil: asNullableTimestamp(
      record.validUntil,
      "strategy.validUntil",
    ),
  };

  assertPublicationMetadata(strategy);
  return strategy;
}

/** Active window is half-open: validFrom <= now < validUntil. */
export function resolveTradeStrategyDisplayState(
  strategy: TradeStrategy,
  now: number,
): TradeStrategyDisplayState {
  if (!Number.isFinite(now)) {
    throw new TypeError("Strategy display time must be finite.");
  }
  if (strategy.storedStatus === "withdrawn") return "withdrawn";
  if (strategy.storedStatus !== "published") return "unpublished";

  const validFrom = Date.parse(strategy.validFrom ?? "");
  const validUntil = Date.parse(strategy.validUntil ?? "");
  if (now < validFrom) return "scheduled";
  if (now >= validUntil) return "expired";
  return "active";
}

export function toActiveTradeStrategyView(
  strategy: TradeStrategy,
): ActiveTradeStrategyView {
  if (
    strategy.storedStatus !== "published" ||
    strategy.reviewer === null ||
    strategy.reviewedAt === null ||
    strategy.validFrom === null ||
    strategy.validUntil === null
  ) {
    throw new Error("Only reviewed, published strategies can become view DTOs.");
  }

  return {
    id: strategy.id,
    revision: strategy.revision,
    asset: strategy.asset,
    bias: strategy.bias,
    headline: strategy.headline,
    summary: strategy.summary,
    timeframes: strategy.timeframes,
    priceZones: strategy.priceZones.map(
      ({ id, role, lower, upper, label, rationale }) => ({
        id,
        role,
        lower,
        upper,
        label,
        rationale,
      }),
    ),
    confirmationConditions: strategy.confirmationConditions,
    invalidationConditions: strategy.invalidationConditions,
    watchItems: strategy.watchItems,
    riskDisclosure: strategy.riskDisclosure,
    author: "Wise 研究",
    reviewer: "Wise 独立复核",
    reviewedAt: strategy.reviewedAt,
    validFrom: strategy.validFrom,
    validUntil: strategy.validUntil,
  };
}

function assertPublicationMetadata(strategy: TradeStrategy): void {
  const timestamps = [
    strategy.reviewedAt,
    strategy.publishedAt,
    strategy.validFrom,
    strategy.validUntil,
  ];

  if (strategy.storedStatus !== "published") return;
  if (
    strategy.reviewer === null ||
    timestamps.some((timestamp) => timestamp === null) ||
    strategy.sources.length === 0 ||
    strategy.priceZones.length === 0
  ) {
    throw new Error(
      "Published strategies require a reviewer, review/publication window, sources and at least one price zone.",
    );
  }

  const createdAt = Date.parse(strategy.createdAt);
  const reviewedAt = Date.parse(strategy.reviewedAt!);
  const publishedAt = Date.parse(strategy.publishedAt!);
  const validFrom = Date.parse(strategy.validFrom!);
  const validUntil = Date.parse(strategy.validUntil!);
  if (
    createdAt > reviewedAt ||
    reviewedAt > publishedAt ||
    validFrom >= validUntil ||
    publishedAt >= validUntil
  ) {
    throw new Error(
      "Published strategy timestamps must satisfy created <= reviewed <= published < validUntil and validFrom < validUntil.",
    );
  }
}

function asPriceZones(
  value: unknown,
  path: string,
  knownSourceIds: ReadonlySet<string>,
): readonly TradeStrategyPriceZone[] {
  if (!Array.isArray(value) || value.length > 8) {
    throw new Error(`${path} must be an array with at most eight entries.`);
  }
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const zonePath = `${path}[${index}]`;
    const record = asExactRecord(entry, zonePath, [
      "id",
      "role",
      "lower",
      "upper",
      "label",
      "rationale",
      "sourceIds",
    ]);
    const id = asId(record.id, `${zonePath}.id`);
    if (ids.has(id)) throw new Error(`${path} IDs must be unique.`);
    ids.add(id);
    const lower = asPositiveNumber(record.lower, `${zonePath}.lower`);
    const upper = asPositiveNumber(record.upper, `${zonePath}.upper`);
    if (lower > upper) {
      throw new Error(`${zonePath}.lower must not exceed upper.`);
    }
    return {
      id,
      role: asOneOf(record.role, `${zonePath}.role`, [
        "support",
        "resistance",
        "target",
        "watch",
      ] as const),
      lower,
      upper,
      label: asBoundedString(record.label, `${zonePath}.label`, 80),
      rationale: asBoundedString(
        record.rationale,
        `${zonePath}.rationale`,
        320,
      ),
      sourceIds: asSourceReferences(
        record.sourceIds,
        `${zonePath}.sourceIds`,
        knownSourceIds,
      ),
    };
  });
}

function asSources(value: unknown, path: string): readonly TradeStrategySource[] {
  if (!Array.isArray(value) || value.length > 12) {
    throw new Error(`${path} must be an array with at most twelve entries.`);
  }
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const sourcePath = `${path}[${index}]`;
    const record = asExactRecord(entry, sourcePath, ["id", "label", "url"]);
    const id = asId(record.id, `${sourcePath}.id`);
    if (ids.has(id)) throw new Error(`${path} IDs must be unique.`);
    ids.add(id);
    const rawUrl = asBoundedString(record.url, `${sourcePath}.url`, 500);
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`${sourcePath}.url must be an absolute HTTPS URL.`);
    }
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      throw new Error(
        `${sourcePath}.url must be HTTPS without credentials or a fragment.`,
      );
    }
    if (
      [...url.searchParams.keys()].some((key) =>
        SENSITIVE_QUERY_KEYS.has(key.toLowerCase()),
      )
    ) {
      throw new Error(
        `${sourcePath}.url cannot contain credential-like query parameters.`,
      );
    }
    return {
      id,
      label: asBoundedString(record.label, `${sourcePath}.label`, 120),
      url: url.toString(),
    };
  });
}

function asSourceReferences(
  value: unknown,
  path: string,
  knownSourceIds: ReadonlySet<string>,
): readonly string[] {
  const ids = asStringList(value, path, 1, 8, 80).map((id) => {
    if (!ID.test(id)) throw new Error(`${path} contains an invalid source ID.`);
    if (!knownSourceIds.has(id)) {
      throw new Error(`${path} references an unknown source ID: ${id}.`);
    }
    return id;
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${path} cannot contain duplicate source IDs.`);
  }
  return ids;
}

function asTimeframes(
  value: unknown,
  path: string,
): readonly ChartCandleInterval[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new Error(`${path} must contain one to four timeframes.`);
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== "string" || !STRATEGY_INTERVALS.has(entry as ChartCandleInterval)) {
      throw new Error(`${path}[${index}] is not a supported timeframe.`);
    }
    return entry as ChartCandleInterval;
  });
  if (new Set(result).size !== result.length) {
    throw new Error(`${path} cannot contain duplicate timeframes.`);
  }
  return result;
}

function asExactRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${path} has unknown or missing fields.`);
  }
  return record;
}

function asOneOf<const T extends readonly string[]>(
  value: unknown,
  path: string,
  options: T,
): T[number] {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new Error(`${path} must be one of ${options.join(", ")}.`);
  }
  return value as T[number];
}

function asId(value: unknown, path: string): string {
  const id = asBoundedString(value, path, 80);
  if (!ID.test(id)) throw new Error(`${path} must be a kebab-case ID.`);
  return id;
}

function asPositiveInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${path} must be a positive safe integer.`);
  }
  return value as number;
}

function asPositiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be a positive finite number.`);
  }
  return value;
}

function asBoundedString(
  value: unknown,
  path: string,
  maximum: number,
): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${path} must be a trimmed string up to ${maximum} chars.`);
  }
  return value;
}

function asNullableString(
  value: unknown,
  path: string,
  maximum: number,
): string | null {
  return value === null ? null : asBoundedString(value, path, maximum);
}

function asStringList(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  itemMaximum: number,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new Error(
      `${path} must contain between ${minimum} and ${maximum} entries.`,
    );
  }
  return value.map((entry, index) =>
    asBoundedString(entry, `${path}[${index}]`, itemMaximum),
  );
}

function asTimestamp(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a strict UTC timestamp.`);
  }
  const match = UTC_TIMESTAMP.exec(value);
  if (match === null) {
    throw new Error(`${path} must be a strict UTC timestamp.`);
  }
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const millisecondsPart = Number(fraction.padEnd(3, "0"));
  const milliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millisecondsPart,
  );
  const parsed = new Date(milliseconds);
  if (
    !Number.isFinite(milliseconds) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day) ||
    parsed.getUTCHours() !== Number(hour) ||
    parsed.getUTCMinutes() !== Number(minute) ||
    parsed.getUTCSeconds() !== Number(second) ||
    parsed.getUTCMilliseconds() !== millisecondsPart
  ) {
    throw new Error(`${path} must be a real UTC timestamp.`);
  }
  return value;
}

function asNullableTimestamp(value: unknown, path: string): string | null {
  return value === null ? null : asTimestamp(value, path);
}
