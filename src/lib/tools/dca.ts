import {
  calculationRangeIssue,
  positiveNumberIssue,
  type ToolCalculationResult,
  type ToolValidationIssue,
} from "./calculation-result";

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_SCHEDULE_OCCURRENCES = 10_000;

export type DcaSchedule =
  | Readonly<{ frequency: "daily" }>
  | Readonly<{ frequency: "weekly"; dayOfWeek: number }>
  | Readonly<{ frequency: "monthly"; dayOfMonth: number }>;

export type DcaDailyPrice = Readonly<{
  date: string;
  close: number;
}>;

export type DcaInput = Readonly<{
  amountPerPurchase: number;
  startDate: string;
  endDate: string;
  schedule: DcaSchedule;
  dailyPrices: readonly DcaDailyPrice[];
}>;

export type DcaExecution = Readonly<{
  scheduledDate: string;
  executedDate: string;
  usedNextAvailablePrice: boolean;
  amountInvested: number;
  price: number;
  quantity: number;
}>;

export type DcaResult = Readonly<{
  schedule: DcaSchedule;
  scheduledPurchaseCount: number;
  executions: readonly DcaExecution[];
  totalInvested: number;
  totalQuantity: number;
  averageCost: number;
  valuationDate: string;
  valuationPrice: number;
  endingValue: number;
  profitLoss: number;
  returnPercent: number;
  model: "utc-close-price-before-costs";
}>;

export type DcaField =
  | "amountPerPurchase"
  | "startDate"
  | "endDate"
  | "schedule"
  | "dailyPrices"
  | "calculation";

/**
 * Calculates a historical DCA schedule against ascending UTC daily closes.
 * When a scheduled UTC date has no candle, the first later valid candle is
 * used. For monthly schedules, a missing day (for example the 31st in
 * February) becomes that month's final UTC calendar day.
 */
export function calculateDca(
  input: DcaInput,
): ToolCalculationResult<DcaResult, DcaField> {
  const errors: ToolValidationIssue<DcaField>[] = [];
  addIssue(
    errors,
    positiveNumberIssue(
      input.amountPerPurchase,
      "amountPerPurchase",
      "每期投入金额",
    ),
  );

  const startDay = parseUtcDate(input.startDate);
  const endDay = parseUtcDate(input.endDate);

  if (startDay === null) {
    errors.push({
      field: "startDate",
      code: "invalid_utc_date",
      message: "开始日期必须是有效的 UTC 日期（YYYY-MM-DD）。",
    });
  }
  if (endDay === null) {
    errors.push({
      field: "endDate",
      code: "invalid_utc_date",
      message: "结束日期必须是有效的 UTC 日期（YYYY-MM-DD）。",
    });
  }
  if (startDay !== null && endDay !== null && startDay > endDay) {
    errors.push({
      field: "endDate",
      code: "invalid_date_order",
      message: "结束日期不得早于开始日期。",
    });
  }

  const scheduleIssue = validateSchedule(input.schedule);
  if (scheduleIssue !== null) {
    errors.push(scheduleIssue);
  }

  const priceDays = validatePriceSeries(input.dailyPrices, errors);

  if (errors.length > 0 || startDay === null || endDay === null) {
    return { ok: false, errors };
  }

  const scheduledDays = generateScheduleDays(startDay, endDay, input.schedule);
  if (scheduledDays.length > MAX_SCHEDULE_OCCURRENCES) {
    return {
      ok: false,
      errors: [
        {
          field: "schedule",
          code: "schedule_too_large",
          message: `单次计算最多支持 ${MAX_SCHEDULE_OCCURRENCES} 个计划投入日。`,
        },
      ],
    };
  }

  if (scheduledDays.length === 0) {
    return {
      ok: false,
      errors: [
        {
          field: "schedule",
          code: "invalid_schedule",
          message: "所选日期范围内没有计划投入日。",
        },
      ],
    };
  }

  const valuationPricePoint = nextPriceOnOrAfter(priceDays, endDay);
  if (valuationPricePoint === null) {
    return {
      ok: false,
      errors: [
        {
          field: "dailyPrices",
          code: "no_price_data",
          message: "结束日当天或之后缺少可用于期末估值的有效日线。",
        },
      ],
    };
  }

  const executions: DcaExecution[] = [];
  let totalQuantity = 0;

  for (const scheduledDay of scheduledDays) {
    const pricePoint = nextPriceOnOrAfter(priceDays, scheduledDay);
    if (pricePoint === null) {
      return {
        ok: false,
        errors: [
          {
            field: "dailyPrices",
            code: "no_price_data",
            message: "部分计划投入日之后缺少可执行的有效日线。",
          },
        ],
      };
    }

    const quantity = input.amountPerPurchase / pricePoint.close;
    totalQuantity += quantity;
    executions.push({
      scheduledDate: formatUtcDay(scheduledDay),
      executedDate: pricePoint.date,
      usedNextAvailablePrice: pricePoint.day !== scheduledDay,
      amountInvested: input.amountPerPurchase,
      price: pricePoint.close,
      quantity,
    });
  }

  const totalInvested = input.amountPerPurchase * executions.length;
  const averageCost = totalInvested / totalQuantity;
  const endingValue = totalQuantity * valuationPricePoint.close;
  const profitLoss = endingValue - totalInvested;
  const returnPercent = (profitLoss / totalInvested) * 100;

  if (
    ![
      totalInvested,
      totalQuantity,
      averageCost,
      endingValue,
      profitLoss,
      returnPercent,
      ...executions.map((execution) => execution.quantity),
    ].every(Number.isFinite)
  ) {
    return { ok: false, errors: [calculationRangeIssue("calculation")] };
  }

  return {
    ok: true,
    value: {
      schedule: input.schedule,
      scheduledPurchaseCount: executions.length,
      executions,
      totalInvested,
      totalQuantity,
      averageCost,
      valuationDate: valuationPricePoint.date,
      valuationPrice: valuationPricePoint.close,
      endingValue,
      profitLoss,
      returnPercent,
      model: "utc-close-price-before-costs",
    },
  };
}

type ValidatedPricePoint = DcaDailyPrice & Readonly<{ day: number }>;

function validatePriceSeries(
  prices: readonly DcaDailyPrice[],
  errors: ToolValidationIssue<DcaField>[],
): readonly ValidatedPricePoint[] {
  if (prices.length === 0) {
    errors.push({
      field: "dailyPrices",
      code: "no_price_data",
      message: "价格日线必须至少包含一条记录。",
    });
    return [];
  }

  const validated: ValidatedPricePoint[] = [];
  let previousDay = Number.NEGATIVE_INFINITY;

  for (const price of prices) {
    const day = parseUtcDate(price.date);
    if (day === null) {
      errors.push({
        field: "dailyPrices",
        code: "invalid_price_series",
        message: "每条价格日期都必须是有效的 UTC 日期（YYYY-MM-DD）。",
      });
      return [];
    }
    if (day <= previousDay) {
      errors.push({
        field: "dailyPrices",
        code: "invalid_price_series",
        message: "价格日线必须按 UTC 日期严格升序排列且不能重复。",
      });
      return [];
    }
    if (!Number.isFinite(price.close) || price.close <= 0) {
      errors.push({
        field: "dailyPrices",
        code: "invalid_price_series",
        message: "每条日线收盘价都必须是大于 0 的有限数字。",
      });
      return [];
    }

    validated.push({ ...price, day });
    previousDay = day;
  }

  return validated;
}

function validateSchedule(
  schedule: DcaSchedule,
): ToolValidationIssue<DcaField> | null {
  if (schedule.frequency === "daily") {
    return null;
  }
  if (
    schedule.frequency === "weekly" &&
    Number.isInteger(schedule.dayOfWeek) &&
    schedule.dayOfWeek >= 0 &&
    schedule.dayOfWeek <= 6
  ) {
    return null;
  }
  if (
    schedule.frequency === "monthly" &&
    Number.isInteger(schedule.dayOfMonth) &&
    schedule.dayOfMonth >= 1 &&
    schedule.dayOfMonth <= 31
  ) {
    return null;
  }

  return {
    field: "schedule",
    code: "invalid_schedule",
    message: "计划频率或 UTC 周/月投入日无效。",
  };
}

function generateScheduleDays(
  startDay: number,
  endDay: number,
  schedule: DcaSchedule,
): readonly number[] {
  if (schedule.frequency === "daily") {
    const result: number[] = [];
    for (let day = startDay; day <= endDay; day += DAY_MS) {
      result.push(day);
      if (result.length > MAX_SCHEDULE_OCCURRENCES) {
        break;
      }
    }
    return result;
  }

  if (schedule.frequency === "weekly") {
    const startWeekday = new Date(startDay).getUTCDay();
    const offset = (schedule.dayOfWeek - startWeekday + 7) % 7;
    const result: number[] = [];
    for (
      let day = startDay + offset * DAY_MS;
      day <= endDay;
      day += 7 * DAY_MS
    ) {
      result.push(day);
      if (result.length > MAX_SCHEDULE_OCCURRENCES) {
        break;
      }
    }
    return result;
  }

  const start = new Date(startDay);
  const end = new Date(endDay);
  const result: number[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();

  while (
    year < end.getUTCFullYear() ||
    (year === end.getUTCFullYear() && month <= end.getUTCMonth())
  ) {
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dayOfMonth = Math.min(schedule.dayOfMonth, lastDayOfMonth);
    const candidate = Date.UTC(year, month, dayOfMonth);
    if (candidate >= startDay && candidate <= endDay) {
      result.push(candidate);
      if (result.length > MAX_SCHEDULE_OCCURRENCES) {
        break;
      }
    }

    month += 1;
    if (month === 12) {
      year += 1;
      month = 0;
    }
  }

  return result;
}

function nextPriceOnOrAfter(
  prices: readonly ValidatedPricePoint[],
  day: number,
): ValidatedPricePoint | null {
  let low = 0;
  let high = prices.length - 1;
  let match: ValidatedPricePoint | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = prices[middle];
    if (candidate.day >= day) {
      match = candidate;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  return match;
}

function parseUtcDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || formatUtcDay(timestamp) !== value) {
    return null;
  }

  return timestamp;
}

function formatUtcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addIssue<Field extends string>(
  issues: ToolValidationIssue<Field>[],
  issue: ToolValidationIssue<Field> | null,
): void {
  if (issue !== null) {
    issues.push(issue);
  }
}
