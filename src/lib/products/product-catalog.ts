export const productTypes = [
  "exchange",
  "wallet",
  "data",
  "security",
  "tax",
  "other",
] as const;

export type ProductType = (typeof productTypes)[number];

export type ProductLogo = {
  src: string;
  alt: string;
};

export type Partner = {
  id: string;
  name: string;
  website: string;
  allowedReferralHosts: readonly string[];
  logo: ProductLogo | null;
  enabled: boolean;
};

export type ProductSource = {
  id: string;
  label: string;
  url: string;
};

export type ProductAvailability =
  | {
      status: "unknown";
      description: string | null;
    }
  | {
      status: "available" | "restricted";
      description: string;
    };

export type Product = {
  id: string;
  partnerId: string;
  name: string;
  slug: string;
  type: ProductType;
  logo: ProductLogo | null;
  summary: string | null;
  website: string | null;
  referralUrl: string | null;
  referralCode: string | null;
  bestFor: string | null;
  pros: readonly string[];
  cons: readonly string[];
  feeDescription: string | null;
  tutorialUrl: string | null;
  wiseBenefit: string | null;
  availability: ProductAvailability;
  enabled: boolean;
  disclaimer: string | null;
  sources: readonly ProductSource[];
  lastVerifiedAt: string | null;
  termsUrl: string | null;
  promotionStartsAt: string | null;
  promotionEndsAt: string | null;
  publicationStatus: "published" | "unpublished";
  contentVersion: string;
};

export type ProductCatalog = {
  partners: readonly Partner[];
  products: readonly Product[];
};

export type ResolvedProduct = Omit<
  Product,
  | "summary"
  | "website"
  | "bestFor"
  | "feeDescription"
  | "availability"
  | "disclaimer"
  | "lastVerifiedAt"
  | "termsUrl"
  | "publicationStatus"
> & {
  partner: Partner;
  logo: ProductLogo | null;
  summary: string;
  website: string;
  bestFor: string;
  feeDescription: string;
  availability: Exclude<ProductAvailability, { status: "unknown" }>;
  disclaimer: string;
  lastVerifiedAt: string;
  termsUrl: string;
  publicationStatus: "published";
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_VERSION = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const LOCAL_LOGO_PATH =
  /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseProductCatalog(input: unknown): ProductCatalog {
  const catalog = asExactRecord(input, "productCatalog", [
    "partners",
    "products",
  ]);
  const partners = asArray(catalog.partners, "productCatalog.partners", 100).map(
    (partner, index) =>
      parsePartner(partner, `productCatalog.partners[${index}]`),
  );
  const products = asArray(catalog.products, "productCatalog.products", 500).map(
    (product, index) =>
      parseProduct(product, `productCatalog.products[${index}]`),
  );

  assertUnique(partners, "id", "productCatalog.partners IDs");
  assertUnique(products, "id", "productCatalog.products IDs");
  assertUnique(products, "slug", "productCatalog.products slugs");

  const partnersById = new Map(
    partners.map((partner) => [partner.id, partner]),
  );
  for (const product of products) {
    const partner = partnersById.get(product.partnerId);
    if (partner === undefined) {
      throw new Error(
        `productCatalog product ${product.id} references unknown partner ID ${product.partnerId}.`,
      );
    }
    if (product.referralCode !== null && product.referralUrl === null) {
      throw new Error(
        `productCatalog product ${product.id} cannot define referralCode without referralUrl.`,
      );
    }
    if (product.referralUrl !== null) {
      assertAllowedReferralUrl(product, partner);
    }
    if (product.publicationStatus === "published") {
      assertPublishedProductIsComplete(product);
    }
  }

  return { partners, products };
}

export function selectPublishedProducts(
  catalog: ProductCatalog,
  now: number,
): readonly ResolvedProduct[] {
  if (!Number.isFinite(now)) {
    throw new Error("now must be a finite Unix timestamp in milliseconds.");
  }

  const partnersById = new Map(
    catalog.partners.map((partner) => [partner.id, partner]),
  );

  return catalog.products.flatMap((product) => {
    const partner = partnersById.get(product.partnerId);
    if (
      partner === undefined ||
      !isProductActive(product, partner, now)
    ) {
      return [];
    }

    return [resolveProduct(product, partner)];
  });
}

export function selectPublishedProductBySlug(
  catalog: ProductCatalog,
  slug: string,
  now: number,
): ResolvedProduct | null {
  if (!SLUG.test(slug)) {
    return null;
  }

  return (
    selectPublishedProducts(catalog, now).find(
      (product) => product.slug === slug,
    ) ?? null
  );
}

export function selectPublishedProductSlugs(
  catalog: ProductCatalog,
  now: number,
): readonly string[] {
  return selectPublishedProducts(catalog, now).map((product) => product.slug);
}

function parsePartner(input: unknown, path: string): Partner {
  const partner = asExactRecord(input, path, [
    "id",
    "name",
    "website",
    "allowedReferralHosts",
    "logo",
    "enabled",
  ]);

  return {
    id: asSlug(partner.id, `${path}.id`),
    name: asBoundedString(partner.name, `${path}.name`, 100),
    website: asHttpsUrl(partner.website, `${path}.website`),
    allowedReferralHosts: asReferralHosts(
      partner.allowedReferralHosts,
      `${path}.allowedReferralHosts`,
    ),
    logo: asNullableLogo(partner.logo, `${path}.logo`),
    enabled: asBoolean(partner.enabled, `${path}.enabled`),
  };
}

function assertAllowedReferralUrl(product: Product, partner: Partner): void {
  if (product.referralUrl === null) {
    return;
  }
  const url = new URL(product.referralUrl);
  if (url.port !== "") {
    throw new Error(
      `productCatalog product ${product.id} referralUrl must not use a custom port.`,
    );
  }
  if (!partner.allowedReferralHosts.includes(url.hostname)) {
    throw new Error(
      `productCatalog product ${product.id} referralUrl hostname ${url.hostname} is not allowed by partner ${partner.id}.`,
    );
  }
}

function asReferralHosts(input: unknown, path: string): readonly string[] {
  const hosts = asArray(input, path, 12).map((host, index) =>
    asReferralHost(host, `${path}[${index}]`),
  );
  if (new Set(hosts).size !== hosts.length) {
    throw new Error(`${path} must not contain duplicate hostnames.`);
  }
  return hosts;
}

function asReferralHost(input: unknown, path: string): string {
  const value = asBoundedString(input, path, 253);
  if (value !== value.toLowerCase()) {
    throw new Error(`${path} must be a lowercase hostname.`);
  }
  const labels = value.split(".");
  const hostnameLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (
    labels.length < 2 ||
    labels.some((label) => !hostnameLabel.test(label)) ||
    isIpv4Address(labels)
  ) {
    throw new Error(`${path} must be a bare public DNS hostname.`);
  }
  return value;
}

function isIpv4Address(labels: readonly string[]): boolean {
  return (
    labels.length === 4 &&
    labels.every(
      (label) => /^\d{1,3}$/.test(label) && Number(label) <= 255,
    )
  );
}

function parseProduct(input: unknown, path: string): Product {
  const product = asExactRecord(input, path, [
    "id",
    "partnerId",
    "name",
    "slug",
    "type",
    "logo",
    "summary",
    "website",
    "referralUrl",
    "referralCode",
    "bestFor",
    "pros",
    "cons",
    "feeDescription",
    "tutorialUrl",
    "wiseBenefit",
    "availability",
    "enabled",
    "disclaimer",
    "sources",
    "lastVerifiedAt",
    "termsUrl",
    "promotionStartsAt",
    "promotionEndsAt",
    "publicationStatus",
    "contentVersion",
  ]);

  const promotionStartsAt = asNullableTimestamp(
    product.promotionStartsAt,
    `${path}.promotionStartsAt`,
  );
  const promotionEndsAt = asNullableTimestamp(
    product.promotionEndsAt,
    `${path}.promotionEndsAt`,
  );

  if ((promotionStartsAt === null) !== (promotionEndsAt === null)) {
    throw new Error(
      `${path}.promotionStartsAt and ${path}.promotionEndsAt must be set together.`,
    );
  }
  if (
    promotionStartsAt !== null &&
    promotionEndsAt !== null &&
    Date.parse(promotionEndsAt) <= Date.parse(promotionStartsAt)
  ) {
    throw new Error(`${path}.promotionEndsAt must be after promotionStartsAt.`);
  }

  return {
    id: asSlug(product.id, `${path}.id`),
    partnerId: asSlug(product.partnerId, `${path}.partnerId`),
    name: asBoundedString(product.name, `${path}.name`, 100),
    slug: asSlug(product.slug, `${path}.slug`),
    type: asProductType(product.type, `${path}.type`),
    logo: asNullableLogo(product.logo, `${path}.logo`),
    summary: asNullableBoundedString(product.summary, `${path}.summary`, 280),
    website: asNullableHttpsUrl(product.website, `${path}.website`),
    referralUrl: asNullableHttpsUrl(
      product.referralUrl,
      `${path}.referralUrl`,
    ),
    referralCode: asNullableBoundedString(
      product.referralCode,
      `${path}.referralCode`,
      100,
    ),
    bestFor: asNullableBoundedString(product.bestFor, `${path}.bestFor`, 300),
    pros: asBoundedStringArray(product.pros, `${path}.pros`, 8, 240),
    cons: asBoundedStringArray(product.cons, `${path}.cons`, 8, 240),
    feeDescription: asNullableBoundedString(
      product.feeDescription,
      `${path}.feeDescription`,
      500,
    ),
    tutorialUrl: asNullableHttpsUrl(product.tutorialUrl, `${path}.tutorialUrl`),
    wiseBenefit: asNullableBoundedString(
      product.wiseBenefit,
      `${path}.wiseBenefit`,
      500,
    ),
    availability: parseAvailability(
      product.availability,
      `${path}.availability`,
    ),
    enabled: asBoolean(product.enabled, `${path}.enabled`),
    disclaimer: asNullableBoundedString(
      product.disclaimer,
      `${path}.disclaimer`,
      800,
    ),
    sources: parseSources(product.sources, `${path}.sources`),
    lastVerifiedAt: asNullableTimestamp(
      product.lastVerifiedAt,
      `${path}.lastVerifiedAt`,
    ),
    termsUrl: asNullableHttpsUrl(product.termsUrl, `${path}.termsUrl`),
    promotionStartsAt,
    promotionEndsAt,
    publicationStatus: asPublicationStatus(
      product.publicationStatus,
      `${path}.publicationStatus`,
    ),
    contentVersion: asContentVersion(
      product.contentVersion,
      `${path}.contentVersion`,
    ),
  };
}

function parseAvailability(
  input: unknown,
  path: string,
): ProductAvailability {
  const availability = asExactRecord(input, path, ["status", "description"]);
  if (
    availability.status !== "unknown" &&
    availability.status !== "available" &&
    availability.status !== "restricted"
  ) {
    throw new Error(
      `${path}.status must be unknown, available, or restricted.`,
    );
  }

  const description = asNullableBoundedString(
    availability.description,
    `${path}.description`,
    500,
  );
  if (availability.status !== "unknown" && description === null) {
    throw new Error(`${path}.description is required when availability is known.`);
  }

  return availability.status === "unknown"
    ? { status: "unknown", description }
    : { status: availability.status, description: description as string };
}

function parseSources(input: unknown, path: string): readonly ProductSource[] {
  const sources = asArray(input, path, 12).map((source, index) => {
    const sourcePath = `${path}[${index}]`;
    const record = asExactRecord(source, sourcePath, ["id", "label", "url"]);
    return {
      id: asSlug(record.id, `${sourcePath}.id`),
      label: asBoundedString(record.label, `${sourcePath}.label`, 120),
      url: asHttpsUrl(record.url, `${sourcePath}.url`),
    };
  });
  assertUnique(sources, "id", `${path} source IDs`);
  return sources;
}

function assertPublishedProductIsComplete(product: Product): void {
  const requiredFields: ReadonlyArray<
    [keyof Product, string | null]
  > = [
    ["summary", product.summary],
    ["website", product.website],
    ["bestFor", product.bestFor],
    ["feeDescription", product.feeDescription],
    ["disclaimer", product.disclaimer],
    ["lastVerifiedAt", product.lastVerifiedAt],
    ["termsUrl", product.termsUrl],
  ];

  for (const [field, value] of requiredFields) {
    if (value === null) {
      throw new Error(
        `Published product ${product.id} requires ${String(field)}.`,
      );
    }
  }
  if (product.pros.length === 0 || product.cons.length === 0) {
    throw new Error(
      `Published product ${product.id} requires at least one pro and one con.`,
    );
  }
  if (product.sources.length === 0) {
    throw new Error(
      `Published product ${product.id} requires at least one source.`,
    );
  }
  if (product.availability.status === "unknown") {
    throw new Error(
      `Published product ${product.id} requires verified availability.`,
    );
  }
}

function isProductActive(
  product: Product,
  partner: Partner,
  now: number,
): boolean {
  if (
    product.publicationStatus !== "published" ||
    !product.enabled ||
    !partner.enabled ||
    product.lastVerifiedAt === null ||
    Date.parse(product.lastVerifiedAt) > now
  ) {
    return false;
  }

  if (
    product.promotionStartsAt !== null &&
    now < Date.parse(product.promotionStartsAt)
  ) {
    return false;
  }
  if (
    product.promotionEndsAt !== null &&
    now > Date.parse(product.promotionEndsAt)
  ) {
    return false;
  }

  return true;
}

function resolveProduct(product: Product, partner: Partner): ResolvedProduct {
  if (
    product.publicationStatus !== "published" ||
    product.summary === null ||
    product.website === null ||
    product.bestFor === null ||
    product.feeDescription === null ||
    product.availability.status === "unknown" ||
    product.disclaimer === null ||
    product.lastVerifiedAt === null ||
    product.termsUrl === null
  ) {
    throw new Error(`Published product ${product.id} is incomplete.`);
  }

  return {
    ...product,
    partner,
    logo: product.logo ?? partner.logo,
    summary: product.summary,
    website: product.website,
    bestFor: product.bestFor,
    feeDescription: product.feeDescription,
    availability: product.availability,
    disclaimer: product.disclaimer,
    lastVerifiedAt: product.lastVerifiedAt,
    termsUrl: product.termsUrl,
    publicationStatus: "published",
  };
}

function asExactRecord(
  input: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(`${path} must be an object.`);
  }

  const record = input as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new Error(`${path} contains unknown field ${key}.`);
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`${path} is missing required field ${key}.`);
    }
  }
  return record;
}

function asArray(input: unknown, path: string, max: number): readonly unknown[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }
  if (input.length > max) {
    throw new Error(`${path} cannot contain more than ${max} items.`);
  }
  return input;
}

function asBoundedString(input: unknown, path: string, max: number): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  const value = input.trim();
  if (value.length > max) {
    throw new Error(`${path} cannot exceed ${max} characters.`);
  }
  return value;
}

function asNullableBoundedString(
  input: unknown,
  path: string,
  max: number,
): string | null {
  return input === null ? null : asBoundedString(input, path, max);
}

function asBoolean(input: unknown, path: string): boolean {
  if (typeof input !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }
  return input;
}

function asSlug(input: unknown, path: string): string {
  const value = asBoundedString(input, path, 64);
  if (!SLUG.test(value)) {
    throw new Error(`${path} must be a lowercase slug.`);
  }
  return value;
}

function asProductType(input: unknown, path: string): ProductType {
  if (!productTypes.includes(input as ProductType)) {
    throw new Error(`${path} must be a supported product type.`);
  }
  return input as ProductType;
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

function asContentVersion(input: unknown, path: string): string {
  const value = asBoundedString(input, path, 64);
  if (!CONTENT_VERSION.test(value)) {
    throw new Error(`${path} must be a lowercase content version.`);
  }
  return value;
}

function asHttpsUrl(input: unknown, path: string): string {
  const value = asBoundedString(input, path, 2_048);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${path} must be a valid URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${path} must use HTTPS.`);
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error(`${path} must not contain URL credentials.`);
  }
  return url.toString();
}

function asNullableHttpsUrl(input: unknown, path: string): string | null {
  return input === null ? null : asHttpsUrl(input, path);
}

function asNullableLogo(input: unknown, path: string): ProductLogo | null {
  if (input === null) {
    return null;
  }
  const logo = asExactRecord(input, path, ["src", "alt"]);
  const src = asBoundedString(logo.src, `${path}.src`, 240);
  if (
    !LOCAL_LOGO_PATH.test(src) ||
    src.includes("..") ||
    src.includes("?") ||
    src.includes("#") ||
    src.includes("\\")
  ) {
    throw new Error(`${path}.src must be a safe public-root local path.`);
  }
  return {
    src,
    alt: asBoundedString(logo.alt, `${path}.alt`, 100),
  };
}

function asNullableTimestamp(input: unknown, path: string): string | null {
  if (input === null) {
    return null;
  }
  const value = asBoundedString(input, path, 30);
  const match = UTC_TIMESTAMP.exec(value);
  if (match === null) {
    throw new Error(`${path} must be a valid ISO 8601 UTC timestamp.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${path} must be a valid ISO 8601 UTC timestamp.`);
  }
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error(`${path} must be a valid ISO 8601 UTC timestamp.`);
  }
  return value;
}

function asBoundedStringArray(
  input: unknown,
  path: string,
  maxItems: number,
  maxLength: number,
): readonly string[] {
  const values = asArray(input, path, maxItems).map((item, index) =>
    asBoundedString(item, `${path}[${index}]`, maxLength),
  );
  if (new Set(values).size !== values.length) {
    throw new Error(`${path} must not contain duplicates.`);
  }
  return values;
}

function assertUnique<T extends Record<K, string>, K extends keyof T>(
  values: readonly T[],
  key: K,
  label: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value[key])) {
      throw new Error(`${label} must be unique.`);
    }
    seen.add(value[key]);
  }
}
