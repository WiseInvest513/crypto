import { futuresCourseV2Chapter1Content } from "./futures-course-v2-chapter-1";
import { futuresCourseV2Chapter2Content } from "./futures-course-v2-chapter-2";
import { futuresCourseV2Chapter3Content } from "./futures-course-v2-chapter-3";
import { futuresCourseV2Chapters45Content } from "./futures-course-v2-chapters-4-5";

export const FUTURES_INTRO_COURSE_ID = "futures-intro" as const;
export const FUTURES_INTRO_CONTENT_VERSION = "futures-intro-v2" as const;

export const futuresChapterIds = [
  "chapter-1-contract-basics",
  "chapter-2-leverage-risk",
  "chapter-3-candlesticks",
  "chapter-4-indicators-levels",
  "chapter-5-planning-replay",
] as const;

export type FuturesChapterId = (typeof futuresChapterIds)[number];

export const futuresFullPathLessonIds = [
  "lesson-01-spot-vs-perpetual",
  "lesson-02-long-short-pnl",
  "lesson-03-notional-margin",
  "lesson-04-order-types",
  "lesson-05-price-roles",
  "lesson-06-leverage",
  "lesson-07-margin-modes",
  "lesson-08-liquidation-maintenance-margin",
  "lesson-09-funding-fees",
  "lesson-10-risk-budget",
  "lesson-11-take-profit-stop-loss-risk-reward",
  "lesson-12-ohlc-wicks",
  "lesson-13-timeframe-closed-candle",
  "lesson-14-volume",
  "lesson-15-market-structure-multi-timeframe",
  "lesson-16-ema",
  "lesson-17-ema-ordering-crossovers",
  "lesson-18-bollinger-bands",
  "lesson-19-support-resistance-zones",
  "lesson-20-fibonacci-retracement",
  "lesson-21-volume-profile-oi-liquidations",
  "lesson-22-trend-range-breakout",
  "lesson-23-confluence-conflict",
  "lesson-24-trigger-confirmation-invalidation",
  "lesson-25-simulated-plan",
  "lesson-26-graduation-review",
] as const;

export type FuturesLessonId = (typeof futuresFullPathLessonIds)[number];
export type LearningPath = "quick" | "full";

export const futuresQuickPathLessonIds = [
  "lesson-01-spot-vs-perpetual",
  "lesson-02-long-short-pnl",
  "lesson-06-leverage",
  "lesson-08-liquidation-maintenance-margin",
  "lesson-10-risk-budget",
  "lesson-13-timeframe-closed-candle",
  "lesson-16-ema",
  "lesson-19-support-resistance-zones",
] as const satisfies readonly FuturesLessonId[];

export const interactionKinds = [
  "spot-perpetual-comparison",
  "direction-scenario",
  "notional-margin-breakdown",
  "order-type-matcher",
  "price-role-matcher",
  "leverage-simulator",
  "margin-mode-comparison",
  "liquidation-boundary",
  "cost-ledger",
  "risk-budget",
  "risk-reward-plan",
  "candle-anatomy",
  "closed-candle-timeline",
  "volume-comparison",
  "multi-timeframe-map",
  "ema-layer-toggle",
  "ema-ordering-sort",
  "bollinger-band-context",
  "key-zone-selector",
  "fibonacci-anchor",
  "market-context-layers",
  "regime-classifier",
  "evidence-board",
  "plan-builder",
  "historical-replay",
  "graduation-review",
] as const;

export type InteractionKind = (typeof interactionKinds)[number];
export type QuizOptionId = "a" | "b" | "unsure";

export type QuizOption = Readonly<{
  id: QuizOptionId;
  label: string;
}>;

type LegacyLessonQuiz = Readonly<{
  question: string;
  options: readonly [QuizOption, QuizOption, QuizOption];
  correctOptionId: Exclude<QuizOptionId, "unsure">;
  explanation: string;
}>;

export const quizKinds = ["concept", "scenario", "boundary"] as const;
export type QuizKind = (typeof quizKinds)[number];

export type LessonQuiz<K extends QuizKind = QuizKind> = Readonly<{
  id: `${FuturesLessonId}-${K}`;
  kind: K;
  title: string;
  question: string;
  options: readonly [QuizOption, QuizOption, QuizOption];
  correctOptionId: Exclude<QuizOptionId, "unsure">;
  correctExplanation: string;
  incorrectExplanation: string;
}>;

export type LessonQuizzes = readonly [
  LessonQuiz<"concept">,
  LessonQuiz<"scenario">,
  LessonQuiz<"boundary">,
];

export type LessonDeepDive = Readonly<{
  estimatedMinutes: number;
  learningGoals: readonly [string, string];
  keyTerms: readonly Readonly<{
    term: string;
    definition: string;
  }>[];
  mechanismSteps: readonly Readonly<{
    title: string;
    detail: string;
  }>[];
  workedExample: Readonly<{
    setup: string;
    steps: readonly [string, string, string];
    observation: string;
    limitation: string;
  }>;
  boundary: Readonly<{
    canTell: readonly [string, string];
    cannotTell: readonly [string, string];
  }>;
  recap: string;
  nextLessonBridge: string;
}>;

export type LessonDefinition = Readonly<{
  id: FuturesLessonId;
  chapterId: FuturesChapterId;
  order: number;
  title: string;
  summary: string;
  takeaway: string;
  explanation: Readonly<{
    definition: string;
    whyItMatters: string;
    example: string;
    commonMistake: string;
    keyPoints: readonly [string, string, string];
  }>;
  deepDive: LessonDeepDive;
  isQuickPath: boolean;
  interaction: Readonly<{
    kind: InteractionKind;
    instruction: string;
  }>;
  quizzes: LessonQuizzes;
  riskNote: string;
}>;

type BaseLessonDefinition = Omit<LessonDefinition, "deepDive" | "quizzes"> &
  Readonly<{
    quiz: LegacyLessonQuiz;
  }>;

export type ChapterDefinition = Readonly<{
  id: FuturesChapterId;
  order: number;
  title: string;
  summary: string;
  introduction: string;
  learningObjectives: readonly [string, string, string];
  completionOutcome: string;
  lessons: readonly LessonDefinition[];
}>;

type BaseChapterDefinition = Omit<ChapterDefinition, "lessons"> &
  Readonly<{
    lessons: readonly BaseLessonDefinition[];
  }>;

export type FuturesIntroCourse = Readonly<{
  id: typeof FUTURES_INTRO_COURSE_ID;
  contentVersion: typeof FUTURES_INTRO_CONTENT_VERSION;
  title: string;
  summary: string;
  riskNote: string;
  chapters: readonly ChapterDefinition[];
}>;

type BaseFuturesIntroCourse = Omit<FuturesIntroCourse, "chapters"> &
  Readonly<{
    chapters: readonly BaseChapterDefinition[];
  }>;

type ScenarioQuizSeed = Readonly<{
  question: string;
  optionA: string;
  optionB: string;
  correctOptionId: Exclude<QuizOptionId, "unsure">;
  correctExplanation: string;
  incorrectExplanation: string;
}>;

type LessonV2ContentSeed =
  | (LessonDeepDive &
      Readonly<{
        scenarioQuiz: ScenarioQuizSeed;
      }>)
  | Readonly<{
      deepDive: LessonDeepDive;
      scenarioQuiz: ScenarioQuizSeed;
    }>;

const unsureOption = {
  id: "unsure",
  label: "我暂时不确定",
} as const satisfies QuizOption;

const futuresIntroCourseBase = {
  id: FUTURES_INTRO_COURSE_ID,
  contentVersion: FUTURES_INTRO_CONTENT_VERSION,
  title: "合约入门",
  summary:
    "用五章二十六关理解合约规则、风险控制和图表观察方法；也可以先完成八个核心关卡。",
  riskNote:
    "本课程仅用于教育，不构成投资建议。合约交易可能迅速损失全部保证金，请先理解规则与风险。",
  chapters: [
    {
      id: "chapter-1-contract-basics",
      order: 1,
      title: "合约基础",
      summary: "先分清交易对象、盈亏方向和订单价格，再理解仓位是怎样建立的。",
      introduction:
        "合约界面里同时出现仓位、保证金、订单和多种价格，新手最容易把它们当成同一件事。本章先建立一张基础地图：你究竟持有什么，做多与做空怎样形成盈亏，名义价值为何不同于保证金，以及订单与标记价分别解决什么问题。先把这些关系说清楚，后面的杠杆和图表才不会建立在错误理解上。",
      learningObjectives: [
        "区分现货资产持有与永续合约仓位",
        "解释多空盈亏、名义价值和保证金的关系",
        "识别订单类型及最新价、指数价、标记价的用途",
      ],
      completionOutcome:
        "学完后，你能看懂合约界面的基本名词，并用自己的话说明正在交易什么、价格如何影响仓位，以及哪些数字不能混为一谈。",
      lessons: [
        {
          id: "lesson-01-spot-vs-perpetual",
          chapterId: "chapter-1-contract-basics",
          order: 1,
          title: "现货与永续合约",
          summary: "比较账户现货余额与衍生品仓位的区别。",
          takeaway: "普通现货交易通常增加账户现货余额；永续合约记录的是围绕价格变化结算的衍生品仓位。",
          explanation: {
            definition:
              "普通现货交易完成后，平台账户通常增加对应现货余额，能否提取及托管方式仍受平台规则约束；永续合约记录的是围绕标的价格结算、通常不设固定到期日的衍生品仓位。合约可以表达做多或做空方向，常允许使用杠杆，还可能定期发生资金费率结算。",
            whyItMatters:
              "持有关系不同，风险也不同。普通无杠杆现货持有本身不会因保证金不足触发合约式强平，而合约仓位可能在不利波动中迅速侵蚀保证金并触发强平。",
            example:
              "假设两位学习者都看同一资产：一位买入普通无杠杆现货，账户里增加资产数量；另一位建立永续多仓，账户里记录仓位、保证金和未实现盈亏。价格变化时两者都可能出现损益，但后者还要面对杠杆、资金费率和清算规则。",
            commonMistake:
              "常见误区是把“合约多仓”当成“拥有更多现货”，或认为永续没有到期日就能一直持有。实际上资金费用、保证金变化和强平边界会持续影响仓位。",
            keyPoints: [
              "普通现货对应账户现货余额，永续对应衍生品仓位",
              "永续可做多或做空，并可能使用杠杆",
              "资金费率和强平风险属于合约的重要边界",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "spot-perpetual-comparison",
            instruction: "将“账户现货余额、可使用杠杆、存在资金费率”放入对应交易方式。",
          },
          quiz: {
            question: "永续合约与现货最核心的区别是什么？",
            options: [
              { id: "a", label: "永续合约交易的是衍生品仓位，而非直接持有对应资产" },
              { id: "b", label: "永续合约只是延后交割的现货，仓位最终会自动变成现货余额" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "永续合约通常不设固定到期日，盈亏随仓位方向和价格变化结算；它不等同于直接持有现货资产。",
          },
          riskNote: "永续合约可能使用杠杆并产生资金费率，风险结构与现货不同。",
        },
        {
          id: "lesson-02-long-short-pnl",
          chapterId: "chapter-1-contract-basics",
          order: 2,
          title: "做多、做空与盈亏方向",
          summary: "用价格变化方向理解多仓与空仓的机械盈亏。",
          takeaway: "多仓通常随价格上涨产生正向盈亏，空仓通常随价格下跌产生正向盈亏。",
          explanation: {
            definition:
              "做多表示仓位的机械盈亏与价格变化同向：价格高于入场基准时通常为正，低于时通常为负。做空则相反，价格下降通常带来正向盈亏，价格上升通常带来负向盈亏。这里描述的是结算方向，不是对未来行情的判断。",
            whyItMatters:
              "只有先分清方向，才能正确设置止损、目标和风险预算；把空仓当成“先卖出现货”会导致对损失边界的误解。",
            example:
              "在一段纯教学价格路径中，先让价格向上移动，再向下移动。多仓的未实现盈亏会随前一段改善、随后回落；空仓则呈相反变化。加入手续费后，两边的净结果都会比不计成本时更低。",
            commonMistake:
              "常见误区是认为做空的最大损失与现货下跌一样有限。价格上涨没有预设上限，空仓若缺少风险边界，损失可能持续扩大。",
            keyPoints: [
              "多仓与价格变化同向，空仓与价格变化反向",
              "盈亏方向不等于行情预测",
              "多空都需要事先定义风险和退出条件",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "direction-scenario",
            instruction: "切换价格上涨或下跌，观察多仓与空仓的盈亏方向如何改变。",
          },
          quiz: {
            question: "在不考虑费用时，价格下跌通常会怎样影响空仓？",
            options: [
              { id: "a", label: "产生正向盈亏" },
              { id: "b", label: "空仓只有平仓后才会受到价格变化影响" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "空仓的机械盈亏方向与价格变化相反；但实际结果仍受仓位规模、费用和执行价格影响。",
          },
          riskNote: "方向判断错误时，多仓和空仓都可能亏损；做空并不意味着风险更小。",
        },
        {
          id: "lesson-03-notional-margin",
          chapterId: "chapter-1-contract-basics",
          order: 3,
          title: "名义价值与保证金",
          summary: "分清实际控制的仓位规模与为其提供的保证金。",
          takeaway: "名义价值描述仓位规模，保证金是支持仓位的资金，两者不能混为一谈。",
          explanation: {
            definition:
              "名义价值表示仓位按产品规格折算后的总体规模，保证金是支持仓位的资金。合约张数还要结合乘数、线性或反向计价、保证金币种与结算币种换算；数量乘价格的简化关系不能套用到所有合约。",
            whyItMatters:
              "只看保证金会低估实际暴露。风险核算必须同时看到名义价值、保证金占用和入场到失效位置的距离。",
            example:
              "教学面板把一个仓位拆成“完整仓位条”和“保证金条”。提高杠杆时，若保持名义价值不变，保证金条会缩短，但价格每变化同样幅度时，仓位金额损益并不会因为保证金变少而同步缩小。",
            commonMistake:
              "常见误区是说“我只放了少量保证金，所以只承担少量风险”。强平、滑点和费用都可能让保证金快速减少，最终结果还取决于平台规则。",
            keyPoints: [
              "名义价值需按具体合约乘数和计价规则换算",
              "保证金是支持仓位的资金而非风险上限",
              "杠杆改变资金占用，不消除名义仓位损益",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "notional-margin-breakdown",
            instruction: "调整名义仓位和杠杆，观察保证金占用与仓位规模的差异。",
          },
          quiz: {
            question: "哪一项更直接表示仓位控制了多大规模？",
            options: [
              { id: "a", label: "名义价值" },
              { id: "b", label: "保证金余额" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "名义价值表示仓位规模；保证金是用于支持该仓位的资金，使用杠杆后两者通常不同。",
          },
          riskNote: "保证金较少不代表风险较少，盈亏仍按名义仓位规模变化。",
        },
        {
          id: "lesson-04-order-types",
          chapterId: "chapter-1-contract-basics",
          order: 4,
          title: "市价单、限价单与条件单",
          summary: "理解立即成交、价格约束与条件触发的差异。",
          takeaway: "条件触发不等于成交；市价、限价与只减仓分别解决不同执行问题。",
          explanation: {
            definition:
              "市价单优先按可获得价格成交，限价单先规定价格边界。条件单要等参考价格满足条件后，才提交市价或限价委托；触发只是提交下一步订单，不代表已经成交。",
            whyItMatters:
              "订单类型决定主要承担滑点还是未成交风险。快速波动时，止损市价可能明显滑点，止损限价则可能无法退出。",
            example:
              "教学订单簿中，止损条件被触发后，止损市价跨档成交并产生滑点；止损限价只提交到指定边界，行情快速越过时可能部分成交或不成交。勾选只减仓只能避免订单增加或反向建立仓位。",
            commonMistake:
              "常见误区是把触发提示当成成交回报，或认为只减仓会保证止损完成。真实仓位必须按实际成交数量与均价核对。",
            keyPoints: [
              "市价单优先成交但可能产生滑点",
              "限价单限制价格但可能不成交",
              "条件触发和只减仓都不保证成交",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "order-type-matcher",
            instruction: "根据“优先成交、限制价格或等待触发”的目标匹配市价单、限价单与条件单。",
          },
          quiz: {
            question: "当用户更重视限制成交价格时，哪类订单更符合这一目标？",
            options: [
              { id: "a", label: "限价单" },
              { id: "b", label: "市价单，因为它会锁定提交订单时看到的价格" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "限价单设置可接受的价格边界，但可能无法成交；市价单优先成交，也可能受滑点影响。",
          },
          riskNote: "条件单和只减仓都不是成交保证；流动性、跳空或系统状态仍可能导致滑点或未成交。",
        },
        {
          id: "lesson-05-price-roles",
          chapterId: "chapter-1-contract-basics",
          order: 5,
          title: "最新价、指数价与标记价",
          summary: "了解交易界面中三类价格承担的不同角色。",
          takeaway: "最新价记录最近成交，指数价参考外部现货，标记价常用于未实现盈亏和强平判断。",
          explanation: {
            definition:
              "最新价是该合约最近一笔成交的记录；指数价通常综合一个或多个现货市场，尝试代表标的参考价格；标记价则在指数价基础上结合基差等机制，常用于计算未实现盈亏和判断强平。三者可能短暂不同。",
            whyItMatters:
              "如果只盯最新成交价，可能误判强平距离或未实现盈亏。理解价格角色，才能知道界面上的变化由哪一种规则驱动。",
            example:
              "教学面板让某一笔最新成交短暂偏离外部现货参考。此时最新价先变化，指数价相对平稳，标记价按平台机制调整。强平提示跟随标记价，而不是简单复制那一笔异常成交。",
            commonMistake:
              "常见误区是把三个价格当成同一个数，或认为所有平台的标记价算法完全一致。指数成分、更新频率和保护机制都可能不同。",
            keyPoints: [
              "最新价记录最近成交",
              "指数价提供外部现货参考",
              "标记价常用于风险与强平判断且规则因平台而异",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "price-role-matcher",
            instruction: "把成交记录、现货参考和风险计算分别匹配到对应价格。",
          },
          quiz: {
            question: "交易所通常用哪类价格降低单一成交异常对强平判断的影响？",
            options: [
              { id: "a", label: "标记价" },
              { id: "b", label: "任意一笔最新成交价" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "标记价通常结合指数与基差机制，用于未实现盈亏和强平判断；具体规则以交易所为准。",
          },
          riskNote: "不同交易所的指数成分、标记价算法和异常处理规则并不相同。",
        },
      ],
    },
    {
      id: "chapter-2-leverage-risk",
      order: 2,
      title: "杠杆与风控",
      summary: "先看损失怎样被放大，再建立保证金、仓位和退出条件的边界。",
      introduction:
        "杠杆不是一个孤立的倍数，它会同时改变保证金占用、盈亏相对本金的幅度和距离强平的空间。本章沿着一笔仓位的风险链条展开：先理解杠杆，再比较逐仓与全仓，拆解维持保证金、资金费率和交易成本，最后从可承受损失反推仓位、止损与风险回报。每一步都强调估算与交易所真实规则的差别。",
      learningObjectives: [
        "说明杠杆、保证金模式与强平风险如何关联",
        "识别资金费率、手续费、滑点等非方向成本",
        "根据风险预算和失效距离核算仓位计划",
      ],
      completionOutcome:
        "学完后，你能在不依赖精确强平承诺的前提下检查一笔合约仓位，明确最多愿意承担什么风险、哪些成本尚未计入。",
      lessons: [
        {
          id: "lesson-06-leverage",
          chapterId: "chapter-2-leverage-risk",
          order: 6,
          title: "杠杆会放大什么",
          summary: "观察同一价格变化在不同杠杆下对保证金回报率的影响。",
          takeaway: "杠杆同时放大收益与损失相对保证金的幅度，并压缩可承受的不利空间。",
          explanation: {
            definition:
              "杠杆描述名义仓位相对初始保证金的比例。提高杠杆可以用较少保证金支持相同名义仓位，也可以在保证金不变时建立更大的名义仓位。无论哪种方式，杠杆都不会改变市场价格本身，只会改变资金暴露和风险速度。",
            whyItMatters:
              "新手常把杠杆理解为收益按钮，却忽略同样的不利波动也会更快侵蚀保证金，并把仓位推向强平边界。",
            example:
              "在教学滑块中保持名义仓位不变，逐步提高杠杆：初始保证金占用下降，但相同价格变化产生的金额盈亏不变，因此盈亏占保证金的比例明显提高。若改为保持保证金不变，名义仓位还会随杠杆扩大。",
            commonMistake:
              "常见误区是认为较高杠杆只提高资金效率，不增加风险。真正风险还取决于名义仓位是否扩大、保证金模式和退出纪律。",
            keyPoints: [
              "杠杆连接名义仓位与保证金",
              "收益和损失相对保证金都会被放大",
              "比较杠杆时必须说明保持什么变量不变",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "leverage-simulator",
            instruction: "保持名义仓位或保证金之一不变，分别比较不同杠杆下的结果。",
          },
          quiz: {
            question: "提高杠杆后，哪项描述最准确？",
            options: [
              { id: "a", label: "损益相对保证金的波动通常会被放大" },
              { id: "b", label: "只会减少保证金占用，不会改变仓位接近清算的速度" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "杠杆减少同等名义仓位所需的初始保证金，但不会消除名义仓位产生的损益。",
          },
          riskNote: "高杠杆会让小幅不利波动更快侵蚀保证金，并增加强平风险。",
        },
        {
          id: "lesson-07-margin-modes",
          chapterId: "chapter-2-leverage-risk",
          order: 7,
          title: "逐仓与全仓",
          summary: "比较单个仓位与账户共享保证金的风险边界。",
          takeaway: "逐仓限制单仓可用保证金；全仓共享账户余额，也会扩大仓位之间的风险关联。",
          explanation: {
            definition:
              "逐仓模式为单个仓位划定相对独立的保证金范围，增加保证金通常需要明确操作；全仓模式则允许符合规则的仓位共享账户可用保证金。全仓可能延后某个仓位的强平，但也让账户内其他资金暴露在同一风险池中。",
            whyItMatters:
              "保证金模式决定不利波动会影响哪些资金。选择模式前必须理解风险是被隔离，还是会在多个仓位和余额之间传递。",
            example:
              "教学账户同时放置两个仓位。一个仓位持续亏损时，逐仓面板只显示其分配保证金减少；全仓面板则显示账户可用余额参与维持。前者边界较集中，后者可能牵连更多资金。",
            commonMistake:
              "常见误区是认为全仓更安全，因为表面强平距离更远；也有人认为逐仓最多只损失初始保证金。追加保证金、费用和平台清算过程都会改变实际结果。",
            keyPoints: [
              "逐仓强调单仓保证金边界",
              "全仓共享余额并扩大仓位关联",
              "模式选择不会替代仓位和止损管理",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "margin-mode-comparison",
            instruction: "模拟一个仓位发生亏损，观察逐仓与全仓下哪些资金会被用于维持仓位。",
          },
          quiz: {
            question: "全仓模式的主要特征是什么？",
            options: [
              { id: "a", label: "多个仓位可能共享账户可用保证金" },
              { id: "b", label: "每个仓位的损失都被固定隔离" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "全仓模式允许多个仓位共享可用保证金；逐仓则更强调单仓隔离，但具体清算规则仍以交易所为准。",
          },
          riskNote: "全仓可能让单个仓位影响更多账户资金；逐仓也不保证避免损失。",
        },
        {
          id: "lesson-08-liquidation-maintenance-margin",
          chapterId: "chapter-2-leverage-risk",
          order: 8,
          title: "强平与维持保证金",
          summary: "理解为什么强平不是简单的“反向波动百分比”。",
          takeaway: "当仓位权益不足以满足维持保证金要求时可能触发强平，真实边界由多项规则共同决定。",
          explanation: {
            definition:
              "交易所要求仓位权益持续高于维持保证金。当按标记价计算的仓位权益接近或低于相应档位要求时，平台可能进入减仓或强平流程。初始保证金、维持保证金率、仓位大小、保证金模式、费用和标记价都会参与真实判断。",
            whyItMatters:
              "强平发生前不一定有充足时间人工处理。只用“杠杆倒数”估算会忽略维持保证金和费用，造成虚假的安全距离。",
            example:
              "教学模型先只显示杠杆，再逐项加入维持保证金、预估平仓费用和全仓余额。每加入一项，概念性边界都会移动，说明单一倍数无法给出平台级精确结果。模型只展示影响方向，不声称复刻某家交易所。",
            commonMistake:
              "常见误区是把页面估算值当成保证成交的强平价，或认为设置普通止损就一定先于强平成交。快速行情、滑点和平台规则可能改变执行顺序。",
            keyPoints: [
              "强平围绕仓位权益与维持保证金判断",
              "标记价、档位、费用和模式都会影响边界",
              "概念估算不能替代交易所实时风险参数",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "liquidation-boundary",
            instruction: "逐项开启维持保证金、费用和保证金模式，观察概念性强平边界如何变化。",
          },
          quiz: {
            question: "为什么不能只用“杠杆倍数的倒数”当作精确强平幅度？",
            options: [
              { id: "a", label: "维持保证金档位、费用和仓位模式也会改变结果" },
              { id: "b", label: "杠杆倍数已经包含平台差异，因此其倒数就是统一强平幅度" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "杠杆倒数只能帮助理解量级，不能替代交易所的维持保证金、费用、标记价和清算规则。",
          },
          riskNote: "本课程不提供交易所级精确强平价；请以实际平台规则和风险提示为准。",
        },
        {
          id: "lesson-09-funding-fees",
          chapterId: "chapter-2-leverage-risk",
          order: 9,
          title: "资金费率与交易费用",
          summary: "把方向盈亏之外的持仓成本加入账本。",
          takeaway: "资金费率在多空之间定期结算，手续费和滑点也会持续改变净结果。",
          explanation: {
            definition:
              "永续合约通过资金费率机制帮助合约价格靠近现货参考。常见规则下，费率为正时通常由多头持仓者向空头持仓者支付，费率为负时通常相反；具体费率、结算间隔和上下限可能调整。开平仓手续费、滑点也属于独立成本。",
            whyItMatters:
              "屏幕上的方向盈亏不是最终净结果。持仓越久、调整越频繁，资金费和交易成本越可能累积并改变计划。",
            example:
              "教学账本把一笔仓位拆成价格盈亏、开仓费、可能发生的资金费、平仓费和滑点。即使价格最终回到起点，成本栏仍可能为负；费率方向变化时，支付方也可能随之改变。",
            commonMistake:
              "常见误区是把某一时刻看到的资金费率外推到整个持仓期，或者只计算开仓费。费率会变化，平仓和执行质量同样需要计入。",
            keyPoints: [
              "资金费率是多空之间的定期结算机制",
              "费率方向与数值会随规则和市场变化",
              "净结果还要扣除开平仓费用和滑点",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "cost-ledger",
            instruction: "将开仓费、平仓费、滑点和资金费加入一笔持仓的成本清单。",
          },
          quiz: {
            question: "资金费率为正时，通常是哪一方支付资金费？",
            options: [
              { id: "a", label: "多方支付给空方" },
              { id: "b", label: "无论费率正负，都由当前持仓亏损的一方支付" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "常见永续合约规则下，正资金费率通常由多方支付给空方；结算频率和计算口径以交易所为准。",
          },
          riskNote: "资金费率会变化，长时间持仓的累计成本可能与最初看到的费率不同。",
        },
        {
          id: "lesson-10-risk-budget",
          chapterId: "chapter-2-leverage-risk",
          order: 10,
          title: "先确定风险预算",
          summary: "从可以承受的损失反推仓位，而不是先决定仓位再寻找止损。",
          takeaway: "单笔风险预算与入场到止损的距离共同决定可承受的仓位数量。",
          explanation: {
            definition:
              "风险预算是你愿意为一笔计划承担的最大预设损失金额。基础仓位算法先用账户规模和风险比例得到预算，再用预算除以入场到失效位置的单位风险距离，反推出可承受数量，而不是从想要的收益倒推仓位。",
            whyItMatters:
              "同样的方向观点，止损距离不同，合理数量也不同。先确定预算能避免因为“看起来机会很好”而临时放大仓位。",
            example:
              "教学工具保持风险预算不变，逐渐把失效位置放远。每单位资产需要承担的价格距离变大，可承受数量就相应减少；把失效位置拉近时数量会上升，但更近的边界也更容易被波动触及。",
            commonMistake:
              "常见误区是先选择整数仓位，再移动止损让公式看起来合适；另一误区是把预设损失当成实际损失上限，忽略跳空、滑点和费用。",
            keyPoints: [
              "先定义可承受风险，再计算仓位",
              "止损距离越大，同预算下数量越小",
              "预算是计划值，不是实际损失保证",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "risk-budget",
            instruction: "调整风险预算和止损距离，观察允许的仓位数量如何变化。",
          },
          quiz: {
            question: "在风险预算不变时，止损距离扩大通常应怎样调整仓位？",
            options: [
              { id: "a", label: "减小仓位数量" },
              { id: "b", label: "增加仓位数量" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "止损距离扩大意味着每单位仓位承担更多价格风险，因此需减少数量才能维持相同风险预算。",
          },
          riskNote: "跳空、滑点和流动性不足可能让实际损失超过预设风险预算。",
        },
        {
          id: "lesson-11-take-profit-stop-loss-risk-reward",
          chapterId: "chapter-2-leverage-risk",
          order: 11,
          title: "止盈、止损与风险回报",
          summary: "用入场、失效和目标之间的距离检查计划结构。",
          takeaway: "风险回报比只比较价格距离，不代表目标会到达，也不等同于策略胜率。",
          explanation: {
            definition:
              "风险回报比比较入场到止损的风险距离，与入场到目标的潜在回报距离。常见写法把单位风险记为一，再说明目标距离是它的多少倍。这个比例只描述计划几何关系，不包含胜率、费用或成交概率。",
            whyItMatters:
              "它能帮助发现目标过近、止损过远或方向价格顺序错误，但不能回答市场是否会按计划运行。",
            example:
              "教学图上移动止损和目标：目标不动、止损离入场更远时，风险回报比下降；止损不动、目标更远时比例上升。然而更远目标并不会因此更容易到达，只是距离关系发生变化。",
            commonMistake:
              "常见误区是只追求更大的数字，随意把目标放远，或把高风险回报比当作高质量交易。计划仍需有结构依据、确认规则和可执行性。",
            keyPoints: [
              "风险回报比只比较两个价格距离",
              "更大的比例不代表更高胜率",
              "费用、滑点和目标可达性需另行检查",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "risk-reward-plan",
            instruction: "移动止损与目标位置，观察风险距离、回报距离和比例如何变化。",
          },
          quiz: {
            question: "风险回报比为计划提供了什么信息？",
            options: [
              { id: "a", label: "目标距离相对止损距离的比例" },
              { id: "b", label: "目标距离更远，因此目标更容易到达" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "风险回报比是距离关系，不包含胜率、费用和成交质量，不能单独证明计划有效。",
          },
          riskNote: "止损和止盈可能因滑点或跳空无法按指定价格成交。",
        },
      ],
    },
    {
      id: "chapter-3-candlesticks",
      order: 3,
      title: "读懂 K 线",
      summary: "从单根 K 线到多周期结构，先学会准确描述已经发生的价格变化。",
      introduction:
        "K 线不是一幅直接给出答案的图，而是按固定周期整理过的价格记录。本章从开、高、低、收和影线开始，解释形成中与已闭合 K 线的区别，再加入成交量和多周期结构。目标不是背诵形态名称，而是学会准确说清楚：什么已经发生、什么仍在变化、观察结论属于哪个周期。",
      learningObjectives: [
        "准确读取一根 K 线的开高低收与影线",
        "区分形成中数据与已闭合确认",
        "在统一口径下比较成交量和多周期市场结构",
      ],
      completionOutcome:
        "学完后，你能从 K 线图提取可核验事实，避免用一根影线或一个短周期片段替代完整的市场结构判断。",
      lessons: [
        {
          id: "lesson-12-ohlc-wicks",
          chapterId: "chapter-3-candlesticks",
          order: 12,
          title: "开高低收与影线",
          summary: "认识一根 K 线记录的四个价格与区间信息。",
          takeaway: "实体连接开盘与收盘，影线记录周期内触及但未维持到收盘的高低位置。",
          explanation: {
            definition:
              "一根 K 线压缩了固定周期内的四个核心价格：开盘、最高、最低和收盘。实体连接开盘与收盘，颜色通常表达收盘相对开盘的方向；上下影线延伸到周期内的最高和最低位置，说明价格曾经到过那里。",
            whyItMatters:
              "如果把影线顶端当成收盘，或忽略周期长度，就会错误理解价格是否真正停留在某个区域之外。",
            example:
              "教学 K 线先向上触及一个区域，随后回落并在区域下方收盘。上影线保存了“曾经触及”的事实，实体收盘则保存“周期结束时回到下方”的事实；两者表达的信息并不相同。",
            commonMistake:
              "常见误区是看到长影线就直接命名反转，或者只看颜色不看高低点。单根 K 线必须放回前后结构和所选周期中理解。",
            keyPoints: [
              "开高低收共同定义一根 K 线",
              "影线表示周期内触及而非最终停留",
              "单根形态需要结合前后结构",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "candle-anatomy",
            instruction: "点击 K 线实体与上下影线，匹配开盘、最高、最低和收盘。",
          },
          quiz: {
            question: "上影线顶端通常对应什么？",
            options: [
              { id: "a", label: "该周期内的最高价" },
              { id: "b", label: "下一周期的开盘价" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation: "上影线顶端表示该周期内曾触及的最高价，但不代表价格在该处收盘。",
          },
          riskNote: "单根 K 线只描述一个周期，不能脱离上下文推导确定方向。",
        },
        {
          id: "lesson-13-timeframe-closed-candle",
          chapterId: "chapter-3-candlesticks",
          order: 13,
          title: "周期与已闭合 K 线",
          summary: "区分盘中变化与周期结束后的确认事实。",
          takeaway: "形成中的 K 线仍会变化，突破、失守和指标状态应明确是否等待闭合确认。",
          explanation: {
            definition:
              "K 线周期决定每根记录覆盖多长时间。周期尚未结束时，当前 K 线的最高、最低、收盘和成交量都可能继续变化；只有时间边界结束后的闭合 K 线，才成为不会再被盘中价格改写的历史记录。",
            whyItMatters:
              "EMA、突破和失守等判断若混用形成中与闭合数据，会在同一周期内反复改变，造成看似确认、随后又消失的错觉。",
            example:
              "教学时间轴让形成中 K 线一度越过压力区，随后在周期结束前回落。盘中可以记录“价格曾进入区域”，但只有最终收在区域上方，才符合预先约定的闭合突破规则。",
            commonMistake:
              "常见误区是把最新跳动价格称为“本周期收盘”，或在不同分析中随意切换确认标准。等待闭合能统一口径，却不能保证后续延续。",
            keyPoints: [
              "周期决定每根 K 线的时间范围",
              "形成中数据会继续变化",
              "确认规则必须预先说明是否采用闭合价",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "closed-candle-timeline",
            instruction: "推进一根形成中 K 线，观察盘中穿越与最终闭合结果的差别。",
          },
          quiz: {
            question: "为什么形成中的 K 线不应直接当作已确认突破？",
            options: [
              { id: "a", label: "收盘前价格仍可能回到区域内" },
              { id: "b", label: "盘中已经越过区域，所以可以按闭合结果记录" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "形成中 K 线有实时数据，但收盘位置尚未确定；是否确认必须与所采用的规则和周期一致。",
          },
          riskNote: "等待闭合能统一观察口径，但不能保证之后的价格延续。",
        },
        {
          id: "lesson-14-volume",
          chapterId: "chapter-3-candlesticks",
          order: 14,
          title: "成交量提供了什么",
          summary: "把价格变化与同周期的成交活跃程度放在一起看。",
          takeaway: "成交量反映该市场和周期的成交规模，比较时要保持交易场所、单位与周期一致。",
          explanation: {
            definition:
              "成交量记录指定交易场所、交易对和周期内完成的成交规模。它可以帮助比较某段价格变化伴随的活跃程度，但不同平台可能使用基础资产数量、计价资产金额或合约张数，口径不能直接混用。",
            whyItMatters:
              "价格变化相似时，成交活跃程度可能不同。量能提供背景证据，却不会单独告诉你买卖方向或后续结果。",
            example:
              "教学图把最新一根已闭合成交量与此前一组闭合 K 线的平均量比较。高于平均只能说明该周期在当前数据口径下更活跃；若最后一根仍在形成，则必须标注它尚未积累完整周期。",
            commonMistake:
              "常见误区是认为放量必涨、缩量必跌，或把单一交易所数据称为全市场成交量。成交双方同时存在，量能不等于净方向。",
            keyPoints: [
              "成交量必须带交易场所、单位和周期",
              "形成中成交量不能直接与完整周期比较",
              "量能是背景证据而非方向答案",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "volume-comparison",
            instruction: "将最新已闭合成交量与此前若干根的平均量比较。",
          },
          quiz: {
            question: "比较两根 K 线成交量前，首先应确认什么？",
            options: [
              { id: "a", label: "交易场所、计量单位与周期口径一致" },
              { id: "b", label: "只要图表柱高经过缩放后接近，就可以直接比较" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "不同场所、单位或周期的成交量不能直接混比；量能本身也不提供确定方向。",
          },
          riskNote: "单一交易所成交量不代表全市场，也不能独立证明突破有效。",
        },
        {
          id: "lesson-15-market-structure-multi-timeframe",
          chapterId: "chapter-3-candlesticks",
          order: 15,
          title: "市场结构与多周期",
          summary: "观察高低点结构在不同周期下为何可能给出不同描述。",
          takeaway: "短周期变化可嵌套在长周期结构中，多周期结论应分别陈述而不是强行合并。",
          explanation: {
            definition:
              "市场结构常用一系列已确认的高点和低点描述价格怎样推进或收缩。不同周期会把细节压缩成不同形状：短周期的一段明显上涨，可能只是长周期下跌过程中的局部反弹。每个结论都必须带上周期。",
            whyItMatters:
              "多周期观察能减少只截取局部片段的偏差，也能暴露短期和长期事实互相冲突的情况。",
            example:
              "教学片段在短周期上显示连续抬高的低点，切换到长周期后，这些 K 线被合并为一个反弹实体，而更早的主要高点仍未被越过。正确记录是同时保留两个周期的结构描述。",
            commonMistake:
              "常见误区是不断切换周期，直到找到支持原有想法的图，或把短周期变化直接称为长期反转。周期冲突应被展示，而不是被挑选掉。",
            keyPoints: [
              "结构由一系列高低点关系组成",
              "短周期变化可以嵌套在长周期之内",
              "周期冲突需要并列记录而非强行统一",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "multi-timeframe-map",
            instruction: "在同一历史片段中切换短周期和长周期，标记各自的高低点结构。",
          },
          quiz: {
            question: "短周期上行而长周期仍处于下行结构时，应怎样描述？",
            options: [
              { id: "a", label: "分别保留两个周期的客观事实" },
              { id: "b", label: "只选择更符合预期的一个周期" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "不同周期可以同时存在不同结构；清楚标注周期比把它们压成单一方向更可靠。",
          },
          riskNote: "切换周期会改变观察尺度，但不会消除信号冲突和市场不确定性。",
        },
      ],
    },
    {
      id: "chapter-4-indicators-levels",
      order: 4,
      title: "指标与关键区域",
      summary: "把均线、波动区间与关键区域作为观察工具，而不是确定答案。",
      introduction:
        "指标是对历史价格与成交数据的再计算，不是看见未来的工具。本章把 Wise Crypto 图表里的核心观察层逐一拆开：EMA 反映什么、排列和交叉为什么会滞后、布林带如何描述波动、支撑压力与 Fibonacci 为什么应看作区域，以及成交密集、OI 和爆仓数据各自能说明什么。重点始终是口径、确认与局限。",
      learningObjectives: [
        "解释 EMA、布林带和 Fibonacci 的计算含义与局限",
        "用区域和闭合边界描述支撑、压力及突破状态",
        "区分成交密集、OI 与爆仓数据的范围和用途",
      ],
      completionOutcome:
        "学完后，你能选择合适的图层回答具体问题，并清楚说明某项指标只是客观位置、辅助证据还是存在口径限制的数据。",
      lessons: [
        {
          id: "lesson-16-ema",
          chapterId: "chapter-4-indicators-levels",
          order: 16,
          title: "EMA：给近期价格更高权重",
          summary: "理解 EMA 的计算特征和价格相对均线的客观位置。",
          takeaway: "EMA 是历史收盘价的平滑结果，周期越短通常越敏感，也更容易随价格变化。",
          explanation: {
            definition:
              "指数移动平均线会对近期收盘价赋予更高权重，并保留更早数据递减后的影响。EMA 后面的周期数表示计算敏感度：较短周期通常更贴近近期价格，较长周期更平滑。它属于对历史数据的反应式、滞后指标。",
            whyItMatters:
              "EMA 能把杂乱价格整理成可比较的位置关系，但只有在周期、参数和 K 线闭合口径一致时，比较才有意义。",
            example:
              "教学图先依次打开 EMA10、EMA20 和 EMA50。价格快速变化时，EMA10 通常先响应，EMA50 调整更慢；若关闭形成中 K 线，已闭合时点的均线数值不会被盘中波动反复改写。",
            commonMistake:
              "常见误区是把“价格高于 EMA”直接翻译成买入，或认为短均线提前预测行情。它们只总结已经发生的价格，不包含确定的未来方向。",
            keyPoints: [
              "EMA 对近期收盘价赋予更高权重",
              "短周期更敏感，长周期更平滑",
              "价格相对 EMA 是事实而非交易指令",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "ema-layer-toggle",
            instruction: "依次显示 EMA10、EMA20 与 EMA50，比较它们对价格变化的响应。",
          },
          quiz: {
            question: "与较长周期 EMA 相比，较短周期 EMA 通常有什么特点？",
            options: [
              { id: "a", label: "对近期价格变化更敏感" },
              { id: "b", label: "由于响应更快，它可以比价格提前给出下一根方向" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "短周期 EMA 对近期价格赋予更高相对权重，因此响应更快，但不具备预测能力。",
          },
          riskNote: "价格高于或低于 EMA 只是位置事实，不等于开仓建议。",
        },
        {
          id: "lesson-17-ema-ordering-crossovers",
          chapterId: "chapter-4-indicators-levels",
          order: 17,
          title: "EMA 排列与交叉",
          summary: "描述多条均线的顺序，并识别交叉确认的时间边界。",
          takeaway: "均线排列反映已经形成的平滑结构，交叉属于滞后事实，可能反复出现。",
          explanation: {
            definition:
              "均线排列是同一时点多条 EMA 数值从高到低的顺序；交叉表示两条均线的相对顺序发生变化。由于每条线都由过去收盘价计算，交叉只能在价格变化之后出现，震荡环境中还可能频繁来回。",
            whyItMatters:
              "排列比单看一条线提供更多结构信息，但必须区分“已经发生的交叉”与“盘中看似即将交叉”。",
            example:
              "教学时间轴中，短周期 EMA 逐渐靠近长周期 EMA。形成中 K 线一度让两线互换，闭合前又恢复原顺序；只有使用约定的闭合数据，交叉事实才被记录，并注明所属周期。",
            commonMistake:
              "常见误区是给每种排列绑定固定多空结论，或在交叉后忽略价格已先行很远。排列描述结构，不提供固定胜率或无效边界。",
            keyPoints: [
              "排列比较同一时点多条 EMA 的顺序",
              "交叉是滞后且可能反复的事实",
              "形成中与闭合交叉必须明确区分",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "ema-ordering-sort",
            instruction: "按当前数值排列三条 EMA，并推进闭合 K 线观察交叉何时确认。",
          },
          quiz: {
            question: "EMA 交叉最准确的含义是什么？",
            options: [
              { id: "a", label: "两条历史价格平滑线的相对顺序发生变化" },
              { id: "b", label: "两条均线开始接近时，未来方向已经得到确认" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "交叉是均线相对位置变化的结果，具有滞后性，也可能在震荡中多次反复。",
          },
          riskNote: "均线交叉不能单独保证趋势延续，也不代表固定胜率。",
        },
        {
          id: "lesson-18-bollinger-bands",
          chapterId: "chapter-4-indicators-levels",
          order: 18,
          title: "布林带与波动范围",
          summary: "了解中轨和统计波动带如何随近期波动变化。",
          takeaway: "布林带围绕移动平均展示近期离散程度，带宽变化描述波动而非确定方向。",
          explanation: {
            definition:
              "布林带通常由一条移动平均中轨和按近期价格离散程度计算的上下轨组成。波动增大时带宽往往扩张，波动收缩时带宽往往变窄。参数、周期和价格来源都会改变轨道位置，因此它是动态统计范围。",
            whyItMatters:
              "它适合帮助观察价格相对近期波动范围的位置，却不能仅凭触轨判断反转或延续。",
            example:
              "教学图让价格波动从集中变得分散，上下轨随样本变化逐步张开；随后价格沿上轨运行数根 K 线。这个片段说明“触及上轨”可以持续发生，并不自动等于应该反向操作。",
            commonMistake:
              "常见误区是把上轨当作必跌压力、下轨当作必涨支撑，或忽略不同参数产生的差异。轨道只是相对位置，需要结合结构和确认规则。",
            keyPoints: [
              "布林带用均线和离散程度描述动态范围",
              "带宽反映近期波动变化而非方向",
              "触及或越过轨道本身不是买卖信号",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "bollinger-band-context",
            instruction: "调整波动程度，观察上下轨距离如何扩张或收缩。",
          },
          quiz: {
            question: "价格触及布林带上轨时，能否单独断定价格将下跌？",
            options: [
              { id: "a", label: "不能，触及只描述相对位置" },
              { id: "b", label: "能，上轨通常可以直接作为做空信号" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "价格可以沿着上轨或下轨持续运行；布林带需要结合市场结构和闭合确认理解。",
          },
          riskNote: "参数和样本周期会改变带宽，任何轨道都不是保证有效的边界。",
        },
        {
          id: "lesson-19-support-resistance-zones",
          chapterId: "chapter-4-indicators-levels",
          order: 19,
          title: "支撑与压力是区域",
          summary: "用区域边界表达反复发生价格反应的位置。",
          takeaway: "关键位置通常应视为范围；进入、离开与闭合在区域外是不同状态。",
          explanation: {
            definition:
              "支撑与压力用于描述过去价格多次出现反应的范围。当前价格在区域上方时，该区域可能被称为下方支撑候选；在区域下方时，可能被称为上方压力候选；价格位于上下沿之间，则应明确说正在区域内。",
            whyItMatters:
              "把关键位置画成区域，可以容纳影线、滑点和不同成交位置，避免假装市场只围绕一个精确数字反应。",
            example:
              "教学图选择一组相邻摆动点并聚合成价格带。盘中影线越过上沿、收盘回到区域内，只记录为短暂穿越；下一根闭合在上沿外，才满足预先设定的闭合确认条件。",
            commonMistake:
              "常见误区是不断增加线直到覆盖所有转折，或者事后移动边界配合结果。区域应有明确来源、确认方法和失效条件，并允许它不生效。",
            keyPoints: [
              "支撑与压力更适合表达为区域",
              "区域内、盘中穿越和闭合突破是不同状态",
              "关键区域必须允许失效",
            ],
          },
          isQuickPath: true,
          interaction: {
            kind: "key-zone-selector",
            instruction: "在历史图表上选择反复出现反应的范围，并用区域而非单点标记。",
          },
          quiz: {
            question: "价格短暂进入压力区域后又收回区域下方，应如何记录？",
            options: [
              { id: "a", label: "曾进入区域，但尚未形成区域上方的闭合确认" },
              { id: "b", label: "盘中进入过区域即可按突破记录，不必等待闭合" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "盘中进入与闭合突破不是同一事实；采用哪种确认规则也必须预先说明。",
          },
          riskNote: "支撑和压力可能失效，区域越宽也不代表可靠性越高。",
        },
        {
          id: "lesson-20-fibonacci-retracement",
          chapterId: "chapter-4-indicators-levels",
          order: 20,
          title: "斐波那契回撤的锚点",
          summary: "学习先选择明确波段，再读取比例位置。",
          takeaway: "斐波那契回撤是由两个锚点计算出的比例区间，结果高度依赖波段选择。",
          explanation: {
            definition:
              "斐波那契回撤工具先选择一个已经发生的波段高低锚点，再按固定比例把区间切分成若干潜在观察位置。比例公式是固定的，但起点、终点、方向和周期由使用者选择，因此不同锚点会得到不同位置。",
            whyItMatters:
              "它能帮助统一描述波段内部的回撤深度，但不能证明某个比例一定形成支撑或压力。",
            example:
              "教学图先框选一个完成的上行波段，系统展示波段内部的比例区域；随后把起点移到更早的低点，所有区域随之改变。练习要求先说明选择这段波动的结构理由，再读取比例。",
            commonMistake:
              "常见误区是在结果出现后反复更换锚点，直到某条比例恰好贴住转折，或把精确比例当成必然反转点。这会放大事后解释。",
            keyPoints: [
              "先确定波段与两个锚点，再计算比例",
              "回撤位置是潜在区域而非确定边界",
              "更换周期或锚点会改变全部结果",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "fibonacci-anchor",
            instruction: "在一段已完成波段上选择高低锚点，观察比例区间如何随锚点改变。",
          },
          quiz: {
            question: "为什么不同用户可能画出不同的斐波那契位置？",
            options: [
              { id: "a", label: "他们选择的波段与锚点可能不同" },
              { id: "b", label: "比例会根据用户预期自动改变" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "比例公式固定，但锚点选择决定计算范围，因此应明确记录波段与周期。",
          },
          riskNote: "比例位置不是自然形成的订单保证，也不能单独用作入场或止损。",
        },
        {
          id: "lesson-21-volume-profile-oi-liquidations",
          chapterId: "chapter-4-indicators-levels",
          order: 21,
          title: "成交密集、OI 与爆仓语境",
          summary: "区分价格成交分布、未平仓合约和强平事件的不同含义。",
          takeaway: "三类数据回答不同问题，来源与范围不一致时不能直接拼成单一结论。",
          explanation: {
            definition:
              "成交密集区尝试描述所选价格区间内较多成交出现在哪里；基于 K 线分桶时只是估算，不等于逐笔成本。OI 表示尚未平仓的合约规模。爆仓数据记录或聚合强制清算事件，三者的数据来源和覆盖范围可能完全不同。",
            whyItMatters:
              "把三类数据分开，才能避免把“成交多”“仓位多”和“某一方向被强平”误写成同一个方向信号。",
            example:
              "教学面板同时显示估算成交密集区域、单一场所 OI 变化和一段聚合爆仓记录。用户要先核对范围标签，再分别回答“哪里成交活跃”“未平仓规模是否改变”“发生了哪些清算”。",
            commonMistake:
              "常见误区是认为 OI 上升等于多仓增加，或把单一交易所数据包装为全市场。每份合约同时存在多空双方，聚合数据也可能不完整。",
            keyPoints: [
              "成交密集、OI 和爆仓回答不同问题",
              "K 线分桶成交密集属于估算",
              "不同场所与口径不能静默合并",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "market-context-layers",
            instruction: "为成交密集、OI 与爆仓数据分别选择它们能回答和不能回答的问题。",
          },
          quiz: {
            question: "OI 上升可以单独证明新增仓位主要是多仓吗？",
            options: [
              { id: "a", label: "不能，OI 只表示未平仓合约规模变化" },
              { id: "b", label: "能，因为每份新增合约都会被统计为新增多仓" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "每份合约同时有多空两方，OI 变化不直接给出净方向；还需保持数据场所与口径一致。",
          },
          riskNote: "聚合爆仓与估算成交密集数据可能不完整，不能包装成精确全市场事实。",
        },
      ],
    },
    {
      id: "chapter-5-planning-replay",
      order: 5,
      title: "交易计划与回放",
      summary: "把前面的事实组织成可检查、可失效、可复盘的模拟计划。",
      introduction:
        "理解单个指标之后，还需要把信息组织成能够检查的流程。本章不提供现成策略，而是训练如何区分趋势、震荡与突破，怎样同时保留共振和冲突，如何提前写下触发、确认与失效条件，再用当时可获得的历史数据完成模拟计划和回放。核心不是猜中方向，而是让每一步都有依据、有边界、可以复核。",
      learningObjectives: [
        "用预先约定的规则描述趋势、震荡和突破",
        "将支持、冲突、触发、确认与失效组织成计划",
        "使用无前视信息的历史回放检查执行与风险边界",
      ],
      completionOutcome:
        "学完后，你能完成一份不依赖未来数据的模拟计划，说明依据和未知项，并在假设失效时停止沿用原有判断。",
      lessons: [
        {
          id: "lesson-22-trend-range-breakout",
          chapterId: "chapter-5-planning-replay",
          order: 22,
          title: "趋势、震荡与突破",
          summary: "使用高低点和区域边界描述三类常见结构。",
          takeaway: "趋势、震荡和突破都是基于指定周期与确认规则的描述，结构可能随新数据改变。",
          explanation: {
            definition:
              "趋势通常描述一系列高低点持续向同一方向推进；震荡表示价格较长时间在相对明确的范围内往返；突破则表示价格按预先约定的规则离开关键区域。三种结构都依赖周期、样本范围和确认方式。",
            whyItMatters:
              "不同结构适合回答不同问题。若连当前观察的是趋势还是区间都没有定义，后续指标很容易互相矛盾。",
            example:
              "教学回放先展示价格在上下边界间反复，随后影线短暂越界并收回，最后出现闭合在区域外的 K 线。练习分别标记“仍在震荡”“盘中穿越”和“满足闭合突破规则”。",
            commonMistake:
              "常见误区是价格一越界就宣布新趋势，或在突破失败后继续沿用原标签。结构描述应随新闭合事实更新，并保留失效可能。",
            keyPoints: [
              "趋势由连续结构关系描述",
              "震荡需要明确上下范围",
              "突破必须绑定周期、边界和确认规则",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "regime-classifier",
            instruction: "根据高低点与闭合位置，为三个历史片段选择客观结构描述。",
          },
          quiz: {
            question: "确认价格突破一个压力区域时，首先要明确什么？",
            options: [
              { id: "a", label: "观察周期、区域边界与闭合确认规则" },
              { id: "b", label: "只要影线触及区域外，就可以沿用同一突破结论" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "不同周期和确认规则会得出不同记录；规则应在观察结果出现前先确定。",
          },
          riskNote: "突破可能失败或迅速回到原区域，结构标签不会消除执行风险。",
        },
        {
          id: "lesson-23-confluence-conflict",
          chapterId: "chapter-5-planning-replay",
          order: 23,
          title: "证据共振与冲突",
          summary: "同时保留互相支持和互相矛盾的事实。",
          takeaway: "多个条件一致称为共振，不同条件相反称为冲突；数量不是概率或胜率。",
          explanation: {
            definition:
              "共振表示来自不同观察角度的事实在同一时点指向相似结构，例如价格位置与某个周期结构一致；冲突则表示这些事实并不一致。未知或缺失数据应单独列出，不能为了得到整齐结论而删除。",
            whyItMatters:
              "明确冲突可以防止只挑支持自己想法的指标，也让计划知道还需要等待什么信息确认。",
            example:
              "教学证据板把 EMA 位置、关键区域、闭合成交量和长周期结构分别放入支持、冲突与未知栏。即使支持项较多，页面仍保留相反的长周期事实，并且不把项目数量换算成概率。",
            commonMistake:
              "常见误区是同一类指标重复计数，制造“多重确认”，或把三项中两项一致说成固定胜率。相关指标可能来自同一组价格数据，并非独立证据。",
            keyPoints: [
              "共振与冲突都必须如实保留",
              "缺失数据不能用猜测补齐",
              "条件数量不能直接换算为概率或胜率",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "evidence-board",
            instruction: "把 EMA、区域、成交量和多周期事实放入支持、冲突或未知三栏。",
          },
          quiz: {
            question: "三项观察中有两项一致，最准确的表达是什么？",
            options: [
              { id: "a", label: "两项条件一致，仍需保留第三项冲突或未知" },
              { id: "b", label: "两项一致时可以先忽略剩余冲突，把它当作多数结论" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "条件计数只是事实整理，不能直接换算成概率；冲突与缺失数据也应保留。",
          },
          riskNote: "技术条件共振仍可能同时失效，不能被描述为确定信号。",
        },
        {
          id: "lesson-24-trigger-confirmation-invalidation",
          chapterId: "chapter-5-planning-replay",
          order: 24,
          title: "触发、确认与失效",
          summary: "把一个观察想法拆成三个可以事后核对的条件。",
          takeaway: "触发提示开始关注，确认表示预设条件成立，失效说明原假设不再适用。",
          explanation: {
            definition:
              "触发条件说明什么时候开始关注一个情景；确认条件规定需要哪些已闭合事实才能认为假设暂时成立；失效条件则明确出现什么事实后应停止沿用原假设。三者应在结果出现前写下，并使用可观察的周期和区域边界。",
            whyItMatters:
              "提前区分三个阶段，可以减少盘中追着价格修改说法，也让复盘能够判断是规则问题还是执行偏差。",
            example:
              "教学计划把“价格进入压力区域”记为触发，把“指定周期闭合在上沿外”记为确认，把“重新闭合回失效边界内”记为失效。回放时只逐项勾选，不提前显示后续结果。",
            commonMistake:
              "常见误区是把触发直接当确认，或在走势不符合预期后把失效线越移越远。条件若可以事后随意修改，就失去检验价值。",
            keyPoints: [
              "触发表示开始观察而非立即执行",
              "确认使用预先定义的可核验事实",
              "失效出现后应停止沿用原假设",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "plan-builder",
            instruction: "为一个历史片段分别填写客观触发、闭合确认和失效条件。",
          },
          quiz: {
            question: "为什么计划必须提前写出失效条件？",
            options: [
              { id: "a", label: "便于判断原假设何时不再适用" },
              { id: "b", label: "失效条件可以在走势不利后再调整，以避免过早退出" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "失效条件让计划可以被核对和停止沿用，但无法保证成交价格或限制全部损失。",
          },
          riskNote: "失效条件不是保证成交的止损价，跳空和流动性仍可能扩大损失。",
        },
        {
          id: "lesson-25-simulated-plan",
          chapterId: "chapter-5-planning-replay",
          order: 25,
          title: "组装一份模拟计划",
          summary: "把方向假设、风险预算、关键区域和退出规则放在同一张检查表。",
          takeaway: "完整计划应区分事实、假设和执行边界，并在行动前确定风险预算。",
          explanation: {
            definition:
              "模拟计划是一张结构化检查表：先记录资产、周期和已经闭合的市场事实，再写方向假设、触发、确认与失效，最后加入风险预算、仓位计算、费用边界和不执行条件。它是思考工具，不会替用户生成交易指令。",
            whyItMatters:
              "把信息放在同一张表上，可以及时发现方向有了但风险预算缺失，或目标存在却没有确认与失效依据。",
            example:
              "教学任务提供一个隐藏后续数据的历史片段。学习者只能选择当时可见的结构与区域，填写模拟风险预算，并勾选尚未确认的项目；计划保存后才逐根推进，用来检查规则是否被遵守。",
            commonMistake:
              "常见误区是只写入场与目标，不写不执行条件，或根据回放结果反向美化原计划。模拟练习评价的是过程完整，不是最终盈亏。",
            keyPoints: [
              "计划要分开记录事实、假设和未知项",
              "确认、失效与风险预算必须在行动前明确",
              "模拟结果不能证明未来策略表现",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "historical-replay",
            instruction: "只使用历史片段当时已经闭合的数据组装计划，再逐根推进查看结果。",
          },
          quiz: {
            question: "历史回放中，哪些信息可以用于当时的计划？",
            options: [
              { id: "a", label: "回放时点之前已经闭合并可获得的数据" },
              { id: "b", label: "整段结束后出现的高低点也可以用于还原当时计划" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "只使用当时可获得的信息可以避免前视偏差；后续数据只能用于检查结果。",
          },
          riskNote: "历史回放不代表未来表现，也不能用精选片段证明策略有效。",
        },
        {
          id: "lesson-26-graduation-review",
          chapterId: "chapter-5-planning-replay",
          order: 26,
          title: "毕业检查：先守住风险边界",
          summary: "用一份综合检查确认自己能区分事实、假设与风险。",
          takeaway: "完成课程表示理解基础概念，不代表获得交易资格、盈利能力或 Wise 策略授权。",
          explanation: {
            definition:
              "毕业检查把课程内容合并为一次风险优先的复核：能否区分现货与合约，解释杠杆、保证金和强平，正确读取闭合 K 线与指标，并完成带确认、失效和仓位预算的模拟计划。通过只表示基础概念回答正确。",
            whyItMatters:
              "合约风险来自多个环节，单独记住某个指标并不足够。综合检查帮助发现仍需返回学习的薄弱位置。",
            example:
              "系统展示一份混合了正确事实与常见误区的模拟计划。学习者要指出形成中 K 线、精确强平承诺、缺失风险预算和把指标当方向答案等问题，再决定哪些章节需要复习。",
            commonMistake:
              "常见误区是把课程完成状态当成交易能力认证，或认为通过题目就能稳定执行。真实市场还包含情绪、流动性、技术故障和超出模型的风险。",
            keyPoints: [
              "课程完成只代表基础知识复核",
              "无法解释风险时应回到对应章节",
              "任何教育工具都不能保证真实交易结果",
            ],
          },
          isQuickPath: false,
          interaction: {
            kind: "graduation-review",
            instruction: "检查一份模拟计划是否包含数据周期、确认、失效、仓位风险和费用边界。",
          },
          quiz: {
            question: "完成本课程后，哪项结论最准确？",
            options: [
              { id: "a", label: "我掌握了基础检查方法，但仍需独立判断并承担风险" },
              { id: "b", label: "我已经具备独立使用真实合约仓位的能力" },
              unsureOption,
            ],
            correctOptionId: "a",
            explanation:
              "课程只提供教育与练习。真实交易仍面临行情、杠杆、流动性、费用和执行等多重风险。",
          },
          riskNote: "如无法清楚说明仓位风险、强平和失效条件，不应使用合约进行真实交易。",
        },
      ],
    },
  ],
} as const satisfies BaseFuturesIntroCourse;

const futuresCourseV2Content = {
  ...futuresCourseV2Chapter1Content,
  ...futuresCourseV2Chapter2Content,
  ...futuresCourseV2Chapter3Content,
  ...futuresCourseV2Chapters45Content,
} as const satisfies Record<FuturesLessonId, LessonV2ContentSeed>;

type ArrangedQuizOptions = Readonly<{
  options: readonly [QuizOption, QuizOption, QuizOption];
  correctOptionId: Exclude<QuizOptionId, "unsure">;
}>;

function arrangeQuizOptions(
  lessonOrder: number,
  kind: QuizKind,
  correctLabel: string,
  incorrectLabel: string,
): ArrangedQuizOptions {
  const kindOffset = quizKinds.indexOf(kind);
  const correctFirst = (lessonOrder + kindOffset) % 2 === 1;

  return {
    options: correctFirst
      ? [
          { id: "a", label: correctLabel },
          { id: "b", label: incorrectLabel },
          unsureOption,
        ]
      : [
          { id: "a", label: incorrectLabel },
          { id: "b", label: correctLabel },
          unsureOption,
        ],
    correctOptionId: correctFirst ? "a" : "b",
  };
}

function buildLessonQuizzes(
  lesson: BaseLessonDefinition,
  legacyQuiz: LegacyLessonQuiz,
  deepDive: LessonDeepDive,
  scenarioQuiz: ScenarioQuizSeed,
): LessonQuizzes {
  const legacyCorrectOption = legacyQuiz.options.find(
    (option) => option.id === legacyQuiz.correctOptionId,
  );
  const legacyIncorrectOption = legacyQuiz.options.find(
    (option) =>
      option.id !== legacyQuiz.correctOptionId && option.id !== "unsure",
  );
  if (!legacyCorrectOption || !legacyIncorrectOption) {
    throw new Error(`Invalid concept quiz options for ${lesson.id}`);
  }
  const conceptOptions = arrangeQuizOptions(
    lesson.order,
    "concept",
    legacyCorrectOption.label,
    legacyIncorrectOption.label,
  );
  const conceptQuiz = {
    id: `${lesson.id}-concept`,
    kind: "concept",
    title: `概念检查：${lesson.title}`,
    question: legacyQuiz.question,
    options: conceptOptions.options,
    correctOptionId: conceptOptions.correctOptionId,
    correctExplanation: legacyQuiz.explanation,
    incorrectExplanation: `请回看本关定义与要点：${lesson.takeaway}`,
  } as const satisfies LessonQuiz<"concept">;

  const scenarioCorrectLabel =
    scenarioQuiz.correctOptionId === "a"
      ? scenarioQuiz.optionA
      : scenarioQuiz.optionB;
  const scenarioIncorrectLabel =
    scenarioQuiz.correctOptionId === "a"
      ? scenarioQuiz.optionB
      : scenarioQuiz.optionA;
  const scenarioOptions = arrangeQuizOptions(
    lesson.order,
    "scenario",
    scenarioCorrectLabel,
    scenarioIncorrectLabel,
  );
  const scenario = {
    id: `${lesson.id}-scenario`,
    kind: "scenario",
    title: `情境应用：${lesson.title}`,
    question: scenarioQuiz.question,
    options: scenarioOptions.options,
    correctOptionId: scenarioOptions.correctOptionId,
    correctExplanation: scenarioQuiz.correctExplanation,
    incorrectExplanation: scenarioQuiz.incorrectExplanation,
  } as const satisfies LessonQuiz<"scenario">;

  const boundaryIndex: 0 | 1 = lesson.order % 2 === 1 ? 0 : 1;
  const selectedCannotTell = deepDive.boundary.cannotTell[boundaryIndex];
  const selectedCanTell = deepDive.boundary.canTell[boundaryIndex];
  const boundaryOptions = arrangeQuizOptions(
    lesson.order,
    "boundary",
    selectedCannotTell,
    selectedCanTell,
  );
  const boundary = {
    id: `${lesson.id}-boundary`,
    kind: "boundary",
    title: `能力边界：${lesson.title}`,
    question: `关于“${lesson.title}”，哪一项是本关知识不能直接告诉你的？`,
    options: boundaryOptions.options,
    correctOptionId: boundaryOptions.correctOptionId,
    correctExplanation: `${selectedCannotTell}。本关只能帮助你判断：${deepDive.boundary.canTell.join("；")}。`,
    incorrectExplanation: `${selectedCanTell}属于本关可以客观说明的范围；它仍不能证明：${deepDive.boundary.cannotTell.join("；")}。`,
  } as const satisfies LessonQuiz<"boundary">;

  return [conceptQuiz, scenario, boundary];
}

function upgradeLesson(baseLesson: BaseLessonDefinition): LessonDefinition {
  const content = futuresCourseV2Content[baseLesson.id];
  const scenarioQuiz = content.scenarioQuiz;
  let deepDive: LessonDeepDive;
  if ("deepDive" in content) {
    deepDive = content.deepDive;
  } else {
    const { scenarioQuiz: _scenarioQuiz, ...deepDiveSeed } = content;
    void _scenarioQuiz;
    deepDive = deepDiveSeed;
  }
  const { quiz: legacyQuiz, ...lesson } = baseLesson;

  return {
    ...lesson,
    deepDive,
    quizzes: buildLessonQuizzes(
      baseLesson,
      legacyQuiz,
      deepDive,
      scenarioQuiz,
    ),
  };
}

export const futuresIntroCourse: FuturesIntroCourse = {
  ...futuresIntroCourseBase,
  chapters: futuresIntroCourseBase.chapters.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map(upgradeLesson),
  })),
};

const futuresIntroChapters: readonly ChapterDefinition[] =
  futuresIntroCourse.chapters;

export const futuresIntroLessons: readonly LessonDefinition[] =
  futuresIntroChapters.flatMap((chapter) => chapter.lessons);

const lessonById = new Map<FuturesLessonId, LessonDefinition>(
  futuresIntroLessons.map((lesson) => [lesson.id, lesson]),
);
const chapterById = new Map<FuturesChapterId, ChapterDefinition>(
  futuresIntroCourse.chapters.map((chapter) => [chapter.id, chapter]),
);

export function isFuturesLessonId(value: unknown): value is FuturesLessonId {
  return typeof value === "string" && lessonById.has(value as FuturesLessonId);
}

export function isFuturesChapterId(value: unknown): value is FuturesChapterId {
  return typeof value === "string" && chapterById.has(value as FuturesChapterId);
}

export function getFuturesLesson(
  lessonId: string,
): LessonDefinition | undefined {
  return lessonById.get(lessonId as FuturesLessonId);
}

export function getFuturesChapter(
  chapterId: string,
): ChapterDefinition | undefined {
  return chapterById.get(chapterId as FuturesChapterId);
}

export function getLessonIdsForPath(
  path: LearningPath,
): readonly FuturesLessonId[] {
  if (path === "quick") {
    return futuresQuickPathLessonIds;
  }
  if (path === "full") {
    return futuresFullPathLessonIds;
  }
  throw new TypeError("Unknown futures course path.");
}
