const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholePrice = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fractionalPrice = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});

const quantity = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
});

export function formatToolMoney(
  value: number,
  currency: "USD" | "USDT" = "USDT",
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${formatWithLowerBound(value, 0.01, money)} ${currency}`;
}

export function formatToolPrice(
  value: number,
  currency: "USD" | "USDT" = "USDT",
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const formatter = Math.abs(value) >= 1 ? wholePrice : fractionalPrice;
  const lowerBound = Math.abs(value) >= 1 ? 0.01 : 0.00000001;
  return `${formatWithLowerBound(value, lowerBound, formatter)} ${currency}`;
}

export function formatToolQuantity(value: number, symbol?: string): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const formatted = formatWithLowerBound(value, 0.00000001, quantity);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatToolPercent(value: number): string {
  return Number.isFinite(value)
    ? `${formatWithLowerBound(value, 0.01, money)}%`
    : "—";
}

export function formatToolRatio(value: number): string {
  return Number.isFinite(value)
    ? `1 : ${formatWithLowerBound(value, 0.01, money)}`
    : "—";
}

function formatWithLowerBound(
  value: number,
  lowerBound: number,
  formatter: Intl.NumberFormat,
): string {
  const absolute = Math.abs(value);
  if (absolute > 0 && absolute < lowerBound) {
    const bound = formatter.format(lowerBound);
    return value < 0 ? `>-${bound}` : `<${bound}`;
  }
  return formatter.format(value);
}
