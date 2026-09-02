# Wise Crypto V0 产品规范与分阶段执行计划

> 状态：Phase 7 Production Quality 已完成，Wise Crypto V0 已收口  
> 最后更新：2026-08-31  
> 仓库：<https://github.com/WiseInvest513/crypto.git>  
> 计划生产域名：<https://crypto.wise-invest.org>

## 1. 文档目的

本文件是 Wise Crypto V0 的产品范围、工程边界、数据规范、质量门槛和分阶段执行基线。

项目必须严格按 Phase 1 至 Phase 7 的顺序推进。每个阶段只完成该阶段明确列出的内容；完成检查和阶段汇报后立即停止，等待用户确认，不能自动进入下一阶段。

如本文件与用户后续的明确指令冲突，以用户最新指令为准，并同步更新本文件，避免实现与规范长期不一致。

## 2. 产品目标

Wise Crypto V0 是面向 Crypto / Web3 用户的独立市场信息、分析工具与合作产品入口，重点提供：

- 清晰的 BTC、ETH 和整体市场状态。
- 每一项市场数据的来源、更新时间及可用状态。
- 可解释、可人工维护的 Wise Take、Market Status 和 Wise Scenario。
- 四个不误导用户的基础计算工具。
- 客观、可审计的合作产品与 Referral 展示。
- 为未来 Wise ID 集成预留边界，但 V0 不实现登录、会员或权限系统。

## 3. V0 明确不做

- 不实现 Wise ID、登录、注册、用户数据库、VIP 或权益判断。
- 不实现交易、钱包连接、下单、托管或资产管理。
- 不实现自动投资建议或自动生成 Wise 的市场判断。
- 不为填满页面而伪造市场数据、费用、资格、优惠或地区信息。
- 不引入 CMS、微服务、消息队列、定时任务或复杂全局状态管理。
- 不自动进入下一版本或 V1 开发。

## 4. 阶段治理规则

### 4.1 执行顺序

```text
Phase 0 方案确认（已完成）
  → Phase 1 Project Foundation
  → Phase 2 Market Data Layer
  → Phase 3 Homepage
  → Phase 4 BTC & ETH
  → Phase 5 Crypto Tools
  → Phase 6 Products & Referral Foundation
  → Phase 7 Production Quality
```

### 4.2 每阶段开始前

- 阅读 `AGENTS.md`。
- 重新阅读本文件。
- 检查工作区已有改动，保留用户或其他任务的无关修改。
- 确认本阶段范围和上一阶段遗留问题。
- 未获得用户确认时，不进入下一阶段。

### 4.3 每阶段结束门槛

从 Phase 1 起，每个阶段均需运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

若任一检查失败，必须说明失败原因、影响范围和是否阻塞发布；不能把未运行或失败报告为通过。

阶段汇报至少包括：

1. 完成内容。
2. 主要修改文件。
3. 页面或模块结构。
4. 临时实现、TODO 和未完成内容。
5. lint、typecheck、tests、production build 的实际结果。
6. 下一阶段计划与已知风险。

完成汇报后停止，等待确认。

### 4.4 本地端口约定

- 本项目的开发服务器和本地生产预览统一使用端口 `2222`。
- 默认访问地址为 `http://localhost:2222`。
- 后续阶段不得回退到 Next.js 默认端口 `3000`。

### 4.5 界面语言约定

- V0 默认界面语言为简体中文，根文档语言标记使用 `zh-CN`。
- 导航、说明、加载与错误状态、无障碍标签和 SEO 元数据统一使用中文。
- `Wise Crypto`、`Wise Take`、`Wise Scenario`、`BTC`、`ETH`、`ETF`、`DCA`、`USD`、`UTC` 等品牌名、行业缩写和计价单位可以保留。
- V0 暂不实现多语言路由或语言切换器；如后续需要英文版，应单独规划 locale 路由与翻译字典。

## 5. Mock 与真实数据政策

用户已确认 Phase 1 暂不接入市场 API，可以先做 mock 处理。Mock 必须遵循以下边界：

- Mock 仅用于本地开发、组件预览和自动化测试。
- Mock 数据必须可识别，例如 `source: "Mock / Development only"`。
- Production 环境必须硬性禁用 Mock；没有可靠数据源时显示 `unavailable`。
- 不允许在生产构建中把静态数字伪装成实时 BTC、ETH 或市场指标。
- 测试 fixture 与生产 provider registry 分离。
- Skeleton、loading、error、stale、unavailable 是不同状态，不能相互冒充。
- Phase 1 只建立接口、状态模型、Unavailable provider 和受控 Mock provider，不接入大量真实 API。

## 6. 全局数据合同

所有市场数据必须支持并清晰表达：

- `source`
- `updatedAt` 或供应商的 `asOf`
- `retrievedAt`
- `loading`
- `error`
- `stale`
- `cache`
- `scope`，例如全市场或 Binance BTCUSDT Perpetual
- `unavailable`

建议的领域结果：

```ts
type MarketDatum<T> =
  | {
      status: "fresh" | "stale";
      value: T;
      unit: string;
      source: string;
      scope?: string;
      asOf?: string;
      retrievedAt: string;
      cache: {
        hit: boolean;
        revalidateSeconds: number;
      };
    }
  | {
      status: "unavailable";
      value: null;
      source?: string;
      error:
        | "not_configured"
        | "timeout"
        | "rate_limited"
        | "upstream_error"
        | "invalid_payload"
        | "no_data";
      retrievedAt?: string;
    };
```

约束：

- `retrievedAt` 不得冒充供应商更新时间。
- 单交易所数据不得包装为全市场聚合数据。
- Provider 切换时不能静默混合不同口径的时间序列。
- 缺失数据展示 `—` 或明确的 unavailable 状态，不能展示为 `0`。
- API Secret 只能存在于服务端模块和服务端环境变量中。

## 7. V0 路由

```text
/
/btc
/eth
/tools
/tools/position-size
/tools/leverage
/tools/dca
/tools/risk-reward
/products
/products/[slug]
```

V0 的全局导航至少包含：市场总览、BTC、ETH、工具、产品。

---

## Phase 1：Project Foundation

### 目标

建立稳定、可扩展、可测试和可部署的项目基础，不完成大规模业务页面，也不接入大量真实 API。

### 本阶段只完成

- 项目基础结构。
- Root Layout。
- Header。
- Footer。
- Navigation。
- Typography。
- Responsive foundation。
- 首页基础 Skeleton。
- `/btc` route。
- `/eth` route。
- `/tools` route。
- `/products` route。
- SEO foundation。
- loading/error states。
- Data Provider interfaces / skeleton。

### 工程要求

- 使用 Next.js App Router、TypeScript strict 和 pnpm。
- Server Components 优先；只有实际交互需要 Client Component。
- 建立基础设计令牌：颜色、字号、间距、容器、边框、阴影和断点。
- 页面需要有明确的语义层级，不把所有内容做成同一种圆角卡片。
- Header 和 Footer 在移动端、平板和桌面端可用。
- Navigation 当前路由需要可识别，并支持键盘操作。
- 首页只提供结构 Skeleton 和模块占位，不完成 Phase 3 的完整内容。
- `/btc`、`/eth`、`/tools`、`/products` 只提供可靠的路由骨架和范围说明，不提前完成后续 Phase。
- 建立 metadata、canonical、robots/sitemap 基础文件或接口。
- 建立 `loading.tsx`、`error.tsx`、`global-error.tsx` 和 `not-found.tsx`。
- 建立 Data Provider 能力接口、统一状态类型、Unavailable provider 和开发/测试 Mock provider。
- 创建 `AGENTS.md`；README 在本阶段可建立最小骨架，完整内容延后到 Phase 7。
- 配置 ESLint、typecheck、unit test 和 production build scripts。

### 本阶段不做

- 不接入大量真实市场 API。
- 不完成完整 Homepage。
- 不完成 BTC / ETH 详情内容和完整图表。
- 不完成四个计算工具。
- 不完成产品详情和真实 Referral 数据。
- 不实现认证、会员、CMS、数据库或 analytics vendor。
- 不进入 Phase 2。

### Phase 1 验收

- 所有基础路由可访问且没有 broken route。
- Layout、Header、Footer 和导航在常见屏幕宽度下成立。
- 首页展示明确的 Skeleton/基础模块结构。
- Mock 不能在 production 模式冒充真实数据。
- API secret 不存在于客户端 bundle。
- lint、typecheck、tests 和 production build 全部运行并如实报告。

### Phase 1 汇报后

停止，等待用户确认是否进入 Phase 2。

---

## Phase 2：Market Data Layer

### 开始前

重新阅读：

- `AGENTS.md`
- `docs/product-specs/wise-crypto-v0.md`

### 目标

建立可靠、可测试、可降级的数据基础设施。Phase 2 重点是数据层，不提前完成 Phase 3 和 Phase 4 的页面内容。

### 本阶段只完成的数据能力

- Data Provider abstraction。
- BTC price。
- ETH price。
- Market Cap。
- Fear & Greed。
- BTC Dominance。
- ETH/BTC。
- Funding。
- Open Interest。
- Liquidations。
- BTC ETF Flow。
- ETH ETF Flow。

### 数据要求

- 没有可靠或有权使用的数据源时，不伪造，返回 `unavailable`。
- 每项数据必须包含 source 和 updatedAt/asOf。
- 必须实现 loading、error、stale 和 cache 语义。
- Provider schema 必须验证外部 payload，不能让未经验证的数据进入领域层。
- API Secret 不得进入客户端或 `NEXT_PUBLIC_*` 变量。
- 页面只能调用领域 service，不能直接访问第三方 API。
- 一个 provider 失败不能导致整个组合请求失败。
- 聚合指标失败时不能无提示切换成单交易所指标。
- 构建流程不能依赖实时 API 成功。
- Production provider registry 不得包含 Mock provider。

### 推荐能力边界

```ts
interface SpotMarketProvider {
  getQuotes(): Promise<unknown>;
  getGlobalMarket(): Promise<unknown>;
  getDailyCandles(): Promise<unknown>;
}

interface SentimentProvider {
  getFearAndGreed(): Promise<unknown>;
}

interface DerivativesProvider {
  getFunding(): Promise<unknown>;
  getOpenInterest(): Promise<unknown>;
  getLiquidations(): Promise<unknown>;
}

interface FundFlowProvider {
  getBtcEtfFlow(): Promise<unknown>;
  getEthEtfFlow(): Promise<unknown>;
}
```

### 测试重点

- 正常响应。
- HTTP 200 但业务错误。
- 空字段、null、NaN、异常时间单位。
- 429、5xx、timeout。
- stale 与 unavailable。
- cache hit/miss 与错误结果不覆盖 last-known-good。
- Secret 不进入客户端 bundle。

### Phase 2 实施结果（2026-08-28）

- CoinMarketCap 与 Alternative.me Provider：BTC/ETH USD 聚合现货报价、总市值、
  BTC Dominance 和各自的 Fear & Greed。配置 CMC 服务端 key 时 CMC 为主源；
  未配置时 Alternative.me 为主源。降级结果保留实际 source、数据口径与主源
  失败元数据，不静默混接两家的历史序列；CMC key 仍用于启用全市场 24h
  Liquidations。
- Binance USDⓈ-M Provider：明确限定为 `BTCUSDT` / `ETHUSDT` 单场所
  perpetual funding 与 5 分钟采样 OI，不包装成全市场数据。
- ETH/BTC 仅由同一 Provider 的经过验证的 ETH/USD 与 BTC/USD 组合读取派生，
  两个 source timestamp 相差不得超过 10 分钟；更新时间取两者较早值，并保留
  实际输入来源。BTC 与 ETH headline 独立读取，因此单个资产失败不会隐藏另一个。
- BTC/ETH ETF Flow 因暂未配置具备商业许可的可靠来源，保持
  `unavailable`，不填 0、不使用 Mock。
- 实现 runtime payload validation、bounded retry、timeout、分资产缓存、
  concurrent single-flight、last-known-good、stale/error/loading/unavailable
  和组合请求部分失败隔离。
- V0 缓存与 last-known-good 为进程内尽力缓存，无法跨 Vercel 实例或冷启动
  共享；该限制已记录在 `docs/data-sources.md`，后续如需跨实例 SLA 必须引入
  持久化/分布式缓存。
- Phase 2 未把数据接入首页，也未开始 Phase 3 页面内容。

### Phase 2 汇报后

运行全部检查，停止并等待用户确认是否进入 Phase 3。

---

## Phase 3：Homepage

### 目标

只完成 Wise Crypto 首页，不进入 BTC / ETH Detail Page 的完整开发。

### 本阶段只完成

- Market Pulse。
- Market Status。
- BTC / ETH overview。
- Today in Crypto。
- Wise Take。
- 关键市场指标。
- Data source / Updated At。
- Responsive Design。
- Loading / Error / Stale state。

### 内容约束

- Wise Take 和 Market Status 使用可人工编辑、经过 schema 验证的配置。
- 配置至少支持 `effectiveAt`、`validUntil`、`lastReviewedAt` 和 sources。
- 不自动生成投资判断。
- 动态数字通过数据层注入，不长期硬编码到编辑文本。
- 配置过期时显示 stale 或隐藏，不自动生成默认判断。
- 页面必须在部分或全部数据 unavailable 时仍然可读。

### Phase 3 实施结果（2026-08-29）

- 首页作为 Server Component 只调用统一数据服务，不在 UI 中直接请求第三方
  API；核心行情与支持性指标分别由 `loadMarketCoreSnapshot()` 和
  `loadMarketIndicatorSnapshot()` 并行加载，Binance Futures 超时不会阻塞
  BTC/ETH 首屏。路由使用动态渲染，production build 不依赖实时市场 API 成功。
- Market Pulse 展示总市值、实际来源对应的 Fear & Greed、BTC Dominance 和 ETH/BTC；
  BTC/ETH 概览分别展示价格、24 小时、7 天、状态、来源、数据截至时间与获取时间。
- ETH/BTC 派生数据保留 BTC 与 ETH 两个输入的底层来源链接；同一来源会去重，
  派生口径与较早的数据截至时间均明确展示。
- 关键市场数据区分别展示 BTC/ETH Funding、单场所 OI、24 小时 Liquidations
  与 BTC/ETH ETF Flow；单交易所和日频口径均明确标注，缺少可靠来源时显示
  `unavailable`，不填 0。fresh/stale 数据保留完整指标卡；error/unavailable
  收纳进可展开的数据覆盖说明，避免空卡片盖过有效数据。
- 首页支持 fresh、stale、error、unavailable 和 Suspense loading；部分 Provider
  失败不会阻断其他指标或人工内容。首次失败加入最长 30 秒的请求退避，避免
  每次访问重复等待同一上游超时，但不会写入 last-known-good 成功缓存。
- 已明确标记为 unavailable 的未接入指标只在对应卡片说明，不会让其余正常数据
  长期触发全局故障提示；真实 error 与 stale 仍保留页面级提醒。
- Market Status、Today in Crypto 与 Wise Take 使用 runtime schema 验证的人工
  配置，支持 `effectiveAt`、`validUntil`、`lastReviewedAt` 与 sources；未发布、
  未生效或过期内容均不会显示为当前判断。
- 编辑配置使用严格 UTC 日历校验、字符与条目上限；Today in Crypto 的每条事实
  通过 source ID 对应具体来源，且只能在同一 UTC 日期显示。Market Status 与
  Wise Take 会拒绝硬编码数字、货币符号和百分比。
- 当前人工配置保持 `unpublished`，未生成默认市场状态、自动 Wise Take、买卖
  信号、支撑阻力或其他投资判断。
- Phase 3 未开发 BTC/ETH 详情页、图表或 Wise Scenario，未进入 Phase 4。

### Phase 3 汇报后

运行全部检查，停止并等待用户确认是否进入 Phase 4。

---

## Phase 4：BTC & ETH

### 本阶段完成页面

- `/btc`
- `/eth`

### 页面内容

- price。
- chart。
- MA20。
- MA50。
- trend。
- support。
- resistance。
- funding。
- OI。
- liquidation。
- ETF flow。
- BTC dominance / ETH-BTC。
- Wise Scenario。

### 内容与判断约束

- Support、Resistance 和 Wise Scenario 必须允许人工配置。
- 人工配置必须有来源、审核时间、有效期和失效条件。
- 不自动伪造 Wise 的投资判断。
- Trend 优先展示可验证的事实，例如价格和 MA20/MA50 的相对位置。
- unavailable 数据不能展示为 `0`。
- 图表必须有可访问的文字摘要或数据替代说明。

### Phase 4 实施结果（2026-08-31）

- `/btc` 与 `/eth` 使用同一个参数化资产工作台；页面继续由 Server
  Component 调用统一领域服务，只有图表时间范围切换使用 Client Component。
- 现货 headline 使用当前有效公共市场 Provider 的聚合 USD 报价；图表与日线
  技术事实独立使用 Binance Spot `BTCUSDT` / `ETHUSDT`、USDT、UTC K 线。两种
  口径在页面上明确分开；聚合 USD 报价不可用时，headline 可明确降级为
  Binance 最新已闭合日线收盘并标记 USDT 与“非实时现货价”，绝不包装成
  USD 聚合现货。
- Candle Provider 保持两个隔离路径：日线技术事实与 DCA 只接受已闭合 `1d`
  K 线，使用 15 分钟缓存、七天 last-known-good 与 36 小时来源陈旧判定；
  交互图表支持 `15m / 1h / 4h / 1d`、最多 1000 根并允许最后一根明确标记为
  `forming`，使用 5 秒缓存、5 分钟 last-known-good 与 20 秒来源陈旧判定。
  两条路径都执行严格上游 schema、OHLC、周期边界、排序与重复数据校验；空响应
  保持 `error / no_data`，不补测试数字。
- MA20 与 MA50 为已闭合日线收盘价的简单移动平均，完整窗口之前保持为空；
  Trend 只陈述价格、MA20、MA50 的严格相对位置，不产生买卖信号或自动判断。
- 交互图表默认读取最近 1000 根 `1h` K 线并显示 500 根，也可选择 200 根或全部、
  浏览更早数据及切换周期。浏览器通过同源 `/api/market/candles` 每 5 秒增量检查
  最新三根，页面隐藏时暂停、恢复时完整同步；客户端不直连 Binance。
- 图表包含大尺寸 K 线、当前周期展示用 MA20/MA50、成交量、最新价线、十字定位、
  当前 OHLCV、键盘逐根查看、可见文字摘要、SVG title/description 和最近二十根
  K 线的语义化数据表。图表周期均线只用于图表展示，形成中 K 线绝不进入下方
  已闭合日线技术事实、Trend 或 DCA 计算。
- 图表可见窗口同步展示首根开盘到末根收盘 / 最新的区间涨跌、最高、最低、振幅、
  末值所处区间位置与总成交量；成交量明确标注为 BTC / ETH 基础资产数量。若末根
  仍在形成，只将其当前成交量与前 20 根已闭合 K 线平均量作机械对比，并明确提示
  当前周期尚不完整。所有这些字段都随周期、可见数量和历史窗口变化，不生成支撑、
  阻力或交易判断。
- Funding、单场所 OI、全市场 Liquidations、ETF Flow 以及 BTC Dominance 或
  ETH/BTC 按各自来源与口径展示；无许可 ETF 数据继续明确 unavailable，不填 0。
- BTC/ETH 的 Support、Resistance 与 Wise Scenario 使用独立人工配置 schema，
  支持来源、审核时间、生效时间、有效期和失效条件。当前生产配置全部保持
  `unpublished`，没有根据行情自动生成内容。
- fresh、stale、error、unavailable、synthetic-blocked 与 route loading 均有
  中文状态；每项保留 source、scope、updatedAt、retrievedAt 和 cache 信息。
- 参考项目 `crypto-analyzer` 仅用于迁移闭合 K 线、SMA、工作台信息结构和测试
  思路；没有引入 Python、Streamlit、Plotly 或本地绝对路径运行时依赖，也没有
  迁移 BUY/SELL、BOS/CHOCH、自动支撑阻力或交易计划。

### Phase 4 汇报后

运行全部检查，停止并等待用户确认是否进入 Phase 5。

---

## Phase 5：Crypto Tools

### 本阶段完成

1. Position Size Calculator。
2. Leverage Calculator。
3. DCA Calculator。
4. Risk / Reward Calculator。

### 路由

- `/tools/position-size`
- `/tools/leverage`
- `/tools/dca`
- `/tools/risk-reward`

### 核心要求

- 公式准确并有必要的单元测试。
- 输入验证明确，覆盖零值、负值、非法方向和不合理价格关系。
- 移动端可用，表单支持键盘操作和清晰错误信息。
- 不产生误导性的精确结果。
- 手续费、滑点、资金费率、税务和跳空等未计因素必须明确说明。
- 强平价格因交易所、仓位模式、维持保证金档位和费用而不同。V0 不应声称提供交易所级精确强平价；如展示概念性估算，必须突出假设和误差说明。
- Tools 可通过独立 URL 分享。
- 为 `tool_open` 和 `tool_complete` Analytics 事件保留接口。
- Analytics 不得发送账户余额、入场价、止损价、目标价或其他用户金融输入。

### 计算口径

#### Position Size

```text
maxRisk = balance × riskPercent / 100
riskPerUnit = abs(entryPrice - stopPrice)
quantity = maxRisk / riskPerUnit
notional = quantity × entryPrice
```

#### Leverage

```text
quantity = notional / entryPrice
margin = notional / leverage
longPnl = (exitPrice - entryPrice) × quantity
shortPnl = (entryPrice - exitPrice) × quantity
roe = pnl / margin × 100
```

#### Risk / Reward

根据 long / short 分别验证 entry、stop、target 的顺序，并输出 `1:x`。

#### DCA

- 使用 UTC 生成计划。
- 缺少计划日价格时使用下一根有效日线。
- 月份不存在指定日期时使用当月月末。
- 输出总投入、总数量、平均成本、期末价值和收益率。
- 明确不包含手续费、点差、税务和质押收益。

### Phase 5 实施结果（2026-08-31）

- `/tools` 已从占位页升级为四个计算器的工具目录，并提供独立可分享路由；
  分享链接只包含工具路径，不序列化任何输入。
- Position Size、Leverage、Risk / Reward 均使用独立纯函数计算层，保留未取整
  结果，由展示层采用有界精度格式化，非零极小值不会显示成零。
- 所有数字字段保持空白初始值，不预填风险比例、杠杆、入场、止损或目标价；
  表单按 long / short 校验价格关系，并覆盖空值、零值、负值、NaN、Infinity
  与超出可靠计算范围的错误。
- Leverage V0 明确不计算强平价；页面持续展示交易所、逐仓/全仓、维持保证金
  档位、费用、资金费与风险限额会改变实际强平结果。
- DCA 使用现有 server-only Market Provider registry 读取 Binance
  `BTCUSDT` / `ETHUSDT` 现货 USDT 已闭合 UTC 日线，约覆盖两年；客户端只接收
  验证后的升序 `{date, close}`，并保留 source、scope、updatedAt、retrievedAt、
  stale、cache、error 与 unavailable reason。错误或不可用时不生成替代数值。
- DCA 支持 UTC 日、周、月计划；缺少计划日时使用下一根有效日线，不存在的
  月份日期落到月末，并展示可展开的逐笔执行明细与数据口径。
- 四个工具均支持字段标签、键盘提交、字段级错误关联、错误焦点、结果播报、
  移动端单列布局和不少于 44px 的主要操作区域。
- `tool_open` / `tool_complete` 使用 provider-neutral Analytics facade；当前为
  noop adapter，运行时和类型层均只允许工具标识、placement、source page 与
  内容版本，不发送金融输入或计算结果。
- 四个详情页均配置中文 metadata、canonical 与 Open Graph，并进入 sitemap。

### Phase 5 汇报后

运行全部检查，停止并等待用户确认是否进入 Phase 6。

---

## Phase 6：Products & Referral Foundation

### 本阶段完成

- `/products`。
- `/products/[slug]` 产品详情页。
- 可配置 Partner / Product 数据模型。
- 产品和 Referral Analytics 事件。

### 产品模型必须支持

- `name`
- `slug`
- `type`
- `logo`
- `website`
- `referralUrl`
- `referralCode`
- `bestFor`
- `pros`
- `cons`
- `feeDescription`
- `tutorialUrl`
- `wiseBenefit`
- `availability`
- `enabled`
- `disclaimer`

实际 schema 还应包含来源、最后核验日期、条款 URL、推广开始/结束日期和 unpublished 状态。

### Referral 约束

- Referral URL 不得写死在展示组件里。
- 统一由配置和 `ReferralLink` 组件管理。
- 外部推广链接使用 `rel="sponsored nofollow noopener noreferrer"`。
- 不允许根据任意 URL 参数构造重定向，避免 open redirect。
- Partner 必须显式列出精确 `allowedReferralHosts`；空列表表示不允许 Referral。
  不从官网域名自动推断，也不接受通配符、未列明子域、IP、localhost 或自定义端口。
- 过期、禁用或 unpublished 产品不进入 sitemap。

### Analytics 事件

- `product_view`
- `referral_click`
- `tutorial_click`

事件只发送 slug、placement、source page 和内容版本，不发送用户敏感信息。

### 内容要求

- 页面客观展示 Pros / Cons，不能做成纯广告列表。
- 不伪造费用、资格、地区可用性、Wise 福利或优惠。
- 缺少真实内容时使用明确的 TODO / unpublished 状态，不自行补写事实。
- `availability` 未知不能解释为全球可用。

### Phase 6 实施结果（2026-08-31）

- `/products` 已从路由骨架升级为客观的产品目录，并实现通用的
  `/products/[slug]` 动态详情页。详情页支持产品基础信息、适用场景、Pros / Cons、
  费用说明、可用性、Wise Benefit、来源、最后核验时间、条款和免责声明；未知或
  不可发布 slug 不会渲染为有效产品。
- Partner / Product 使用集中式、server-only 配置与运行时校验，支持本阶段要求的
  全部字段，以及来源、最后核验日期、条款 URL、推广生效/结束时间和
  `unpublished` 状态。禁用、未生效、过期或 unpublished 产品不会进入公开目录、
  动态参数或 sitemap。
- 生产目录现已发布 7 份独立产品指南：Binance、Coinbase、Kraken、OKX、
  MetaMask、Ledger 硬件钱包与 CoinGecko 市场数据，覆盖交易所、钱包、硬件安全和
  数据工具 4 类。每份指南的产品范围、适用场景、Pros / Cons、费用口径、地区或
  资格边界、教程、条款及免责声明均在 2026-08-31 对照所链接的第一方资料核验；
  目录按类型整理，不构成排名或产品推荐。
- 当前 7 份生产指南均未配置 Referral URL、Referral Code、推广有效期或 Wise
  Benefit，也没有固定展示会变化的费率或优惠。缺少可确认的商业关系与权益时，
  页面明确标记“无推广链接”，不会以示例、TODO 或自拟内容填充这些字段。
- Referral URL 只可来自经过验证的服务端配置，由统一 `ReferralLink` 组件渲染；
  每个首跳 hostname 还必须精确匹配 Partner 白名单，当前白名单全部为空；
  推广外链固定使用 `rel="sponsored nofollow noopener noreferrer"`，且不根据查询参数
  或任意用户输入构造跳转目标。
- `product_view`、`referral_click` 与 `tutorial_click` 已接入 provider-neutral
  Analytics facade，事件载荷只允许 slug、placement、source page 和内容版本；当前
  adapter 为 noop，Analytics 失败不会阻断页面导航或外链跳转。
- Phase 6 没有补写无法核验的产品事实、费用、资格或权益，没有接入 analytics vendor，也没有开始
  Phase 7 的生产质量检查、部署或 DNS 工作。

### Phase 6 汇报后

运行全部检查，停止并等待用户确认是否进入 Phase 7。

---

## Phase 7：Production Quality

### 最终质量检查

- Responsive。
- Mobile。
- Accessibility。
- Performance。
- SEO。
- Metadata。
- Open Graph。
- Sitemap。
- Robots。
- Canonical。
- Error Handling。
- Data fallback。
- API security。
- Analytics。
- Referral click tracking。
- No fake production data。
- No leaked API keys。
- No broken routes。
- No console errors。
- lint。
- typecheck。
- tests。
- production build。

### 文档校验

- 检查本文件是否与实际项目一致。
- 对已经改变的行为更新规范，不能留下与实现冲突的说明。
- 完整更新 `README.md`。

README 必须包括：

- 本地运行。
- 环境变量。
- 数据源。
- 部署。
- DNS。
- 项目结构。
- 测试和质量命令。
- Mock 与 production 数据政策。
- 未来 Wise ID 集成说明。

### 最终交付

提交一份 `Wise Crypto V0 Completion Report`，至少包含：

- V0 已完成范围。
- 路由和核心模块。
- 实际数据源与 unavailable 项。
- 产品和 Referral 状态。
- SEO、可访问性和性能结果。
- lint、typecheck、tests、build 的实际输出摘要。
- 已知限制、风险和未来 Wise ID 接入边界。

Phase 7 完成后停止，不开始开发下一版本。

### Phase 7 实施结果（2026-08-31）

- 完成 320/390/1280px 响应式与生产预览检查，修复工具摘要横向溢出、首页资产
  概览 ARIA 结构、移动端 7 日数据隐藏、图表/数据表键盘滚动入口、触控目标、
  小字号对比度、内联来源链接辨识和 loading/data fallback 播报。
- 使用统一 Metadata helper 为所有公开路由补齐唯一 title、description、canonical、
  Open Graph 与 X 字段；加入 1200×630 Wise Crypto 分享图。根站点与栏目页使用
  共享图，产品、资产和工具详情在没有真实主图时明确清除继承图片。
- Production canonical 对 `SITE_URL` 做 HTTPS 纯 origin 校验并固定为
  `https://crypto.wise-invest.org`；Preview/Development 保持 `noindex`。404 与未知
  产品明确 noindex 且没有错误 canonical。
- Sitemap 只包含固定公开路由与当前 7 个 enabled/published 产品；robots、WebSite
  JSON-LD 和与可见导航一致的工具/产品 Breadcrumb JSON-LD 已完成。
- 新增 `page_view` provider-neutral facade，与既有 tool/product/referral 事件一起
  默认使用 noop adapter；payload 白名单不接收查询参数、用户标识、金融输入、
  结果、Referral URL 或 code，Analytics 失败不阻断业务。
- 数据层补充 BTC/ETH headline 隔离、ETH/BTC 同 Provider 时间偏差上限、空 Binance
  K 线的 source/scope/retrievedAt 保留，以及 HTTPS-only、禁止 credentialed URL、
  禁止 redirect、2 MB 流式响应体上限。
- 首页按 quote、market pulse、衍生品/资金流分段流式渲染；资产详情按 price、chart、
  derivatives context 分段渲染。慢数据源只影响所属区块，不再让整页等待。
- 进程内成功缓存和失败 backoff 分别限制为 256 项；stale backoff 不能越过
  last-known-good 的绝对失效时间。spot/global 可用已披露的 fresh 备用源替换 stale
  主源，Fear & Greed 因口径不同保留原主序列。
- Referral 配置增加 Partner 级精确 hostname 白名单；当前 7 个 Partner 白名单为空，
  未来配置不接受任意 HTTPS 域名、通配符、未列明子域、IP、localhost 或自定义端口。
- 增加 `nosniff`、拒绝 iframe、严格 Referrer Policy 和禁用摄像头/麦克风/定位的
  响应头；生产客户端产物使用 sentinel key 扫描，不包含市场 API secret、Mock
  标签或 synthetic fixture。
- README 已覆盖本地运行、环境变量、数据源、部署、DNS、项目结构、质量命令、
  Mock policy 与未来 Wise ID 边界。最终检查与已知限制记录在
  `docs/wise-crypto-v0-completion-report.md`。
- 本阶段没有部署、修改 DNS、推送代码或开始 V1。

## 8. SEO 全局规则

- Production canonical 固定为 `https://crypto.wise-invest.org`。
- Preview 和非生产环境必须 `noindex`。
- 每个公开页面提供唯一 title 和 description。
- 动态价格不写入长期缓存的 metadata。
- Sitemap 只包含 enabled、published 的页面和产品。
- 使用语义化 heading、表格、列表和 `<time>`。
- 结构化数据只描述真实存在的 Organization、WebSite、Breadcrumb 等实体。

## 9. Analytics 全局规则

Analytics 通过 provider-neutral facade 调用，业务组件不能直接依赖具体供应商 SDK。

V0 事件：

- `page_view`
- `tool_open`
- `tool_complete`
- `product_view`
- `referral_click`
- `tutorial_click`

Analytics 失败不能阻断导航、工具计算或 Referral 跳转。没有确定隐私和 cookie 策略前，可以使用 noop adapter。

## 10. 未来 Wise ID 边界

- V0 不渲染假的登录入口。
- 公共市场数据和公共页面缓存不得依赖用户身份。
- Header 可以保留结构性 account slot，但 V0 默认不显示。
- 未来身份读取集中在服务端 Identity Adapter。
- 权益判断集中在 Entitlement Service，不能散落在 Client Components。
- 私有页面和公共缓存必须隔离。
- 未来优先采用标准 OIDC/OAuth、PKCE、state、nonce 和严格 callback allowlist。

## 11. 当前执行状态

| 阶段 | 状态 |
|---|---|
| Phase 0：方案确认 | 已完成 |
| 执行规范保存 | 已完成 |
| Phase 1：Project Foundation | 已完成产品界面校正 |
| Phase 2：Market Data Layer | 已完成 |
| Phase 3：Homepage | 已完成 |
| Phase 4：BTC & ETH | 已完成 |
| Phase 5：Crypto Tools | 已完成 |
| Phase 6：Products & Referral | 已完成 |
| Phase 7：Production Quality | 已完成，V0 收口 |
