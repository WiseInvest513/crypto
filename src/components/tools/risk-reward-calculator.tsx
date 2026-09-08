"use client";

import { useRef, useState } from "react";
import { calculateRiskReward, type RiskRewardResult } from "@/lib/tools";
import {
  formatToolPrice,
  formatToolRatio,
} from "@/lib/tools/formatters";
import {
  CalculatorActions,
  CalculatorField,
  CalculatorFormSection,
  CalculatorIntro,
  CalculatorResult,
  CurrencyField,
  DirectionField,
  ResultEmpty,
  ResultGrid,
  type ToolCurrency,
  type ToolDirection,
} from "./calculator-ui";
import {
  calculatorInputA11y,
  focusFirstCalculatorError,
  mapCalculatorErrors,
  parseCalculatorNumber,
  revalidateCalculatorErrors,
  type CalculatorFieldErrors,
} from "./calculator-form-utils";
import { useToolAnalytics } from "./use-tool-analytics";

type RiskRewardForm = {
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  direction: ToolDirection;
  currency: ToolCurrency;
};

const EMPTY_FORM: RiskRewardForm = {
  entryPrice: "",
  stopPrice: "",
  targetPrice: "",
  direction: "long",
  currency: "USDT",
};

const RISK_REWARD_RELATION_FIELDS = new Set<keyof RiskRewardForm>([
  "direction",
  "entryPrice",
  "stopPrice",
  "targetPrice",
]);

function calculateRiskRewardForm(form: RiskRewardForm) {
  return calculateRiskReward({
    direction: form.direction,
    entryPrice: parseCalculatorNumber(form.entryPrice),
    stopPrice: parseCalculatorNumber(form.stopPrice),
    targetPrice: parseCalculatorNumber(form.targetPrice),
  });
}

export function RiskRewardCalculator() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<RiskRewardForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<CalculatorFieldErrors>({});
  const [result, setResult] = useState<RiskRewardResult | null>(null);
  const trackComplete = useToolAnalytics(
    "risk-reward",
    "/tools/risk-reward",
  );

  function update<Field extends keyof RiskRewardForm>(
    field: Field,
    value: RiskRewardForm[Field],
  ) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setErrors((current) => {
      if (RISK_REWARD_RELATION_FIELDS.has(field)) {
        return revalidateCalculatorErrors(
          current,
          calculateRiskRewardForm(nextForm),
        );
      }

      const { [field]: _removed, calculation: _calculation, ...rest } = current;
      void _removed;
      void _calculation;
      return rest;
    });
    setResult(null);
  }

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
    setResult(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const calculation = calculateRiskRewardForm(form);

    if (!calculation.ok) {
      setResult(null);
      setErrors(mapCalculatorErrors(calculation.errors));
      focusFirstCalculatorError(formRef.current);
      return;
    }

    setErrors({});
    setResult(calculation.value);
    trackComplete();
  }

  return (
    <>
      <CalculatorIntro
        title="检查价格结构"
        description="分别校验做多或做空的入场、止损与目标价顺序，再比较单位风险和潜在回报。"
      />
      <form className="calculator-form" noValidate onSubmit={submit} ref={formRef}>
        <CalculatorFormSection
          title="交易情景"
          description="方向、止损和目标都由你输入，页面不会提供推荐价位。"
        >
          <CurrencyField
            value={form.currency}
            onChange={(value) => update("currency", value)}
          />
          <DirectionField
            value={form.direction}
            onChange={(value) => update("direction", value)}
          />
          <CalculatorField
            id="risk-reward-entry"
            label="入场价"
            hint={`单位：${form.currency}`}
            error={errors.entryPrice}
          >
            <input
              {...calculatorInputA11y(
                "risk-reward-entry",
                errors.entryPrice,
              )}
              autoComplete="off"
              id="risk-reward-entry"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("entryPrice", event.target.value)}
              placeholder="输入计划入场价"
              step="any"
              type="number"
              value={form.entryPrice}
            />
          </CalculatorField>
          <CalculatorField
            id="risk-reward-stop"
            label="止损价"
            hint={`单位：${form.currency}`}
            error={errors.stopPrice}
          >
            <input
              {...calculatorInputA11y(
                "risk-reward-stop",
                errors.stopPrice,
              )}
              autoComplete="off"
              id="risk-reward-stop"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("stopPrice", event.target.value)}
              placeholder="输入计划止损价"
              step="any"
              type="number"
              value={form.stopPrice}
            />
          </CalculatorField>
          <CalculatorField
            id="risk-reward-target"
            label="目标价"
            hint={`单位：${form.currency}`}
            error={errors.targetPrice}
            full
          >
            <input
              {...calculatorInputA11y(
                "risk-reward-target",
                errors.targetPrice,
              )}
              autoComplete="off"
              id="risk-reward-target"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("targetPrice", event.target.value)}
              placeholder="输入情景目标价"
              step="any"
              type="number"
              value={form.targetPrice}
            />
          </CalculatorField>
        </CalculatorFormSection>

        {errors.calculation && (
          <p className="calculator-form-error" role="alert">
            {errors.calculation}
          </p>
        )}
        <CalculatorActions onReset={reset} submitLabel="计算风险回报" />
      </form>

      <CalculatorResult
        title={result ? "价格距离比较" : "等待计算"}
        description="比值只比较你输入的价格距离，不包含成交概率、仓位、手续费、滑点或跳空。"
        ready={Boolean(result)}
        resultKey={result}
        announcement={
          result
            ? `风险回报估算已更新。风险回报 ${formatToolRatio(result.rewardToRiskRatio)}。`
            : ""
        }
      >
        {result ? (
          <>
            <ResultGrid
              items={[
                {
                  label: "风险 / 回报",
                  value: formatToolRatio(result.rewardToRiskRatio),
                  detail: "每承担 1 单位价格风险对应的情景回报",
                  tone: "neutral",
                  primary: true,
                },
                {
                  label: "每单位风险",
                  value: formatToolPrice(result.riskPerUnit, form.currency),
                  detail: "入场价与止损价的绝对距离",
                },
                {
                  label: "每单位潜在回报",
                  value: formatToolPrice(result.rewardPerUnit, form.currency),
                  detail: "目标价与入场价的绝对距离",
                },
              ]}
            />
            <p className="calculator-warning">
              风险回报比高不代表交易胜率高；止损和目标价只是你的输入假设，不是 Wise Crypto 的投资判断。
            </p>
          </>
        ) : (
          <ResultEmpty>填写全部字段并提交后显示价格距离比较。</ResultEmpty>
        )}
      </CalculatorResult>
    </>
  );
}
