import { beforeEach, describe, expect, it, vi } from "vitest";
import { unavailableDatum } from "@/server/data/contracts/market-data";

const mocks = vi.hoisted(() => ({
  loadAssetPerformanceSnapshot: vi.fn(),
  requireWiseApiAccount: vi.fn(),
}));
vi.mock("@/server/data/services/price-performance-service", () => ({ loadAssetPerformanceSnapshot: mocks.loadAssetPerformanceSnapshot }));
vi.mock("@/server/auth/wise-route-access", () => ({
  requireWiseApiAccount: mocks.requireWiseApiAccount,
}));
import { GET } from "@/app/api/market/performance/route";

describe("price performance same-origin API", () => {
  beforeEach(() => {
    mocks.loadAssetPerformanceSnapshot.mockReset();
    mocks.requireWiseApiAccount.mockReset();
    mocks.requireWiseApiAccount.mockResolvedValue(null);
    mocks.loadAssetPerformanceSnapshot.mockResolvedValue({ asset: "btc", windows: [{ window: "1d", datum: unavailableDatum("spot.btc-performance", "no_data") }] });
  });

  it.each(["btc", "eth"])("serves only authenticated asset %s requests", async (asset) => {
    const response = await GET(new Request(`http://localhost:2222/api/market/performance?asset=${asset}`, { headers: { cookie: "tier=vip" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.loadAssetPerformanceSnapshot).toHaveBeenCalledExactlyOnceWith(asset);
  });

  it("rejects an anonymous request before invoking the market provider", async () => {
    mocks.requireWiseApiAccount.mockResolvedValue(
      Response.json(
        { error: "authentication_required" },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
            Vary: "Cookie",
          },
        },
      ),
    );

    const response = await GET(
      new Request("http://localhost:2222/api/market/performance?asset=btc"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(mocks.loadAssetPerformanceSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    "", "asset=", "asset=xrp", "asset=BTC", "asset=btc&asset=eth",
    "asset=btc&interval=1h", "asset=btc&window=30d", "asset=btc&tier=vip",
    "asset=btc&startTime=0", "asset=btc&url=https://example.com",
  ])("rejects invalid or unbounded request %s", async (query) => {
    const response = await GET(new Request(`http://localhost:2222/api/market/performance?${query}`));
    expect(response.status).toBe(400);
    expect(mocks.loadAssetPerformanceSnapshot).not.toHaveBeenCalled();
  });

  it("does not expose internal errors or secrets", async () => {
    mocks.loadAssetPerformanceSnapshot.mockRejectedValue(new Error("secret-key"));
    const response = await GET(new Request("http://localhost:2222/api/market/performance?asset=btc"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-key");
  });
});
