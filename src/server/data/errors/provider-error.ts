import type { DataError, DataErrorCode } from "../contracts/market-data";

export class ProviderError extends Error {
  readonly code: DataErrorCode;
  readonly retryable: boolean;

  constructor(code: DataErrorCode, retryable: boolean) {
    super(`Market data provider failed: ${code}`);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  return new ProviderError("upstream_error", true);
}

export function toDataError(error: unknown): DataError {
  const normalized = normalizeProviderError(error);
  return {
    code: normalized.code,
    retryable: normalized.retryable,
  };
}
