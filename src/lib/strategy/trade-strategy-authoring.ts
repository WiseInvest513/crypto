import type { Asset, ChartCandleInterval } from "@/lib/market/live-chart";
import {
  parseTradeStrategy,
  TRADE_STRATEGY_SCHEMA_VERSION,
  type TradeStrategy,
  type TradeStrategyBias,
  type TradeStrategyPriceZone,
  type TradeStrategySource,
  type TradeStrategyZoneRole,
} from "@/lib/strategy/trade-strategy";

export const TRADE_STRATEGY_AUTHORING_LIMITS = {
  id: 80,
  headline: 100,
  summary: 600,
  timeframes: 4,
  priceZones: 8,
  zoneLabel: 80,
  zoneRationale: 320,
  sourceReferences: 8,
  conditions: 8,
  condition: 240,
  watchItems: 8,
  watchItem: 240,
  riskDisclosure: 500,
  sources: 12,
  sourceLabel: 120,
  sourceUrl: 500,
  person: 80,
} as const;

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

export type TradeStrategyDraftStatus = "draft" | "in_review";

export type TradeStrategyDraftSource = Readonly<{
  id: string;
  label: string;
  url: string;
}>;

export type TradeStrategyDraftPriceZone = Readonly<{
  id: string;
  role: TradeStrategyZoneRole | null;
  lower: number | null;
  upper: number | null;
  label: string;
  rationale: string;
  sourceIds: readonly string[];
}>;

/**
 * Editable content only. Blank strings, empty arrays and nullable decisions are
 * intentional so a real first save never needs invented filler content.
 */
export type TradeStrategyDraftInput = Readonly<{
  asset: Asset;
  bias: TradeStrategyBias | null;
  headline: string;
  summary: string;
  timeframes: readonly ChartCandleInterval[];
  priceZones: readonly TradeStrategyDraftPriceZone[];
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  watchItems: readonly string[];
  riskDisclosure: string;
  sources: readonly TradeStrategyDraftSource[];
  validFrom: string | null;
  validUntil: string | null;
}>;

/** Storage metadata is separate from editable content and never inferred. */
export type StoredTradeStrategyDraft = Readonly<{
  schemaVersion: typeof TRADE_STRATEGY_SCHEMA_VERSION;
  id: string;
  revision: number;
  storedStatus: TradeStrategyDraftStatus;
  content: TradeStrategyDraftInput;
  author: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ReadyTradeStrategyDraft = Readonly<
  Omit<
    TradeStrategyDraftInput,
    "bias" | "priceZones" | "sources" | "validFrom" | "validUntil"
  > & {
    bias: TradeStrategyBias;
    priceZones: readonly TradeStrategyPriceZone[];
    sources: readonly TradeStrategySource[];
    validFrom: string;
    validUntil: string;
  }
>;

export type TradeStrategyPublicationMetadata = Readonly<{
  id: string;
  revision: number;
  author: string;
  reviewer: string;
  createdAt: string;
  reviewedAt: string;
  publishedAt: string;
  validFrom: string;
  validUntil: string;
}>;

export type TradeStrategyAuthoringIssueCode =
  | "invalid_type"
  | "missing_field"
  | "unknown_field"
  | "invalid_version"
  | "invalid_option"
  | "invalid_id"
  | "invalid_number"
  | "invalid_range"
  | "invalid_url"
  | "invalid_timestamp"
  | "invalid_time_order"
  | "not_trimmed"
  | "control_character"
  | "too_long"
  | "too_many_items"
  | "duplicate"
  | "required"
  | "invalid_reference"
  | "self_review"
  | "window_mismatch"
  | "invalid_snapshot";

export type TradeStrategyAuthoringIssue = Readonly<{
  path: string;
  code: TradeStrategyAuthoringIssueCode;
  message: string;
}>;

export type TradeStrategyAuthoringResult<T> =
  | Readonly<{ ok: true; value: T; errors: readonly [] }>
  | Readonly<{
      ok: false;
      value: null;
      errors: readonly TradeStrategyAuthoringIssue[];
    }>;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const STRATEGY_INTERVALS = ["15m", "1h", "4h", "1d"] as const;
const STRATEGY_BIASES = ["bullish", "bearish", "neutral", "wait"] as const;
const ZONE_ROLES = ["support", "resistance", "target", "watch"] as const;
const DRAFT_STATUSES = ["draft", "in_review"] as const;

const DRAFT_FIELDS = [
  "asset",
  "bias",
  "headline",
  "summary",
  "timeframes",
  "priceZones",
  "confirmationConditions",
  "invalidationConditions",
  "watchItems",
  "riskDisclosure",
  "sources",
  "validFrom",
  "validUntil",
] as const;

const STORED_DRAFT_FIELDS = [
  "schemaVersion",
  "id",
  "revision",
  "storedStatus",
  "content",
  "author",
  "createdAt",
  "updatedAt",
] as const;

const PUBLICATION_FIELDS = [
  "id",
  "revision",
  "author",
  "reviewer",
  "createdAt",
  "reviewedAt",
  "publishedAt",
  "validFrom",
  "validUntil",
] as const;

export function createBlankTradeStrategyDraft(
  asset: Asset,
): TradeStrategyDraftInput {
  return {
    asset,
    bias: null,
    headline: "",
    summary: "",
    timeframes: [],
    priceZones: [],
    confirmationConditions: [],
    invalidationConditions: [],
    watchItems: [],
    riskDisclosure: "",
    sources: [],
    validFrom: null,
    validUntil: null,
  };
}

export function parseTradeStrategyDraftInput(
  input: unknown,
): TradeStrategyAuthoringResult<TradeStrategyDraftInput> {
  return parseDraftAt(input, "draft");
}

export function parseStoredTradeStrategyDraft(
  input: unknown,
): TradeStrategyAuthoringResult<StoredTradeStrategyDraft> {
  const issues: TradeStrategyAuthoringIssue[] = [];
  const record = exactRecord(input, "record", STORED_DRAFT_FIELDS, issues);
  if (record === null) return failure(issues);

  const schemaVersion = field(record, "schemaVersion", (value) => {
    if (value !== TRADE_STRATEGY_SCHEMA_VERSION) {
      addIssue(
        issues,
        "record.schemaVersion",
        "invalid_version",
        `版本必须为 ${TRADE_STRATEGY_SCHEMA_VERSION}。`,
      );
      return undefined;
    }
    return TRADE_STRATEGY_SCHEMA_VERSION;
  });
  const id = field(record, "id", (value) =>
    requiredId(value, "record.id", issues),
  );
  const revision = field(record, "revision", (value) =>
    positiveInteger(value, "record.revision", issues),
  );
  const storedStatus = field(record, "storedStatus", (value) =>
    oneOf(value, "record.storedStatus", DRAFT_STATUSES, issues),
  );
  const contentResult = hasOwn(record, "content")
    ? parseDraftAt(record.content, "record.content")
    : null;
  if (contentResult?.ok === false) issues.push(...contentResult.errors);
  const author = field(record, "author", (value) =>
    requiredString(
      value,
      "record.author",
      TRADE_STRATEGY_AUTHORING_LIMITS.person,
      issues,
    ),
  );
  const createdAt = field(record, "createdAt", (value) =>
    timestamp(value, "record.createdAt", issues),
  );
  const updatedAt = field(record, "updatedAt", (value) =>
    timestamp(value, "record.updatedAt", issues),
  );

  if (
    createdAt !== undefined &&
    updatedAt !== undefined &&
    Date.parse(createdAt) > Date.parse(updatedAt)
  ) {
    addIssue(
      issues,
      "record.updatedAt",
      "invalid_time_order",
      "更新时间不能早于创建时间。",
    );
  }

  if (
    issues.length > 0 ||
    schemaVersion === undefined ||
    id === undefined ||
    revision === undefined ||
    storedStatus === undefined ||
    contentResult?.ok !== true ||
    author === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return failure(issues);
  }

  return success({
    schemaVersion,
    id,
    revision,
    storedStatus,
    content: contentResult.value,
    author,
    createdAt,
    updatedAt,
  });
}

export function validateTradeStrategyReadyForReview(
  input: unknown,
): TradeStrategyAuthoringResult<ReadyTradeStrategyDraft> {
  const parsed = parseTradeStrategyDraftInput(input);
  if (!parsed.ok) return parsed;

  const draft = parsed.value;
  const issues: TradeStrategyAuthoringIssue[] = [];
  requireCompletedText(draft.headline, "draft.headline", issues);
  requireCompletedText(draft.summary, "draft.summary", issues);
  if (draft.bias === null) {
    addIssue(issues, "draft.bias", "required", "提交审核前必须选择倾向。");
  }
  if (draft.timeframes.length === 0) {
    addIssue(
      issues,
      "draft.timeframes",
      "required",
      "提交审核前必须选择至少一个适用周期。",
    );
  }
  if (draft.priceZones.length === 0) {
    addIssue(
      issues,
      "draft.priceZones",
      "required",
      "提交审核前必须填写至少一个价格区域。",
    );
  }
  if (draft.sources.length === 0) {
    addIssue(
      issues,
      "draft.sources",
      "required",
      "提交审核前必须填写至少一个可验证来源。",
    );
  }

  const sourceIds = new Set<string>();
  draft.sources.forEach((source, index) => {
    const path = `draft.sources[${index}]`;
    requireCompletedText(source.id, `${path}.id`, issues);
    requireCompletedText(source.label, `${path}.label`, issues);
    requireCompletedText(source.url, `${path}.url`, issues);
    if (source.id !== "") sourceIds.add(source.id);
  });

  draft.priceZones.forEach((zone, index) => {
    const path = `draft.priceZones[${index}]`;
    requireCompletedText(zone.id, `${path}.id`, issues);
    if (zone.role === null) {
      addIssue(
        issues,
        `${path}.role`,
        "required",
        "提交审核前必须选择区域角色。",
      );
    }
    if (zone.lower === null) {
      addIssue(
        issues,
        `${path}.lower`,
        "required",
        "提交审核前必须填写区域下界。",
      );
    }
    if (zone.upper === null) {
      addIssue(
        issues,
        `${path}.upper`,
        "required",
        "提交审核前必须填写区域上界。",
      );
    }
    requireCompletedText(zone.label, `${path}.label`, issues);
    requireCompletedText(zone.rationale, `${path}.rationale`, issues);
    if (zone.sourceIds.length === 0) {
      addIssue(
        issues,
        `${path}.sourceIds`,
        "required",
        "提交审核前必须关联至少一个来源。",
      );
    }
    zone.sourceIds.forEach((sourceId, sourceIndex) => {
      const sourcePath = `${path}.sourceIds[${sourceIndex}]`;
      if (sourceId === "") {
        addIssue(
          issues,
          sourcePath,
          "required",
          "提交审核前必须选择来源。",
        );
      } else if (!sourceIds.has(sourceId)) {
        addIssue(
          issues,
          sourcePath,
          "invalid_reference",
          "引用了不存在的来源。",
        );
      }
    });
  });

  requireCompletedList(
    draft.confirmationConditions,
    "draft.confirmationConditions",
    "提交审核前必须填写至少一个确认条件。",
    issues,
  );
  requireCompletedList(
    draft.invalidationConditions,
    "draft.invalidationConditions",
    "提交审核前必须填写至少一个失效条件。",
    issues,
  );
  draft.watchItems.forEach((item, index) => {
    requireCompletedText(item, `draft.watchItems[${index}]`, issues);
  });
  requireCompletedText(draft.riskDisclosure, "draft.riskDisclosure", issues);

  if (draft.validFrom === null) {
    addIssue(
      issues,
      "draft.validFrom",
      "required",
      "提交审核前必须填写生效时间。",
    );
  }
  if (draft.validUntil === null) {
    addIssue(
      issues,
      "draft.validUntil",
      "required",
      "提交审核前必须填写到期时间。",
    );
  }
  if (
    draft.validFrom !== null &&
    draft.validUntil !== null &&
    Date.parse(draft.validFrom) >= Date.parse(draft.validUntil)
  ) {
    addIssue(
      issues,
      "draft.validUntil",
      "invalid_time_order",
      "到期时间必须晚于生效时间。",
    );
  }

  if (
    issues.length > 0 ||
    draft.bias === null ||
    draft.validFrom === null ||
    draft.validUntil === null
  ) {
    return failure(issues);
  }

  return success({
    ...draft,
    bias: draft.bias,
    priceZones: draft.priceZones as readonly TradeStrategyPriceZone[],
    sources: draft.sources as readonly TradeStrategySource[],
    validFrom: draft.validFrom,
    validUntil: draft.validUntil,
  });
}

export function parseTradeStrategyPublicationMetadata(
  input: unknown,
): TradeStrategyAuthoringResult<TradeStrategyPublicationMetadata> {
  const issues: TradeStrategyAuthoringIssue[] = [];
  const record = exactRecord(input, "publication", PUBLICATION_FIELDS, issues);
  if (record === null) return failure(issues);

  const id = field(record, "id", (value) =>
    requiredId(value, "publication.id", issues),
  );
  const revision = field(record, "revision", (value) =>
    positiveInteger(value, "publication.revision", issues),
  );
  const author = field(record, "author", (value) =>
    requiredString(
      value,
      "publication.author",
      TRADE_STRATEGY_AUTHORING_LIMITS.person,
      issues,
    ),
  );
  const reviewer = field(record, "reviewer", (value) =>
    requiredString(
      value,
      "publication.reviewer",
      TRADE_STRATEGY_AUTHORING_LIMITS.person,
      issues,
    ),
  );
  const createdAt = field(record, "createdAt", (value) =>
    timestamp(value, "publication.createdAt", issues),
  );
  const reviewedAt = field(record, "reviewedAt", (value) =>
    timestamp(value, "publication.reviewedAt", issues),
  );
  const publishedAt = field(record, "publishedAt", (value) =>
    timestamp(value, "publication.publishedAt", issues),
  );
  const validFrom = field(record, "validFrom", (value) =>
    timestamp(value, "publication.validFrom", issues),
  );
  const validUntil = field(record, "validUntil", (value) =>
    timestamp(value, "publication.validUntil", issues),
  );

  if (
    author !== undefined &&
    reviewer !== undefined &&
    canonicalPerson(author) === canonicalPerson(reviewer)
  ) {
    addIssue(
      issues,
      "publication.reviewer",
      "self_review",
      "作者不能审核自己的策略。",
    );
  }

  if (createdAt !== undefined && reviewedAt !== undefined) {
    assertOrderedTime(
      createdAt,
      reviewedAt,
      "publication.reviewedAt",
      "审核时间不能早于创建时间。",
      issues,
    );
  }
  if (reviewedAt !== undefined && publishedAt !== undefined) {
    assertOrderedTime(
      reviewedAt,
      publishedAt,
      "publication.publishedAt",
      "发布时间不能早于审核时间。",
      issues,
    );
  }
  if (
    validFrom !== undefined &&
    validUntil !== undefined &&
    Date.parse(validFrom) >= Date.parse(validUntil)
  ) {
    addIssue(
      issues,
      "publication.validUntil",
      "invalid_time_order",
      "到期时间必须晚于生效时间。",
    );
  }
  if (
    publishedAt !== undefined &&
    validUntil !== undefined &&
    Date.parse(publishedAt) >= Date.parse(validUntil)
  ) {
    addIssue(
      issues,
      "publication.publishedAt",
      "invalid_time_order",
      "发布时间必须早于到期时间。",
    );
  }

  if (
    issues.length > 0 ||
    id === undefined ||
    revision === undefined ||
    author === undefined ||
    reviewer === undefined ||
    createdAt === undefined ||
    reviewedAt === undefined ||
    publishedAt === undefined ||
    validFrom === undefined ||
    validUntil === undefined
  ) {
    return failure(issues);
  }

  return success({
    id,
    revision,
    author,
    reviewer,
    createdAt,
    reviewedAt,
    publishedAt,
    validFrom,
    validUntil,
  });
}

/**
 * Builds one immutable strict publication snapshot. No identity, revision or
 * timestamp is defaulted from ambient state; every audit value is supplied by
 * the caller and checked again by the existing publication contract.
 */
export function buildPublishedTradeStrategy(
  draftInput: unknown,
  publicationInput: unknown,
): TradeStrategyAuthoringResult<TradeStrategy> {
  const ready = validateTradeStrategyReadyForReview(draftInput);
  const publication = parseTradeStrategyPublicationMetadata(publicationInput);
  const issues: TradeStrategyAuthoringIssue[] = [];
  if (!ready.ok) issues.push(...ready.errors);
  if (!publication.ok) issues.push(...publication.errors);
  if (!ready.ok || !publication.ok) return failure(issues);

  if (Date.parse(ready.value.validFrom) !== Date.parse(publication.value.validFrom)) {
    addIssue(
      issues,
      "publication.validFrom",
      "window_mismatch",
      "发布生效时间必须与已审核草稿一致。",
    );
  }
  if (
    Date.parse(ready.value.validUntil) !==
    Date.parse(publication.value.validUntil)
  ) {
    addIssue(
      issues,
      "publication.validUntil",
      "window_mismatch",
      "发布到期时间必须与已审核草稿一致。",
    );
  }
  if (issues.length > 0) return failure(issues);

  const candidate = {
    schemaVersion: TRADE_STRATEGY_SCHEMA_VERSION,
    id: publication.value.id,
    revision: publication.value.revision,
    asset: ready.value.asset,
    storedStatus: "published" as const,
    bias: ready.value.bias,
    headline: ready.value.headline,
    summary: ready.value.summary,
    timeframes: [...ready.value.timeframes],
    priceZones: ready.value.priceZones.map((zone) => ({
      ...zone,
      sourceIds: [...zone.sourceIds],
    })),
    confirmationConditions: [...ready.value.confirmationConditions],
    invalidationConditions: [...ready.value.invalidationConditions],
    watchItems: [...ready.value.watchItems],
    riskDisclosure: ready.value.riskDisclosure,
    author: publication.value.author,
    reviewer: publication.value.reviewer,
    sources: ready.value.sources.map((source) => ({ ...source })),
    createdAt: publication.value.createdAt,
    reviewedAt: publication.value.reviewedAt,
    publishedAt: publication.value.publishedAt,
    validFrom: publication.value.validFrom,
    validUntil: publication.value.validUntil,
  };

  try {
    return success(parseTradeStrategy(candidate));
  } catch {
    return failure([
      {
        path: "strategy",
        code: "invalid_snapshot",
        message: "发布快照未通过最终合同校验。",
      },
    ]);
  }
}

function parseDraftAt(
  input: unknown,
  root: string,
): TradeStrategyAuthoringResult<TradeStrategyDraftInput> {
  const issues: TradeStrategyAuthoringIssue[] = [];
  const record = exactRecord(input, root, DRAFT_FIELDS, issues);
  if (record === null) return failure(issues);

  const asset = field(record, "asset", (value) =>
    oneOf(value, `${root}.asset`, ["btc", "eth"] as const, issues),
  );
  const bias = field(record, "bias", (value) =>
    nullableOneOf(value, `${root}.bias`, STRATEGY_BIASES, issues),
  );
  const headline = field(record, "headline", (value) =>
    draftString(
      value,
      `${root}.headline`,
      TRADE_STRATEGY_AUTHORING_LIMITS.headline,
      issues,
    ),
  );
  const summary = field(record, "summary", (value) =>
    draftString(
      value,
      `${root}.summary`,
      TRADE_STRATEGY_AUTHORING_LIMITS.summary,
      issues,
    ),
  );
  const timeframes = field(record, "timeframes", (value) =>
    timeframesList(value, `${root}.timeframes`, issues),
  );
  const priceZones = field(record, "priceZones", (value) =>
    priceZoneList(value, `${root}.priceZones`, issues),
  );
  const confirmationConditions = field(
    record,
    "confirmationConditions",
    (value) =>
      stringList(
        value,
        `${root}.confirmationConditions`,
        TRADE_STRATEGY_AUTHORING_LIMITS.conditions,
        TRADE_STRATEGY_AUTHORING_LIMITS.condition,
        issues,
      ),
  );
  const invalidationConditions = field(
    record,
    "invalidationConditions",
    (value) =>
      stringList(
        value,
        `${root}.invalidationConditions`,
        TRADE_STRATEGY_AUTHORING_LIMITS.conditions,
        TRADE_STRATEGY_AUTHORING_LIMITS.condition,
        issues,
      ),
  );
  const watchItems = field(record, "watchItems", (value) =>
    stringList(
      value,
      `${root}.watchItems`,
      TRADE_STRATEGY_AUTHORING_LIMITS.watchItems,
      TRADE_STRATEGY_AUTHORING_LIMITS.watchItem,
      issues,
    ),
  );
  const riskDisclosure = field(record, "riskDisclosure", (value) =>
    draftString(
      value,
      `${root}.riskDisclosure`,
      TRADE_STRATEGY_AUTHORING_LIMITS.riskDisclosure,
      issues,
    ),
  );
  const sources = field(record, "sources", (value) =>
    sourceList(value, `${root}.sources`, issues),
  );
  const validFrom = field(record, "validFrom", (value) =>
    nullableTimestamp(value, `${root}.validFrom`, issues),
  );
  const validUntil = field(record, "validUntil", (value) =>
    nullableTimestamp(value, `${root}.validUntil`, issues),
  );

  if (
    issues.length > 0 ||
    asset === undefined ||
    bias === undefined ||
    headline === undefined ||
    summary === undefined ||
    timeframes === undefined ||
    priceZones === undefined ||
    confirmationConditions === undefined ||
    invalidationConditions === undefined ||
    watchItems === undefined ||
    riskDisclosure === undefined ||
    sources === undefined ||
    validFrom === undefined ||
    validUntil === undefined
  ) {
    return failure(issues);
  }

  return success({
    asset,
    bias,
    headline,
    summary,
    timeframes,
    priceZones,
    confirmationConditions,
    invalidationConditions,
    watchItems,
    riskDisclosure,
    sources,
    validFrom,
    validUntil,
  });
}

function exactRecord(
  input: unknown,
  path: string,
  fields: readonly string[],
  issues: TradeStrategyAuthoringIssue[],
): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    addIssue(issues, path, "invalid_type", "应为对象。");
    return null;
  }
  const record = input as Record<string, unknown>;
  const expected = new Set(fields);
  for (const fieldName of fields) {
    if (!hasOwn(record, fieldName)) {
      addIssue(
        issues,
        `${path}.${fieldName}`,
        "missing_field",
        "缺少字段。",
      );
    }
  }
  Object.keys(record)
    .filter((key) => !expected.has(key))
    .sort()
    .forEach((key) => {
      addIssue(
        issues,
        `${path}.${key}`,
        "unknown_field",
        "不允许此字段。",
      );
    });
  return record;
}

function field<T>(
  record: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => T | undefined,
): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function draftString(
  value: unknown,
  path: string,
  maximum: number,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  if (typeof value !== "string") {
    addIssue(issues, path, "invalid_type", "应为字符串。");
    return undefined;
  }
  let valid = true;
  if (value.length > maximum) {
    addIssue(issues, path, "too_long", `最多允许 ${maximum} 个字符。`);
    valid = false;
  }
  if (value !== "" && value.trim() !== value) {
    addIssue(issues, path, "not_trimmed", "首尾不能包含空白字符。");
    valid = false;
  }
  if (CONTROL_CHARACTER.test(value)) {
    addIssue(issues, path, "control_character", "不能包含控制字符。");
    valid = false;
  }
  return valid ? value : undefined;
}

function requiredString(
  value: unknown,
  path: string,
  maximum: number,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  const parsed = draftString(value, path, maximum, issues);
  if (parsed === "") {
    addIssue(issues, path, "required", "必须填写。");
    return undefined;
  }
  return parsed;
}

function requiredId(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  const parsed = requiredString(
    value,
    path,
    TRADE_STRATEGY_AUTHORING_LIMITS.id,
    issues,
  );
  if (parsed !== undefined && !ID.test(parsed)) {
    addIssue(
      issues,
      path,
      "invalid_id",
      "ID 必须使用小写字母、数字与连字符。",
    );
    return undefined;
  }
  return parsed;
}

function optionalId(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  const parsed = draftString(
    value,
    path,
    TRADE_STRATEGY_AUTHORING_LIMITS.id,
    issues,
  );
  if (parsed !== undefined && parsed !== "" && !ID.test(parsed)) {
    addIssue(
      issues,
      path,
      "invalid_id",
      "非空 ID 必须使用小写字母、数字与连字符。",
    );
    return undefined;
  }
  return parsed;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  path: string,
  options: T,
  issues: TradeStrategyAuthoringIssue[],
): T[number] | undefined {
  if (typeof value !== "string" || !options.includes(value)) {
    addIssue(issues, path, "invalid_option", "值不在允许范围内。");
    return undefined;
  }
  return value as T[number];
}

function nullableOneOf<const T extends readonly string[]>(
  value: unknown,
  path: string,
  options: T,
  issues: TradeStrategyAuthoringIssue[],
): T[number] | null | undefined {
  return value === null ? null : oneOf(value, path, options, issues);
}

function positiveInteger(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): number | undefined {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    addIssue(issues, path, "invalid_number", "必须是正安全整数。");
    return undefined;
  }
  return value as number;
}

function nullablePositiveNumber(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    addIssue(
      issues,
      path,
      "invalid_number",
      "非空价格必须是大于 0 的有限数值。",
    );
    return undefined;
  }
  return value;
}

function timeframesList(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): readonly ChartCandleInterval[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "invalid_type", "应为数组。");
    return undefined;
  }
  if (value.length > TRADE_STRATEGY_AUTHORING_LIMITS.timeframes) {
    addIssue(
      issues,
      path,
      "too_many_items",
      `最多允许 ${TRADE_STRATEGY_AUTHORING_LIMITS.timeframes} 项。`,
    );
  }
  const result: ChartCandleInterval[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const parsed = oneOf(entry, `${path}[${index}]`, STRATEGY_INTERVALS, issues);
    if (parsed === undefined) return;
    if (seen.has(parsed)) {
      addIssue(issues, `${path}[${index}]`, "duplicate", "不能包含重复周期。");
      return;
    }
    seen.add(parsed);
    result.push(parsed);
  });
  return result;
}

function stringList(
  value: unknown,
  path: string,
  maximum: number,
  itemMaximum: number,
  issues: TradeStrategyAuthoringIssue[],
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "invalid_type", "应为数组。");
    return undefined;
  }
  if (value.length > maximum) {
    addIssue(issues, path, "too_many_items", `最多允许 ${maximum} 项。`);
  }
  const result: string[] = [];
  value.forEach((entry, index) => {
    const parsed = draftString(entry, `${path}[${index}]`, itemMaximum, issues);
    if (parsed !== undefined) result.push(parsed);
  });
  return result;
}

function sourceReferenceList(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): readonly string[] | undefined {
  const parsed = stringList(
    value,
    path,
    TRADE_STRATEGY_AUTHORING_LIMITS.sourceReferences,
    TRADE_STRATEGY_AUTHORING_LIMITS.id,
    issues,
  );
  if (parsed === undefined) return undefined;
  const seen = new Set<string>();
  parsed.forEach((id, index) => {
    if (id !== "" && !ID.test(id)) {
      addIssue(
        issues,
        `${path}[${index}]`,
        "invalid_id",
        "非空来源 ID 必须使用小写字母、数字与连字符。",
      );
    }
    if (id !== "" && seen.has(id)) {
      addIssue(
        issues,
        `${path}[${index}]`,
        "duplicate",
        "不能重复引用同一来源。",
      );
    }
    if (id !== "") seen.add(id);
  });
  return parsed;
}

function priceZoneList(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): readonly TradeStrategyDraftPriceZone[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "invalid_type", "应为数组。");
    return undefined;
  }
  if (value.length > TRADE_STRATEGY_AUTHORING_LIMITS.priceZones) {
    addIssue(
      issues,
      path,
      "too_many_items",
      `最多允许 ${TRADE_STRATEGY_AUTHORING_LIMITS.priceZones} 项。`,
    );
  }
  const result: TradeStrategyDraftPriceZone[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const startIssueCount = issues.length;
    const record = exactRecord(
      entry,
      itemPath,
      ["id", "role", "lower", "upper", "label", "rationale", "sourceIds"],
      issues,
    );
    if (record === null) return;
    const id = field(record, "id", (item) => optionalId(item, `${itemPath}.id`, issues));
    const role = field(record, "role", (item) =>
      nullableOneOf(item, `${itemPath}.role`, ZONE_ROLES, issues),
    );
    const lower = field(record, "lower", (item) =>
      nullablePositiveNumber(item, `${itemPath}.lower`, issues),
    );
    const upper = field(record, "upper", (item) =>
      nullablePositiveNumber(item, `${itemPath}.upper`, issues),
    );
    const label = field(record, "label", (item) =>
      draftString(
        item,
        `${itemPath}.label`,
        TRADE_STRATEGY_AUTHORING_LIMITS.zoneLabel,
        issues,
      ),
    );
    const rationale = field(record, "rationale", (item) =>
      draftString(
        item,
        `${itemPath}.rationale`,
        TRADE_STRATEGY_AUTHORING_LIMITS.zoneRationale,
        issues,
      ),
    );
    const sourceIds = field(record, "sourceIds", (item) =>
      sourceReferenceList(item, `${itemPath}.sourceIds`, issues),
    );
    if (id !== undefined && id !== "") {
      if (ids.has(id)) {
        addIssue(issues, `${itemPath}.id`, "duplicate", "价格区域 ID 不能重复。");
      }
      ids.add(id);
    }
    if (
      lower !== undefined &&
      lower !== null &&
      upper !== undefined &&
      upper !== null &&
      lower > upper
    ) {
      addIssue(
        issues,
        `${itemPath}.lower`,
        "invalid_range",
        "区域下界不能高于上界。",
      );
    }
    if (
      issues.length === startIssueCount &&
      id !== undefined &&
      role !== undefined &&
      lower !== undefined &&
      upper !== undefined &&
      label !== undefined &&
      rationale !== undefined &&
      sourceIds !== undefined
    ) {
      result.push({ id, role, lower, upper, label, rationale, sourceIds });
    }
  });
  return result;
}

function sourceList(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): readonly TradeStrategyDraftSource[] | undefined {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "invalid_type", "应为数组。");
    return undefined;
  }
  if (value.length > TRADE_STRATEGY_AUTHORING_LIMITS.sources) {
    addIssue(
      issues,
      path,
      "too_many_items",
      `最多允许 ${TRADE_STRATEGY_AUTHORING_LIMITS.sources} 项。`,
    );
  }
  const result: TradeStrategyDraftSource[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const startIssueCount = issues.length;
    const record = exactRecord(entry, itemPath, ["id", "label", "url"], issues);
    if (record === null) return;
    const id = field(record, "id", (item) => optionalId(item, `${itemPath}.id`, issues));
    const label = field(record, "label", (item) =>
      draftString(
        item,
        `${itemPath}.label`,
        TRADE_STRATEGY_AUTHORING_LIMITS.sourceLabel,
        issues,
      ),
    );
    const url = field(record, "url", (item) =>
      draftSourceUrl(item, `${itemPath}.url`, issues),
    );
    if (id !== undefined && id !== "") {
      if (ids.has(id)) {
        addIssue(issues, `${itemPath}.id`, "duplicate", "来源 ID 不能重复。");
      }
      ids.add(id);
    }
    if (
      issues.length === startIssueCount &&
      id !== undefined &&
      label !== undefined &&
      url !== undefined
    ) {
      result.push({ id, label, url });
    }
  });
  return result;
}

function draftSourceUrl(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  const parsed = draftString(
    value,
    path,
    TRADE_STRATEGY_AUTHORING_LIMITS.sourceUrl,
    issues,
  );
  if (parsed === undefined || parsed === "") return parsed;
  let url: URL;
  try {
    url = new URL(parsed);
  } catch {
    addIssue(
      issues,
      path,
      "invalid_url",
      "非空链接必须是绝对 HTTPS URL，且不能包含凭据或片段。",
    );
    return undefined;
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    parsed.includes("#")
  ) {
    addIssue(
      issues,
      path,
      "invalid_url",
      "非空链接必须是绝对 HTTPS URL，且不能包含凭据或片段。",
    );
    return undefined;
  }
  if (
    [...url.searchParams.keys()].some((key) =>
      SENSITIVE_QUERY_KEYS.has(key.toLowerCase()),
    )
  ) {
    addIssue(
      issues,
      path,
      "invalid_url",
      "链接不能包含疑似凭证的查询参数。",
    );
    return undefined;
  }
  return url.toString();
}

function timestamp(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): string | undefined {
  if (typeof value !== "string" || !isStrictUtcTimestamp(value)) {
    addIssue(
      issues,
      path,
      "invalid_timestamp",
      "必须是有效的 UTC 时间戳。",
    );
    return undefined;
  }
  return value;
}

function nullableTimestamp(
  value: unknown,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): string | null | undefined {
  return value === null ? null : timestamp(value, path, issues);
}

function isStrictUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value);
  if (match === null) return false;
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const millisecond = Number(fraction.padEnd(3, "0"));
  const milliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millisecond,
  );
  const parsed = new Date(milliseconds);
  return (
    Number.isFinite(milliseconds) &&
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second) &&
    parsed.getUTCMilliseconds() === millisecond
  );
}

function requireCompletedText(
  value: string,
  path: string,
  issues: TradeStrategyAuthoringIssue[],
): void {
  if (value === "") {
    addIssue(issues, path, "required", "提交审核前必须填写。");
  }
}

function requireCompletedList(
  value: readonly string[],
  path: string,
  emptyMessage: string,
  issues: TradeStrategyAuthoringIssue[],
): void {
  if (value.length === 0) {
    addIssue(issues, path, "required", emptyMessage);
  }
  value.forEach((item, index) => {
    requireCompletedText(item, `${path}[${index}]`, issues);
  });
}

function canonicalPerson(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

function assertOrderedTime(
  earlier: string,
  later: string,
  path: string,
  message: string,
  issues: TradeStrategyAuthoringIssue[],
): void {
  if (Date.parse(earlier) > Date.parse(later)) {
    addIssue(issues, path, "invalid_time_order", message);
  }
}

function addIssue(
  issues: TradeStrategyAuthoringIssue[],
  path: string,
  code: TradeStrategyAuthoringIssueCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function success<T>(value: T): TradeStrategyAuthoringResult<T> {
  return { ok: true, value, errors: [] };
}

function failure<T = never>(
  errors: readonly TradeStrategyAuthoringIssue[],
): TradeStrategyAuthoringResult<T> {
  return { ok: false, value: null, errors };
}
