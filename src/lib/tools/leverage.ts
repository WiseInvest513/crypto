import {
  calculationRangeIssue,
  isTradeDirection,
  positiveNumberIssue,
  type ToolCalculationResult,
  type ToolValidationIssue,
  type TradeDirection,
} from "./calculation-result";

export type LeverageInput = Readonly<{
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  notional: number;
  leverage: number;
}>;

export type LeverageResult = Readonly<{
  direction: TradeDirection;
  quantity: number;
  margin: number;
  pnl: number;
  roePercent: number;
  model: "linear-pnl-before-fees-funding-and-liquidation";
}>;

export type LeverageField = keyof LeverageInput | "calculation";

/**
 * Calculates linear position PnL and margin. It deliberately does not calculate
 * an exchange liquidation price: maintenance margin, fees, funding, tiers and
 * position/margin mode are outside this model.
 */
export function calculateLeverage(
  input: LeverageInput,
): ToolCalculationResult<LeverageResult, LeverageField> {
  const errors: ToolValidationIssue<LeverageField>[] = [];
  addIssue(
    errors,
    positiveNumberIssue(input.entryPrice, "entryPrice", "入场价"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.exitPrice, "exitPrice", "退出价"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.notional, "notional", "仓位名义价值"),
  );
  addIssue(errors, positiveNumberIssue(input.leverage, "leverage", "杠杆倍数"));

  if (!isTradeDirection(input.direction)) {
    errors.push({
      field: "direction",
      code: "invalid_direction",
      message: "方向必须是 long 或 short。",
    });
  }

  if (Number.isFinite(input.leverage) && input.leverage > 0 && input.leverage < 1) {
    errors.push({
      field: "leverage",
      code: "below_minimum",
      message: "杠杆倍数必须大于等于 1。",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const quantity = input.notional / input.entryPrice;
  const margin = input.notional / input.leverage;
  const pnl =
    input.direction === "long"
      ? (input.exitPrice - input.entryPrice) * quantity
      : (input.entryPrice - input.exitPrice) * quantity;
  const roePercent = (pnl / margin) * 100;

  if (
    ![quantity, margin].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    ![pnl, roePercent].every(Number.isFinite)
  ) {
    return { ok: false, errors: [calculationRangeIssue("calculation")] };
  }

  return {
    ok: true,
    value: {
      direction: input.direction,
      quantity,
      margin,
      pnl,
      roePercent,
      model: "linear-pnl-before-fees-funding-and-liquidation",
    },
  };
}

function addIssue<Field extends string>(
  issues: ToolValidationIssue<Field>[],
  issue: ToolValidationIssue<Field> | null,
): void {
  if (issue !== null) {
    issues.push(issue);
  }
}
