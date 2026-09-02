import {
  calculationRangeIssue,
  isTradeDirection,
  positiveNumberIssue,
  type ToolCalculationResult,
  type ToolValidationIssue,
  type TradeDirection,
} from "./calculation-result";

export type PositionSizeInput = Readonly<{
  balance: number;
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  direction: TradeDirection;
}>;

export type PositionSizeResult = Readonly<{
  direction: TradeDirection;
  maxRisk: number;
  riskPerUnit: number;
  quantity: number;
  notional: number;
  model: "price-distance-risk-before-costs";
}>;

export type PositionSizeField =
  | keyof PositionSizeInput
  | "calculation";

/**
 * Calculates position size from a fixed account-risk budget. The result is
 * deliberately unrounded so presentation code can choose precision without
 * changing the risk model.
 */
export function calculatePositionSize(
  input: PositionSizeInput,
): ToolCalculationResult<PositionSizeResult, PositionSizeField> {
  const errors: ToolValidationIssue<PositionSizeField>[] = [];
  addIssue(errors, positiveNumberIssue(input.balance, "balance", "账户余额"));
  addIssue(
    errors,
    positiveNumberIssue(input.riskPercent, "riskPercent", "风险比例"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.entryPrice, "entryPrice", "入场价"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.stopPrice, "stopPrice", "止损价"),
  );

  if (!isTradeDirection(input.direction)) {
    errors.push({
      field: "direction",
      code: "invalid_direction",
      message: "方向必须是 long 或 short。",
    });
  }

  if (Number.isFinite(input.riskPercent) && input.riskPercent > 100) {
    errors.push({
      field: "riskPercent",
      code: "above_maximum",
      message: "风险比例不能超过 100%。",
    });
  }

  if (
    input.direction === "long" &&
    input.entryPrice > 0 &&
    input.stopPrice > 0 &&
    input.stopPrice >= input.entryPrice
  ) {
    errors.push({
      field: "stopPrice",
      code: "invalid_price_order",
      message: "多单止损价必须低于入场价。",
    });
  }

  if (
    input.direction === "short" &&
    input.entryPrice > 0 &&
    input.stopPrice > 0 &&
    input.stopPrice <= input.entryPrice
  ) {
    errors.push({
      field: "stopPrice",
      code: "invalid_price_order",
      message: "空单止损价必须高于入场价。",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const maxRisk = input.balance * (input.riskPercent / 100);
  const riskPerUnit = Math.abs(input.entryPrice - input.stopPrice);
  const quantity = maxRisk / riskPerUnit;
  const notional = quantity * input.entryPrice;

  if (
    ![maxRisk, riskPerUnit, quantity, notional].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    return { ok: false, errors: [calculationRangeIssue("calculation")] };
  }

  return {
    ok: true,
    value: {
      direction: input.direction,
      maxRisk,
      riskPerUnit,
      quantity,
      notional,
      model: "price-distance-risk-before-costs",
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
