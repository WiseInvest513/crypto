import { beforeEach, describe, expect, it, vi } from "vitest";
import { unavailableDatum } from "@/server/data/contracts/market-data";

const mocks = vi.hoisted(() => ({ loadAssetPerformanceSnapshot: vi.fn() }));
vi.mock("@/server/data/services/price-performance-service", () => ({ loadAssetPerformanceSnapshot: mocks.loadAssetPerformanceSnapshot }));
import { GET } from "@/app/api/market/performance/route";

describe("price performance same-origin API", () => {
  beforeEach(() => {
    mocks.loadAssetPerformanceSnapshot.mockReset();
    mocks.loadAssetPerformanceSnapshot.mockResolvedValue({ asset: "btc", windows: [{ window: "1d", datum: unavailableDatum("spot.btc-performance", "no_data") }] });
  });

  it.each(["btc", "eth"])("serves only asset %s and keeps identity out of public data", async (asset) => {
    const response = await GET(new Request(`http://localhost:2222/api/market/performance?asset=${asset}`, { headers: { cookie: "tier=vip" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.loadAssetPerformanceSnapshot).toHaveBeenCalledExactlyOnceWith(asset);
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
