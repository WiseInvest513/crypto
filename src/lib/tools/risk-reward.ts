import {
  calculationRangeIssue,
  isTradeDirection,
  positiveNumberIssue,
  type ToolCalculationResult,
  type ToolValidationIssue,
  type TradeDirection,
} from "./calculation-result";

export type RiskRewardInput = Readonly<{
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}>;

export type RiskRewardResult = Readonly<{
  direction: TradeDirection;
  riskPerUnit: number;
  rewardPerUnit: number;
  rewardToRiskRatio: number;
  ratio: Readonly<{
    risk: 1;
    reward: number;
  }>;
  model: "price-distance-only";
}>;

export type RiskRewardField = keyof RiskRewardInput | "calculation";

export function calculateRiskReward(
  input: RiskRewardInput,
): ToolCalculationResult<RiskRewardResult, RiskRewardField> {
  const errors: ToolValidationIssue<RiskRewardField>[] = [];
  addIssue(
    errors,
    positiveNumberIssue(input.entryPrice, "entryPrice", "入场价"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.stopPrice, "stopPrice", "止损价"),
  );
  addIssue(
    errors,
    positiveNumberIssue(input.targetPrice, "targetPrice", "目标价"),
  );

  if (!isTradeDirection(input.direction)) {
    errors.push({
      field: "direction",
      code: "invalid_direction",
      message: "方向必须是 long 或 short。",
    });
  }

  if (
    input.direction === "long" &&
    input.entryPrice > 0 &&
    input.stopPrice > 0 &&
    input.targetPrice > 0 &&
    !(input.stopPrice < input.entryPrice && input.entryPrice < input.targetPrice)
  ) {
    errors.push({
      field: "targetPrice",
      code: "invalid_price_order",
      message: "多单价格顺序必须为：止损价 < 入场价 < 目标价。",
    });
  }

  if (
    input.direction === "short" &&
    input.entryPrice > 0 &&
    input.stopPrice > 0 &&
    input.targetPrice > 0 &&
    !(input.targetPrice < input.entryPrice && input.entryPrice < input.stopPrice)
  ) {
    errors.push({
      field: "targetPrice",
      code: "invalid_price_order",
      message: "空单价格顺序必须为：目标价 < 入场价 < 止损价。",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const riskPerUnit = Math.abs(input.entryPrice - input.stopPrice);
  const rewardPerUnit = Math.abs(input.targetPrice - input.entryPrice);
  const rewardToRiskRatio = rewardPerUnit / riskPerUnit;

  if (
    ![riskPerUnit, rewardPerUnit, rewardToRiskRatio].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    return { ok: false, errors: [calculationRangeIssue("calculation")] };
  }

  return {
    ok: true,
    value: {
      direction: input.direction,
      riskPerUnit,
      rewardPerUnit,
      rewardToRiskRatio,
      ratio: {
        risk: 1,
        reward: rewardToRiskRatio,
      },
      model: "price-distance-only",
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
