import "server-only";

import { ProviderError } from "../errors/provider-error";

export type JsonRequest = {
  headers?: Readonly<Record<string, string>>;
};

export interface JsonHttpClient {
  get(url: string, request?: JsonRequest): Promise<unknown>;
}

type FetchJsonClientOptions = {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  maxResponseBytes?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class FetchJsonClient implements JsonHttpClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly maxResponseBytes: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor({
    fetchFn = fetch,
    timeoutMs = 5_000,
    maxAttempts = 2,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    sleep = defaultSleep,
  }: FetchJsonClientOptions = {}) {
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = Math.max(1, maxAttempts);
    this.maxResponseBytes = Math.max(1, maxResponseBytes);
    this.sleep = sleep;
  }

  async get(url: string, request: JsonRequest = {}): Promise<unknown> {
    assertSafeUpstreamUrl(url);
    let lastError: ProviderError | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.fetchOnce(url, request);
      } catch (error) {
        const providerError =
          error instanceof ProviderError
            ? error
            : new ProviderError("upstream_error", true);
        lastError = providerError;

        if (!providerError.retryable || attempt === this.maxAttempts) {
          throw providerError;
        }

        await this.sleep(Math.min(100 * 2 ** (attempt - 1), 1_000));
      }
    }

    throw lastError ?? new ProviderError("upstream_error", true);
  }

  private async fetchOnce(
    url: string,
    request: JsonRequest,
  ): Promise<unknown> {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutHandle = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: request.headers,
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });

      if (response.status === 429) {
        throw new ProviderError("rate_limited", true);
      }

      if (response.status >= 500) {
        throw new ProviderError("upstream_error", true);
      }

      if (!response.ok) {
        throw new ProviderError("upstream_error", false);
      }

      const declaredLengthHeader = response.headers.get("content-length");
      if (declaredLengthHeader !== null) {
        const declaredLength = Number(declaredLengthHeader);
        if (
          !Number.isFinite(declaredLength) ||
          declaredLength < 0 ||
          declaredLength > this.maxResponseBytes
        ) {
          throw new ProviderError("invalid_payload", false);
        }
      }

      let body: string;
      try {
        body = await readLimitedBody(response, this.maxResponseBytes);
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }
        throw new ProviderError("upstream_error", true);
      }

      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new ProviderError("invalid_payload", false);
      }
    } catch (error) {
      if (didTimeout) {
        throw new ProviderError("timeout", true);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value === undefined) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ProviderError("invalid_payload", false);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function assertSafeUpstreamUrl(value: string): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ProviderError("upstream_error", false);
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new ProviderError("upstream_error", false);
  }
}
