import { ProviderError } from "../errors/provider-error";

export type UnknownRecord = Record<string, unknown>;

export function record(value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderError("invalid_payload", false);
  }
  return value as UnknownRecord;
}

export function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ProviderError("invalid_payload", false);
  }
  return value;
}

export function nonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProviderError("invalid_payload", false);
  }
  return value.trim();
}

export function finiteNumber(value: unknown): number {
  const normalized =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (typeof normalized !== "number" || !Number.isFinite(normalized)) {
    throw new ProviderError("invalid_payload", false);
  }
  return normalized;
}

export function optionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return finiteNumber(value);
}

export function positiveNumber(value: unknown): number {
  const normalized = finiteNumber(value);
  if (normalized <= 0) {
    throw new ProviderError("invalid_payload", false);
  }
  return normalized;
}

export function nonNegativeNumber(value: unknown): number {
  const normalized = finiteNumber(value);
  if (normalized < 0) {
    throw new ProviderError("invalid_payload", false);
  }
  return normalized;
}

export function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const normalized = finiteNumber(value);
  if (normalized < minimum || normalized > maximum) {
    throw new ProviderError("invalid_payload", false);
  }
  return normalized;
}

export function unixSecondsToIso(value: unknown, nowMs = Date.now()): string {
  const seconds = finiteNumber(value);
  if (!Number.isInteger(seconds) || seconds < 1_000_000_000 || seconds >= 10_000_000_000) {
    throw new ProviderError("invalid_payload", false);
  }
  return checkedIso(seconds * 1_000, nowMs);
}

export function unixMillisecondsToIso(
  value: unknown,
  nowMs = Date.now(),
): string {
  const milliseconds = finiteNumber(value);
  if (
    !Number.isInteger(milliseconds) ||
    milliseconds < 1_000_000_000_000 ||
    milliseconds >= 10_000_000_000_000
  ) {
    throw new ProviderError("invalid_payload", false);
  }
  return checkedIso(milliseconds, nowMs);
}

export function isoTimestamp(value: unknown, nowMs = Date.now()): string {
  const timestamp = nonEmptyString(value);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) {
    throw new ProviderError("invalid_payload", false);
  }
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) {
    throw new ProviderError("invalid_payload", false);
  }
  return checkedIso(milliseconds, nowMs);
}

function checkedIso(milliseconds: number, nowMs: number): string {
  if (milliseconds > nowMs + 5 * 60 * 1_000) {
    throw new ProviderError("invalid_payload", false);
  }
  return new Date(milliseconds).toISOString();
}
