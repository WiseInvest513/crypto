import { describe, expect, it } from "vitest";
import {
  interpretMarketIndicators,
  type ComparableOpenInterestReading,
  type MarketIndicatorInterpretationInput,
} from "@/lib/market/market-indicator-interpretation";
import type {
  AvailableMarketDatum,
  DataScope,
  ErrorMarketDatum,
  EtfFlowReading,
  FundingReading,
  LiquidationsReading,
  MarketCapability,
} from "@/server/data/contracts/market-data";
import {
  loadingDatum,
  unavailableDatum,
} from "@/server/data/contracts/market-data";

const UPDATED_AT = "2026-09-07T12:00:00.000Z";
const RETRIEVED_AT = "2026-09-07T12:00:02.000Z";
const VENUE_SCOPE: DataScope = {
  kind: "venue",
  label: "Binance BTCUSDT Perpetual",
};
const GLOBAL_SCOPE: DataScope = {
  kind: "global",
  label: "Provider-tracked derivatives venues",
};
const BTC_ETF_SCOPE: DataScope = {
  kind: "asset",
  label: "US spot Bitcoin ETFs",
};
const ETH_ETF_SCOPE: DataScope = {
  kind: "asset",
  label: "US spot Ether ETFs",
};

function available<T>(
  capability: MarketCapability,
  value: T,
  scope: DataScope,
  overrides: Partial<AvailableMarketDatum<T>> = {},
): AvailableMarketDatum<T> {
  return {
    status: "fresh",
    capability,
    value,
    source: {
      id: `source-${capability}`,
      label: `Source for ${capability}`,
      url: "https://example.com/market-data",
    },
    scope,
    updatedAt: UPDATED_AT,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    provenance: "live",
    cache: {
      status: "miss",
      revalidateSeconds: 60,
      staleIfErrorSeconds: 300,
    },
    error: null,
    ...overrides,
  };
}

function funding(
  asset: "btc" | "eth",
  rate: number,
): AvailableMarketDatum<FundingReading> {
  return available(
    `derivatives.${asset}-funding`,
    {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      rate,
      intervalHours: 8,
    },
    {
      kind: "venue",
      label: `Binance ${asset.toUpperCase()}USDT Perpetual`,
    },
  );
}

function openInterest(
  asset: "btc" | "eth",
  options: {
    notional: number;
    change24hPercent?: number | null;
    comparisonWindowHours?: number | null;
  },
): AvailableMarketDatum<ComparableOpenInterestReading> {
  return available(
    `derivatives.${asset}-open-interest`,
    {
      asset,
      symbol: asset === "btc" ? "BTCUSDT" : "ETHUSDT",
      notional: options.notional,
      quoteCurrency: "USDT",
      samplingPeriod: "5m",
      change24hPercent: options.change24hPercent,
      comparisonWindowHours: options.comparisonWindowHours,
    },
    {
      kind: "venue",
      label: `Binance ${asset.toUpperCase()}USDT Perpetual`,
    },
  );
}

function liquidations(
  value: LiquidationsReading = {
    asset: "all",
    totalUsd: 380_000_000,
    longUsd: 210_000_000,
    shortUsd: 170_000_000,
    window: "24h",
  },
  scope: DataScope = GLOBAL_SCOPE,
): AvailableMarketDatum<LiquidationsReading> {
  return available("derivatives.total-liquidations", value, scope);
}

function etfFlow(
  asset: "btc" | "eth",
  netFlowUsd: number,
  tradingDate: string,
): AvailableMarketDatum<EtfFlowReading> {
  return available(
    `fund-flows.${asset}-etf`,
    { asset, netFlowUsd, tradingDate },
    asset === "btc" ? BTC_ETF_SCOPE : ETH_ETF_SCOPE,
  );
}

function liveInput(): MarketIndicatorInterpretationInput {
  return {
    btcFunding: funding("btc", 0.0001),
    ethFunding: funding("eth", -0.000075),
    btcOpenInterest: openInterest("btc", {
      notional: 1_250_000_000,
      change24hPercent: 6.2,
      comparisonWindowHours: 24,
    }),
    ethOpenInterest: openInterest("eth", {
      notional: 780_000_000,
      change24hPercent: -2.4,
      comparisonWindowHours: 24,
    }),
    liquidations24h: liquidations(),
    btcEtfFlow: etfFlow("btc", 125_000_000, "2026-09-05"),
    ethEtfFlow: etfFlow("eth", -42_000_000, "2026-09-04"),
  };
}

function failed(capability: MarketCapability): ErrorMarketDatum {
  return {
    status: "error",
    capability,
    value: null,
    source: {
      id: "failed-source",
      label: "Failed source",
      url: "https://example.com/failed",
    },
    scope: VENUE_SCOPE,
    updatedAt: null,
    retrievedAt: RETRIEVED_AT,
    loading: false,
    stale: false,
    cache: {
      status: "bypass",
      revalidateSeconds: 0,
      staleIfErrorSeconds: 0,
    },
    error: { code: "timeout", retryable: true },
  };
}

describe("objective market indicator interpretation", () => {
  it("uses a real 24-hour OI comparison without turning funding into a direction call", () => {
    const result = interpretMarketIndicators(liveInput()).leverage;

    expect(result).toMatchObject({
      id: "leverage",
      title: "永续合约持仓状态",
      headline: "BTC 与 ETH OI 的 24 小时变化方向不同",
      availability: "available",
      stale: false,
      updatedAt: UPDATED_AT,
      coverage: { available: 4, total: 4 },
    });
    expect(result.summary).toContain("BTC OI 较 24 小时前增加 +6.20%");
    expect(result.summary).toContain("ETH OI 较 24 小时前减少 -2.40%");
    expect(result.summary).toContain("BTC 为正费率，多头向空头支付");
    expect(result.summary).toContain("ETH 为负费率，空头向多头支付");
    expect(result.summary).toContain("不等同于价格方向");
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence[2]).toMatchObject({
      label: "BTC 未平仓合约",
      value: "12.50 亿 USDT",
      scope: { kind: "venue" },
    });
    expect(result.watchCondition).toContain("同一合约");
    expect(result.watchCondition).toContain("24 小时 OI");
  });

  it("does not call an absolute OI snapshot crowded, hot, rising, or falling", () => {
    const input = liveInput();
    const result = interpretMarketIndicators({
      ...input,
      btcOpenInterest: openInterest("btc", { notional: 1_250_000_000 }),
      ethOpenInterest: openInterest("eth", { notional: 780_000_000 }),
    }).leverage;

    expect(result.headline).toBe("BTC 与 ETH 资金费率方向不同；OI 暂无可比变化");
    expect(result.availability).toBe("partial");
    expect(result.summary).toContain(
      "没有同口径历史比较时，不能称为杠杆升温、降温或拥挤",
    );
    expect(result.summary).not.toContain("OI 增加");
    expect(result.summary).not.toContain("OI 减少");
  });

  it("requires an explicit 24-hour window before using an OI change", () => {
    const input = liveInput();
    const result = interpretMarketIndicators({
      ...input,
      btcOpenInterest: openInterest("btc", {
        notional: 1_250_000_000,
        change24hPercent: 8,
        comparisonWindowHours: null,
      }),
      ethOpenInterest: unavailableDatum(
        "derivatives.eth-open-interest",
        "no_data",
      ),
    }).leverage;

    expect(result.availability).toBe("partial");
    expect(result.headline).toContain("OI 暂无可比变化");
    expect(result.summary).not.toContain("+8.00%");
  });

  it("accepts a provider-verified approximately 24-hour OI window", () => {
    const input = liveInput();
    const result = interpretMarketIndicators({
      ...input,
      btcOpenInterest: openInterest("btc", {
        notional: 1_250_000_000,
        change24hPercent: 3.4,
        comparisonWindowHours: 23.9,
      }),
    }).leverage;

    expect(result.summary).toContain("BTC OI 较 24 小时前增加 +3.40%");
  });

  it("preserves stale state and uses the oldest displayed timestamp", () => {
    const input = liveInput();
    const old = "2026-09-07T11:45:00.000Z";
    const result = interpretMarketIndicators({
      ...input,
      ethFunding: {
        ...funding("eth", -0.000075),
        status: "stale",
        stale: true,
        updatedAt: old,
        error: { code: "timeout", retryable: true },
      },
    }).leverage;

    expect(result.stale).toBe(true);
    expect(result.updatedAt).toBe(old);
    expect(result.evidence.find((item) => item.label === "ETH 资金费率")?.stale).toBe(
      true,
    );
  });

  it("describes the liquidation side without turning it into a reversal call", () => {
    const result = interpretMarketIndicators(liveInput()).liquidations;

    expect(result).toMatchObject({
      headline: "24 小时多单强平金额高于空单",
      availability: "available",
      coverage: { available: 1, total: 1 },
    });
    expect(result.summary).toContain("$3.80 亿");
    expect(result.summary).toContain("不能单独证明去杠杆已经完成");
    expect(result.summary).toContain("不代表后续一定反转");
    expect(result.evidence[0].scope.kind).toBe("global");
  });

  it("never relabels venue liquidation data as a global market total", () => {
    const input = liveInput();
    const result = interpretMarketIndicators({
      ...input,
      liquidations24h: liquidations(undefined, {
        kind: "venue",
        label: "Example venue liquidations",
      }),
    }).liquidations;

    expect(result.summary).not.toContain("全市场");
    expect(result.summary).not.toContain("多交易所聚合");
    expect(result.evidence[0].detail).toContain("单一交易场所口径");
  });

  it("keeps BTC and ETH ETF dates independent and explains daily-flow limits", () => {
    const result = interpretMarketIndicators(liveInput()).etfFlow;

    expect(result).toMatchObject({
      headline: "BTC ETF 最近交易日净流入；ETH ETF 最近交易日净流出",
      availability: "available",
      coverage: { available: 2, total: 2 },
    });
    expect(result.summary).toContain("BTC ETF 在 2026-09-05 净流入 $1.25 亿");
    expect(result.summary).toContain("ETH ETF 在 2026-09-04 净流出 $4200.00 万");
    expect(result.summary).toContain("不代表盘中价格方向或连续趋势");
    expect(result.watchCondition).toContain("不同日期不会合并");
  });

  it("returns partial coverage when one ETF is unavailable without inserting zero", () => {
    const input = liveInput();
    const result = interpretMarketIndicators({
      ...input,
      ethEtfFlow: unavailableDatum(
        "fund-flows.eth-etf",
        "license_restricted",
      ),
    }).etfFlow;

    expect(result.availability).toBe("partial");
    expect(result.coverage).toEqual({
      available: 1,
      total: 2,
      loading: 0,
      error: 0,
      unavailable: 1,
    });
    expect(result.evidence).toHaveLength(1);
    expect(result.headline).toBe("BTC ETF 最近交易日净流入");
    expect(result.summary).not.toContain("ETH ETF");
  });

  it("separates loading, error, unavailable, and synthetic-blocked states", () => {
    const unavailableInput: MarketIndicatorInterpretationInput = {
      btcFunding: loadingDatum("derivatives.btc-funding"),
      ethFunding: unavailableDatum("derivatives.eth-funding", "no_data"),
      btcOpenInterest: failed("derivatives.btc-open-interest"),
      ethOpenInterest: unavailableDatum(
        "derivatives.eth-open-interest",
        "no_data",
      ),
      liquidations24h: failed("derivatives.total-liquidations"),
      btcEtfFlow: available(
        "fund-flows.btc-etf",
        {
          asset: "btc",
          netFlowUsd: 999,
          tradingDate: "2026-09-05",
        },
        BTC_ETF_SCOPE,
        { provenance: "synthetic" },
      ),
      ethEtfFlow: unavailableDatum("fund-flows.eth-etf", "no_data"),
    };
    const result = interpretMarketIndicators(unavailableInput);

    expect(result.leverage).toMatchObject({
      availability: "loading",
      evidence: [],
      stale: false,
      updatedAt: null,
      coverage: {
        available: 0,
        loading: 1,
        error: 1,
        unavailable: 2,
      },
    });
    expect(result.liquidations.availability).toBe("error");
    expect(result.etfFlow.availability).toBe("unavailable");
    expect(result.etfFlow.evidence).toEqual([]);
    expect(result.etfFlow.summary).toContain("缺失交易日不会被补成零");
    expect(JSON.stringify(result)).not.toContain("999");
  });

  it("contains no automatic trade or probability language", () => {
    const text = JSON.stringify(interpretMarketIndicators(liveInput()));

    for (const forbidden of [
      "开多",
      "开空",
      "买入",
      "卖出",
      "目标价",
      "止损",
      "胜率",
      "概率",
      "投资建议",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
