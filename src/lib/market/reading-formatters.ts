import type {
  EtfFlowReading,
  FundingReading,
  LiquidationsReading,
  OpenInterestReading,
} from "@/server/data/contracts/market-data";
import {
  formatCompactNumber,
  formatCompactUsd,
  formatFundingRate,
  formatTradingDate,
} from "./formatters";
import type { FormattedDatumValue } from "./homepage-presentation";

export function formatFundingReading(
  value: FundingReading,
): FormattedDatumValue {
  return {
    primary: formatFundingRate(value.rate),
    secondary: `${value.symbol} · ${
      value.intervalHours === null
        ? "结算周期以交易所为准"
        : `${value.intervalHours} 小时结算周期`
    }`,
  };
}

export function formatOpenInterestReading(
  value: OpenInterestReading,
): FormattedDatumValue {
  return {
    primary: `${formatCompactNumber(value.notional)} ${value.quoteCurrency}`,
    secondary: `${value.symbol} · ${formatSamplingPeriod(value.samplingPeriod)} · 单一交易场所名义价值`,
  };
}

export function formatLiquidationsReading(
  value: LiquidationsReading,
): FormattedDatumValue {
  const breakdown =
    value.longUsd !== null && value.shortUsd !== null
      ? `多单 ${formatCompactUsd(value.longUsd)} · 空单 ${formatCompactUsd(value.shortUsd)}`
      : "多空拆分暂不可用";
  return {
    primary: formatCompactUsd(value.totalUsd),
    secondary: `${formatWindow(value.window)}合计 · ${breakdown}`,
  };
}

export function formatEtfFlowReading(
  value: EtfFlowReading,
): FormattedDatumValue {
  return {
    primary: formatCompactUsd(value.netFlowUsd, true),
    secondary: `${formatTradingDate(value.tradingDate)} · 日净流量`,
  };
}

function formatSamplingPeriod(value: string): string {
  return value === "5m" ? "5 分钟样本" : `${value} 样本`;
}

function formatWindow(value: string): string {
  return value === "24h" ? "24 小时" : `${value} `;
}
