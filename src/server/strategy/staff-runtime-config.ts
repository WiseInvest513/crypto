import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";

export const STRATEGY_STUDIO_MODE_ENV = "WISE_STRATEGY_STUDIO_MODE";
export const STRATEGY_STUDIO_SESSION_KEY_ENV =
  "WISE_STRATEGY_STUDIO_SESSION_KEY";
export const STRATEGY_STUDIO_ENCRYPTION_KEY_ENV =
  "WISE_STRATEGY_STUDIO_ENCRYPTION_KEY";
export const STRATEGY_STUDIO_STORE_DIRECTORY_ENV =
  "WISE_STRATEGY_STUDIO_STORE_DIR";

export const STRATEGY_STUDIO_STAFF_ENV = Object.freeze({
  editor: Object.freeze({
    tokenDigest: "WISE_STRATEGY_STUDIO_EDITOR_TOKEN_SHA256",
    subject: "WISE_STRATEGY_STUDIO_EDITOR_SUBJECT",
    displayName: "WISE_STRATEGY_STUDIO_EDITOR_DISPLAY_NAME",
  }),
  reviewer: Object.freeze({
    tokenDigest: "WISE_STRATEGY_STUDIO_REVIEWER_TOKEN_SHA256",
    subject: "WISE_STRATEGY_STUDIO_REVIEWER_SUBJECT",
    displayName: "WISE_STRATEGY_STUDIO_REVIEWER_DISPLAY_NAME",
  }),
} as const);

export const STRATEGY_STUDIO_STAFF_ROLES = Object.freeze([
  "editor",
  "reviewer",
] as const);

export type StrategyStudioStaffRole =
  (typeof STRATEGY_STUDIO_STAFF_ROLES)[number];

export type StrategyStudioStaffConfig = Readonly<{
  role: StrategyStudioStaffRole;
  tokenDigest: string;
  subject: string;
  displayName: string;
}>;

export type StrategyStudioRuntimeConfig =
  | Readonly<{
      enabled: false;
      reason:
        | "mode_disabled"
        | "deployment_environment"
        | "public_environment_variable"
        | "invalid_configuration";
    }>
  | Readonly<{
      enabled: true;
      mode: "local";
      sessionKey: Uint8Array;
      encryptionKey: Uint8Array;
      editor: StrategyStudioStaffConfig & Readonly<{ role: "editor" }>;
      reviewer: StrategyStudioStaffConfig & Readonly<{ role: "reviewer" }>;
      storeDirectory: string;
    }>;

export type StrategyStudioEnvironment = Readonly<
  Record<string, string | undefined>
>;

const SHA256_HEX = /^[a-fA-F0-9]{64}$/u;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/u;
const SAFE_SUBJECT =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/u;
const SAFE_DISPLAY_NAME =
  /^[\p{L}\p{N}](?:[\p{L}\p{N} ._()'\-]{0,78}[\p{L}\p{N})])?$/u;
const PUBLIC_ENV_PREFIX = "NEXT_PUBLIC_WISE_STRATEGY_";

const DEPLOYMENT_ENVIRONMENT_KEYS = new Set([
  "NETLIFY",
  "CF_PAGES",
  "RENDER",
  "RAILWAY_ENVIRONMENT",
  "FLY_APP_NAME",
  "K_SERVICE",
  "AWS_LAMBDA_FUNCTION_NAME",
  "FUNCTIONS_WORKER_RUNTIME",
  "WEBSITE_INSTANCE_ID",
]);

const DISABLED_MODE = Object.freeze({
  enabled: false,
  reason: "mode_disabled",
} as const);
const DISABLED_DEPLOYMENT = Object.freeze({
  enabled: false,
  reason: "deployment_environment",
} as const);
const DISABLED_PUBLIC_ENV = Object.freeze({
  enabled: false,
  reason: "public_environment_variable",
} as const);
const DISABLED_INVALID = Object.freeze({
  enabled: false,
  reason: "invalid_configuration",
} as const);

/**
 * Fail-closed local-only configuration for the private authoring studio.
 * Merely defining credentials never enables the studio: mode must be the exact
 * string `local`, every value must validate and no deployment marker may exist.
 */
export function loadStrategyStudioRuntimeConfig(
  environment: StrategyStudioEnvironment = process.env,
  cwd = process.cwd(),
): StrategyStudioRuntimeConfig {
  if (environment[STRATEGY_STUDIO_MODE_ENV] !== "local") {
    return DISABLED_MODE;
  }

  const environmentKeys = Object.keys(environment);
  if (environmentKeys.some(isDeploymentEnvironmentKey)) {
    return DISABLED_DEPLOYMENT;
  }
  if (environmentKeys.some((key) => key.startsWith(PUBLIC_ENV_PREFIX))) {
    return DISABLED_PUBLIC_ENV;
  }

  const sessionKey = decodeBase64UrlKey(
    environment[STRATEGY_STUDIO_SESSION_KEY_ENV],
  );
  const encryptionKey = decodeBase64UrlKey(
    environment[STRATEGY_STUDIO_ENCRYPTION_KEY_ENV],
  );
  const editor = parseStaffConfig("editor", environment);
  const reviewer = parseStaffConfig("reviewer", environment);
  const storeDirectory = resolveStoreDirectory(
    environment[STRATEGY_STUDIO_STORE_DIRECTORY_ENV],
    cwd,
  );

  if (
    sessionKey === null ||
    encryptionKey === null ||
    editor === null ||
    reviewer === null ||
    storeDirectory === null ||
    fixedLengthEqual(sessionKey, encryptionKey) ||
    fixedLengthEqual(
      Buffer.from(editor.tokenDigest, "hex"),
      Buffer.from(reviewer.tokenDigest, "hex"),
    ) ||
    editor.subject.toLocaleLowerCase("en-US") ===
      reviewer.subject.toLocaleLowerCase("en-US") ||
    editor.displayName.toLocaleLowerCase("zh-CN") ===
      reviewer.displayName.toLocaleLowerCase("zh-CN")
  ) {
    return DISABLED_INVALID;
  }

  return {
    enabled: true,
    mode: "local",
    sessionKey,
    encryptionKey,
    editor,
    reviewer,
    storeDirectory,
  };
}

/** Compare a submitted local login token with a configured SHA-256 digest. */
export function verifyStrategyStudioStaffToken(
  token: unknown,
  expectedDigest: unknown,
): boolean {
  if (
    typeof token !== "string" ||
    !BASE64URL_32_BYTES.test(token) ||
    typeof expectedDigest !== "string" ||
    !SHA256_HEX.test(expectedDigest)
  ) {
    return false;
  }

  const actual = createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(expectedDigest, "hex");
  return fixedLengthEqual(actual, expected);
}

export function isStrategyStudioStaffRole(
  value: unknown,
): value is StrategyStudioStaffRole {
  return value === "editor" || value === "reviewer";
}

export function isSafeStrategyStudioSubject(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    value.normalize("NFC") === value &&
    SAFE_SUBJECT.test(value)
  );
}

export function isSafeStrategyStudioDisplayName(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    value === value.trim() &&
    value.normalize("NFC") === value &&
    SAFE_DISPLAY_NAME.test(value)
  );
}

function parseStaffConfig<Role extends StrategyStudioStaffRole>(
  role: Role,
  environment: StrategyStudioEnvironment,
): (StrategyStudioStaffConfig & Readonly<{ role: Role }>) | null {
  const names = STRATEGY_STUDIO_STAFF_ENV[role];
  const tokenDigest = environment[names.tokenDigest];
  const subject = environment[names.subject];
  const displayName = environment[names.displayName];

  if (
    typeof tokenDigest !== "string" ||
    !SHA256_HEX.test(tokenDigest) ||
    !isSafeStrategyStudioSubject(subject) ||
    !isSafeStrategyStudioDisplayName(displayName)
  ) {
    return null;
  }

  return {
    role,
    tokenDigest: tokenDigest.toLowerCase(),
    subject,
    displayName,
  };
}

function decodeBase64UrlKey(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || !BASE64URL_32_BYTES.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== 32 || decoded.toString("base64url") !== value) {
    return null;
  }
  return Uint8Array.from(decoded);
}

function resolveStoreDirectory(
  configured: string | undefined,
  cwd: string,
): string | null {
  if (
    typeof cwd !== "string" ||
    cwd.length === 0 ||
    cwd.includes("\0") ||
    (configured !== undefined &&
      (configured.length === 0 ||
        configured.length > 1_024 ||
        configured !== configured.trim() ||
        configured.includes("\0")))
  ) {
    return null;
  }

  const resolvedCwd = path.resolve(cwd);
  const resolved = path.resolve(
    resolvedCwd,
    configured ?? ".wise-crypto-private/strategies",
  );
  const filesystemRoot = path.parse(resolved).root;
  if (resolved === filesystemRoot || resolved === resolvedCwd) return null;

  const protectedRoots = ["src", "public", "docs", ".next", ".git"].map(
    (directory) => path.join(resolvedCwd, directory),
  );
  if (protectedRoots.some((root) => isPathInsideOrEqual(resolved, root))) {
    return null;
  }

  return resolved;
}

function isPathInsideOrEqual(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isDeploymentEnvironmentKey(key: string): boolean {
  return key === "VERCEL" || key.startsWith("VERCEL_") || DEPLOYMENT_ENVIRONMENT_KEYS.has(key);
}

function fixedLengthEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}
