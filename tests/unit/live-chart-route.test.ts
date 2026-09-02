import { beforeEach, describe, expect, it, vi } from "vitest";
import { unavailableDatum } from "../../src/server/data/contracts/market-data";

const mocks = vi.hoisted(() => ({
  loadAssetLiveChartDatum: vi.fn(),
}));

vi.mock("@/server/data/services/market-data-service", () => ({
  loadAssetLiveChartDatum: mocks.loadAssetLiveChartDatum,
}));

import { GET } from "../../src/app/api/market/candles/route";

describe("live chart same-origin route", () => {
  beforeEach(() => {
    mocks.loadAssetLiveChartDatum.mockReset();
    mocks.loadAssetLiveChartDatum.mockResolvedValue(
      unavailableDatum("historical.btc-chart-candles", "no_data"),
    );
  });

  it("passes an allowlisted full request to the normalized server service", async () => {
    const response = await GET(
      new Request(
        "http://localhost:2222/api/market/candles?asset=btc&interval=1h&mode=full",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.loadAssetLiveChartDatum).toHaveBeenCalledWith(
      "btc",
      "1h",
      "full",
    );
    await expect(response.json()).resolves.toMatchObject({
      status: "unavailable",
      capability: "historical.btc-chart-candles",
      reason: "no_data",
    });
  });

  it("defaults valid requests to a bounded tail refresh", async () => {
    await GET(
      new Request(
        "http://localhost:2222/api/market/candles?asset=eth&interval=15m",
      ),
    );

    expect(mocks.loadAssetLiveChartDatum).toHaveBeenCalledWith(
      "eth",
      "15m",
      "tail",
    );
  });

  it.each([
    "asset=xrp&interval=1h&mode=tail",
    "asset=btc&interval=5m&mode=tail",
    "asset=btc&interval=1h&mode=all",
    "asset=btc&asset=eth&interval=1h&mode=tail",
    "asset=btc&interval=1h&mode=tail&url=https://example.com",
    "asset=btc&mode=tail",
  ])("rejects invalid or expandable requests without invoking a provider: %s", async (query) => {
    const response = await GET(
      new Request(`http://localhost:2222/api/market/candles?${query}`),
    );

    expect(response.status).toBe(400);
    expect(mocks.loadAssetLiveChartDatum).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      message: "只支持 btc / eth 与 15m / 1h / 4h / 1d K 线请求。",
    });
  });
});
