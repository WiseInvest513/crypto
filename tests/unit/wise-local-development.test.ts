import { describe, expect, it } from "vitest";
import {
  isWiseLocalDevelopmentRequestInput,
  type WiseLocalDevelopmentEnvironment,
} from "@/server/auth/wise-local-development";

const DEVELOPMENT_ENVIRONMENT: WiseLocalDevelopmentEnvironment = {
  NODE_ENV: "development",
};

function localRequest(
  host = "127.0.0.1:2222",
  additionalHeaders: HeadersInit = {},
) {
  return new Headers({ host, ...Object.fromEntries(new Headers(additionalHeaders)) });
}

describe("Wise local development access", () => {
  it.each(["127.0.0.1:2222", "localhost:2222", "LOCALHOST:2222"])(
    "allows the exact loopback development host %s",
    (host) => {
      expect(
        isWiseLocalDevelopmentRequestInput(
          localRequest(host),
          DEVELOPMENT_ENVIRONMENT,
        ),
      ).toBe(true);
    },
  );

  it.each([
    "crypto.wise-invest.org",
    "crypto-project.vercel.app",
    "192.168.1.10:2222",
    "0.0.0.0:2222",
    "localhost:3000",
    "localhost",
    "localhost.evil.test:2222",
    "127.0.0.1.evil.test:2222",
    "localhost:2222, crypto.wise-invest.org",
    "",
  ])("rejects a non-exact host: %s", (host) => {
    expect(
      isWiseLocalDevelopmentRequestInput(
        localRequest(host),
        DEVELOPMENT_ENVIRONMENT,
      ),
    ).toBe(false);
  });

  it("rejects a missing host", () => {
    expect(
      isWiseLocalDevelopmentRequestInput(
        new Headers(),
        DEVELOPMENT_ENVIRONMENT,
      ),
    ).toBe(false);
  });

  it.each(["production", "test", undefined])(
    "fails closed outside development when NODE_ENV is %s",
    (nodeEnvironment) => {
      expect(
        isWiseLocalDevelopmentRequestInput(localRequest(), {
          NODE_ENV: nodeEnvironment,
        }),
      ).toBe(false);
    },
  );

  it.each([
    ["VERCEL", "1"],
    ["VERCEL_ENV", "production"],
    ["VERCEL_ENV", "preview"],
    ["VERCEL_ENV", "development"],
    ["VERCEL_URL", "crypto-project.vercel.app"],
    ["CF_PAGES", "1"],
    ["NETLIFY", "true"],
    ["AWS_EXECUTION_ENV", "AWS_Lambda_nodejs22.x"],
  ] as const)("rejects a deployment marker: %s", (name, value) => {
    expect(
      isWiseLocalDevelopmentRequestInput(localRequest(), {
        ...DEVELOPMENT_ENVIRONMENT,
        [name]: value,
      }),
    ).toBe(false);
  });

  it.each([
    [{ "x-forwarded-host": "crypto.wise-invest.org" }, false],
    [{ "x-forwarded-host": "localhost:2222" }, false],
    [{ "x-forwarded-proto": "https" }, false],
    [{ "x-forwarded-proto": "http, https" }, false],
    [{ "x-forwarded-port": "443" }, false],
    [{ forwarded: "host=localhost:2222;proto=http" }, false],
    [
      {
        "x-forwarded-host": "127.0.0.1:2222",
        "x-forwarded-proto": "http",
        "x-forwarded-port": "2222",
      },
      true,
    ],
  ] as const)("validates proxy metadata %j", (additionalHeaders, expected) => {
    expect(
      isWiseLocalDevelopmentRequestInput(
        localRequest("127.0.0.1:2222", additionalHeaders),
        DEVELOPMENT_ENVIRONMENT,
      ),
    ).toBe(expected);
  });
});
