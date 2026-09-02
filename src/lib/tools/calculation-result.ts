export type TradeDirection = "long" | "short";

export type ToolValidationCode =
  | "invalid_direction"
  | "not_finite"
  | "must_be_positive"
  | "below_minimum"
  | "above_maximum"
  | "invalid_price_order"
  | "invalid_utc_date"
  | "invalid_date_order"
  | "invalid_schedule"
  | "invalid_price_series"
  | "no_price_data"
  | "schedule_too_large"
  | "calculation_out_of_range";

export type ToolValidationIssue<Field extends string = string> = Readonly<{
  field: Field;
  code: ToolValidationCode;
  message: string;
}>;

export type ToolCalculationResult<T, Field extends string = string> =
  | Readonly<{
      ok: true;
      value: T;
    }>
  | Readonly<{
      ok: false;
      errors: readonly ToolValidationIssue<Field>[];
    }>;

export function isTradeDirection(value: unknown): value is TradeDirection {
  return value === "long" || value === "short";
}

export function positiveNumberIssue<Field extends string>(
  value: number,
  field: Field,
  label: string,
): ToolValidationIssue<Field> | null {
  if (!Number.isFinite(value)) {
    return {
      field,
      code: "not_finite",
      message: `${label}必须是有限数字。`,
    };
  }

  if (value <= 0) {
    return {
      field,
      code: "must_be_positive",
      message: `${label}必须大于 0。`,
    };
  }

  return null;
}

export function calculationRangeIssue<Field extends string>(
  field: Field,
): ToolValidationIssue<Field> {
  return {
    field,
    code: "calculation_out_of_range",
    message: "输入数值过大，计算结果超出可可靠表示的范围。",
  };
}
