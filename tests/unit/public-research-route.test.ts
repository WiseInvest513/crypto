import { beforeEach, describe, expect, it, vi } from "vitest";
import { unavailableDatum } from "@/server/data/contracts/market-data";

const mocks = vi.hoisted(() => ({ loadAssetResearchSnapshot: vi.fn() }));
vi.mock("@/server/data/services/public-research-service", () => ({ loadAssetResearchSnapshot: mocks.loadAssetResearchSnapshot }));
import { GET } from "@/app/api/market/research/route";

describe("public research same-origin API", () => {
  beforeEach(() => {
    mocks.loadAssetResearchSnapshot.mockReset();
    mocks.loadAssetResearchSnapshot.mockResolvedValue({
      asset: "btc",
      interval: "1h",
      levels: unavailableDatum("analysis.btc-key-levels", "no_data"),
      history: unavailableDatum("analysis.btc-historical-context", "no_data"),
      longHistory: unavailableDatum("analysis.btc-long-term-history", "no_data"),
      timeframes: [],
    });
  });

  it("returns normalized public facts without accepting an identity parameter", async () => {
    const response = await GET(new Request("http://localhost:2222/api/market/research?asset=btc&interval=1h", { headers: { cookie: "tier=vip" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.loadAssetResearchSnapshot).toHaveBeenCalledWith("btc", "1h");
    const payload = await response.json();
    expect(payload).toMatchObject({
      asset: "btc",
      interval: "1h",
      levels: { status: "unavailable" },
      history: { status: "unavailable" },
      longHistory: { status: "unavailable" },
    });
    expect(JSON.stringify(payload)).not.toMatch(/strategy|editorial|access|tier/i);
  });

  it.each([
    "asset=xrp&interval=1h", "asset=BTC&interval=1h", "asset=btc&interval=5m",
    "asset=btc", "interval=1h", "asset=btc&asset=eth&interval=1h",
    "asset=btc&interval=1h&interval=4h", "asset=btc&interval=1h&tier=vip",
    "asset=btc&interval=1h&limit=99999", "asset=btc&interval=1h&url=https://example.com",
  ])("rejects unbounded or invalid request %s", async (query) => {
    const response = await GET(new Request(`http://localhost:2222/api/market/research?${query}`));
    expect(response.status).toBe(400);
    expect(mocks.loadAssetResearchSnapshot).not.toHaveBeenCalled();
  });

  it("never sends internal failure messages to the client", async () => {
    mocks.loadAssetResearchSnapshot.mockRejectedValue(new Error("secret-key"));
    const response = await GET(new Request("http://localhost:2222/api/market/research?asset=eth&interval=4h"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-key");
  });
});
