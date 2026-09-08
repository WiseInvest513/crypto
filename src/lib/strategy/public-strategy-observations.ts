import type { ChartCandleInterval } from "@/lib/market/live-chart";
import type { PublicResearchSnapshot } from "@/lib/market/public-research";

export const PUBLIC_STRATEGY_METHOD_VERSION = "closed-confirmation-v1" as const;

export type PublicStrategyEvidence = Readonly<{
  methodVersion: typeof PUBLIC_STRATEGY_METHOD_VERSION;
  closedVolume: Readonly<{
    ratio: number | null;
    headline: string;
    detail: string;
  }>;
  multiTimeframe: Readonly<{
    available: number;
    above: number;
    below: number;
    equal: number;
    headline: string;
    detail: string;
  }>;
}>;

/**
 * Public, objective confirmation facts. It does not create a bias, entry,
 * target, probability or Wise editorial judgment.
 */
export function buildPublicStrategyEvidence(
  snapshot: PublicResearchSnapshot | null,
  interval: ChartCandleInterval,
): PublicStrategyEvidence {
  const current = snapshot?.timeframes.find(
    (entry) => entry.interval === interval,
  );
  const currentValue = readAvailable(current?.datum);
  const ratio = currentValue?.window.latestVolumeRatioToAverage ?? null;

  let volumeHeadline = "量能样本暂不可用";
  if (ratio !== null && Number.isFinite(ratio)) {
    volumeHeadline =
      ratio >= 1.2
        ? "量能高于近 20 根均量"
        : ratio <= 0.8
          ? "量能低于近 20 根均量"
          : "量能接近近 20 根均量";
  }

  const relations = (snapshot?.timeframes ?? []).flatMap((entry) => {
    const value = readAvailable(entry.datum);
    const relation = value?.comparisons.find(
      (comparison) => comparison.key === "ema20",
    )?.relation;
    return relation && relation !== "unavailable" ? [relation] : [];
  });
  const above = relations.filter((relation) => relation === "above").length;
  const below = relations.filter((relation) => relation === "below").length;
  const equal = relations.filter((relation) => relation === "equal").length;
  const available = relations.length;
  const multiTimeframeHeadline =
    available === 0
      ? "多周期样本暂不可用"
      : above > below && above >= equal
        ? `${above}/${available} 周期在 EMA20 上方`
        : below > above && below >= equal
          ? `${below}/${available} 周期在 EMA20 下方`
          : "多周期位置仍在分化";

  return {
    methodVersion: PUBLIC_STRATEGY_METHOD_VERSION,
    closedVolume: {
      ratio,
      headline: volumeHeadline,
      detail:
        ratio === null || !Number.isFinite(ratio)
          ? "仅统计已闭合 K 线"
          : `${ratio.toFixed(2)}× 前 20 根已闭合均量`,
    },
    multiTimeframe: {
      available,
      above,
      below,
      equal,
      headline: multiTimeframeHeadline,
      detail: "15 分、1 小时、4 小时与日线独立计算",
    },
  };
}

function readAvailable<T>(
  datum:
    | Readonly<{
        status: string;
        provenance?: string;
        value?: T;
      }>
    | undefined,
): T | null {
  return datum &&
    (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic" &&
    datum.value !== undefined
    ? datum.value
    : null;
}
