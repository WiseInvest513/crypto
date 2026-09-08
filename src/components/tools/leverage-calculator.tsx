"use client";

import { useRef, useState } from "react";
import { calculateLeverage, type LeverageResult } from "@/lib/tools";
import {
  formatToolMoney,
  formatToolPercent,
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

type LeverageForm = {
  entryPrice: string;
  exitPrice: string;
  notional: string;
  leverage: string;
  direction: ToolDirection;
  currency: ToolCurrency;
};

const EMPTY_FORM: LeverageForm = {
  entryPrice: "",
  exitPrice: "",
  notional: "",
  leverage: "",
  direction: "long",
  currency: "USDT",
};

export function LeverageCalculator() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<LeverageForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<CalculatorFieldErrors>({});
  const [result, setResult] = useState<LeverageResult | null>(null);
  const trackComplete = useToolAnalytics("leverage", "/tools/leverage");

  function update<Field extends keyof LeverageForm>(
    field: Field,
    value: LeverageForm[Field],
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
    const calculation = calculateLeverage({
      direction: form.direction,
      entryPrice: parseCalculatorNumber(form.entryPrice),
      exitPrice: parseCalculatorNumber(form.exitPrice),
      notional: parseCalculatorNumber(form.notional),
      leverage: parseCalculatorNumber(form.leverage),
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

  const pnlTone = result
    ? result.pnl > 0
      ? "positive"
      : result.pnl < 0
        ? "negative"
        : "neutral"
    : "neutral";

  return (
    <>
      <CalculatorIntro
        title="先拆解保证金与价格情景"
        description="估算初始保证金和线性价格盈亏；本工具不会计算交易所强平价。"
      />
      <form className="calculator-form" noValidate onSubmit={submit} ref={formRef}>
        <CalculatorFormSection
          title="仓位设置"
          description="杠杆倍数必须至少为 1；页面不会提供默认杠杆建议。"
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
            id="leverage-notional"
            label="仓位名义价值"
            hint={`仓位对应的标的总价值，不是投入保证金；单位：${form.currency}`}
            error={errors.notional}
          >
            <input
              {...calculatorInputA11y(
                "leverage-notional",
                errors.notional,
              )}
              autoComplete="off"
              id="leverage-notional"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("notional", event.target.value)}
              placeholder="输入名义仓位"
              step="any"
              type="number"
              value={form.notional}
            />
          </CalculatorField>
          <CalculatorField
            id="leverage-multiple"
            label="杠杆倍数（x）"
            hint="仅用于初始保证金和 ROE 估算。"
            error={errors.leverage}
          >
            <input
              {...calculatorInputA11y(
                "leverage-multiple",
                errors.leverage,
              )}
              autoComplete="off"
              id="leverage-multiple"
              inputMode="decimal"
              min="1"
              onChange={(event) => update("leverage", event.target.value)}
              placeholder="输入杠杆倍数"
              step="any"
              type="number"
              value={form.leverage}
            />
          </CalculatorField>
        </CalculatorFormSection>

        <CalculatorFormSection
          title="价格情景"
          description="退出价只是你输入的假设，不代表价格预测或成交保证。"
        >
          <CalculatorField
            id="leverage-entry"
            label="入场价"
            hint={`单位：${form.currency}`}
            error={errors.entryPrice}
          >
            <input
              {...calculatorInputA11y(
                "leverage-entry",
                errors.entryPrice,
              )}
              autoComplete="off"
              id="leverage-entry"
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
            id="leverage-exit"
            label="退出价"
            hint={`单位：${form.currency}`}
            error={errors.exitPrice}
          >
            <input
              {...calculatorInputA11y(
                "leverage-exit",
                errors.exitPrice,
              )}
              autoComplete="off"
              id="leverage-exit"
              inputMode="decimal"
              min="0"
              onChange={(event) => update("exitPrice", event.target.value)}
              placeholder="输入情景退出价"
              step="any"
              type="number"
              value={form.exitPrice}
            />
          </CalculatorField>
        </CalculatorFormSection>

        {errors.calculation && (
          <p className="calculator-form-error" role="alert">
            {errors.calculation}
          </p>
        )}
        <CalculatorActions onReset={reset} submitLabel="计算杠杆结果" />
      </form>

      <CalculatorResult
        title={result ? "保证金与盈亏估算" : "等待计算"}
        description="这是线性价格变化模型，不包含交易所的维持保证金、资金费与费用规则。"
        ready={Boolean(result)}
        resultKey={result}
        announcement={
          result
            ? `杠杆估算已更新。初始保证金 ${formatToolMoney(result.margin, form.currency)}。`
            : ""
        }
      >
        {result ? (
          <ResultGrid
            items={[
              {
                label: "初始保证金",
                value: formatToolMoney(result.margin, form.currency),
                detail: "名义仓位 ÷ 杠杆倍数",
                primary: true,
              },
              {
                label: "情景盈亏",
                value: formatToolMoney(result.pnl, form.currency),
                detail: "未扣手续费与资金费",
                tone: pnlTone,
              },
              {
                label: "仓位数量",
                value: formatToolQuantity(result.quantity),
                detail: "名义仓位 ÷ 入场价",
              },
              {
                label: "保证金 ROE",
                value: formatToolPercent(result.roePercent),
                detail: "情景盈亏 ÷ 初始保证金；不是账户收益率",
                tone: pnlTone,
              },
            ]}
          />
        ) : (
          <ResultEmpty>填写全部字段并提交后显示估算结果。</ResultEmpty>
        )}
        <p className="calculator-warning">
          V0 不计算强平价。不同交易所的维持保证金档位、逐仓/全仓模式、费用、资金费和风险限额不同，实际仓位可能在情景退出价之前被强平；ROE 也不是账户收益率。
        </p>
      </CalculatorResult>
    </>
  );
}
