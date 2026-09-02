import { describe, expect, it, vi } from "vitest";
import { FetchJsonClient } from "../../src/server/data/http/fetch-json";

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch;
}

describe("FetchJsonClient", () => {
  it("retries a bounded 429 and then returns JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const sleep = vi.fn(async () => undefined);
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 2,
      sleep,
    });

    await expect(client.get("https://example.test/data")).resolves.toEqual({
      ok: true,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("reports exhausted 5xx responses as retryable upstream errors", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 503 }));
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 2,
      sleep: async () => undefined,
    });

    await expect(client.get("https://example.test/data")).rejects.toMatchObject({
      code: "upstream_error",
      retryable: true,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("reports exhausted 429 responses as rate limited", async () => {
    const client = new FetchJsonClient({
      fetchFn: asFetch(
        vi.fn(async () => new Response("{}", { status: 429 })),
      ),
      maxAttempts: 1,
    });

    await expect(client.get("https://example.test/data")).rejects.toMatchObject({
      code: "rate_limited",
      retryable: true,
    });
  });

  it("aborts and classifies timed-out requests", async () => {
    const fetchFn = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      timeoutMs: 5,
      maxAttempts: 1,
    });

    await expect(client.get("https://example.test/slow")).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });
  });

  it("rejects malformed JSON without retrying", async () => {
    const fetchFn = vi.fn(async () => new Response("not-json", { status: 200 }));
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 2,
      sleep: async () => undefined,
    });

    await expect(client.get("https://example.test/data")).rejects.toMatchObject({
      code: "invalid_payload",
      retryable: false,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries when a successful response body is interrupted in transit", async () => {
    const interruptedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'));
        controller.error(new TypeError("connection closed"));
      },
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(interruptedBody, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const sleep = vi.fn(async () => undefined);
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 2,
      sleep,
    });

    await expect(client.get("https://example.test/data")).resolves.toEqual({
      ok: true,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("rejects redirects so provider credentials cannot cross origins", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 1,
    });

    await client.get("https://example.test/data", {
      headers: { "X-Provider-Key": "server-only" },
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/data",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("rejects oversized JSON responses before parsing", async () => {
    const client = new FetchJsonClient({
      fetchFn: asFetch(
        vi.fn(async () =>
          new Response(JSON.stringify({ payload: "x".repeat(128) }), {
            status: 200,
          }),
        ),
      ),
      maxAttempts: 1,
      maxResponseBytes: 64,
    });

    await expect(client.get("https://example.test/data")).rejects.toMatchObject({
      code: "invalid_payload",
      retryable: false,
    });
  });

  it("rejects non-HTTPS and credentialed upstream URLs", async () => {
    const fetchFn = vi.fn();
    const client = new FetchJsonClient({
      fetchFn: asFetch(fetchFn),
      maxAttempts: 1,
    });

    await expect(client.get("http://example.test/data")).rejects.toMatchObject({
      code: "upstream_error",
      retryable: false,
    });
    await expect(
      client.get("https://user:password@example.test/data"),
    ).rejects.toMatchObject({ code: "upstream_error", retryable: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
