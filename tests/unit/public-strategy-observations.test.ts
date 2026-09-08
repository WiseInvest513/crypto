import { describe, expect, it } from "vitest";
import type { PublicResearchSnapshot } from "@/lib/market/public-research";
import { buildPublicStrategyEvidence } from "@/lib/strategy/public-strategy-observations";

function snapshot(
  relations: readonly ("above" | "below" | "equal")[] = [
    "above",
    "above",
    "above",
    "below",
  ],
  ratio = 1.42,
): PublicResearchSnapshot {
  const intervals = ["15m", "1h", "4h", "1d"] as const;
  return {
    asset: "btc",
    interval: "1h",
    levels: { status: "unavailable" } as PublicResearchSnapshot["levels"],
    history: { status: "unavailable" } as PublicResearchSnapshot["history"],
    longHistory: { status: "unavailable" } as PublicResearchSnapshot["longHistory"],
    cycle: { status: "unavailable" } as PublicResearchSnapshot["cycle"],
    timeframes: intervals.map((interval, index) => ({
      interval,
      datum: {
        status: "fresh",
        provenance: "live",
        value: {
          comparisons: [{ key: "ema20", relation: relations[index] }],
          window: {
            latestVolumeRatioToAverage: interval === "1h" ? ratio : 1,
          },
        },
      } as unknown as PublicResearchSnapshot["timeframes"][number]["datum"],
    })),
  };
}

const DEFAULT_RELATIONS = ["above", "above", "above", "below"] as const;

describe("public strategy observations", () => {
  it("summarizes closed volume and multi-timeframe EMA facts without probability", () => {
    const evidence = buildPublicStrategyEvidence(snapshot(), "1h");
    expect(evidence.closedVolume).toEqual({
      ratio: 1.42,
      headline: "量能高于近 20 根均量",
      detail: "1.42× 前 20 根已闭合均量",
    });
    expect(evidence.multiTimeframe).toMatchObject({
      available: 4,
      above: 3,
      below: 1,
      headline: "3/4 周期在 EMA20 上方",
    });
    expect(JSON.stringify(evidence)).not.toMatch(/概率|胜率|买入|卖出/);
  });

  it.each([
    [0.7, "量能低于近 20 根均量"],
    [1, "量能接近近 20 根均量"],
    [1.2, "量能高于近 20 根均量"],
  ] as const)("classifies a %.2f volume ratio as objective evidence", (ratio, headline) => {
    expect(buildPublicStrategyEvidence(snapshot(DEFAULT_RELATIONS, ratio), "1h").closedVolume.headline).toBe(headline);
  });

  it("reports divergence and ignores synthetic or unavailable timeframes", () => {
    const data = snapshot(["above", "below", "equal", "below"]);
    const first = data.timeframes[0];
    const mixed: PublicResearchSnapshot = {
      ...data,
      timeframes: [
        {
          ...first,
          datum: {
            ...first.datum,
            provenance: "synthetic",
          } as typeof first.datum,
        },
        ...data.timeframes.slice(1),
      ],
    };
    const evidence = buildPublicStrategyEvidence(mixed, "15m");
    expect(evidence.closedVolume.ratio).toBeNull();
    expect(evidence.multiTimeframe.available).toBe(3);
    expect(evidence.multiTimeframe.headline).toBe("2/3 周期在 EMA20 下方");
  });

  it("keeps missing research explicitly unavailable", () => {
    const evidence = buildPublicStrategyEvidence(null, "1h");
    expect(evidence.closedVolume.headline).toBe("量能样本暂不可用");
    expect(evidence.multiTimeframe.headline).toBe("多周期样本暂不可用");
  });
});
