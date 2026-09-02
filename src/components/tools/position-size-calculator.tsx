"use client";

import { useRef, useState } from "react";
import {
  calculatePositionSize,
  type PositionSizeResult,
} from "@/lib/tools";
import {
  formatToolMoney,
  formatToolPrice,
  formatToolQuantity,
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
  type CalculatorFieldErrors,
} from "./calculator-form-utils";
import { useToolAnalytics } from "./use-tool-analytics";

type PositionForm = {
  balance: string;
  riskPercent: string;
  entryPrice: string;
  stopPrice: string;
  direction: ToolDirection;
  currency: ToolCurrency;
};

const EMPTY_FORM: PositionForm = {
  balance: "",
  riskPercent: "",
  entryPrice: "",
  stopPrice: "",
  direction: "long",
  currency: "USDT",
};

export function PositionSizeCalculator() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<PositionForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<CalculatorFieldErrors>({});
  const [result, setResult] = useState<PositionSizeResult | null>(null);
  const trackComplete = useToolAnalytics(
    "position-size",
    "/tools/position-size",
  );

  function update<Field extends keyof PositionForm>(
    field: Field,
    value: PositionForm[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
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
    const calculation = calculatePositionSize({
      balance: parseCalculatorNumber(form.balance),
      riskPercent: parseCalculatorNumber(form.riskPercent),
      entryPrice: parseCalculatorNumber(form.entryPrice),
      stopPrice: parseCalculatorNumber(form.stopPrice),
      direction: form.direction,
    });

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
        title="设置风险预算"
        description="先定义最多愿意承担的价格距离风险，再反推仓位；所有输入只停留在当前页面。"
      />
      <form className="calculator-form" noValidate onSubmit={submit} ref={formRef}>
        <CalculatorFormSection
          title="账户与风险"
          description="风险比例是你自行设定的情景参数，页面不会提供建议值。"
        >
          <CalculatorField
            id="position-balance"
            label="账户余额"
            hint="用于计算本次计划的最大风险预算。"
            error={errors.balance}
          >
            <input
              {...calculatorInputA11y(
                "position-balance",
                errors.balance,
              )}
              autoComplete="off"
              id="position-balance"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("balance", event.target.value)}
              placeholder="例如 10000"
              step="any"
              type="number"
              value={form.balance}
            />
          </CalculatorField>
          <CalculatorField
            id="position-risk-percent"
            label="最大风险比例（%）"
            hint="必须大于 0 且不超过 100。"
            error={errors.riskPercent}
          >
            <input
              {...calculatorInputA11y(
                "position-risk-percent",
                errors.riskPercent,
              )}
              autoComplete="off"
              id="position-risk-percent"
              inputMode="decimal"
              max="100"
              min="0"
              onChange={(event) => update("riskPercent", event.target.value)}
              placeholder="输入你的风险比例"
              step="any"
              type="number"
              value={form.riskPercent}
            />
          </CalculatorField>
          <CurrencyField
            value={form.currency}
            onChange={(value) => update("currency", value)}
          />
          <DirectionField
            value={form.direction}
            onChange={(value) => update("direction", value)}
          />
        </CalculatorFormSection>

        <CalculatorFormSection
          title="价格计划"
          description="多单止损必须低于入场价；空单止损必须高于入场价。"
        >
          <CalculatorField
            id="position-entry"
            label="入场价"
            hint={`单位：${form.currency}`}
            error={errors.entryPrice}
          >
            <input
              {...calculatorInputA11y(
                "position-entry",
                errors.entryPrice,
              )}
              autoComplete="off"
              id="position-entry"
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
            id="position-stop"
            label="止损价"
            hint={`单位：${form.currency}`}
            error={errors.stopPrice}
          >
            <input
              {...calculatorInputA11y(
                "position-stop",
                errors.stopPrice,
              )}
              autoComplete="off"
              id="position-stop"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("stopPrice", event.target.value)}
              placeholder="输入计划止损价"
              step="any"
              type="number"
              value={form.stopPrice}
            />
          </CalculatorField>
        </CalculatorFormSection>

        {errors.calculation && (
          <p className="calculator-form-error" role="alert">
            {errors.calculation}
          </p>
        )}
        <CalculatorActions onReset={reset} submitLabel="计算仓位" />
      </form>

      <CalculatorResult
        title={result ? "仓位估算" : "等待计算"}
        description="结果按未取整的公式计算，页面仅限制显示精度；不含手续费、滑点与跳空。"
      >
        {result ? (
          <>
            <ResultGrid
              items={[
                {
                  label: "最大风险金额",
                  value: formatToolMoney(result.maxRisk, form.currency),
                  detail: `${form.balance} × ${form.riskPercent}%`,
                },
                {
                  label: "每单位价格风险",
                  value: formatToolPrice(result.riskPerUnit, form.currency),
                  detail: "入场价与止损价的绝对距离",
                },
                {
                  label: "资产数量",
                  value: formatToolQuantity(result.quantity),
                  detail: "实际交易需按市场最小下单单位取整",
                },
                {
                  label: "名义仓位",
                  value: formatToolMoney(result.notional, form.currency),
                  detail: "数量 × 入场价",
                },
              ]}
            />
            <p className="calculator-warning">
              市场跳空、流动性和执行滑点可能令实际亏损超过最大风险金额；此处不代表保证止损成交。
            </p>
          </>
        ) : (
          <ResultEmpty>填写全部字段并提交后显示估算结果。</ResultEmpty>
        )}
      </CalculatorResult>
    </>
  );
}
