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
  formatPercent,
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
  const comparison =
    value.change24hPercent === undefined || value.change24hPercent === null
      ? "24 小时变化暂不可用"
      : `24 小时 ${formatPercent(value.change24hPercent, true)}`;
  return {
    primary: `${formatCompactNumber(value.notional)} ${value.quoteCurrency}`,
    secondary: `${comparison} · ${value.symbol} 单一交易场所`,
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

function formatWindow(value: string): string {
  return value === "24h" ? "24 小时" : `${value} `;
}
