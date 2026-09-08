"use client";

import { useState } from "react";
import type {
  FuturesChapterId,
  InteractionKind,
  LessonDefinition,
} from "@/lib/learning/futures-course";
import styles from "./futures-intro.module.css";

type ObservationSet = readonly [string, string, string];
type VisualFamily = "compare" | "risk" | "candles" | "indicators" | "plan";

const OBSERVATIONS: Readonly<Record<InteractionKind, ObservationSet>> = {
  "spot-perpetual-comparison": ["账户记录的是什么", "可以表达什么方向", "风险从哪里产生"],
  "direction-scenario": ["价格上涨时", "价格下跌时", "方向判断错误时"],
  "notional-margin-breakdown": ["名义价值", "占用保证金", "两者并不相等"],
  "order-type-matcher": ["市价单", "限价单", "条件单"],
  "price-role-matcher": ["最新成交价", "指数价格", "标记价格"],
  "leverage-simulator": ["1 倍基准", "保证金占用", "风险同步放大"],
  "margin-mode-comparison": ["逐仓边界", "全仓共享", "切换前先确认"],
  "liquidation-boundary": ["维持保证金", "强平触发", "平台规则差异"],
  "cost-ledger": ["交易手续费", "资金费率", "滑点与执行差异"],
  "risk-budget": ["账户风险预算", "止损距离", "可承受仓位"],
  "risk-reward-plan": ["计划入场", "失效位置", "目标与风险回报"],
  "candle-anatomy": ["开盘与收盘", "最高与最低", "实体与影线"],
  "closed-candle-timeline": ["形成中的 K 线", "闭合时刻", "确认后的事实"],
  "volume-comparison": ["当前成交量", "相邻周期", "同周期才可比较"],
  "multi-timeframe-map": ["短周期细节", "中周期结构", "大周期背景"],
  "ema-layer-toggle": ["短期 EMA", "中期 EMA", "价格相对位置"],
  "ema-ordering-sort": ["向上排列", "向下排列", "均线交错"],
  "bollinger-band-context": ["中轨", "上下轨", "带宽变化"],
  "key-zone-selector": ["压力区域", "支撑区域", "价格位于区域内"],
  "fibonacci-anchor": ["选择起点", "选择终点", "观察回撤区"],
  "market-context-layers": ["价格结构", "持仓与成交", "爆仓数据边界"],
  "regime-classifier": ["趋势环境", "震荡环境", "突破后的确认"],
  "evidence-board": ["支持证据", "冲突证据", "保留不确定"],
  "plan-builder": ["触发条件", "闭合确认", "失效条件"],
  "historical-replay": ["当时可见信息", "随后发生的事实", "避免前视"],
  "graduation-review": ["先写风险", "再等确认", "无法判断也可以停止"],
};

const FAMILY_BY_CHAPTER: Readonly<Record<FuturesChapterId, VisualFamily>> = {
  "chapter-1-contract-basics": "compare",
  "chapter-2-leverage-risk": "risk",
  "chapter-3-candlesticks": "candles",
  "chapter-4-indicators-levels": "indicators",
  "chapter-5-planning-replay": "plan",
};

const DIRECT_INTERACTION_KINDS = new Set<InteractionKind>([
  "spot-perpetual-comparison",
  "direction-scenario",
  "leverage-simulator",
  "liquidation-boundary",
  "risk-budget",
  "closed-candle-timeline",
  "ema-layer-toggle",
  "key-zone-selector",
]);

export function LessonVisual({ lesson }: { lesson: LessonDefinition }) {
  const [activeObservation, setActiveObservation] = useState(0);
  const observations = OBSERVATIONS[lesson.interaction.kind];
  const family = FAMILY_BY_CHAPTER[lesson.chapterId];
  const hasDirectInteraction = DIRECT_INTERACTION_KINDS.has(
    lesson.interaction.kind,
  );

  return (
    <section className={styles.lessonPractice} aria-labelledby="lesson-practice-title">
      <figure className={styles.lessonFigure}>
        <figcaption className={styles.figureCaption}>
          <span>教学示意</span>
          <strong>不代表实时行情</strong>
        </figcaption>
        <div className={styles.visualCanvas} data-family={family}>
          <LearningGraphic
            lesson={lesson}
            observations={observations}
            active={activeObservation}
          />
        </div>
      </figure>

      <div className={styles.observationPanel}>
        <p className={styles.sectionEyebrow}>动手观察</p>
        <h2 id="lesson-practice-title">先看清楚这三个位置</h2>
        <p className={styles.practiceInstruction}>
          {hasDirectInteraction
            ? lesson.interaction.instruction
            : "依次点击三个观察点，对照图中的变化，再完成本关问题。"}
        </p>
        {hasDirectInteraction ? (
          <ol className={styles.observationPoints}>
            {observations.map((observation, index) => (
              <li key={observation}>
                <span aria-hidden="true">{index + 1}</span>
                <strong>{observation}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <ol className={styles.observationList}>
              {observations.map((observation, index) => (
                <li key={observation}>
                  <button
                    type="button"
                    aria-pressed={activeObservation === index}
                    onClick={() => setActiveObservation(index)}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    {observation}
                  </button>
                </li>
              ))}
            </ol>
            <p className={styles.observationStatus} aria-live="polite">
              当前观察：{observations[activeObservation]}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function LearningGraphic({
  lesson,
  observations,
  active,
}: {
  lesson: LessonDefinition;
  observations: ObservationSet;
  active: number;
}) {
  const kind = lesson.interaction.kind;

  switch (kind) {
    case "spot-perpetual-comparison":
      return <SpotPerpetualInteractive />;
    case "direction-scenario":
      return <DirectionScenarioInteractive />;
    case "leverage-simulator":
      return <LeverageInteractive />;
    case "liquidation-boundary":
      return <LiquidationRulesInteractive />;
    case "risk-budget":
      return <RiskBudgetInteractive />;
    case "closed-candle-timeline":
      return <ClosedCandleInteractive />;
    case "ema-layer-toggle":
      return <EmaLayersInteractive />;
    case "key-zone-selector":
      return <KeyZonesInteractive />;
    case "candle-anatomy":
    case "volume-comparison":
      return <CandleGraphic active={active} kind={kind} />;
    case "multi-timeframe-map":
    case "ema-ordering-sort":
      return <TimeframeGraphic active={active} labels={observations} />;
    case "bollinger-band-context":
    case "fibonacci-anchor":
    case "market-context-layers":
      return <IndicatorGraphic active={active} kind={kind} />;
    case "risk-reward-plan":
    case "plan-builder":
    case "historical-replay":
      return <PlanGraphic active={active} labels={observations} kind={kind} />;
    default:
      return (
        <ConceptCardsGraphic
          active={active}
          kind={kind}
          labels={observations}
        />
      );
  }
}

function SpotPerpetualInteractive() {
  const [mode, setMode] = useState<"spot" | "perpetual">("spot");
  const isPerpetual = mode === "perpetual";
  const facts = isPerpetual
    ? ["持有衍生品仓位", "可使用杠杆", "可能产生资金费率"]
    : ["账户通常增加现货余额", "普通现货默认无杠杆", "没有永续资金费率"];

  return (
    <div className={styles.directInteraction}>
      <div className={styles.interactionTabs} role="group" aria-label="切换交易方式">
        <button
          type="button"
          aria-pressed={!isPerpetual}
          onClick={() => setMode("spot")}
        >
          现货
        </button>
        <button
          type="button"
          aria-pressed={isPerpetual}
          onClick={() => setMode("perpetual")}
        >
          永续合约
        </button>
      </div>
      <div className={styles.modeComparison} data-mode={mode} aria-live="polite">
        <span className={styles.modeSymbol} aria-hidden="true">
          {isPerpetual ? "P" : "S"}
        </span>
        <div>
          <small>当前查看</small>
          <strong>{isPerpetual ? "永续合约仓位" : "普通现货持有"}</strong>
        </div>
      </div>
      <ul className={styles.factTiles}>
        {facts.map((fact, index) => (
          <li key={fact}>
            <span>{index + 1}</span>
            <strong>{fact}</strong>
          </li>
        ))}
      </ul>
      <p className={styles.interactionConclusion}>
        {isPerpetual
          ? "你交易的是价格方向与仓位规则，不等同于把币买进钱包。"
          : "价格下跌会减少持仓价值；普通无杠杆现货本身不触发合约式强平。"}
      </p>
    </div>
  );
}

function DirectionScenarioInteractive() {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const isUp = direction === "up";

  return (
    <div className={styles.directInteraction}>
      <div className={styles.scenarioControl} role="group" aria-label="选择价格变化情景">
        <button type="button" aria-pressed={isUp} onClick={() => setDirection("up")}>
          价格上涨 5%
        </button>
        <button type="button" aria-pressed={!isUp} onClick={() => setDirection("down")}>
          价格下跌 5%
        </button>
      </div>
      <div className={styles.directionLine} data-direction={direction} aria-hidden="true">
        <span />
        <i />
      </div>
      <div className={styles.pnlCards} aria-live="polite">
        <div data-positive={isUp}>
          <span>做多</span>
          <strong>{isUp ? "+5%" : "−5%"}</strong>
        </div>
        <div data-positive={!isUp}>
          <span>做空</span>
          <strong>{isUp ? "−5%" : "+5%"}</strong>
        </div>
      </div>
      <p className={styles.interactionConclusion}>
        同一段价格变化，多仓与空仓的机械盈亏方向相反；示意未计费用。
      </p>
    </div>
  );
}

function LeverageInteractive() {
  const [leverage, setLeverage] = useState<1 | 5 | 10>(5);
  const initialMargin = 1000 / leverage;
  const marginMove = leverage * 5;

  return (
    <div className={styles.directInteraction}>
      <div className={styles.choiceLabel}>
        <span>保持名义仓位 1,000 USDT</span>
        <strong>{leverage}×</strong>
      </div>
      <div className={styles.leverageChoices} role="group" aria-label="选择杠杆倍数">
        {([1, 5, 10] as const).map((value) => (
          <button
            type="button"
            aria-pressed={leverage === value}
            onClick={() => setLeverage(value)}
            key={value}
          >
            {value}×
          </button>
        ))}
      </div>
      <div className={styles.leverageMeter} aria-hidden="true">
        <span style={{ width: `${leverage * 10}%` }} />
      </div>
      <div className={styles.metricPair} aria-live="polite">
        <div>
          <small>概念初始保证金</small>
          <strong>{initialMargin.toLocaleString("en-US")} USDT</strong>
        </div>
        <div>
          <small>价格反向 5% / 相对保证金</small>
          <strong>约 −{marginMove}%</strong>
        </div>
      </div>
      <p className={styles.interactionConclusion}>
        这是忽略维持保证金、费用与滑点的机械示意，不是强平价计算。
      </p>
    </div>
  );
}

function LiquidationRulesInteractive() {
  const [rules, setRules] = useState({
    maintenance: false,
    fees: false,
    sharedMargin: false,
  });
  const boundaryPosition = Math.max(
    22,
    68 - (rules.maintenance ? 16 : 0) - (rules.fees ? 7 : 0) + (rules.sharedMargin ? 10 : 0),
  );
  const activeRules = Object.values(rules).filter(Boolean).length;

  function toggleRule(rule: keyof typeof rules) {
    setRules((current) => ({ ...current, [rule]: !current[rule] }));
  }

  return (
    <div className={styles.directInteraction}>
      <div className={styles.ruleSwitches}>
        <label>
          <input
            type="checkbox"
            checked={rules.maintenance}
            onChange={() => toggleRule("maintenance")}
          />
          <span>维持保证金要求</span>
        </label>
        <label>
          <input type="checkbox" checked={rules.fees} onChange={() => toggleRule("fees")} />
          <span>手续费与资金费用</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={rules.sharedMargin}
            onChange={() => toggleRule("sharedMargin")}
          />
          <span>全仓可用余额</span>
        </label>
      </div>
      <div className={styles.boundarySimulation} aria-hidden="true">
        <span className={styles.boundaryFill} style={{ width: `${boundaryPosition}%` }} />
        <i style={{ left: `${boundaryPosition}%` }} />
      </div>
      <div className={styles.boundaryResult} aria-live="polite">
        <small>已纳入 {activeRules} 项规则</small>
        <strong>
          {activeRules === 0
            ? "这里只是杠杆倒数的理论距离"
            : rules.sharedMargin
              ? "边界改变，同时更多账户资金可能被关联"
              : "真实强平缓冲通常比理论距离更窄"}
        </strong>
      </div>
      <p className={styles.interactionConclusion}>
        方向仅用于理解影响；精确边界必须使用交易所当时的规则。
      </p>
    </div>
  );
}

function RiskBudgetInteractive() {
  const [riskBudget, setRiskBudget] = useState(100);
  const [stopDistance, setStopDistance] = useState(2);
  const notional = riskBudget / (stopDistance / 100);

  return (
    <div className={styles.directInteraction}>
      <div className={styles.rangeControl}>
        <label htmlFor="risk-budget-range">
          <span>单笔风险预算</span>
          <output>{riskBudget} USDT</output>
        </label>
        <input
          id="risk-budget-range"
          type="range"
          min="50"
          max="200"
          step="50"
          value={riskBudget}
          onChange={(event) => setRiskBudget(Number(event.target.value))}
        />
      </div>
      <div className={styles.rangeControl}>
        <label htmlFor="stop-distance-range">
          <span>入场到止损距离</span>
          <output>{stopDistance}%</output>
        </label>
        <input
          id="stop-distance-range"
          type="range"
          min="1"
          max="5"
          step="1"
          value={stopDistance}
          onChange={(event) => setStopDistance(Number(event.target.value))}
        />
      </div>
      <div className={styles.budgetResult} aria-live="polite">
        <small>机械换算的最大名义仓位</small>
        <strong>{notional.toLocaleString("en-US")} USDT</strong>
        <span>风险预算 ÷ 止损距离</span>
      </div>
      <p className={styles.interactionConclusion}>
        未计滑点、手续费与跳空，实际计划应保留额外缓冲。
      </p>
    </div>
  );
}

function ClosedCandleInteractive() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const phases = ["形成中", "闭合时刻", "确认事实"] as const;

  return (
    <div className={styles.directInteraction}>
      <div className={styles.timelineChoices} role="group" aria-label="推进 K 线时间">
        {phases.map((label, index) => (
          <button
            type="button"
            aria-pressed={phase === index}
            onClick={() => setPhase(index as 0 | 1 | 2)}
            key={label}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <CandleGraphic active={phase} kind="closed-candle-timeline" />
      <p className={styles.timelineResult} aria-live="polite">
        <strong>{phases[phase]}</strong>
        {phase === 0
          ? "：价格可以暂时穿越关键位，结论仍会变化。"
          : phase === 1
            ? "：周期结束，开高低收不再继续改写。"
            : "：只有闭合后的数据才能用于这门课的机械判断。"}
      </p>
    </div>
  );
}

function EmaLayersInteractive() {
  const [layers, setLayers] = useState({ ema10: true, ema20: true, ema50: false });
  const visibleCount = Object.values(layers).filter(Boolean).length;

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <div className={styles.directInteraction}>
      <div className={styles.layerSwitches} aria-label="EMA 图层">
        {(
          [
            ["ema10", "EMA10"],
            ["ema20", "EMA20"],
            ["ema50", "EMA50"],
          ] as const
        ).map(([key, label]) => (
          <label data-layer={key} key={key}>
            <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <svg className={styles.emaInteractiveChart} viewBox="0 0 720 280" role="img" aria-label={`价格图与 ${visibleCount} 条可见 EMA`}>
        <g className={styles.chartGrid} aria-hidden="true">
          <path d="M30 55H690M30 125H690M30 195H690M150 20V250M290 20V250M430 20V250M570 20V250" />
        </g>
        <path className={styles.pricePath} d="M30 220 C76 206 98 227 140 194 S201 122 250 148 S335 202 383 150 S454 74 510 106 S590 168 690 92" />
        {layers.ema10 ? <path className={styles.emaFast} d="M30 224 C107 211 139 184 198 158 S302 180 380 145 S492 120 566 139 S637 112 690 101" /> : null}
        {layers.ema20 ? <path className={styles.emaMedium} d="M30 232 C114 221 178 190 241 173 S355 174 426 140 S553 143 690 112" /> : null}
        {layers.ema50 ? <path className={styles.emaSlow} d="M30 241 C145 232 242 204 332 180 S496 153 590 144 S650 132 690 126" /> : null}
      </svg>
      <p className={styles.interactionConclusion} aria-live="polite">
        已显示 {visibleCount} 条均线。周期越短，通常越快响应价格变化，也更容易来回穿越。
      </p>
    </div>
  );
}

function KeyZonesInteractive() {
  const [position, setPosition] = useState<"resistance" | "inside" | "support">("inside");
  const positionCopy = {
    resistance: "价格来到压力区域：先观察是否闭合突破",
    inside: "价格仍在区间内部：方向尚未脱离区域",
    support: "价格来到支撑区域：先观察是否闭合跌破",
  } as const;
  const pointY = position === "resistance" ? 73 : position === "support" ? 222 : 148;

  return (
    <div className={styles.directInteraction}>
      <div className={styles.zoneChoices} role="group" aria-label="选择价格所在位置">
        <button type="button" aria-pressed={position === "resistance"} onClick={() => setPosition("resistance")}>
          压力区域
        </button>
        <button type="button" aria-pressed={position === "inside"} onClick={() => setPosition("inside")}>
          区间内部
        </button>
        <button type="button" aria-pressed={position === "support"} onClick={() => setPosition("support")}>
          支撑区域
        </button>
      </div>
      <svg className={styles.zoneInteractiveChart} viewBox="0 0 720 280" role="img" aria-label={positionCopy[position]}>
        <rect className={styles.resistanceZone} data-active={position === "resistance"} x="34" y="48" width="652" height="42" rx="9" />
        <rect className={styles.supportZone} data-active={position === "support"} x="34" y="202" width="652" height="42" rx="9" />
        <path className={styles.pricePath} d="M34 188 C93 172 120 199 174 160 S263 115 310 142 S404 191 458 138 S560 104 686 128" />
        <circle className={styles.zonePricePoint} cx="610" cy={pointY} r="10" />
      </svg>
      <p className={styles.zoneResult} aria-live="polite">{positionCopy[position]}</p>
      <p className={styles.interactionConclusion}>
        支撑与压力是历史反应区域，不是保证反转的精确点位。
      </p>
    </div>
  );
}

function ConceptCardsGraphic({
  active,
  kind,
  labels,
}: {
  active: number;
  kind: InteractionKind;
  labels: ObservationSet;
}) {
  return (
    <div className={styles.compareGraphic} role="img" aria-label={`${kindLabel(kind)}教学图，当前突出${labels[active]}`}>
      {labels.map((label, index) => (
        <div className={styles.compareColumn} data-active={active === index} key={label}>
          <span className={styles.compareIcon} aria-hidden="true">
            {conceptIcon(kind, index)}
          </span>
          <strong>{label}</strong>
          <small>{active === index ? "正在观察" : "点击对照"}</small>
        </div>
      ))}
      <span className={styles.graphicBaseline} aria-hidden="true" />
    </div>
  );
}

function CandleGraphic({
  active,
  kind,
}: {
  active: number;
  kind: "candle-anatomy" | "closed-candle-timeline" | "volume-comparison";
}) {
  const candles = [
    [68, 40, 50, 31], [58, 33, 42, 24], [48, 25, 36, 18], [42, 56, 62, 35],
    [55, 70, 77, 47], [68, 54, 75, 48], [52, 38, 60, 31], [41, 49, 56, 34],
    [47, 63, 70, 40], [62, 75, 83, 55], [73, 61, 80, 55], [60, 67, 74, 52],
  ] as const;

  return (
    <svg className={styles.chartGraphic} viewBox="0 0 720 330" role="img" aria-labelledby={`candle-graphic-title-${kind}`}>
      <title id={`candle-graphic-title-${kind}`}>{kindLabel(kind)}教学示意</title>
      <g className={styles.chartGrid} aria-hidden="true">
        <path d="M36 64H690M36 136H690M36 208H690M36 280H690" />
        <path d="M145 28V292M272 28V292M399 28V292M526 28V292M653 28V292" />
      </g>
      <g className={styles.candles} data-kind={kind} data-active={active} aria-hidden="true">
        {candles.map(([open, close, high, low], index) => {
          const x = 56 + index * 52;
          const yOpen = 292 - open * 2.6;
          const yClose = 292 - close * 2.6;
          const yHigh = 292 - high * 2.6;
          const yLow = 292 - low * 2.6;
          const rise = close >= open;
          return (
            <g className={rise ? styles.candleUp : styles.candleDown} key={x}>
              <path d={`M${x} ${yHigh}V${yLow}`} />
              <rect x={x - 8} y={Math.min(yOpen, yClose)} width="16" height={Math.max(5, Math.abs(yClose - yOpen))} rx="2" />
            </g>
          );
        })}
      </g>
      <g className={styles.volumeBars} data-active={kind === "volume-comparison"} data-selection={active} aria-hidden="true">
        {[18, 28, 20, 46, 68, 34, 25, 30, 38, 55, 31, 24].map((height, index) => (
          <rect key={index} x={48 + index * 52} y={316 - height / 2} width="16" height={height / 2} rx="2" />
        ))}
      </g>
      {kind === "candle-anatomy" ? (
        <g className={styles.candleAnatomyMarker} data-selection={active} aria-hidden="true">
          <circle cx="472" cy="92" r="13" />
          <circle cx="472" cy="170" r="13" />
          <rect x="452" y="86" width="40" height="104" rx="9" />
        </g>
      ) : null}
      {kind === "closed-candle-timeline" ? (
        <>
          <rect className={styles.formingRegion} data-active={active === 0} x="626" y="28" width="64" height="288" rx="8" aria-hidden="true" />
          <path className={styles.closedMarker} data-active={active === 1} d="M625 28V316" aria-hidden="true" />
          <path className={styles.confirmedRegion} data-active={active === 2} d="M36 300H620" aria-hidden="true" />
        </>
      ) : null}
    </svg>
  );
}

function TimeframeGraphic({ active, labels }: { active: number; labels: ObservationSet }) {
  const paths = [
    "M8 62 C25 56 32 70 48 51 S72 28 94 38 S118 58 138 31",
    "M8 66 C29 66 37 52 57 49 S87 55 105 36 S123 22 138 29",
    "M8 69 C35 67 48 61 69 55 S106 46 138 26",
  ] as const;

  return (
    <div className={styles.timeframeGraphic} role="img" aria-label={`多周期教学图，当前突出${labels[active]}`}>
      {labels.map((label, index) => (
        <div data-active={active === index} key={label}>
          <svg viewBox="0 0 146 86" aria-hidden="true">
            <path d={paths[index]} />
          </svg>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function IndicatorGraphic({
  active,
  kind,
}: {
  active: number;
  kind:
    | "ema-layer-toggle"
    | "ema-ordering-sort"
    | "bollinger-band-context"
    | "key-zone-selector"
    | "fibonacci-anchor"
    | "market-context-layers";
}) {
  const showEma = kind === "ema-layer-toggle" || kind === "ema-ordering-sort";
  const showBands = kind === "bollinger-band-context";
  const showZones = kind === "key-zone-selector";
  const showFib = kind === "fibonacci-anchor";
  const showContext = kind === "market-context-layers";

  return (
    <svg className={styles.chartGraphic} viewBox="0 0 720 330" role="img" aria-labelledby={`indicator-graphic-title-${kind}`}>
      <title id={`indicator-graphic-title-${kind}`}>{kindLabel(kind)}教学示意</title>
      <g className={styles.chartGrid} aria-hidden="true">
        <path d="M36 64H690M36 136H690M36 208H690M36 280H690" />
        <path d="M145 28V292M272 28V292M399 28V292M526 28V292M653 28V292" />
      </g>
      <path className={styles.pricePath} d="M38 244 C86 226 104 251 148 214 S218 148 260 166 S324 204 368 154 S442 84 484 118 S548 190 590 150 S640 104 690 122" aria-hidden="true" />
      {showEma ? (
        <>
          <path className={styles.emaFast} data-active={active === 0 || active === 2} d="M38 250 C118 232 156 208 212 188 S308 192 374 158 S480 132 548 148 S628 130 690 126" aria-hidden="true" />
          <path className={styles.emaSlow} data-active={active === 1 || active === 2} d="M38 264 C132 250 216 220 302 194 S450 163 542 158 S638 146 690 140" aria-hidden="true" />
        </>
      ) : null}
      {showBands ? (
        <g className={styles.bollingerBands} data-selection={active} aria-hidden="true">
          <path d="M38 205 C108 180 158 181 220 129 S335 143 401 90 S526 118 690 78" />
          <path d="M38 271 C108 260 158 267 220 227 S335 239 401 196 S526 225 690 184" />
          <path d="M38 238 C108 220 158 224 220 178 S335 191 401 143 S526 171 690 131" />
        </g>
      ) : null}
      {showZones ? (
        <>
          <rect className={styles.resistanceZone} data-active={active === 0 || active === 2} x="38" y="82" width="652" height="35" rx="8" aria-hidden="true" />
          <rect className={styles.supportZone} data-active={active === 1 || active === 2} x="38" y="238" width="652" height="38" rx="8" aria-hidden="true" />
        </>
      ) : null}
      {showFib ? (
        <g className={styles.fibAnchor} data-selection={active} aria-hidden="true">
          <circle cx="112" cy="246" r="10" />
          <circle cx="484" cy="112" r="10" />
          <path d="M112 246 484 112" />
        </g>
      ) : null}
      {showFib ? <g className={styles.fibLines} data-active={active === 2} aria-hidden="true">
        <path d="M38 117H690M38 164H690M38 207H690M38 245H690" />
      </g> : null}
      {showContext ? (
        <g className={styles.marketLayers} data-selection={active} aria-hidden="true">
          <path d="M38 282H690" />
          {[24, 42, 30, 66, 48, 72, 31, 55, 39, 62, 46].map((height, index) => (
            <rect key={index} x={52 + index * 58} y={310 - height / 2} width="20" height={height / 2} rx="2" />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

function PlanGraphic({
  active,
  labels,
  kind,
}: {
  active: number;
  labels: ObservationSet;
  kind: "risk-reward-plan" | "regime-classifier" | "plan-builder" | "historical-replay";
}) {
  return (
    <div className={styles.planGraphic} role="img" aria-label={`${kindLabel(kind)}教学图，当前突出${labels[active]}`}>
      <div className={styles.planChart} aria-hidden="true">
        <svg viewBox="0 0 450 220">
          <path className={styles.planPrice} d="M12 176 C60 164 72 124 112 139 S182 174 218 118 S282 72 328 95 S388 60 438 40" />
          {kind === "risk-reward-plan" ? (
            <>
              <path className={styles.riskEntry} data-active={active === 0} d="M12 128H438" />
              <path className={styles.riskStop} data-active={active === 1} d="M12 181H438" />
              <path className={styles.riskTarget} data-active={active === 2} d="M12 70H438" />
            </>
          ) : (
            <>
              <path className={styles.planTrigger} data-active={active === 0} d="M12 128H438" />
              <path className={styles.planConfirm} data-active={active === 1} d="M218 28V202" />
              <path className={styles.planInvalidation} data-active={active === 2} d="M12 181H438" />
            </>
          )}
          {kind === "historical-replay" ? (
            <rect className={styles.replayMask} data-active={active === 0 || active === 2} x="219" y="20" width="220" height="183" rx="8" />
          ) : null}
        </svg>
      </div>
      <ol className={styles.planSteps}>
        {labels.map((label, index) => (
          <li data-active={active === index} key={label}>
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function kindLabel(kind: InteractionKind) {
  const labels: Readonly<Record<InteractionKind, string>> = {
    "spot-perpetual-comparison": "现货与永续对比",
    "direction-scenario": "多空方向",
    "notional-margin-breakdown": "名义价值与保证金",
    "order-type-matcher": "订单类型",
    "price-role-matcher": "价格角色",
    "leverage-simulator": "杠杆",
    "margin-mode-comparison": "保证金模式",
    "liquidation-boundary": "强平边界",
    "cost-ledger": "交易成本",
    "risk-budget": "风险预算",
    "risk-reward-plan": "风险回报计划",
    "candle-anatomy": "K 线结构",
    "closed-candle-timeline": "闭合 K 线",
    "volume-comparison": "成交量",
    "multi-timeframe-map": "多周期",
    "ema-layer-toggle": "EMA",
    "ema-ordering-sort": "均线排列",
    "bollinger-band-context": "布林带",
    "key-zone-selector": "关键区域",
    "fibonacci-anchor": "斐波那契回撤",
    "market-context-layers": "市场数据层",
    "regime-classifier": "市场环境",
    "evidence-board": "证据整理",
    "plan-builder": "交易计划",
    "historical-replay": "历史回放",
    "graduation-review": "毕业检查",
  };
  return labels[kind];
}

function conceptIcon(kind: InteractionKind, index: number) {
  if (kind === "direction-scenario") return index === 0 ? "↗" : index === 1 ? "↘" : "!";
  if (kind === "order-type-matcher") return ["⚡", "—", "◇"][index];
  if (kind === "price-role-matcher") return ["●", "◎", "◆"][index];
  if (kind === "evidence-board") return ["+", "−", "?"][index];
  if (kind === "graduation-review") return ["①", "②", "③"][index];
  return ["01", "02", "03"][index];
}
