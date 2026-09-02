export type EditorialSource = {
  id: string;
  label: string;
  url: string;
};

export type EditorialEntry<T> = {
  publicationStatus: "published" | "unpublished";
  effectiveAt: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  sources: readonly EditorialSource[];
  content: T | null;
};

export type MarketStatusContent = {
  headline: string;
  summary: string;
  watchItems: readonly string[];
};

export type TodayInCryptoContent = {
  date: string;
  items: readonly {
    title: string;
    summary: string;
    sourceIds: readonly string[];
  }[];
};

export type WiseTakeContent = {
  headline: string;
  body: string;
  watchItems: readonly string[];
};

export type HomepageEditorialConfig = {
  marketStatus: EditorialEntry<MarketStatusContent>;
  todayInCrypto: EditorialEntry<TodayInCryptoContent>;
  wiseTake: EditorialEntry<WiseTakeContent>;
};

export type EditorialDisplayState =
  | "active"
  | "unpublished"
  | "scheduled"
  | "expired";

export type ResolvedEditorialEntry<T> = {
  state: EditorialDisplayState;
  content: T | null;
  effectiveAt: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  sources: readonly EditorialSource[];
};

const JUDGMENT_MARKET_VALUE = /[0-9０-９$€£¥￥%％]/u;
const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

export function parseHomepageEditorialConfig(
  input: unknown,
): HomepageEditorialConfig {
  const config = asRecord(input, "homepageEditorial");
  const marketStatus = parseEntry(
    config.marketStatus,
    "homepageEditorial.marketStatus",
    parseMarketStatusContent,
  );
  const todayInCrypto = parseEntry(
    config.todayInCrypto,
    "homepageEditorial.todayInCrypto",
    parseTodayInCryptoContent,
  );
  const wiseTake = parseEntry(
    config.wiseTake,
    "homepageEditorial.wiseTake",
    parseWiseTakeContent,
  );

  validateTodayDateWindow(todayInCrypto, "homepageEditorial.todayInCrypto");

  return { marketStatus, todayInCrypto, wiseTake };
}

export function resolveEditorialEntry<T>(
  entry: EditorialEntry<T>,
  now: number,
): ResolvedEditorialEntry<T> {
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

export function resolveTodayInCryptoEntry(
  entry: EditorialEntry<TodayInCryptoContent>,
  now: number,
): ResolvedEditorialEntry<TodayInCryptoContent> {
  const resolved = resolveEditorialEntry(entry, now);
  if (resolved.state !== "active" || resolved.content === null) {
    return resolved;
  }

  const currentUtcDate = toUtcDate(now);
  if (resolved.content.date === currentUtcDate) {
    return resolved;
  }

  return {
    ...resolved,
    state: resolved.content.date > currentUtcDate ? "scheduled" : "expired",
    content: null,
  };
}

function parseEntry<T>(
  input: unknown,
  path: string,
  parseContent: (
    input: unknown,
    path: string,
    sources: readonly EditorialSource[],
  ) => T,
): EditorialEntry<T> {
  const entry = asRecord(input, path);
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
  const content =
    entry.content === null
      ? null
      : parseContent(entry.content, `${path}.content`, sources);

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
    validUntil !== null &&
    Date.parse(lastReviewedAt) > Date.parse(validUntil)
  ) {
    throw new Error(`${path}.lastReviewedAt must not be after validUntil.`);
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
    if (content === null) {
      throw new Error(`${path} published entries require content.`);
    }
  }

  return {
    publicationStatus,
    effectiveAt,
    validUntil,
    lastReviewedAt,
    sources,
    content,
  };
}

function parseMarketStatusContent(
  input: unknown,
  path: string,
): MarketStatusContent {
  const content = asRecord(input, path);
  return {
    headline: asJudgmentText(content.headline, `${path}.headline`, 80),
    summary: asJudgmentText(content.summary, `${path}.summary`, 500),
    watchItems: asJudgmentArray(content.watchItems, `${path}.watchItems`),
  };
}

function parseTodayInCryptoContent(
  input: unknown,
  path: string,
  sources: readonly EditorialSource[],
): TodayInCryptoContent {
  const content = asRecord(input, path);
  const date = asBoundedString(content.date, `${path}.date`, 10);
  if (!isValidCalendarDate(date)) {
    throw new Error(`${path}.date must be a valid YYYY-MM-DD date.`);
  }
  if (!Array.isArray(content.items) || content.items.length === 0) {
    throw new Error(`${path}.items must contain at least one item.`);
  }
  if (content.items.length > 3) {
    throw new Error(`${path}.items cannot contain more than three items.`);
  }

  const knownSourceIds = new Set(sources.map((source) => source.id));
  return {
    date,
    items: content.items.map((item, index) => {
      const itemPath = `${path}.items[${index}]`;
      const record = asRecord(item, itemPath);
      const sourceIds = asStringArray(
        record.sourceIds,
        `${itemPath}.sourceIds`,
        4,
        48,
      );
      if (sourceIds.length === 0) {
        throw new Error(`${itemPath}.sourceIds must contain at least one ID.`);
      }
      if (new Set(sourceIds).size !== sourceIds.length) {
        throw new Error(`${itemPath}.sourceIds must not contain duplicates.`);
      }
      for (const sourceId of sourceIds) {
        if (!knownSourceIds.has(sourceId)) {
          throw new Error(
            `${itemPath}.sourceIds references unknown source ID ${sourceId}.`,
          );
        }
      }

      return {
        title: asBoundedString(record.title, `${itemPath}.title`, 100),
        summary: asBoundedString(record.summary, `${itemPath}.summary`, 400),
        sourceIds,
      };
    }),
  };
}

function parseWiseTakeContent(input: unknown, path: string): WiseTakeContent {
  const content = asRecord(input, path);
  return {
    headline: asJudgmentText(content.headline, `${path}.headline`, 80),
    body: asJudgmentText(content.body, `${path}.body`, 600),
    watchItems: asJudgmentArray(content.watchItems, `${path}.watchItems`),
  };
}

function validateTodayDateWindow(
  entry: EditorialEntry<TodayInCryptoContent>,
  path: string,
): void {
  if (
    entry.publicationStatus !== "published" ||
    entry.content === null ||
    entry.effectiveAt === null
  ) {
    return;
  }

  if (entry.content.date !== toUtcDate(Date.parse(entry.effectiveAt))) {
    throw new Error(
      `${path}.content.date must match the UTC date of effectiveAt.`,
    );
  }
}

function asRecord(input: unknown, path: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${path} must be an object.`);
  }
  return input as Record<string, unknown>;
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

function asSources(input: unknown, path: string): readonly EditorialSource[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length > 8) {
    throw new Error(`${path} cannot contain more than eight sources.`);
  }

  const ids = new Set<string>();
  return input.map((source, index) => {
    const sourcePath = `${path}[${index}]`;
    const record = asRecord(source, sourcePath);
    const id = asBoundedString(record.id, `${sourcePath}.id`, 48);
    if (!SOURCE_ID.test(id)) {
      throw new Error(`${sourcePath}.id must be a lowercase slug.`);
    }
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

function asJudgmentArray(input: unknown, path: string): readonly string[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length > 5) {
    throw new Error(`${path} cannot contain more than five items.`);
  }
  return input.map((item, index) =>
    asJudgmentText(item, `${path}[${index}]`, 160),
  );
}

function asStringArray(
  input: unknown,
  path: string,
  maxItems: number,
  maxLength: number,
): readonly string[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length > maxItems) {
    throw new Error(`${path} cannot contain more than ${maxItems} items.`);
  }
  return input.map((item, index) =>
    asBoundedString(item, `${path}[${index}]`, maxLength),
  );
}

function asJudgmentText(
  input: unknown,
  path: string,
  maxLength: number,
): string {
  const value = asBoundedString(input, path, maxLength);
  if (JUDGMENT_MARKET_VALUE.test(value)) {
    throw new Error(
      `${path} cannot contain hard-coded market numbers, currency symbols, or percentages.`,
    );
  }
  return value;
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

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

function toUtcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
