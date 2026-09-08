import { describe, expect, it } from "vitest";
import { assertStrategyStudioMutationOrigin } from "@/server/strategy/strategy-studio-origin";

describe("strategy studio mutation origin", () => {
  it.each([
    ["http://localhost:2222", "localhost:2222"],
    ["http://127.0.0.1:2222", "127.0.0.1:2222"],
  ])("accepts the exact local studio origin %s", (origin, host) => {
    expect(() =>
      assertStrategyStudioMutationOrigin({
        origin,
        host,
        forwardedHost: host,
        forwardedProto: "http",
      }),
    ).not.toThrow();
  });

  it.each([
    { origin: null, host: "localhost:2222" },
    { origin: "null", host: "localhost:2222" },
    { origin: "https://localhost:2222", host: "localhost:2222" },
    { origin: "http://localhost", host: "localhost" },
    { origin: "http://localhost:2222.evil.test", host: "localhost:2222.evil.test" },
    { origin: "http://localhost:2222", host: "127.0.0.1:2222" },
    {
      origin: "http://localhost:2222",
      host: "localhost:2222",
      forwardedHost: "evil.test",
    },
    {
      origin: "http://localhost:2222",
      host: "localhost:2222",
      forwardedProto: "https",
    },
    {
      origin: "http://localhost:2222",
      host: "localhost:2222, evil.test",
    },
  ])("rejects an ambiguous or non-local request", (request) => {
    expect(() => assertStrategyStudioMutationOrigin(request)).toThrow(
      "STRATEGY_STUDIO_INVALID_ORIGIN",
    );
  });
});
