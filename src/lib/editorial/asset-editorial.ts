export const assetEditorialAssets = ["btc", "eth"] as const;

export type AssetEditorialAsset = (typeof assetEditorialAssets)[number];

export type AssetEditorialSource = {
  id: string;
  label: string;
  url: string;
};

export type AssetEditorialEntry<T> = {
  publicationStatus: "published" | "unpublished";
  effectiveAt: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  sources: readonly AssetEditorialSource[];
  content: T | null;
};

export type AssetKeyLevelRole = "support" | "resistance";

export type AssetKeyLevel = {
  id: string;
  role: AssetKeyLevelRole;
  price: number;
  label: string;
  rationale: string;
  invalidationCondition: string;
  sourceIds: readonly string[];
};

export type AssetKeyLevelsContent = {
  quoteCurrency: "USDT";
  levels: readonly AssetKeyLevel[];
};

export type WiseScenarioStance =
  | "bullish"
  | "bearish"
  | "neutral"
  | "wait";

export type WiseScenarioContent = {
  stance: WiseScenarioStance;
  author: string;
  timeframe: string;
  headline: string;
  summary: string;
  rationale: readonly string[];
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  watchItems: readonly string[];
  riskDisclosure: string;
  sourceIds: readonly string[];
};

export type AssetEditorialEntries = {
  keyLevels: AssetEditorialEntry<AssetKeyLevelsContent>;
  wiseScenario: AssetEditorialEntry<WiseScenarioContent>;
};

export type AssetEditorialConfig = Record<
  AssetEditorialAsset,
  AssetEditorialEntries
>;

export type AssetEditorialDisplayState =
  | "active"
  | "scheduled"
  | "expired"
  | "unpublished";

export type ResolvedAssetEditorialEntry<T> = {
  state: AssetEditorialDisplayState;
  content: T | null;
  effectiveAt: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  sources: readonly AssetEditorialSource[];
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

export function parseAssetEditorialConfig(
  input: unknown,
): AssetEditorialConfig {
  const config = asExactRecord(
    input,
    "assetEditorial",
    assetEditorialAssets,
  );

  return {
    btc: parseAssetEntries(config.btc, "assetEditorial.btc"),
    eth: parseAssetEntries(config.eth, "assetEditorial.eth"),
  };
}

export function resolveAssetEditorialEntry<T>(
  entry: AssetEditorialEntry<T>,
  now: number,
): ResolvedAssetEditorialEntry<T> {
  const metadata = {
    effectiveAt: entry.effectiveAt,
    validUntil: entry.validUntil,
    lastReviewedAt: entry.lastReviewedAt,
    sources: entry.sources,
  };

  if (entry.publicationStatus !== "published" || entry.content === null) {
    return { state: "unpublished", content: null, ...metadata };
  }

  const effectiveAt = Date.parse(entry.effectiveAt ?? "");
  const validUntil = Date.parse(entry.validUntil ?? "");
  const lastReviewedAt = Date.parse(entry.lastReviewedAt ?? "");

  if (now < effectiveAt || now < lastReviewedAt) {
    return { state: "scheduled", content: null, ...metadata };
  }

  if (now > validUntil) {
    return { state: "expired", content: null, ...metadata };
  }

  return { state: "active", content: entry.content, ...metadata };
}

function parseAssetEntries(input: unknown, path: string): AssetEditorialEntries {
  const entries = asExactRecord(input, path, ["keyLevels", "wiseScenario"]);

  return {
    keyLevels: parseEntry(
      entries.keyLevels,
      `${path}.keyLevels`,
      parseKeyLevelsContent,
    ),
    wiseScenario: parseEntry(
      entries.wiseScenario,
      `${path}.wiseScenario`,
      parseWiseScenarioContent,
    ),
  };
}

function parseEntry<T>(
  input: unknown,
  path: string,
  parseContent: (
    input: unknown,
    path: string,
    sources: readonly AssetEditorialSource[],
  ) => T,
): AssetEditorialEntry<T> {
  const entry = asExactRecord(input, path, [
    "publicationStatus",
    "effectiveAt",
    "validUntil",
    "lastReviewedAt",
    "sources",
    "content",
  ]);
  const publicationStatus = asPublicationStatus(
    entry.publicationStatus,
    `${path}.publicationStatus`,
  );
  const effectiveAt = asNullableTimestamp(
    entry.effectiveAt,
    `${path}.effectiveAt`,
  );
  const validUntil = asNullableTimestamp(
    entry.validUntil,
    `${path}.validUntil`,
  );
  const lastReviewedAt = asNullableTimestamp(
    entry.lastReviewedAt,
    `${path}.lastReviewedAt`,
  );
  const sources = asSources(entry.sources, `${path}.sources`);

  if ((effectiveAt === null) !== (validUntil === null)) {
    throw new Error(
      `${path}.effectiveAt and ${path}.validUntil must be set together.`,
    );
  }

  if (
    effectiveAt !== null &&
    validUntil !== null &&
    Date.parse(validUntil) <= Date.parse(effectiveAt)
  ) {
    throw new Error(`${path}.validUntil must be after effectiveAt.`);
  }

  if (
    lastReviewedAt !== null &&
    effectiveAt !== null &&
    Date.parse(lastReviewedAt) > Date.parse(effectiveAt)
  ) {
    throw new Error(`${path}.lastReviewedAt must not be after effectiveAt.`);
  }

  if (publicationStatus === "published") {
    if (
      effectiveAt === null ||
      validUntil === null ||
      lastReviewedAt === null
    ) {
      throw new Error(`${path} published entries require all review dates.`);
    }
    if (sources.length === 0) {
      throw new Error(`${path} published entries require at least one source.`);
    }
    if (entry.content === null) {
      throw new Error(`${path} published entries require content.`);
    }
  }

  const content =
    entry.content === null
      ? null
      : parseContent(entry.content, `${path}.content`, sources);

  return {
    publicationStatus,
    effectiveAt,
    validUntil,
    lastReviewedAt,
    sources,
    content,
  };
}

function parseKeyLevelsContent(
  input: unknown,
  path: string,
  sources: readonly AssetEditorialSource[],
): AssetKeyLevelsContent {
  const content = asExactRecord(input, path, ["quoteCurrency", "levels"]);
  if (content.quoteCurrency !== "USDT") {
    throw new Error(`${path}.quoteCurrency must be USDT.`);
  }
  if (!Array.isArray(content.levels)) {
    throw new Error(`${path}.levels must be an array.`);
  }
  if (content.levels.length < 2) {
    throw new Error(`${path}.levels must contain at least two levels.`);
  }
  if (content.levels.length > 8) {
    throw new Error(`${path}.levels cannot contain more than eight levels.`);
  }

  const knownSourceIds = new Set(sources.map((source) => source.id));
  const levelIds = new Set<string>();
  const levels = content.levels.map((level, index) => {
    const levelPath = `${path}.levels[${index}]`;
    const record = asExactRecord(level, levelPath, [
      "id",
      "role",
      "price",
      "label",
      "rationale",
      "invalidationCondition",
      "sourceIds",
    ]);
    const id = asId(record.id, `${levelPath}.id`);
    if (levelIds.has(id)) {
      throw new Error(`${path}.levels IDs must be unique.`);
    }
    levelIds.add(id);

    return {
      id,
      role: asKeyLevelRole(record.role, `${levelPath}.role`),
      price: asPositiveFiniteNumber(record.price, `${levelPath}.price`),
      label: asBoundedString(record.label, `${levelPath}.label`, 80),
      rationale: asBoundedString(
        record.rationale,
        `${levelPath}.rationale`,
        320,
      ),
      invalidationCondition: asBoundedString(
        record.invalidationCondition,
        `${levelPath}.invalidationCondition`,
        240,
      ),
      sourceIds: asSourceReferences(
        record.sourceIds,
        `${levelPath}.sourceIds`,
        knownSourceIds,
      ),
    };
  });

  if (!levels.some((level) => level.role === "support")) {
    throw new Error(`${path}.levels must include at least one support level.`);
  }
  if (!levels.some((level) => level.role === "resistance")) {
    throw new Error(`${path}.levels must include at least one resistance level.`);
  }

  return { quoteCurrency: "USDT", levels };
}

function parseWiseScenarioContent(
  input: unknown,
  path: string,
  sources: readonly AssetEditorialSource[],
): WiseScenarioContent {
  const content = asExactRecord(input, path, [
    "stance",
    "author",
    "timeframe",
    "headline",
    "summary",
    "rationale",
    "confirmationConditions",
    "invalidationConditions",
    "watchItems",
    "riskDisclosure",
    "sourceIds",
  ]);
  const knownSourceIds = new Set(sources.map((source) => source.id));

  return {
    stance: asWiseScenarioStance(content.stance, `${path}.stance`),
    author: asBoundedString(content.author, `${path}.author`, 80),
    timeframe: asBoundedString(content.timeframe, `${path}.timeframe`, 120),
    headline: asBoundedString(content.headline, `${path}.headline`, 100),
    summary: asBoundedString(content.summary, `${path}.summary`, 600),
    rationale: asBoundedStringArray(
      content.rationale,
      `${path}.rationale`,
      { minItems: 1, maxItems: 6, maxLength: 240 },
    ),
    confirmationConditions: asBoundedStringArray(
      content.confirmationConditions,
      `${path}.confirmationConditions`,
      { minItems: 1, maxItems: 5, maxLength: 200 },
    ),
    invalidationConditions: asBoundedStringArray(
      content.invalidationConditions,
      `${path}.invalidationConditions`,
      { minItems: 1, maxItems: 5, maxLength: 200 },
    ),
    watchItems: asBoundedStringArray(content.watchItems, `${path}.watchItems`, {
      minItems: 0,
      maxItems: 5,
      maxLength: 160,
    }),
    riskDisclosure: asBoundedString(
      content.riskDisclosure,
      `${path}.riskDisclosure`,
      320,
    ),
    sourceIds: asSourceReferences(
      content.sourceIds,
      `${path}.sourceIds`,
      knownSourceIds,
    ),
  };
}

function asWiseScenarioStance(
  input: unknown,
  path: string,
): WiseScenarioStance {
  if (
    input !== "bullish" &&
    input !== "bearish" &&
    input !== "neutral" &&
    input !== "wait"
  ) {
    throw new Error(`${path} must be bullish, bearish, neutral or wait.`);
  }

  return input;
}

function asExactRecord(
  input: unknown,
  path: string,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const record = input as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`${path} contains unknown field ${key}.`);
    }
  }
  for (const key of allowedKeys) {
    if (!(key in record)) {
      throw new Error(`${path}.${key} is required.`);
    }
  }
  return record;
}

function asPublicationStatus(
  input: unknown,
  path: string,
): "published" | "unpublished" {
  if (input !== "published" && input !== "unpublished") {
    throw new Error(`${path} must be published or unpublished.`);
  }
  return input;
}

function asNullableTimestamp(input: unknown, path: string): string | null {
  if (input === null) {
    return null;
  }
  const value = asBoundedString(input, path, 30);
  if (!isValidUtcTimestamp(value)) {
    throw new Error(`${path} must be a valid ISO 8601 UTC timestamp.`);
  }
  return value;
}

function asSources(
  input: unknown,
  path: string,
): readonly AssetEditorialSource[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length > 8) {
    throw new Error(`${path} cannot contain more than eight sources.`);
  }

  const ids = new Set<string>();
  return input.map((source, index) => {
    const sourcePath = `${path}[${index}]`;
    const record = asExactRecord(source, sourcePath, ["id", "label", "url"]);
    const id = asId(record.id, `${sourcePath}.id`);
    if (ids.has(id)) {
      throw new Error(`${path} source IDs must be unique.`);
    }
    ids.add(id);

    const url = asBoundedString(record.url, `${sourcePath}.url`, 2_048);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`${sourcePath}.url must be a valid URL.`);
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`${sourcePath}.url must use HTTPS.`);
    }
    if (parsedUrl.username !== "" || parsedUrl.password !== "") {
      throw new Error(`${sourcePath}.url must not contain URL credentials.`);
    }

    return {
      id,
      label: asBoundedString(record.label, `${sourcePath}.label`, 80),
      url: parsedUrl.toString(),
    };
  });
}

function asId(input: unknown, path: string): string {
  const value = asBoundedString(input, path, 48);
  if (!ID.test(value)) {
    throw new Error(`${path} must be a lowercase slug.`);
  }
  return value;
}

function asKeyLevelRole(input: unknown, path: string): AssetKeyLevelRole {
  if (input !== "support" && input !== "resistance") {
    throw new Error(`${path} must be support or resistance.`);
  }
  return input;
}

function asPositiveFiniteNumber(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    throw new Error(`${path} must be a positive finite number.`);
  }
  return input;
}

function asSourceReferences(
  input: unknown,
  path: string,
  knownSourceIds: ReadonlySet<string>,
): readonly string[] {
  const sourceIds = asBoundedStringArray(input, path, {
    minItems: 1,
    maxItems: 8,
    maxLength: 48,
  }).map((sourceId, index) => asId(sourceId, `${path}[${index}]`));

  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error(`${path} must not contain duplicates.`);
  }
  for (const sourceId of sourceIds) {
    if (!knownSourceIds.has(sourceId)) {
      throw new Error(`${path} references unknown source ID ${sourceId}.`);
    }
  }
  return sourceIds;
}

function asBoundedStringArray(
  input: unknown,
  path: string,
  limits: { minItems: number; maxItems: number; maxLength: number },
): readonly string[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length < limits.minItems) {
    throw new Error(
      `${path} must contain at least ${limits.minItems} ${limits.minItems === 1 ? "item" : "items"}.`,
    );
  }
  if (input.length > limits.maxItems) {
    throw new Error(
      `${path} cannot contain more than ${limits.maxItems} items.`,
    );
  }
  return input.map((item, index) =>
    asBoundedString(item, `${path}[${index}]`, limits.maxLength),
  );
}

function asBoundedString(
  input: unknown,
  path: string,
  maxLength: number,
): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  const value = input.trim();
  if (value.length > maxLength) {
    throw new Error(`${path} cannot exceed ${maxLength} characters.`);
  }
  return value;
}

function isValidUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return false;
  }
  const milliseconds = Number(fraction.padEnd(3, "0"));
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second) &&
    parsed.getUTCMilliseconds() === milliseconds
  );
}
