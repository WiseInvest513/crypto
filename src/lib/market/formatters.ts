const usdPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const groupedNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export type ValueDirection = "positive" | "negative" | "flat" | "neutral";

export function formatUsdPrice(value: number): string {
  return isFiniteNumber(value) ? usdPriceFormatter.format(value) : "—";
}

export function formatCompactUsd(value: number, signed = false): string {
  const parts = compactNumberParts(value, signed);
  if (parts === null) {
    return "—";
  }

  return `${parts.sign}$${parts.amount}${parts.suffix}`;
}

export function formatCompactNumber(value: number, signed = false): string {
  const parts = compactNumberParts(value, signed);
  if (parts === null) {
    return "—";
  }

  return `${parts.sign}${parts.amount}${parts.suffix}`;
}

function compactNumberParts(
  value: number,
  signed: boolean,
): { sign: string; amount: string; suffix: string } | null {
  if (!isFiniteNumber(value)) {
    return null;
  }

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : signed && value > 0 ? "+" : "";
  const scales = [
    { divisor: 1, suffix: "" },
    { divisor: 10_000, suffix: " 万" },
    { divisor: 100_000_000, suffix: " 亿" },
    { divisor: 1_000_000_000_000, suffix: " 万亿" },
  ] as const;
  let scaleIndex = scales.length - 1;
  for (let index = 1; index < scales.length; index += 1) {
    if (absolute < scales[index].divisor) {
      scaleIndex = index - 1;
      break;
    }
  }

  const nextScale = scales[scaleIndex + 1];
  const selectedScale = scales[scaleIndex];
  const roundedAmount = Number(
    (absolute / selectedScale.divisor).toFixed(2),
  );

  // Do not render values such as `10000.00 万` when rounding crosses the next
  // Chinese compact-number boundary. Promote the unit before formatting.
  if (
    nextScale &&
    roundedAmount >= nextScale.divisor / selectedScale.divisor
  ) {
    scaleIndex += 1;
  }

  const scale = scales[scaleIndex];

  const amount = absolute / scale.divisor;
  const formatted =
    scale.divisor === 1
      ? groupedNumberFormatter.format(amount)
      : amount.toFixed(2);

  return { sign, amount: formatted, suffix: scale.suffix };
}

export function formatPercent(value: number, signed = false): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatFundingRate(value: number): string {
  return isFiniteNumber(value) ? `${(value * 100).toFixed(4)}%` : "—";
}

export function formatEthBtcRatio(value: number): string {
  return isFiniteNumber(value) ? `${value.toFixed(5)} BTC` : "—";
}

export function formatIndexValue(value: number): string {
  return isFiniteNumber(value) ? Math.round(value).toString() : "—";
}

export function directionFor(value: number | null): ValueDirection {
  if (!isFiniteNumber(value)) {
    return "neutral";
  }
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "flat";
}

export function translateSentimentClassification(value: string): string {
  const classifications: Record<string, string> = {
    "extreme fear": "极度恐慌",
    fear: "恐慌",
    neutral: "中性",
    greed: "贪婪",
    "extreme greed": "极度贪婪",
  };

  return classifications[value.trim().toLowerCase()] ?? "供应商分类未识别";
}

export function formatUtcDateTime(value: string | null): string {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) {
    return "—";
  }

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function normalizeIsoTimestamp(value: string | null): string | null {
  const timestamp = parseTimestamp(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function formatTradingDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "—";
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
    ? value
    : "—";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseTimestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
