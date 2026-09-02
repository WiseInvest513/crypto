import { describe, expect, it } from "vitest";
import { WISE_INVEST_CRYPTO_PERKS_URL } from "../../src/config/site";
import { config, proxy } from "../../src/proxy";

describe("legacy product redirect proxy", () => {
  it("covers the product index and every nested legacy path", () => {
    expect(config.matcher).toBe("/products/:path*");
  });

  it("returns a fixed permanent redirect without forwarding request data", () => {
    const response = proxy();

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      WISE_INVEST_CRYPTO_PERKS_URL,
    );
  });
});
