"use client";

import { useRef, useState } from "react";
import {
  calculateDca,
  type DcaResult,
  type DcaSchedule,
} from "@/lib/tools";
import type {
  DcaMarketAsset,
  DcaMarketDataset,
  DcaMarketHistory,
} from "@/lib/tools/dca-market-data";
import {
  formatToolMoney,
  formatToolPercent,
  formatToolPrice,
  formatToolQuantity,
} from "@/lib/tools/formatters";
import {
  CalculatorActions,
  CalculatorField,
  CalculatorFormSection,
  CalculatorIntro,
  CalculatorResult,
  ResultEmpty,
  ResultGrid,
} from "./calculator-ui";
import {
  calculatorInputA11y,
  focusFirstCalculatorError,
  mapCalculatorErrors,
  parseCalculatorNumber,
  type CalculatorFieldErrors,
} from "./calculator-form-utils";
import { useToolAnalytics } from "./use-tool-analytics";

type DcaFrequency = DcaSchedule["frequency"];

type DcaForm = {
  asset: DcaMarketAsset;
  amountPerPurchase: string;
  startDate: string;
  endDate: string;
  frequency: DcaFrequency;
  dayOfWeek: string;
  dayOfMonth: string;
};

const EMPTY_FORM: DcaForm = {
  asset: "btc",
  amountPerPurchase: "",
  startDate: "",
  endDate: "",
  frequency: "monthly",
  dayOfWeek: "1",
  dayOfMonth: "",
};

function createEmptyForm(initialAsset: DcaMarketAsset): DcaForm {
  return { ...EMPTY_FORM, asset: initialAsset };
}

const UTC_WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

export function DcaCalculator({
  datasets,
  initialAsset = "btc",
}: {
  datasets: DcaMarketHistory;
  initialAsset?: DcaMarketAsset;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<DcaForm>(() => createEmptyForm(initialAsset));
  const [errors, setErrors] = useState<CalculatorFieldErrors>({});
  const [result, setResult] = useState<DcaResult | null>(null);
  const trackComplete = useToolAnalytics("dca", "/tools/dca");
  const dataset = datasets[form.asset];
  const available = isDatasetAvailable(dataset);
  const firstPriceDate = dataset.prices.at(0)?.date;
  const lastPriceDate = dataset.prices.at(-1)?.date;

  function update<Field extends keyof DcaForm>(
    field: Field,
    value: DcaForm[Field],
  ) {
    setForm((current) => {
      if (field === "asset") {
        return {
          ...current,
          asset: value as DcaMarketAsset,
          startDate: "",
          endDate: "",
        };
      }
      return { ...current, [field]: value };
    });
    setErrors((current) => {
      const {
        [field]: _removed,
        dailyPrices: _dailyPrices,
        calculation: _calculation,
        schedule: _schedule,
        ...rest
      } = current;
      void _removed;
      void _dailyPrices;
      void _calculation;
      void _schedule;
      return rest;
    });
    setResult(null);
  }

  function reset() {
    setForm(createEmptyForm(initialAsset));
    setErrors({});
    setResult(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rangeErrors = validateSelectedRange(
      form.startDate,
      form.endDate,
      firstPriceDate,
      lastPriceDate,
    );
    if (Object.keys(rangeErrors).length > 0) {
      setResult(null);
      setErrors(rangeErrors);
      focusFirstCalculatorError(formRef.current);
      return;
    }

    const calculation = calculateDca({
      amountPerPurchase: parseCalculatorNumber(form.amountPerPurchase),
      startDate: form.startDate,
      endDate: form.endDate,
      schedule: toDcaSchedule(form),
      dailyPrices: dataset.prices,
    });

    if (!calculation.ok) {
      setResult(null);
      setErrors(mapDcaErrors(calculation.errors, form.frequency));
      focusFirstCalculatorError(formRef.current);
      return;
    }

    setErrors({});
    setResult(calculation.value);
    trackComplete();
  }

  const resultTone = result
    ? result.profitLoss > 0
      ? "positive"
      : result.profitLoss < 0
        ? "negative"
        : "neutral"
    : "neutral";

  return (
    <>
      <CalculatorIntro
        title="回看历史定投"
        description="选择 BTC 或 ETH，用 Binance 现货已闭合 UTC 日线逐期计算；不使用盘中价格或模拟行情。"
      />
      <DcaDatasetMeta dataset={dataset} />

      <form className="calculator-form" noValidate onSubmit={submit} ref={formRef}>
        <CalculatorFormSection
          title="资产与投入节奏"
          description="先选择资产、每期金额和 UTC 投入频率；页面不会提供推荐金额。"
        >
          <CalculatorField
            id="dca-asset"
            label="回测资产"
            hint="数据源：Binance BTCUSDT / ETHUSDT 现货。"
          >
            <select
              aria-describedby="dca-asset-hint"
              id="dca-asset"
              onChange={(event) =>
                update("asset", event.target.value as DcaMarketAsset)
              }
              value={form.asset}
            >
              <option value="btc">BTC / USDT</option>
              <option value="eth">ETH / USDT</option>
            </select>
          </CalculatorField>
          <CalculatorField
            id="dca-amount"
            label="每期投入金额（USDT）"
            hint="每个计划日使用相同投入金额。"
            error={errors.amountPerPurchase}
          >
            <input
              {...calculatorInputA11y(
                "dca-amount",
                errors.amountPerPurchase,
              )}
              autoComplete="off"
              id="dca-amount"
              inputMode="decimal"
              min="0"
              onChange={(event) =>
                update("amountPerPurchase", event.target.value)
              }
              placeholder="输入每期投入"
              step="any"
              type="number"
              value={form.amountPerPurchase}
            />
          </CalculatorField>
          <CalculatorField
            id="dca-frequency"
            label="投入频率"
            hint="所有周期都按 UTC 日历生成。"
            error={errors.schedule}
          >
            <select
              {...calculatorInputA11y("dca-frequency", errors.schedule)}
              id="dca-frequency"
              onChange={(event) =>
                update("frequency", event.target.value as DcaFrequency)
              }
              value={form.frequency}
            >
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </CalculatorField>

          {form.frequency === "weekly" && (
            <CalculatorField
              id="dca-weekday"
              label="每周投入日（UTC）"
              hint="星期按 UTC 日历计算，不随本地时区变化。"
              error={errors.dayOfWeek}
            >
              <select
                {...calculatorInputA11y(
                  "dca-weekday",
                  errors.dayOfWeek,
                )}
                id="dca-weekday"
                onChange={(event) => update("dayOfWeek", event.target.value)}
                value={form.dayOfWeek}
              >
                {UTC_WEEKDAYS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </CalculatorField>
          )}

          {form.frequency === "monthly" && (
            <CalculatorField
              id="dca-month-day"
              label="每月投入日（UTC）"
              hint="填写 1–31；若当月没有该日期，则使用当月月末。"
              error={errors.dayOfMonth}
            >
              <input
                {...calculatorInputA11y(
                  "dca-month-day",
                  errors.dayOfMonth,
                )}
                autoComplete="off"
                id="dca-month-day"
                inputMode="numeric"
                max="31"
                min="1"
                onChange={(event) => update("dayOfMonth", event.target.value)}
                placeholder="1–31"
                step="1"
                type="number"
                value={form.dayOfMonth}
              />
            </CalculatorField>
          )}
        </CalculatorFormSection>

        <CalculatorFormSection
          title="UTC 日期区间"
          description={
            firstPriceDate && lastPriceDate
              ? `可用已闭合日线：${firstPriceDate} 至 ${lastPriceDate}（UTC）`
              : "当前资产没有可用于计算的已闭合日线。"
          }
        >
          <CalculatorField
            id="dca-start-date"
            label="开始日期（UTC）"
            hint="必须位于可用日线范围内。"
            error={errors.startDate}
          >
            <input
              {...calculatorInputA11y(
                "dca-start-date",
                errors.startDate,
              )}
              id="dca-start-date"
              max={lastPriceDate}
              min={firstPriceDate}
              onChange={(event) => update("startDate", event.target.value)}
              type="date"
              value={form.startDate}
            />
          </CalculatorField>
          <CalculatorField
            id="dca-end-date"
            label="结束日期（UTC）"
            hint="期末估值使用当天或之后第一根有效日线。"
            error={errors.endDate}
          >
            <input
              {...calculatorInputA11y("dca-end-date", errors.endDate)}
              id="dca-end-date"
              max={lastPriceDate}
              min={firstPriceDate}
              onChange={(event) => update("endDate", event.target.value)}
              type="date"
              value={form.endDate}
            />
          </CalculatorField>
        </CalculatorFormSection>

        {(errors.dailyPrices || errors.calculation) && (
          <p className="calculator-form-error" role="alert">
            {errors.dailyPrices ?? errors.calculation}
          </p>
        )}
        <CalculatorActions
          onReset={reset}
          submitDisabled={!available}
          submitLabel={available ? "计算历史定投" : "行情暂不可用"}
        />
      </form>

      <CalculatorResult
        title={result ? "历史定投结果" : "等待计算"}
        description="每次执行使用计划日当天或之后第一根有效的 Binance 已闭合日线收盘价。"
        ready={Boolean(result)}
        resultKey={result}
        announcement={
          result
            ? `历史定投结果已更新。期末价值 ${formatToolMoney(result.endingValue, "USDT")}。`
            : ""
        }
      >
        {result ? (
          <>
            <ResultGrid
              items={[
                {
                  label: "期末价值（历史）",
                  value: formatToolMoney(result.endingValue, "USDT"),
                  detail: `${result.valuationDate} UTC · 收盘 ${formatToolPrice(
                    result.valuationPrice,
                    "USDT",
                  )}`,
                  primary: true,
                },
                {
                  label: "总投入",
                  value: formatToolMoney(result.totalInvested, "USDT"),
                  detail: `${result.scheduledPurchaseCount} 期已执行`,
                },
                {
                  label: `累计 ${dataset.asset.toUpperCase()} 数量`,
                  value: formatToolQuantity(
                    result.totalQuantity,
                    dataset.asset.toUpperCase(),
                  ),
                  detail: "未计交易数量精度与最小下单限制",
                },
                {
                  label: "平均成本",
                  value: formatToolPrice(result.averageCost, "USDT"),
                  detail: "总投入 ÷ 累计数量",
                },
                {
                  label: "历史盈亏",
                  value: formatToolMoney(result.profitLoss, "USDT"),
                  detail: "期末价值 − 总投入",
                  tone: resultTone,
                },
                {
                  label: "历史收益率",
                  value: formatToolPercent(result.returnPercent),
                  detail: "历史盈亏 ÷ 总投入；不代表未来结果",
                  tone: resultTone,
                },
              ]}
            />
            <DcaExecutionDetails
              asset={dataset.asset}
              result={result}
            />
            <p className="calculator-warning">
              这是基于历史已闭合日线的机械回看，不是收益预测；未包含手续费、点差、税务、质押收益、下单精度和实际成交差异。
            </p>
          </>
        ) : (
          <ResultEmpty>
            {available
              ? "设置金额、UTC 日期和频率后提交，页面才会生成历史结果。"
              : "当前无法取得可靠的 Binance 已闭合日线，因此不生成任何替代或模拟结果。"}
          </ResultEmpty>
        )}
      </CalculatorResult>
    </>
  );
}

function DcaDatasetMeta({ dataset }: { dataset: DcaMarketDataset }) {
  const statusCopy = getDatasetStatusCopy(dataset);
  const firstDate = dataset.prices.at(0)?.date;
  const lastDate = dataset.prices.at(-1)?.date;
  const assetLabel = dataset.asset.toUpperCase();
  const rangeLabel =
    firstDate && lastDate
      ? `${firstDate} 至 ${lastDate}`
      : "当前没有可用日期区间";

  return (
    <section
      className={`dca-data-state dca-data-state--${dataset.status}`}
      aria-label="DCA 行情数据状态"
    >
      <div className="dca-data-state__summary">
        <strong>
          {assetLabel} · {dataset.prices.length} 根已闭合日线
        </strong>
        <span>{statusCopy.label} · {rangeLabel}</span>
      </div>
      <details
        className="dca-data-state__details"
        open={dataset.status === "error" || dataset.status === "unavailable"}
      >
        <summary>查看完整数据口径</summary>
        <p>{statusCopy.detail}</p>
        <dl>
          <div>
            <dt>来源</dt>
            <dd>
              {dataset.source ? (
                <a
                  href={dataset.source.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {dataset.source.label}
                  <span className="sr-only">（在新标签页打开）</span>
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>口径</dt>
            <dd>{dataset.scope?.label ?? `${dataset.symbol} 现货日线`}</dd>
          </div>
          <div>
            <dt>数据截至</dt>
            <dd>{formatUtcTimestamp(dataset.updatedAt)}</dd>
          </div>
          <div>
            <dt>获取时间</dt>
            <dd>{formatUtcTimestamp(dataset.retrievedAt)}</dd>
          </div>
          <div>
            <dt>缓存</dt>
            <dd>{formatCacheState(dataset)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

function DcaExecutionDetails({
  asset,
  result,
}: {
  asset: DcaMarketAsset;
  result: DcaResult;
}) {
  const symbol = asset.toUpperCase();

  return (
    <details className="dca-executions">
      <summary>查看 {result.executions.length} 笔执行明细</summary>
      <div
        className="dca-executions__scroll"
        role="region"
        tabIndex={0}
        aria-label={`${symbol} 定投执行明细，可横向滚动`}
      >
        <table>
          <caption>
            计划日、实际采用日及 Binance 已闭合 UTC 日线收盘价
          </caption>
          <thead>
            <tr>
              <th scope="col">计划日</th>
              <th scope="col">采用日</th>
              <th scope="col">每期投入</th>
              <th scope="col">收盘价</th>
              <th scope="col">买入数量</th>
            </tr>
          </thead>
          <tbody>
            {result.executions.map((execution) => (
              <tr key={`${execution.scheduledDate}-${execution.executedDate}`}>
                <td>{execution.scheduledDate}</td>
                <td>
                  {execution.executedDate}
                  {execution.usedNextAvailablePrice && (
                    <small>下一根有效日线</small>
                  )}
                </td>
                <td>{formatToolMoney(execution.amountInvested, "USDT")}</td>
                <td>{formatToolPrice(execution.price, "USDT")}</td>
                <td>{formatToolQuantity(execution.quantity, symbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function isDatasetAvailable(dataset: DcaMarketDataset): boolean {
  return (
    (dataset.status === "fresh" || dataset.status === "stale") &&
    dataset.prices.length > 0
  );
}

function toDcaSchedule(form: DcaForm): DcaSchedule {
  if (form.frequency === "daily") {
    return { frequency: "daily" };
  }
  if (form.frequency === "weekly") {
    return {
      frequency: "weekly",
      dayOfWeek: parseCalculatorNumber(form.dayOfWeek),
    };
  }
  return {
    frequency: "monthly",
    dayOfMonth: parseCalculatorNumber(form.dayOfMonth),
  };
}

function mapDcaErrors(
  issues: Parameters<typeof mapCalculatorErrors>[0],
  frequency: DcaFrequency,
): CalculatorFieldErrors {
  const mapped = mapCalculatorErrors(issues);
  if (!mapped.schedule) {
    return mapped;
  }

  const { schedule, ...rest } = mapped;
  if (frequency === "weekly") {
    return { ...rest, dayOfWeek: schedule };
  }
  if (frequency === "monthly") {
    return { ...rest, dayOfMonth: schedule };
  }
  return mapped;
}

function validateSelectedRange(
  startDate: string,
  endDate: string,
  firstPriceDate: string | undefined,
  lastPriceDate: string | undefined,
): CalculatorFieldErrors {
  if (!firstPriceDate || !lastPriceDate) {
    return { dailyPrices: "当前没有可靠的已闭合日线可用于计算。" };
  }

  const errors: Record<string, string> = {};
  if (startDate && (startDate < firstPriceDate || startDate > lastPriceDate)) {
    errors.startDate = `开始日期必须在 ${firstPriceDate} 至 ${lastPriceDate} 之间。`;
  }
  if (endDate && (endDate < firstPriceDate || endDate > lastPriceDate)) {
    errors.endDate = `结束日期必须在 ${firstPriceDate} 至 ${lastPriceDate} 之间。`;
  }
  return errors;
}

function getDatasetStatusCopy(dataset: DcaMarketDataset) {
  if (dataset.status === "fresh") {
    return {
      label: `${dataset.symbol} 日线可用`,
      detail: `${dataset.prices.length} 根 Binance 现货已闭合 UTC 日线`,
    };
  }
  if (dataset.status === "stale") {
    return {
      label: `${dataset.symbol} 数据延迟`,
      detail: `沿用最近可核验缓存，共 ${dataset.prices.length} 根已闭合日线`,
    };
  }
  if (dataset.status === "error") {
    return {
      label: `${dataset.symbol} 日线获取失败`,
      detail: dataset.error
        ? dataErrorLabel(dataset.error.code, dataset.error.retryable)
        : "上游数据暂时不可用，请稍后再试。",
    };
  }
  return {
    label: `${dataset.symbol} 日线暂不可用`,
    detail: unavailableReasonLabel(dataset.reason),
  };
}

function dataErrorLabel(code: NonNullable<DcaMarketDataset["error"]>["code"], retryable: boolean) {
  const labels = {
    timeout: "数据源响应超时",
    rate_limited: "数据源触发访问频率限制",
    upstream_error: "数据源暂时返回错误",
    invalid_payload: "数据源响应未通过校验",
    no_data: "数据源没有返回有效日线",
  } as const;
  return `${labels[code]}${retryable ? "，请稍后重试。" : "。"}`;
}

function unavailableReasonLabel(reason: DcaMarketDataset["reason"]): string {
  const labels = {
    not_configured: "可靠数据源尚未配置。",
    unsupported: "当前数据源不支持该资产。",
    license_restricted: "当前授权不允许展示该数据。",
    no_reliable_source: "当前没有可核验的数据来源。",
    no_data: "当前日期范围没有有效日线。",
    insufficient_history: "可用历史日线不足。",
  } as const;
  return reason ? labels[reason] : "当前没有可用于计算的可靠数据。";
}

function formatUtcTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function formatCacheState(dataset: DcaMarketDataset): string {
  const labels = { hit: "命中", miss: "未命中", bypass: "绕过" } as const;
  return `${labels[dataset.cache.status]} · ${dataset.cache.revalidateSeconds}s 更新窗口`;
}
