import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readMarketProviderConfig } from "../../src/server/data/config/provider-env";
import { createMarketProviderRegistry } from "../../src/server/data/provider-registry";

const PROJECT_ROOT = process.cwd();

describe("market provider security boundaries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects provider credentials configured through NEXT_PUBLIC_*", () => {
    expect(() =>
      readMarketProviderConfig({
        NEXT_PUBLIC_COINMARKETCAP_API_KEY: "must-not-be-public",
      }),
    ).toThrow("must never use a NEXT_PUBLIC_* variable");
  });

  it("does not serialize a server API key from the production registry", () => {
    const sentinel = "WISE_CRYPTO_SERVER_SECRET_SENTINEL";
    vi.stubEnv("COINMARKETCAP_API_KEY", sentinel);

    const serializedRegistry = JSON.stringify(createMarketProviderRegistry());

    expect(serializedRegistry).not.toContain(sentinel);
  });

  it("keeps the production registry independent from testing providers", () => {
    const registrySource = readFileSync(
      join(PROJECT_ROOT, "src/server/data/provider-registry.ts"),
      "utf8",
    );

    expect(registrySource).not.toMatch(/testing|mock-market-provider/i);
  });

  it("prevents client modules from importing the server data layer", () => {
    const sourceFiles = walk(join(PROJECT_ROOT, "src")).filter((path) =>
      /\.(?:ts|tsx)$/.test(path),
    );
    const unsafeFiles = sourceFiles.filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        /^\s*["']use client["'];/m.test(source) &&
        /(?:@\/server\/data|server\/data\/)/.test(source)
      );
    });

    expect(unsafeFiles).toEqual([]);
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
