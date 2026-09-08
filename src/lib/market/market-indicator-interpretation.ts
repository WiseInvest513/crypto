import {
  formatCompactNumber,
  formatCompactUsd,
  formatFundingRate,
  formatPercent,
  formatTradingDate,
} from "./formatters";
import type {
  AvailableMarketDatum,
  DataScope,
  DataSource,
  EtfFlowReading,
  FundingReading,
  LiquidationsReading,
  MarketCapability,
  MarketDatumView,
  OpenInterestReading,
} from "@/server/data/contracts/market-data";

export type ComparableOpenInterestReading = OpenInterestReading &
  Readonly<{
    /** Same-contract change over a validated, like-for-like comparison window. */
    change24hPercent?: number | null;
    comparisonWindowHours?: number | null;
  }>;

export type MarketIndicatorInterpretationInput = Readonly<{
  btcFunding: MarketDatumView<FundingReading>;
  ethFunding: MarketDatumView<FundingReading>;
  btcOpenInterest: MarketDatumView<ComparableOpenInterestReading>;
  ethOpenInterest: MarketDatumView<ComparableOpenInterestReading>;
  liquidations24h: MarketDatumView<LiquidationsReading>;
  btcEtfFlow: MarketDatumView<EtfFlowReading>;
  ethEtfFlow: MarketDatumView<EtfFlowReading>;
}>;

export type MarketInterpretationAvailability =
  | "available"
  | "partial"
  | "loading"
  | "error"
  | "unavailable";

export type MarketInterpretationEvidence = Readonly<{
  capability: MarketCapability;
  label: string;
  value: string;
  context: string;
  detail: string;
  source: DataSource;
  scope: DataScope;
  updatedAt: string;
  stale: boolean;
}>;

export type MarketInterpretationCoverage = Readonly<{
  available: number;
  total: number;
  loading: number;
  error: number;
  unavailable: number;
}>;

export type ObjectiveMarketInterpretation = Readonly<{
  id: "leverage" | "liquidations" | "etf-flow";
  title: string;
  headline: string;
  summary: string;
  evidence: readonly MarketInterpretationEvidence[];
  watchCondition: string;
  availability: MarketInterpretationAvailability;
  /** True when any fact used in this interpretation is last-known-good data. */
  stale: boolean;
  /** Oldest source timestamp among the displayed facts (the freshness floor). */
  updatedAt: string | null;
  coverage: MarketInterpretationCoverage;
}>;

export type MarketIndicatorInterpretations = Readonly<{
  leverage: ObjectiveMarketInterpretation;
  liquidations: ObjectiveMarketInterpretation;
  etfFlow: ObjectiveMarketInterpretation;
}>;

type DatumState = "available" | "loading" | "error" | "unavailable";
type FundingFact = Readonly<{
  asset: "BTC" | "ETH";
  rate: number;
  evidence: MarketInterpretationEvidence;
}>;
type OpenInterestFact = Readonly<{
  asset: "BTC" | "ETH";
  change24hPercent: number | null;
  evidence: MarketInterpretationEvidence;
}>;
type EtfFlowFact = Readonly<{
  asset: "BTC" | "ETH";
  netFlowUsd: number;
  tradingDate: string;
  evidence: MarketInterpretationEvidence;
}>;

/**
 * Turns seven normalized readings into three objective, auditable explanations.
 *
 * This layer deliberately does not assign bullish/bearish labels, predict price,
 * prescribe a trade, or infer crowding from an absolute OI snapshot. OI change is
 * described only when the provider supplied a validated 24-hour comparison.
 */
export function interpretMarketIndicators(
  input: MarketIndicatorInterpretationInput,
): MarketIndicatorInterpretations {
  return {
    leverage: interpretLeverage(input),
    liquidations: interpretLiquidations(input),
    etfFlow: interpretEtfFlow(input),
  };
}

function interpretLeverage(
  input: MarketIndicatorInterpretationInput,
): ObjectiveMarketInterpretation {
  const entries = [
    {
      datum: input.btcFunding,
      validate: (value: FundingReading) => validFunding(value, "btc"),
    },
    {
      datum: input.ethFunding,
      validate: (value: FundingReading) => validFunding(value, "eth"),
    },
    {
      datum: input.btcOpenInterest,
      validate: (value: ComparableOpenInterestReading) =>
        validOpenInterest(value, "btc"),
    },
    {
      datum: input.ethOpenInterest,
      validate: (value: ComparableOpenInterestReading) =>
        validOpenInterest(value, "eth"),
    },
  ] as const;
  const fundingFacts = [
    fundingFact(input.btcFunding, "BTC"),
    fundingFact(input.ethFunding, "ETH"),
  ].filter(isPresent);
  const openInterestFacts = [
    openInterestFact(input.btcOpenInterest, "BTC"),
    openInterestFact(input.ethOpenInterest, "ETH"),
  ].filter(isPresent);
  const comparableOi = openInterestFacts.filter(
    (fact) => fact.change24hPercent !== null,
  );
  const evidence = [
    ...fundingFacts.map((fact) => fact.evidence),
    ...openInterestFacts.map((fact) => fact.evidence),
  ];
  const coverage = coverageFor(entries);

  if (evidence.length === 0) {
    return emptyInterpretation(
      "leverage",
      "永续合约持仓状态",
      "永续持仓状态暂不可解读",
      "资金费率与未平仓合约数据当前均不可用；缺失值不会被写成零，也不会据此判断拥挤方向。",
      "等待数据恢复后，再观察 24 小时 OI 变化与资金费率方向。",
      coverage,
    );
  }

  const headline =
    comparableOi.length > 0
      ? openInterestHeadline(comparableOi)
      : fundingFacts.length > 0
        ? `${fundingHeadline(fundingFacts)}；OI 暂无可比变化`
        : "当前 OI 规模已取得；暂不能判断增减";
  const fundingSummary =
    fundingFacts.length > 0
      ? `${fundingFacts.map(fundingPaymentSentence).join("；")}。资金费率只表示该结算口径下的费用支付方向，不等同于价格方向。`
      : "资金费率当前不可用，无法说明当期费用支付方向。";
  const oiSummary =
    comparableOi.length > 0
      ? `${comparableOi.map(openInterestChangeSentence).join("；")}。OI 变化说明同口径持仓参与规模正在变化，但不能说明新增或退出的是多头还是空头。`
      : "当前只有 OI 绝对规模；没有同口径历史比较时，不能称为杠杆升温、降温或拥挤。";

  return buildInterpretation({
    id: "leverage",
    title: "永续合约持仓状态",
    headline,
    summary: `${oiSummary}${fundingSummary}`,
    evidence,
    watchCondition:
      "继续观察 24 小时 OI 是否同向变化、资金费率是否穿越 0%；只有同一合约和同一比较窗口的数据才可前后比较。",
    coverage,
  }, comparableOi.length === 2 ? undefined : "partial");
}

function interpretLiquidations(
  input: MarketIndicatorInterpretationInput,
): ObjectiveMarketInterpretation {
  const entries = [
    { datum: input.liquidations24h, validate: validLiquidations },
  ] as const;
  const coverage = coverageFor(entries);
  const datum = usableDatum(input.liquidations24h, validLiquidations);

  if (datum === null) {
    return emptyInterpretation(
      "liquidations",
      "24 小时强平结构",
      "24 小时强平状态暂不可解读",
      "强平数据当前不可用，因此不会推断市场是否已经完成去杠杆。",
      "等待完整 24 小时滚动窗口恢复后，再比较总额与多空结构。",
      coverage,
    );
  }

  const { value } = datum;
  const hasBreakdown =
    value.longUsd !== null && value.shortUsd !== null;
  const headline = !hasBreakdown
    ? "24 小时强平总额已取得；多空拆分不可用"
    : value.longUsd! > value.shortUsd!
      ? "24 小时多单强平金额高于空单"
      : value.longUsd! < value.shortUsd!
        ? "24 小时空单强平金额高于多单"
        : "24 小时多空强平金额相同";
  const breakdown = hasBreakdown
    ? `其中多单 ${formatCompactUsd(value.longUsd!)}，空单 ${formatCompactUsd(value.shortUsd!)}。`
    : "当前数据没有可靠的多空拆分。";
  const scope = liquidationScope(datum.scope);
  const evidence: readonly MarketInterpretationEvidence[] = [
    evidenceFromDatum(
      datum,
      "24 小时强平金额",
      formatCompactUsd(value.totalUsd),
      breakdown,
      `${scope}；${breakdown}`,
    ),
  ];

  return buildInterpretation({
    id: "liquidations",
    title: "24 小时强平结构",
    headline,
    summary: `过去 24 小时累计强平 ${formatCompactUsd(value.totalUsd)}，${breakdown}强平说明哪一侧仓位已经被迫退出，不代表后续一定反转，也不能单独证明去杠杆已经完成。`,
    evidence,
    watchCondition:
      "观察下一个 24 小时滚动窗口的总额与多空结构是否改变；没有历史分位时，不把单个窗口称为极端或异常。",
    coverage,
  });
}

function interpretEtfFlow(
  input: MarketIndicatorInterpretationInput,
): ObjectiveMarketInterpretation {
  const entries = [
    {
      datum: input.btcEtfFlow,
      validate: (value: EtfFlowReading) => validEtfFlow(value, "btc"),
    },
    {
      datum: input.ethEtfFlow,
      validate: (value: EtfFlowReading) => validEtfFlow(value, "eth"),
    },
  ] as const;
  const facts = [
    etfFlowFact(input.btcEtfFlow, "BTC"),
    etfFlowFact(input.ethEtfFlow, "ETH"),
  ].filter(isPresent);
  const evidence = facts.map((fact) => fact.evidence);
  const coverage = coverageFor(entries);

  if (facts.length === 0) {
    return emptyInterpretation(
      "etf-flow",
      "美国现货 ETF 日资金流",
      "ETF 资金方向暂不可解读",
      "BTC 与 ETH 现货 ETF 日度净流量当前均不可用；缺失交易日不会被补成零。",
      "等待下一个已经完成且来源确认的交易日数据，不用周末或假日空白推断资金方向。",
      coverage,
    );
  }

  return buildInterpretation({
    id: "etf-flow",
    title: "美国现货 ETF 日资金流",
    headline: facts.map(etfHeadlinePart).join("；"),
    summary: `${facts.map(etfFlowSentence).join("；")}。单日净流量只说明各自交易日的申购赎回净结果，不代表盘中价格方向或连续趋势。`,
    evidence,
    watchCondition:
      "等待下一完整交易日，并只在同一资产、同一 ETF 覆盖口径下比较连续已完成交易日；不同日期不会合并成同一天的结论。",
    coverage,
  });
}

function fundingFact(
  datum: MarketDatumView<FundingReading>,
  asset: "BTC" | "ETH",
): FundingFact | null {
  const expectedAsset = asset.toLowerCase() as "btc" | "eth";
  const available = usableDatum(datum, (value) =>
    validFunding(value, expectedAsset),
  );
  if (available === null) return null;
  const { rate, intervalHours } = available.value;
  const payment =
    rate > 0
      ? "正费率：多头向空头支付"
      : rate < 0
        ? "负费率：空头向多头支付"
        : "费率为零：本次没有由费率方向产生的净支付";
  const interval =
    intervalHours === null ? "结算周期以交易所为准" : `${intervalHours} 小时结算`;
  return {
    asset,
    rate,
    evidence: evidenceFromDatum(
      available,
      `${asset} 资金费率`,
      formatFundingRate(rate),
      payment,
      `${payment}；${interval}；${scopeDescription(available.scope)}。`,
    ),
  };
}

function openInterestFact(
  datum: MarketDatumView<ComparableOpenInterestReading>,
  asset: "BTC" | "ETH",
): OpenInterestFact | null {
  const expectedAsset = asset.toLowerCase() as "btc" | "eth";
  const available = usableDatum(datum, (value) =>
    validOpenInterest(value, expectedAsset),
  );
  if (available === null) return null;
  const value = available.value;
  const change24hPercent = validOiComparison(value)
    ? value.change24hPercent!
    : null;
  const comparison =
    change24hPercent === null
      ? "当前规模快照，缺少可比的 24 小时变化"
      : `较 24 小时前 ${changeWord(change24hPercent)} ${formatPercent(change24hPercent, true)}`;
  return {
    asset,
    change24hPercent,
    evidence: evidenceFromDatum(
      available,
      `${asset} 未平仓合约`,
      `${formatCompactNumber(value.notional)} ${value.quoteCurrency}`,
      comparison,
      `${comparison}；${scopeDescription(available.scope)}；${value.samplingPeriod} 采样。`,
    ),
  };
}

function etfFlowFact(
  datum: MarketDatumView<EtfFlowReading>,
  asset: "BTC" | "ETH",
): EtfFlowFact | null {
  const expectedAsset = asset.toLowerCase() as "btc" | "eth";
  const available = usableDatum(datum, (value) =>
    validEtfFlow(value, expectedAsset),
  );
  if (available === null) return null;
  const { netFlowUsd, tradingDate } = available.value;
  return {
    asset,
    netFlowUsd,
    tradingDate,
    evidence: evidenceFromDatum(
      available,
      `${asset} ETF 日净流量`,
      formatCompactUsd(netFlowUsd, true),
      `${formatTradingDate(tradingDate)} 完整交易日`,
      `${formatTradingDate(tradingDate)}；${flowWord(netFlowUsd)}；${scopeDescription(available.scope)}。`,
    ),
  };
}

function fundingHeadline(facts: readonly FundingFact[]): string {
  if (facts.length === 1) {
    return `${facts[0].asset} 资金费率${rateWord(facts[0].rate)}`;
  }
  const [first, second] = facts;
  const firstSign = Math.sign(first.rate);
  const secondSign = Math.sign(second.rate);
  return firstSign === secondSign
    ? `BTC 与 ETH 资金费率均${rateWord(first.rate)}`
    : "BTC 与 ETH 资金费率方向不同";
}

function openInterestHeadline(facts: readonly OpenInterestFact[]): string {
  if (facts.length === 1) {
    const fact = facts[0];
    return `${fact.asset} OI 较 24 小时前${changeWord(fact.change24hPercent!)}`;
  }
  const [first, second] = facts;
  const firstSign = Math.sign(first.change24hPercent!);
  const secondSign = Math.sign(second.change24hPercent!);
  return firstSign === secondSign
    ? `BTC 与 ETH OI 较 24 小时前均${changeWord(first.change24hPercent!)}`
    : "BTC 与 ETH OI 的 24 小时变化方向不同";
}

function fundingPaymentSentence(fact: FundingFact): string {
  return fact.rate > 0
    ? `${fact.asset} 为正费率，多头向空头支付`
    : fact.rate < 0
      ? `${fact.asset} 为负费率，空头向多头支付`
      : `${fact.asset} 费率为零`;
}

function openInterestChangeSentence(fact: OpenInterestFact): string {
  return `${fact.asset} OI 较 24 小时前${changeWord(fact.change24hPercent!)} ${formatPercent(fact.change24hPercent!, true)}`;
}

function etfHeadlinePart(fact: EtfFlowFact): string {
  return `${fact.asset} ETF 最近交易日${flowWord(fact.netFlowUsd)}`;
}

function etfFlowSentence(fact: EtfFlowFact): string {
  return `${fact.asset} ETF 在 ${formatTradingDate(fact.tradingDate)} ${flowWord(fact.netFlowUsd)} ${formatCompactUsd(Math.abs(fact.netFlowUsd))}`;
}

function rateWord(value: number): "为正" | "为负" | "为零" {
  return value > 0 ? "为正" : value < 0 ? "为负" : "为零";
}

function changeWord(value: number): "增加" | "减少" | "持平" {
  return value > 0 ? "增加" : value < 0 ? "减少" : "持平";
}

function flowWord(value: number): "净流入" | "净流出" | "净流量为零" {
  return value > 0 ? "净流入" : value < 0 ? "净流出" : "净流量为零";
}

function liquidationScope(scope: DataScope): string {
  return scope.kind === "global"
    ? "数据源覆盖的多交易所聚合口径"
    : scope.kind === "venue"
      ? "单一交易场所口径"
      : "当前已标注的覆盖口径";
}

function scopeDescription(scope: DataScope): string {
  return scope.kind === "venue"
    ? `单一交易场所（${scope.label}）`
    : scope.kind === "global"
      ? `数据源覆盖的多市场聚合（${scope.label}）`
      : `${scope.label}`;
}

function evidenceFromDatum<T>(
  datum: AvailableMarketDatum<T>,
  label: string,
  value: string,
  context: string,
  detail: string,
): MarketInterpretationEvidence {
  return {
    capability: datum.capability,
    label,
    value,
    context,
    detail,
    source: datum.source,
    scope: datum.scope,
    updatedAt: datum.updatedAt,
    stale: datum.status === "stale",
  };
}

function buildInterpretation(
  value: Omit<
    ObjectiveMarketInterpretation,
    "availability" | "stale" | "updatedAt"
  >,
  availabilityOverride?: MarketInterpretationAvailability,
): ObjectiveMarketInterpretation {
  return {
    ...value,
    availability:
      availabilityFor(value.coverage) === "available" && availabilityOverride
        ? availabilityOverride
        : availabilityFor(value.coverage),
    stale: value.evidence.some((item) => item.stale),
    updatedAt: oldestTimestamp(value.evidence.map((item) => item.updatedAt)),
  };
}

function emptyInterpretation(
  id: ObjectiveMarketInterpretation["id"],
  title: string,
  headline: string,
  summary: string,
  watchCondition: string,
  coverage: MarketInterpretationCoverage,
): ObjectiveMarketInterpretation {
  return buildInterpretation({
    id,
    title,
    headline,
    summary,
    evidence: [],
    watchCondition,
    coverage,
  });
}

function coverageFor(
  entries: readonly Readonly<{
    datum: MarketDatumView<unknown>;
    validate: (value: never) => boolean;
  }>[],
): MarketInterpretationCoverage {
  const states = entries.map(({ datum, validate }) =>
    datumState(datum, validate as (value: unknown) => boolean),
  );
  return {
    available: states.filter((state) => state === "available").length,
    total: states.length,
    loading: states.filter((state) => state === "loading").length,
    error: states.filter((state) => state === "error").length,
    unavailable: states.filter((state) => state === "unavailable").length,
  };
}

function availabilityFor(
  coverage: MarketInterpretationCoverage,
): MarketInterpretationAvailability {
  if (coverage.available === coverage.total) return "available";
  if (coverage.available > 0) return "partial";
  if (coverage.loading > 0) return "loading";
  if (coverage.error > 0) return "error";
  return "unavailable";
}

function datumState<T>(
  datum: MarketDatumView<T>,
  validate: (value: T) => boolean,
): DatumState {
  if (datum.status === "loading") return "loading";
  if (datum.status === "error") return "error";
  if (datum.status === "unavailable") return "unavailable";
  if (datum.provenance === "synthetic") return "unavailable";
  return validate(datum.value) ? "available" : "error";
}

function usableDatum<T>(
  datum: MarketDatumView<T>,
  validate: (value: T) => boolean,
): AvailableMarketDatum<T> | null {
  return (datum.status === "fresh" || datum.status === "stale") &&
    datum.provenance !== "synthetic" &&
    validate(datum.value)
    ? datum
    : null;
}

function validFunding(value: FundingReading, expectedAsset?: "btc" | "eth"): boolean {
  return (
    (value.asset === "btc" || value.asset === "eth") &&
    (expectedAsset === undefined || value.asset === expectedAsset) &&
    typeof value.symbol === "string" &&
    value.symbol.length > 0 &&
    Number.isFinite(value.rate) &&
    (value.intervalHours === null ||
      (Number.isFinite(value.intervalHours) && value.intervalHours > 0))
  );
}

function validOpenInterest(
  value: ComparableOpenInterestReading,
  expectedAsset?: "btc" | "eth",
): boolean {
  return (
    (value.asset === "btc" || value.asset === "eth") &&
    (expectedAsset === undefined || value.asset === expectedAsset) &&
    typeof value.symbol === "string" &&
    value.symbol.length > 0 &&
    Number.isFinite(value.notional) &&
    value.notional >= 0 &&
    value.quoteCurrency === "USDT" &&
    value.samplingPeriod === "5m" &&
    (value.change24hPercent === undefined ||
      value.change24hPercent === null ||
      (Number.isFinite(value.change24hPercent) &&
        value.change24hPercent >= -100)) &&
    (value.comparisonWindowHours === undefined ||
      value.comparisonWindowHours === null ||
      (Number.isFinite(value.comparisonWindowHours) &&
        value.comparisonWindowHours > 0))
  );
}

function validOiComparison(value: ComparableOpenInterestReading): boolean {
  return (
    Number.isFinite(value.change24hPercent) &&
    Number.isFinite(value.comparisonWindowHours) &&
    value.comparisonWindowHours! >= 23 &&
    value.comparisonWindowHours! <= 25
  );
}

function validLiquidations(value: LiquidationsReading): boolean {
  return (
    value.asset === "all" &&
    value.window === "24h" &&
    Number.isFinite(value.totalUsd) &&
    value.totalUsd >= 0 &&
    nullableNonNegativeFinite(value.longUsd) &&
    nullableNonNegativeFinite(value.shortUsd)
  );
}

function validEtfFlow(
  value: EtfFlowReading,
  expectedAsset?: "btc" | "eth",
): boolean {
  return (
    (value.asset === "btc" || value.asset === "eth") &&
    (expectedAsset === undefined || value.asset === expectedAsset) &&
    Number.isFinite(value.netFlowUsd) &&
    formatTradingDate(value.tradingDate) !== "—"
  );
}

function nullableNonNegativeFinite(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function oldestTimestamp(values: readonly string[]): string | null {
  let oldest: { value: string; timestamp: number } | null = null;
  for (const value of values) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) continue;
    if (oldest === null || timestamp < oldest.timestamp) {
      oldest = { value: new Date(timestamp).toISOString(), timestamp };
    }
  }
  return oldest?.value ?? null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
