import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketPricePerformance } from "@/components/assets/market-price-performance";
import { pricePerformanceWindows, type PricePerformanceSnapshot } from "@/lib/market/price-performance";
import {
  expirePricePerformanceSnapshot,
  parsePricePerformance,
  performanceRows,
} from "@/lib/market/price-performance-presentation";
import { unavailableDatum } from "@/server/data/contracts/market-data";

const now = Date.parse("2026-09-03T05:15:20.000Z");
function snapshot(): PricePerformanceSnapshot {
  return {
    asset: "btc",
    windows: pricePerformanceWindows.map((window) => ({
      window,
      datum: {
        capability: "spot.btc-performance", status: "fresh", stale: false, loading: false, error: null,
        source: { id: "test-source", label: "Hidden source", url: "https://example.com" },
        scope: { kind: "venue", label: "BTCUSDT" }, provenance: window === "30d" ? "derived" : "live",
        updatedAt: new Date(now).toISOString(), retrievedAt: new Date(now).toISOString(),
        cache: { status: "miss", revalidateSeconds: 60, staleIfErrorSeconds: 300 },
        value: { asset: "btc", symbol: "BTCUSDT", quoteCurrency: "USDT", window,
          openPrice: 100, latestPrice: 110, changePercent: 10,
          openTime: new Date(now - Number.parseInt(window) * 86_400_000 - 20_000).toISOString(),
          closeTime: new Date(now).toISOString(), basis: window === "30d" ? "minute-anchor" : "rolling-ticker" },
      },
    })),
  };
}

describe("rolling return presentation", () => {
  it("accepts the three independent windows and renders the right labels", () => {
    const data = parsePricePerformance(snapshot(), "btc");
    expect(performanceRows(data, false, now).map((row) => row.label)).toEqual(["近 1 天", "近 7 天", "近 30 天"]);
    const html = renderToStaticMarkup(createElement(MarketPricePerformance, { snapshot: data, now, issue: false }));
    expect(html.match(/\+10.00%/g)).toHaveLength(3);
    expect(html).not.toContain("本周期");
    expect(html).not.toContain("Hidden source");
    expect(html).toContain("分钟对齐");
  });

  it("does not hide successful windows when one is unavailable", () => {
    const data = snapshot();
    data.windows[2].datum = unavailableDatum("spot.btc-performance", "no_data");
    const rows = performanceRows(parsePricePerformance(data, "btc"), false, now);
    expect(rows.map((row) => row.change)).toEqual([10, 10, null]);
    expect(rows[2].state).toBe("unavailable");
  });

  it("marks cached values delayed on an error and expires them without inventing zeros", () => {
    const data = snapshot();
    expect(performanceRows(data, true, now)[0].state).toBe("delayed");
    expect(performanceRows(data, false, now + 91_000)[0].state).toBe("delayed");
    expect(performanceRows(data, false, now + 301_000).every((row) => row.change === null)).toBe(true);
    expect(performanceRows(null, false, now).every((row) => row.state === "loading")).toBe(true);
    expect(performanceRows(null, true, now).every((row) => row.state === "unavailable")).toBe(true);
  });

  it("anchors browser expiry to server retrieval time, not a newer source timestamp", () => {
    const data = snapshot();
    const first = data.windows[0].datum;
    if (first.status !== "fresh" && first.status !== "stale") throw new Error("Fixture must be available");
    data.windows[0].datum = {
      ...first,
      retrievedAt: new Date(now - 301_000).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    const rows = performanceRows(data, false, now);
    expect(rows.map((row) => row.change)).toEqual([null, 10, 10]);
    const current = expirePricePerformanceSnapshot(data, now);
    expect(current.expired).toBe(true);
    expect(current.snapshot.windows[0].datum).toMatchObject({
      status: "unavailable",
      value: null,
      reason: "no_data",
    });
    expect(current.snapshot.windows[1].datum.status).toBe("fresh");
  });

  it("rejects scope mixing, duplicated windows and synthetic data", () => {
    expect(() => parsePricePerformance(snapshot(), "eth")).toThrow();
    const duplicate = snapshot();
    duplicate.windows[2].window = "1d";
    expect(() => parsePricePerformance(duplicate, "btc")).toThrow();
    const fake = snapshot();
    const datum = fake.windows[0].datum;
    if (datum.status !== "fresh" && datum.status !== "stale") throw new Error("Fixture must be available");
    fake.windows[0].datum = { ...datum, provenance: "synthetic" };
    expect(() => parsePricePerformance(fake, "btc")).toThrow();
  });
});
