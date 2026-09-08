# Wise Crypto V0 产品规范与分阶段执行计划

> 状态：Phase 7 Production Quality 已完成，Wise Crypto V0 已收口；上线前访问门禁批次已在本地完成
> 最后更新：2026-09-09
> 仓库：<https://github.com/WiseInvest513/crypto.git>  
> 计划生产域名：<https://crypto.wise-invest.org>

## 1. 文档目的

本文件是 Wise Crypto V0 的产品范围、工程边界、数据规范、质量门槛和分阶段执行基线。

项目必须严格按 Phase 1 至 Phase 7 的顺序推进。每个阶段只完成该阶段明确列出的内容；完成检查和阶段汇报后立即停止，等待用户确认，不能自动进入下一阶段。

如本文件与用户后续的明确指令冲突，以用户最新指令为准，并同步更新本文件，避免实现与规范长期不一致。

Phase 1–7 及第 12–15 节保留各次实施时的历史记录。行情工作台与公开研究以第 16–18、20–21 节
的后续批准内容为当前规范；Wise ID 协议与 Session 以第 27 节为基线，最新页面访问、账户资料、
搜索索引与弹层交互边界以第 28 节为准。旧章节的可见来源说明、多周期 VIP 限制、旧版行情布局、
“所有功能公开”及“尚未接入真实登录”的历史描述不再覆盖这些决策。
当前变更不表示已部署，也不替代本轮独立质量验收。

## 2. 产品目标

Wise Crypto V0 是面向 Crypto / Web3 用户的独立市场信息与分析工具，重点提供：

- 清晰的 BTC、ETH 和整体市场状态。
- 每一项市场数据的来源、更新时间及可用状态都保留在标准化数据合同中；首页摘要
  与行情工作台只显示更新时间与异常状态，避免重复来源文本干扰主信息；完整口径保留在内部合同。
- 可解释、可人工维护的 Wise Take、Market Status 和 Wise Scenario。
- 四个不误导用户的基础计算工具。
- 工具区内的“合约入门”学习工具，以 5 章 26 关解释合约风险和图表观察方法。
- 主站与子站职责分离：产品、邀请码和 Crypto 权益内容统一由 Wise Invest 主站承接。
- V0 收口后的已批准优化已经建立 Wise ID OIDC、独立子站 Session 与 `regular / vip`
  两级身份合同；首页保持公开，行情、工具、课程与账户页需要有效登录。

## 3. V0 明确不做

以下是 V0 收口时的范围记录；后续获批的 Wise ID 登录与访问门禁以第 27–28 节为准。

- V0 阶段原本不实现 Wise ID、登录、注册、用户数据库、VIP 或权益判断；后续登录批次仍不建立
  子站用户数据库，不允许客户端切换或伪造普通 / VIP 身份。
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
- `updatedAtKind`（可选；`source` 表示上游时间，`observed` 表示服务器观测时间）
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

## 7. 当前路由与访问边界

```text
# 公开且可索引
/

# 需要有效 Wise ID Session
/btc
/eth
/tools
/tools/position-size
/tools/leverage
/tools/dca
/tools/risk-reward
/tools/futures-intro
/account
```

全局导航包含：市场总览、行情、工具。BTC / ETH 在行情工作台内切换；`/btc`、
`/eth` 继续作为独立可分享 URL，不新增冗余顶层入口。

登录门禁只验证是否存在有效 Wise ID 身份，不等同于 VIP 权益门禁：`regular` 与 `vip` 用户均可
进入上述行情、工具、课程和账户页面；只有后续明确标记为私有权益的内容才能再进行 VIP 判断。
匿名访问受限页面时进入登录流程，身份服务配置异常时必须 fail closed，不能退回匿名公开访问。

Phase 6 曾公开的 `/products` 与 `/products/[slug]` 已在 2026-09-02 退出子站
核心体验。两个历史地址保留为固定服务端 `308` 永久重定向，统一前往
`https://www.wise-invest.org/perk/crypto`；目的地址不由 path、slug 或查询参数
构造。历史产品地址不进入导航、公开路由清单、sitemap 或 `page_view`。

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
- Data lineage / Updated At：完整来源链保留在数据层；首页视觉层只重复显示更新时间。
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
  BTC/ETH 概览分别展示价格、24 小时、7 天、状态与更新时间。2026-09-02 首页视觉
  降噪后不再在每张卡重复 Provider 名称与获取链路，但标准化结果仍完整保留这些字段。
- ETH/BTC 派生数据继续保留 BTC 与 ETH 两个输入的底层来源、派生口径与较早的
  数据截至时间；完整链路用于服务端校验和资产详情核验，不在首页摘要重复展开。
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
  Component 调用统一领域服务，只有图表交互与随 K 线同步的顶部价格使用 Client
  Component。
- 顶部主价格使用 Binance 图表最新值并随同源图表刷新同步；24 小时与 7 天变化继续
  使用当前有效公共市场 Provider 的聚合 USD 报价。图表与日线技术事实独立使用
  Binance Spot `BTCUSDT` / `ETHUSDT`、USDT、UTC K 线。两种口径在页面上明确
  分开；仅有已闭合日线可用时明确标记 USDT 与“非实时现货价”，绝不包装成 USD
  聚合现货。
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
- 图表包含大尺寸 K 线、可选的短线 EMA10/20/50 与趋势 EMA20/50/200、成交量、最新价线、十字定位、
  当前 OHLCV、键盘逐根查看、可见文字摘要、SVG title/description 和最近二十根
  K 线的语义化数据表。图表周期均线只用于图表展示，形成中 K 线绝不进入下方
  已闭合日线技术事实、Trend 或 DCA 计算。
- 图表可见窗口同步展示首根开盘到末根收盘 / 最新的区间涨跌、最高、最低、振幅、
  末值所处区间位置与总成交量；成交量明确标注为 BTC / ETH 基础资产数量。若末根
  仍在形成，只将其当前成交量与前 20 根已闭合 K 线平均量作机械对比，并明确提示
  当前周期尚不完整。所有这些字段都随周期、可见数量和历史窗口变化，不生成支撑、
  阻力或交易判断。
- 2026-09-02 的资产工作台重设计将原“大标题、双栏快速摘要、页内导览、三层图表
  工具栏”合并为紧凑资产栏和单一命令区。首屏直接出现价格、周期、分析视角、K 线
  与“一眼结论”；OHLCV 采用完整中文标签并作为图内读数，区间统计、完整 EMA、
  日线 SMA 背景和原始数据改为渐进展开。右侧只优先显示已闭合收盘相对 EMA 的位置、
  近三根变化、可见区间位置、距高点和下一次使当前事实改变的客观条件。
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

> 以下为 Phase 6 当时的历史实施记录。产品目录已在 2026-09-02 按最新产品决策
> 退出公开体验；当前行为以第 7 节和第 12 节为准。

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
  共享图，资产和工具详情在没有真实主图时明确清除继承图片。
- Production canonical 对 `SITE_URL` 做 HTTPS 纯 origin 校验并固定为
  `https://crypto.wise-invest.org`；Preview/Development 保持 `noindex`。404 明确
  noindex 且没有错误 canonical；历史产品地址由固定 308 交给主站成为唯一归属。
- Sitemap 当前只包含市场、BTC、ETH 与四个工具固定公开路由；robots、WebSite
  JSON-LD 和与可见导航一致的工具 Breadcrumb JSON-LD 已完成。
- 新增 `page_view` provider-neutral facade，与既有 tool 事件一起
  默认使用 noop adapter；payload 白名单不接收查询参数、用户标识、金融输入、
  结果或 code，Analytics 失败不阻断业务。历史 product/referral facade 保留但
  不再由公开路由调用。
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
- Sitemap 只包含当前仍公开且可索引的页面；重定向后的历史产品地址不得进入。
- 使用语义化 heading、表格、列表和 `<time>`。
- 结构化数据只描述真实存在的 Organization、WebSite、Breadcrumb 等实体。

## 9. Analytics 全局规则

Analytics 通过 provider-neutral facade 调用，业务组件不能直接依赖具体供应商 SDK。

V0 事件：

- `page_view`
- `tool_open`
- `tool_complete`
- `market_interval_change`
- `cycle_timeline_toggle`
- `key_level_select`
- `course_open`
- `lesson_start`
- `quiz_result`
- `lesson_complete`
- `course_complete`

Phase 6 的 `product_view`、`referral_click`、`tutorial_click` facade 作为历史安全
基础设施保留，但产品路由退出公开体验后不再触发。

行情交互事件只允许资产、周期、时间轴动作与隐藏段数、关键位类别及展示序号等有限枚举；
不得发送价格、关键位 ID、账户、金融输入、计算结果、URL 查询、用户或 Session 标识。
Analytics 失败不能阻断导航、行情交互或工具计算。历史 Referral facade 的失败隔离规则继续
保留；没有确定隐私和 cookie 策略前，默认使用 noop adapter。

## 10. Wise ID 接入边界

- 当前只使用真实 Wise ID OIDC 结果建立子站 Session；未登录、配置异常或身份字段异常时不得
  伪造用户，也不得把匿名访问映射为普通会员。
- `regular / vip` 类型、统一功能权限表与 fail-closed 的服务端 Identity Adapter 已建立；两种
  已验证身份都能通过基础产品页面的登录门禁，VIP 权益另由服务端 Entitlement Service 判断。
- 首页、公共市场 Provider cache 与首页 Metadata 不依赖用户身份；受限页面 Metadata 必须
  `noindex`，受限页面响应与账户接口必须使用 `private/no-store` 或等价隔离。
- Header 账户入口只读取同源最小账户状态；身份读取继续集中在服务端 Identity Adapter。
- 权益判断集中在 Entitlement Service，不能散落在 Client Components。
- 受限内容必须在服务端判断后才进入响应；真实身份接入时，个性化响应与公共缓存
  必须使用 `private/no-store` 或等价方式严格隔离。
- 身份协议采用标准 OIDC/OAuth、PKCE、state、nonce 和严格 callback allowlist；完整约束见
  第 27 节，最新页面门禁与账户展示见第 28 节。

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
| Phase 6：Products & Referral | 历史阶段已完成；公开产品线已退出，安全模型保留 |
| Phase 7：Production Quality | 已完成，V0 收口 |
| VIP 行情研究基础（V0 后优化） | 已完成权限合同、页面隔离、四周期客观参考与公开日线周期；真实登录和 AI 未接入 |
| 首页信息层级重设计（V0 后优化） | 已完成；首屏聚焦 BTC/ETH，来源链保留但首页仅显示更新时间 |
| 工具工作台重设计（V0 后优化） | 已完成；四个同权图标方块、输入与核心结果并列、公式渐进展开 |
| 行情工作台 V2 与公开研究（2026-09-03 批准） | 按已确认设计实施；客观关键位与多周期公开，人工策略保持私有，本轮质量结果单独汇报 |
| Binance 官方归档与跨牛熊机械统计（2026-09-06 批准） | 已完成本地离线构建、长期指纹及独立日线周期接入；尚未部署或建立自动发布流水线 |
| 使用闭环与客户端时效修正（2026-09-05 批准） | 已实施；首页入口、短线/趋势联动、关键区域边界、风险工具承接和客户端绝对过期语义已收口 |
| 人工策略发布台本地基础（2026-09-06 批准） | 已实施；编辑、独立复核、加密存储、发布、退回与撤回闭环，本地专用且部署环境强制关闭 |
| 动态历史情景引擎（2026-09-06 批准） | 已实施 BTC/ETH 的近期 EMA 参照和资产级已闭合日线周期；不宣称胜率、预测或自动策略 |
| 新手解释与匿名行为事件（2026-09-06 批准） | 已实施渐进式术语说明与行情/工具交互事件；默认 noop，未接第三方供应商 |
| 合约入门学习工具（2026-09-06 批准） | V2 内容与体验改版完成；5 章 26 关、78 道分层练习、8 关快速路径，作为 `/tools` 内学习型工具，不新增顶层导航或交易功能 |
| Wise ID 主站 OIDC 登录接入（2026-09-08 批准） | 本地接入已建立；主站 `wise_crypto` 客户端尚未注册 / 启用，未部署、未修改 DNS |
| 上线前访问门禁、账户资料与弹层收口（2026-09-09 批准） | 本地实施；仅首页公开，行情、工具、课程与账户页需要普通或 VIP 登录，接口同步鉴权；未推送、未部署 |

## 12. 2026-09-02 产品线退出决策

- Wise Crypto 聚焦 BTC、ETH 行情工作台、K 线分析与实用工具，不再维护独立的
  产品目录、邀请码或权益详情页。
- Header、Footer 与首页不再展示 `/products` 入口。
- `/products` 与全部 `/products/:path*` 不展示旧页面；原页面文件已删除，请求层
  Proxy 固定返回永久重定向至 Wise Invest 主站 Crypto 福利页，请求参数不会参与
  目的地址构造。
- 历史产品地址不再生成自身 canonical、Open Graph 或索引页面，也不进入 sitemap
  和公开 `page_view` 白名单，由主站页面成为内容与搜索引擎的唯一归属。
- Phase 6 已建立的产品数据 schema、来源核验、Referral host allowlist、组件和
  Analytics facade 暂时保留为未公开基础设施，避免未来确有需要时重建安全边界。
- 所有历史 Partner / Product 已统一设为 disabled + unpublished；即使旧目录组件被
  误接回路由，产品服务也不会返回可发布条目。
- 若未来重新启用任何产品信息，必须重新确认事实、费用、地区、资格、条款与商业
  关系；当前 2026-08-31 的历史核验结果不得自动视为仍然有效。

## 13. 2026-09-02 VIP 行情研究基础

> 历史实施记录。2026-09-03 起，客观多周期研究走第 16 节的独立公开服务；人工策略
> 权限仍然 fail closed，不通过将普通用户伪装成 VIP 来公开数据。

- 当前产品主线调整为 `BTC / ETH 行情事实 → K 线与 EMA → VIP 人工策略 → 风险工具`。
- 用户等级只定义 `regular` 与 `vip`。公开访问默认匿名普通权限；VIP 只能来自未来
  Wise ID 的服务端已验证结果，不能由 URL、localStorage、客户端状态或环境变量授予。
- BTC / ETH 页面已经加入 VIP 行情策略台。普通用户只看到能力边界与主站权益入口，
  即使服务端已有 active 人工配置，关键价格、方向、条件与正文也不进入其响应。
- 现有人工关键位与 Wise Scenario 配置复用为首个受限内容源；只有 VIP、已发布、
  审核通过且处于有效期内才展示，过期与未发布状态不会伪装成当前策略。
- 人工策略 schema 强制包含倾向、作者、适用窗口、判断依据、确认/失效条件、风险说明、
  来源与有效期。真实 VIP 策略不得提交到 Git；当前仓库仅保留空生产配置和测试 fixture，
  未来必须在服务端鉴权后从私有 CMS / 数据库读取。
- 多周期客观参考已经在 VIP 服务端边界内实现：15m / 1h / 4h / 1d 各读取最多
  1,000 根 Binance Spot K 线，排除形成中 K 线后计算 EMA10/20/50/200、近 3/20 根
  变化、距近 20 根高点、区间位置与量能比例。四周期独立保留来源、口径、截至时间、
  获取时间、stale、cache 和 error；普通权限不会触发行情请求或收到摘要数据。
- 多周期顶部汇总仅陈述可验证的 EMA 相对位置与排列数量，不产生多空评分、方向、
  支撑、阻力、目标价或交易建议。牛熊转接标记与 DeepSeek 回撤分析仍只保留透明规划状态。
- 具体内容合同与后续边界见
  `docs/product-specs/wise-crypto-vip-research-foundation.md`。

## 14. 2026-09-02 首页信息层级重设计

- 首页由“全部数据平铺”调整为清晰的任务顺序：市场入口与 BTC/ETH 核心报价、
  “市场现在”三条客观事实、VIP 人工策略入口、有效的人工内容、市场脉搏、风险工具，
  最后才是默认收起的衍生品与资金流。
- 首屏使用大字号标题和两张资产主卡，价格、24 小时、7 天变化及进入 K 线工作台的
  操作在同一视觉单元内完成；不添加伪造的小型趋势图或装饰性历史走势。
- 首页卡片仅展示 `updatedAt`（上游无时间时才显示明确的检查时间）和异常状态，不再
  重复显示 Provider 名称、scope、retrievedAt、cache 或“查看数据口径”。这些字段没有
  从 `MarketDatum` / `DatumPresentation` 删除，资产详情与服务端审计继续使用完整链路。
- 日线或报价失败时，“市场现在”保留明确的 unavailable/error 卡片，不再静默消失；
  缺少可靠数据仍显示破折号或说明，不以零值补位。
- 视觉系统参考 Wise Invest 主站的白色/暖灰表面、深色粗标题、琥珀色权益强调、较大
  圆角和克制阴影。移动端改为自然纵向阅读，移除隐藏核心事实的横向卡片滚动。
- 详细设计、概念稿与实现边界记录在
  `docs/product-specs/wise-crypto-homepage-redesign.md`。

## 15. 2026-09-02 工具工作台重设计

- `/tools` 使用问题驱动的四张同权图标方块：仓位风险、杠杆、历史 DCA 与风险回报
  在 Desktop 四列并排，分别明确“填写什么 / 得到什么”，不再形成主工具与附属工具层级。
- 四个详情页统一为左侧输入、右侧核心结果的计算工作台；移动端保持输入后结果的自然
  DOM 顺序。公式、输出和未计因素进入原生渐进展开，不再占据首屏固定侧栏。
- 每个工具只突出一个核心结果：资产数量、初始保证金、风险回报比或历史期末价值；
  其他数字作为次要事实展示，不增加推荐风险比例、杠杆、价位或交易方向。
- DCA 完整来源、scope、截至时间、获取时间、cache 与错误元数据继续保留；fresh 时折叠
  展示，error / unavailable 默认展开，可靠日线不可用时仍禁止计算。
- 工具目录新增任务分类、问题、输入摘要、结果摘要和主结果字段，首页工具入口也从同一
  目录派生，避免文案与顺序漂移。
- 字段错误、通用错误焦点、hint/error 关联、结果播报和重复分享反馈完成无障碍修正。
  详细结构、概念稿与保持不变的计算边界见
  `docs/product-specs/wise-crypto-tools-redesign.md`。

## 16. 2026-09-03 行情工作台 V2 与公开客观研究

### 已批准范围与界面

- 用户已确认 `docs/designs/market-workbench-v2/` 的桌面及手机设计方向，并批准实现。
  概念图中的数字不进入生产数据或测试 fixture；页面只展示服务端校验后的真实数据。
- 顶层导航只保留市场总览、行情、工具。BTC / ETH 在工作台内切换，`/btc`、`/eth`
  的分享、SEO 和既有路由保持有效。首页内容层级和四个同权工具卡不重新规划。
- 采用黑白灰基础、系统无衬线与苹方回退、蓝红涨跌和可区分的 EMA 配色，不使用
  绿色品牌界面，也不下载打包 Apple 专属字体。
- 首屏聚焦资产、当前价格、周期和大图表；桌面图表在左、研究在右，手机先图表后研究。
  右侧按“行情解读 → 最近关键位 → 接下来关注 → 多周期对照”组织，不罗列全量指标。
- 行情界面不再重复 Provider、source/scope、retrievedAt、cache、原始 K 线表、
  可见区间统计和计算口径长文，仅保留简洁更新时间及真实 loading/error/stale 提示。
  source、scope、updatedAt、updatedAtKind、retrievedAt、error、stale、cache、
  provenance、算法版本继续存在于内部标准化合同，不因视觉清理而删除。
- 顶部价格来自 Binance Spot USDT K 线；用户后续批准将“本周期”替换为右上角
  近 1 天、7 天、30 天涨跌。三窗独立于图表周期，约每分钟刷新；主价格仍每 5 秒
  检查，保留各自真实采样时间，不将两个时点拼算，也不混入聚合 USD 报价。
  首页独立聚合 USD 报价的既有口径不受此更改影响。工作台左右加入响应式留白。
- 图层设置只控制 EMA、成交量、关键位显隐；拖动和缩放只改变可见窗口，不能悄悄
  改变最新研究的计算窗口。点击研究中的价位可高亮相应图线；悬停、点击、键盘选中
  时显示 OHLCV，保留图表文字摘要和键盘可访问路径。

### 当前价格、已确认结构与客观关键位

- 当前价格相对 EMA 的位置可随最新 K 线变化；突破、失守等确认只能依据明确的
  已完成周期，不把盘中瞬间穿越描述为已确认事件，也不自动输出开仓、止损或胜率。
- `src/lib/market/key-levels.ts` 基于同一资产、同一周期的连续 OHLCV 计算客观关键位。
  固定使用最近最多 500 根已完成 K 线，少于 200 根返回 unavailable；形成中 K 线
  不进入该计算，数据非法、混合口径、缺口或非有限结果均不生成替代数字。
- 候选由已确认摆动点、最新完成周期 Pivot、窗口 Fibonacci 和成交高密度节点聚类
  构成；默认按距当前价的距离展示上方三档压力、下方三档支撑，包含距离与简短依据，
  不足三档时保持实际数量。“更多关键位”展开其他真实候选；点击后图表高亮并定位。
  近档突出、远档淡化，已聚类候选可呈现为区域；成交密集区与 Fibonacci 可独立开关。
  图表标签过密时优先保留选中与最近档位，价格线不因标签避让而移动。权重不是概率或成功率，区域
  中心价也不代表价格必然反转。
- 摆动点必须等待之后 5 根 K 线确认，保留极值 anchorAt 与实际 confirmedAt；不能
  将事后才可知的候选包装成当时已发出的信号或回测成绩。
- POC、VAL、VAH 是 OHLCV 分桶成交量估算，目标价值区覆盖 70% 成交量，整桶累计
  可能超过目标；不等于真实逐笔成交、持仓成本或订单簿流动性。界面保留简短“估算”
  标签；全零成交量时不输出成交分布，价格数据有效时仍可保留独立价格候选。

### 同源数据服务、刷新与降级

- 图表继续通过 `/api/market/candles` 每 5 秒检查尾部增量；客户端不直连第三方 API。
- 新增 `/api/market/performance?asset=btc|eth`，只接受资产参数，拒绝重复与未知参数。
  近 1 天、7 天使用 Binance `/api/v3/ticker` 的分钟对齐滚动窗口；近 30 天使用
  同 Binance 最新一分钟 K 线价格与 30 天前对应分钟开盘价派生，实际窗口允许不到
  一分钟的对齐差异，不冒充自然日、自然周、自然月或 30 根日线表现。起止时间、
  `basis`、source、scope、provenance、cache 与 stale 均保留，鼠标提示展示起止时间。
  三窗并行、独立失败；六个固定缓存键、60 秒缓存、300 秒绝对 last-good 与最长
  30 秒失败退避。仅暂时网络/服务器故障可回退同 Binance 公共主机，限流、拒绝访问
  和非法响应不通过切主机规避。数据缺失显示破折号与状态，客户端也会过期移除旧值。
  官方口径依据：[Binance Spot REST 文档](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#rolling-window-price-change-statistics)。
- 新增 `/api/market/research?asset=btc|eth&interval=15m|1h|4h|1d`，只接受这两个参数，
  拒绝重复、未知参数及任意请求范围。返回所选周期 `levels` 与四周期 `timeframes`，
  不含身份或人工策略。请求由 `loadAssetResearchSnapshot()` 统一处理。
- 四周期独立并行加载，首次最多取 1,000 根；后续正常读取 3 根增量并合并。源切换、
  不连续尾部或无法补全旧形成中 K 线时完整重同步，不每 5 秒反复请求四份完整历史。
- 客户端约每 60 秒请求研究，并支持周期切换、恢复可见和手动刷新。服务端研究缓存
  与身份无关，按 Provider 实例、资产、周期隔离，最多 8 项并使用 single-flight。
  最长 TTL 为 60 秒，在对应周期闭合边界提前失效；HTTP 响应不另加浏览器/CDN缓存。
- 研究 last-known-good 最长为 300 秒，失败退避最长 15 秒。失败不延长最后成功数据
  的绝对有效期；陈旧尾部不能回滚较新的已验证历史。超出有效期后返回错误/不可用。
- 每个周期保留独立的来源链、时间与可用状态，一个周期失败不影响其余周期。价格和
  图表可用、研究失败时继续显示图表，并明确说明研究未能更新；不补零或显示错误周期
  的旧结论。synthetic 数据不得进入此公开服务。
- 此缓存是进程内尽力缓存，不跨 Serverless 实例或冷启动共享，不新增数据库、定时
  任务、分布式缓存或后台身份依赖。

### 公开研究与未来 VIP 边界

- 本次是明确公开客观多周期研究的产品权限调整，不是赋予普通用户 VIP 身份。
  `public-research-service.ts` 不读取 Session、access 或人工内容；旧 VIP 服务的
  fail-closed 行为保留，不被新公开路径用作越权入口。
- 人工关键位、作者行情策略、Wise Scenario 与 Wise Take 仍在独立私有内容路径，
  未验证身份、未发布、过期或未经审核的正文不得进入公开响应或公共缓存。
- 新行情工作台不显示空的 VIP 锁定宣传区，也不以算法结果替代未发布的 Wise 判断。
  未来 VIP 策略必须在服务器验证身份后从私有内容源读取，不能通过 URL 或客户端状态
  开放，也不能提交真实策略到 Git。
- 当前不实现真实登录、Wise ID、DeepSeek/其他 AI 分析、持久化关键位事件、回踩
  历史或牛熊转换；这些需要后续独立授权、真实时序数据及验证。
- 本节说明已批准的实现范围，不宣称浏览器、lint、typecheck、tests 或 production build
  已验收；本轮检查结果由实际执行后单独记录和汇报，不沿用旧阶段的通过记录。

## 17. 2026-09-05 使用闭环与客户端时效修正

- 首页删除重复的即时行情结论；“市场现在”只保留 BTC、ETH 两条日线客观事实。
  已失效的 `#vip-research` 锚点不再出现在首页，BTC / ETH 行动入口直接进入相应行情
  工作台。人工策略未发布时明确显示未发布状态，真实 VIP 权益仍由 Wise Invest 主站承接。
- 行情工作台把“短线（EMA10/20/50）”与“趋势（EMA20/50/200）”设为直接可见的
  分析视角。选择视角后，图上均线、右侧价格相对位置和多周期结构使用同一组口径，
  避免用户看到互相不对应的筛选与解读。
- 聚类关键位按完整价格区域分类：现价低于区域下沿才是压力，高于区域上沿才是支撑，
  落在上下沿之间则明确显示“价格正在关键区域内”。突破条件使用压力区上沿，失效条件
  使用支撑区下沿；区域中心只作定位参考，不再被当作突破阈值。现价区域默认绘制在图表上，
  上下各三档近位及其他真实候选保持渐进展示。
- 右侧研究形成“价格相对均线 → 当前市场位置 → 下一步确认条件 → 风险核算”的操作闭环，
  提供仓位风险与风险回报工具入口，但不替用户决定多空、不预填未经确认的价格，也不生成
  自动投资判断。
- 客户端最后成功数据采用以服务端 `retrievedAt` 为起点的 300 秒绝对有效期；失败重试不能
  延长旧数据寿命。行情、研究与 1 天 / 7 天 / 30 天表现分别过期，非法或未来时间戳按不可用
  处理。过期 K 线可以作为历史记录保留，但不得继续显示为当前价格、当前价线或即时分析。
- 四个工具在手机端继续保持同权入口；计算完成后结果区获得焦点并避开粘性导航，核心结果
  通过简短 `aria-live` 播报。仓位和风险回报表单会在方向或相关价格变化后重新验证，避免保留
  已失效的关系错误；橙色辅助文本对比度达到 WCAG AA。
- 权限能力明确拆分为公开的 `analysis.publicResearch` 与私有的
  `analysis.privateMultiTimeframe`。后者保留旧 VIP 服务的服务端 fail-closed 边界；公开研究
  不读取身份，也不会把普通用户伪装为 VIP。
- 本批次不接入 Wise ID、AI、私有策略 CMS、交易执行或新数据供应商，不修改既有计算公式，
  不部署生产环境。

## 18. 2026-09-06 通用观察与 Wise 人工策略边界

### 产品分层

- 行情页面明确拆成三层：底层是可验证的市场事实；中层是公开的“通用观察”，把 EMA、
  关键价格区域、已闭合量能和多周期位置组织成确认流程；顶层是 Wise 人工策略。
- 公开网络资料只用于核对指标定义、计算公式、确认流程与方法局限，不能直接写入当前
  看多 / 看空、进场、目标、胜率或收益承诺。当前方法基线记录在
  `docs/research/strategy-methods.md`。
- 通用观察继续公开：当前价格与所选 EMA 的位置、均线排列、最近三根变化、上下关键
  区域、以区域边界为准的收盘确认、最新已闭合成交量相对前 20 根均量、四周期位于
  EMA20 上下方的实际数量，以及风险计算入口。`3/4` 只表示三项条件满足，不转换成
  `75%` 概率。
- RSI、MACD、ATR 区域宽度与完整突破回踩事件链已完成研究，但未在本批次冒充已接入；
  它们需要后续独立实现、数据验证与界面层级确认。

### 人工策略合同与安全边界

- BTC 与 ETH 共用一套严格人工策略 schema：版本、资产、工作流状态、人工倾向、标题、
  摘要、适用周期、价格区域、确认条件、失效条件、观察项、风险说明、作者、审核人、
  来源、创建 / 审核 / 发布 / 生效 / 到期时间均为显式字段。
- 人工价格使用 `lower / upper` 区域，不把中心值当作保证生效的精确价。发布内容必须有
  至少一个区域、确认与失效条件、风险说明、审核人、可验证来源和完整有效窗口。
- 生命周期由服务端派生：`draft / in_review` 为未发布，`withdrawn` 优先撤回；已发布内容
  使用半开区间 `[validFrom, validUntil)`，到达 `validUntil` 的瞬间立即失效。页面长时间
  停留跨过到期时间时，当前策略正文也会从界面移除。
- 私有仓库采用 access-first 懒读取。匿名用户、已验证普通用户、畸形身份或身份服务异常
  一律只收到 `{ kind: "locked", asset }`，不会触发私有仓库，也不会得知策略是否存在、
  方向、价格、作者、时间或来源。
- 只有服务端确认的 VIP 才读取私有仓库；仅 `published + reviewed + active` 内容会投影成
  最小展示 DTO。草稿、排期、过期、撤回、资产错配、非法 schema 或仓库异常均不返回
  旧正文，不回退到历史策略。
- 人工策略不进入 `/api/market/research` 或任何公共行情缓存。Server Component 完成鉴权和
  脱敏后，以渲染 slot 注入现有 Client Component 行情工作台；公开行情获取和渲染仍不依赖
  未来 Wise ID。

### 页面与当前临时状态

- 右侧阅读顺序调整为“Wise 人工策略 → 通用观察 → 最近关键位 → 接下来关注 → 多周期”。
  锁定状态保持紧凑，不重新接回旧版的大面积 VIP 能力列表，也不压缩左侧 K 线首屏。
- 人工层使用黑白灰与克制琥珀强调；算法支撑、压力和成交密集区继续保持蓝、红、紫，避免
  把算法线误认为 Wise 人工判断。界面不重新铺开 Provider 来源文字。
- 平板策略区跨两列，后续客观区按语义类控制边框；手机保持“图表 → 人工策略 → 客观研究”
  的 DOM 顺序，按钮和展开控件保持至少 44px 触控高度。
- 当前生产仓库实现明确返回 `null`，没有真实或示例策略价格提交到 Git。因 Wise ID 与私有
  CMS 尚未接入，公开网站默认只展示普通权限边界；有效 VIP 状态只用测试 fixture 验证，
  不增加 query、Cookie、环境变量或客户端切换后门。
- 本批次不接入真实登录、AI 分析、交易执行、私有 CMS、自动策略发布或回测胜率，也不部署。

## 19. 2026-09-06 人工策略发布台（本地私有基础）

### 目标与范围

- 新增 `/studio/strategies`，只完成真实人工策略的编辑、独立复核、发布、退回和撤回闭环。
  本轮不接入 Wise staff 账号、Wise ID、远程 CMS、AI 自动判断、交易执行或部署。
- 页面不进入公开 Header/Footer 导航、`PUBLIC_ROUTES`、sitemap 或公开 `page_view` 白名单；
  Metadata、robots 响应头和应用 robots 均明确 `noindex / nofollow / noarchive`。
- 发布台不是公开用户的 VIP 开关。staff 的 `editor / reviewer` 与网站的
  `regular / vip` 是两套完全独立的身份空间；合法 staff Cookie 也不能让 `/btc` 或 `/eth`
  获得 VIP 正文。

### 工作流与内容合同

- 草稿允许不完整并可反复保存；送审时才要求倾向、标题、摘要、周期、至少一个价格区域、
  确认条件、失效条件、风险说明、可验证 HTTPS 来源以及完整有效窗口。
- 编辑者只能保存和送审。送审会先保存最新正文，再冻结一份 `in_review` 候选；冻结期间
  正文只读。复核者不能编辑正文，只能带原因退回，或重新输入自己的访问令牌并显式确认发布。
- 作者、复核者、ID、revision、创建 / 审核 / 发布时间由服务端产生或保留，不接受客户端
  覆写。作者与复核者必须不同；发布时重新读取冻结候选并校验内容一致，避免审核后被替换。
- 已发布内容是不可变快照；同一资产的有效窗口不得重叠。撤回要求复核者重新认证、明确确认
  和填写原因，只追加 tombstone，不删除历史，也不会自动回退到旧策略。
- 公共读取不再采用“最新一条”覆盖语义。仓库在给定时点裁决唯一 active；当前 active 优先于
  未来排期，多个 active、损坏、资产错配或非法 schema 一律 `unavailable`。有效窗口继续使用
  `[validFrom, validUntil)`。

### 本地身份与存储安全

- 只有 `WISE_STRATEGY_STUDIO_MODE=local`、全部配置完整、且没有 Vercel 或其他部署标记时
  才启用。发现任何 `NEXT_PUBLIC_WISE_STRATEGY_*` 变量也会强制关闭。
- 编辑与复核各使用不同的 32-byte canonical base64url 高熵原始令牌；环境仅保存 SHA-256
  digest。开发与预览脚本只监听 `127.0.0.1:2222`。Session 使用独立
  32-byte HMAC key、30 分钟固定半开有效期、高熵 nonce，以及 `HttpOnly / SameSite=Strict /
  path=/studio/strategies` Cookie。
- 所有已登录 mutation 同时验证 session-bound CSRF、精确本机 Origin / Host（仅
  `localhost:2222` 或 `127.0.0.1:2222`）与当前 staff 配置。发布和撤回还要求复核者再次认证。
- 原始 staff 令牌采用固定高熵格式，登录校验保持固定最短耗时；作者、复核者、退回与撤回
  审计使用稳定 subject，客户端只接收可展示角色名。会话到期或页面重新聚焦时自动回到登录边界。
- 草稿、冻结候选、发布快照、撤回和退回意见保存在单个 AES-256-GCM 认证加密 envelope；
  使用专用加密 key、文件大小上限、`0600`、目录锁、generation/editVersion 乐观锁及
  temp → fsync → rename → directory fsync 原子写入。损坏或认证失败不自动清空、不写默认数据。
- POSIX 环境校验存储目录/文件 owner 与 `0700/0600` 权限；初始化标记存在后若主密文缺失，
  读写均 fail closed。崩溃残留锁只有在同主机、超过阈值且原 PID 明确不存在时才可恢复。
- 默认目录 `.wise-crypto-private/strategies` 已被 Git 忽略。该文件方案只用于本机创作与流程
  验证，不声称支持 Vercel 多实例持久化；生产必须换成受控 staff 身份与私有数据库/CMS 适配器。

### 界面与展示边界

- 桌面采用连续编辑画布与右侧 sticky 预览/检查栏，移动端改为单列；控件触控高度至少 44px。
  视觉沿用黑白灰、系统中文字体和克制琥珀人工层，不使用绿色品牌色、渐变或假指标。
- 编辑区覆盖策略概况、关键价格区域、确认与失效、来源及风险说明。预览只呈现未来 VIP DTO
  允许的字段，不展示来源 URL、内部 subject、Cookie、存储路径或审计实现。
- 当前仍没有真实策略内容写入仓库；空字段不会被示例价位、方向、胜率或 AI 文案补齐。公开
  用户因 Wise ID 尚未接入仍保持普通权限，这一状态是预期的 fail-closed，而不是发布台故障。

## 20. 2026-09-06 动态历史情景引擎首版

### 产品目标与首版范围

- 在不要求人工每天维护策略的前提下，把当前已验证行情整理为“当前阶段 → 历史参照 →
  关键位置 → 接下来确认 / 失效”的连续阅读路径。它用于帮助用户理解现在处于什么结构，
  不是替用户决定开多、开空或下单。
- 本节获批后的自动研究顺序取代第 18 节“人工策略优先”的历史页面顺序：公开、可自动更新的
  客观阶段和历史参照先出现，Wise 人工策略仍保持独立私有边界，但不再遮挡首要行情结论。
- 首版的精确 EMA 状态指纹统计仅覆盖 BTC、ETH 的 `1h / 4h / 1d`。`15m` 仍可用于现有
  实时图表，但不进行自身的近期或长期 EMA 指纹匹配，避免在样本强相关、噪声更高且窗口
  覆盖过短时给出虚假的稳定结论；第 21 节的资产级已闭合日线周期独立于所选图表周期，
  因而在 `15m` 页面也可展示。
- 输入只使用服务端从 Binance 公开市场接口取得并通过既有 schema、连续性与 OHLCV 校验的
  真实已闭合 K 线。形成中 K 线可以继续服务当前价格和图表，但不能进入事件确认、历史匹配
  或未来结果统计；客户端不直接请求 Binance。
- 首版复用每个资产、周期最近最多 1,000 根已验证 K 线。因此所有页面文案只能称为
  “近期历史参照”或“当前数据窗口内的相似样本”，不得称为“全部历史”“历次牛熊规律”或
  “长期回测”。实际样本数、覆盖起止时间、周期和算法版本必须保留并可核验。

### 当前阶段与历史匹配口径

- 当前阶段由最新已闭合收盘价相对 EMA10、EMA20、EMA50 的实际位置，以及三条 EMA 的
  排列状态共同构成。只陈述已发生的关系，例如“收盘高于 EMA10 / EMA20、低于 EMA50”
  或“EMA10 > EMA20 > EMA50”；混合排列必须明确显示为交错，不包装为多空评分。
- 历史样本必须使用与当前完全相同的资产、周期和阶段指纹。连续多根 K 线停留在同一状态时，
  只把第一次进入该状态计为一个事件，不能把同一段行情重复计数来放大样本量。
- 每个历史事件的特征只能使用事件确认时已经闭合且当时可获得的数据。当前关键位、当前 EMA
  或后续形成的摆动点不得回填到过去；需要未来 24 根结果的数据不足时，该事件不进入完整
  结果聚合，避免前视偏差。
- 首版观察事件后第 `6 / 12 / 24` 根已闭合 K 线：展示该时点相对事件收盘的实际涨跌，
  并可展示区间内最大上行和最大下行幅度。聚合只展示样本数、中位数和 25%–75% 分位区间；
  中位数、分位区间与代表案例可使用全部完整事件。方向占比只能使用相隔至少对应观察周期、
  未来观察窗口互不重叠的事件，并披露不重叠样本数；少于 20 个不重叠样本时明确标记
  “样本不足”，不输出方向占比、胜率或概率。
- 页面最多展示少量可核对的代表样本，并说明选取规则；不能只挑选支持当前叙事的案例。
  样本日期、事件价、后续窗口及结果均来自同一条已验证时序。

### 页面信息层级

- 行情工作台右侧优先显示“当前阶段”，用一句主结论说明价格与 EMA 的客观关系，并保留
  周期与已闭合时间，避免重新堆满原始 OHLCV、数据来源和计算过程。
- “历史参照”紧随当前阶段，默认展示实际样本数、覆盖区间及 `6 / 12 / 24` 根的简洁统计；
  详细样本采用渐进展开。历史事件若绘制在 K 线上，必须与对应时间对齐，并能与普通关键位、
  当前价线和人工策略视觉区分。
- “关键位置”继续使用第 16–18 节已验证的支撑、压力与成交密集区域，只按实际候选展示，
  不补齐虚构档位。历史引擎不能把这些客观区域改写为保证生效的进场价、止损价或目标价。
- “接下来确认 / 失效”只给出能使当前客观阶段发生变化的机械条件，例如下一根已闭合收盘
  重新站上某条 EMA 或越过既有关键区域边界；形成中价格穿越不能写成已经确认。
- 数据正常时，视觉层可以仅显示更新时间与异常状态；source、scope、asOf、retrievedAt、
  stale、cache、provenance 和算法版本仍必须贯穿服务端合同，不能因界面降噪而删除。

### 明确不做与风险边界

- 首版不接入 DeepSeek 或其他 AI，不生成 Wise 人工判断，不自动发布策略，不连接交易所账户，
  不下单，也不提供仓位、杠杆、止损或收益承诺。
- 统计结果只说明同一近期窗口内相同机械状态随后发生了什么，不能写成“接下来会涨 / 跌”、
  “历史证明有效”或“成功率”。即使方向占比已排除重叠观察窗口，事件之间仍可能相关；市场
  制度变化和极端行情也可能使参照失效。
- 任何数据失败、样本不足、历史不连续、周期不支持或结果非有限时，都显示 unavailable / 样本
  不足，不能以零值、测试 fixture、其他周期结果或人工猜测补位。
- 本节只定义用户已批准的实现范围。完成后仍须实际运行 lint、typecheck、tests、production
  build 和浏览器响应式检查；未完成验收前不得把本节状态改写为已发布或已部署。

### 未来完整历史基线层

- 若后续需要跨牛熊周期的长期参照，应独立建设 Binance 官方公开归档基线：按资产与周期下载
  日 / 月 K 线归档，验证官方 checksum、连续性、重复项和时间边界，再离线重算事件。
- 历史基线应保存紧凑的事件摘要和统计结果，而不是在每次页面访问时重新下载全部 K 线或把
  全量历史发送给浏览器。记录至少包含数据覆盖区间、数据版本 / checksum、算法版本、生成时间、
  样本数和失效状态，以便复算与审计。
- 实时公开接口继续负责当前阶段和近期增量；归档层负责长期基线。两层只有在资产、交易场所、
  计价单位、周期、K 线闭合口径和算法版本一致时才可合并，不能静默混入其他交易所或不同口径。
- 完整归档、持久化、后台更新任务和跨版本统计迁移不属于本次首版，必须在数据存储、更新频率、
  失败恢复与发布验收方案明确后另行批准。

## 21. 2026-09-06 Binance 官方归档与跨牛熊机械统计

### 数据边界与离线构建

- 长期基线只使用 Binance 官方公开现货归档中的 `BTCUSDT / ETHUSDT`，首批周期为
  `1h / 4h / 1d`。归档下载属于显式离线构建步骤；公共网页请求、Route Handler 和
  Client Component 均不得在运行时下载、解压或重算全量历史。
- 每个月度 ZIP 必须先取得对应官方 `.CHECKSUM` 并逐文件验证 SHA-256。ZIP 只能包含预期的
  单个根目录 CSV；文件名、行结构、数值范围、OHLC 关系、时间精度、K 线闭合边界、顺序和
  重复项均须 fail closed。不能用零值、插值、其他交易所或实时接口悄悄补洞。
- 2025 年起归档可能使用微秒时间戳；离线解析器统一规范化为毫秒，同时保留原始归档哈希。
  原始 ZIP 与中间缓存只保存在 Git 忽略的私有构建目录。仓库和应用只消费按版本生成、原子写入
  的紧凑统计产物与 manifest，不向浏览器发送全量历史 K 线。
- 首版允许 `1h / 4h` 官方归档中的严格对齐 open-time 缺口，但必须按真实连续段计算，绝不
  插值或把缺口两侧拼接成同一段。EMA warm-up、状态切换事件、`6 / 12 / 24` 根未来窗口及
  不重叠方向样本均不得跨段；所有段的原始事件结果合并后再计算分位数与方向占比，不能平均
  已聚合统计。每个缺口的两侧时间和缺失根数保留在审计 manifest，运行时只保留汇总数量。
  `1d` 若出现任何缺口则 fail closed，避免 EMA200 牛熊制度跨空白延续。实际起止月份与缺口
  数量以最终 manifest 为准。同期极少数旧毫秒记录把 close time 写成 bucket 内提前时间或下一周期起点；
  仅在 open time 仍连续、close 位于 `[open, open + interval]` 时规范化为标准边界，并在每月
  cache、单流 manifest 与最终 manifest 记录修正数量。微秒边界与其他偏差继续严格失败。
- Binance 早期停机恢复阶段可能产生开盘时间不在 UTC 周期 boundary 的旧毫秒小时记录。
  离线构建只可排除 `1h / 4h` 中这类行，不得平移、插值或补造；微秒记录和 `1d` 记录遇到
  非 boundary 时间仍须失败。每个源文件与总覆盖必须同时记录原始行数、接受 K 线数和
  `excludedUnalignedCandleCount`；与下面独立的零成交占位排除数一起可复算原始行数。运行时
  只保留汇总，不携带被排除的逐行数据。
- 旧毫秒 `1h / 4h` 还允许严格排除一种零成交占位行：`open time` 已对齐，但原始 `close time`
  早于 `open time` 且仍在紧邻前一 bucket 内，同时 OHLC 完全相等，所有量与成交笔数均为零。
  不得平移、补造或把它计入非对齐排除；微秒、`1d`、越界、非零成交和 OHLC 不等均须失败。
  每个源文件、总覆盖和运行时汇总必须独立记录
  `excludedLegacyZeroVolumePlaceholderCount`，并满足原始行数等于接受数加两类排除数；过滤后的
  标准 bucket 空白照常进入 gap / segment 审计。
- manifest 至少记录 schema、数据集、算法、制度与事件研究版本，资产、周期、覆盖起止、K 线数、
  segment / gap / missing-candle 数、两类排除数、每个精确缺口、生成时间、每个源文件 URL /
  checksum / 原始行数 / 接受行数，
  以及最终产物 SHA-256。任何版本、范围或校验不一致都必须使对应长期基线不可用，不能回退为
  貌似正常的旧结论。

### 牛熊阶段机械定义

- “牛市 / 熊市阶段”是 Wise Crypto 为分组统计定义的机械日线标签，不是 Binance 官方判断，也不
  是对未来市场的定性。EMA 使用同一套逐根、仅向后看的计算口径，并在 EMA200 完整前保持未分类。
- `bull`：当日日线已闭合收盘价高于 EMA200，且 EMA50 高于 EMA200；`bear`：当日日线已闭合
  收盘价低于 EMA200，且 EMA50 低于 EMA200；其余为 `transition`。制度只在已闭合日线后改变。
- 对 `1h / 4h` 历史事件，只能使用 `closedAt` 不晚于该事件 `closedAt` 的最近一根已闭合日线标签。
  不能使用同一自然日尚未闭合的日线结果，也不能把后来修订出的阶段回填给更早事件。

### 已闭合日线周期段与同类分布

- 日线标签每次从 `bull / bear / transition` 中一种切换到另一种时，结束上一段并开始下一段；
  相邻同标签日线属于同一周期段，不能重复计数。归档第一段可能在真实阶段开始后才进入数据
  覆盖，标记为左截断；最后一段截至最新已闭合日线仍在延续，标记为右截断。
- 历史同类分布只纳入起点和终点都由真实标签切换界定的完整周期段。左截断首段和右截断当前
  段可以用于如实展示已观察部分，但不得混入完整阶段的样本数、中位数或 25%–75% 分位区间。
- 每段记录起止已闭合日线时间、已闭合日线数量、起止收盘、阶段收盘涨跌、收盘峰值涨幅和
  最大收盘回撤。全部收益与回撤只使用逐日 close；最大回撤是阶段内已出现的收盘峰值到其后
  收盘的最大下降幅度，不使用盘中 high / low，也不包装为可交易止损距离。
- 运行时以归档最后状态为起点，只用最新已闭合 Spot 日线向前延续或产生真实标签切换；形成中
  日线不能改变当前周期。公开投影只包含独立 `current`、按时间升序的最近最多 7 段
  `timeline`、三类完整阶段分布及紧凑覆盖信息；时间轴最后一段必须与 `current` 完全一致。
- 日线周期使用独立 `MarketDatum`、能力名、日线 scope、更新时间、stale、cache、error、
  provenance 和客户端绝对过期状态。它不依赖当前选择的 `15m / 1h / 4h / 1d`，一个周期
  自身的近期或长期 EMA 指纹失败也不能隐藏仍有效的日线周期；反向亦然。

### 跨周期事件统计与页面呈现

- 长期事件继续复用第 20 节的 EMA10 / EMA20 / EMA50 精确状态指纹、首次进入状态去重、
  `6 / 12 / 24` 根未来观察窗、最大有利 / 不利变动、中位数及 25%–75% 分位区间。
  统计分别保留全部历史及 `bull / bear / transition` 分组，不能只挑支持当前叙事的制度或案例。
- 每个 `asset × interval` 都必须至少有一个完整 bull 事件和一个完整 bear 事件才可发布；单个
  精确状态指纹允许只在一种制度出现，另一制度的样本按真实情况保持为零或不足，不得补造。
- 当前页面把实时已闭合 K 线计算出的状态指纹，与相同资产、交易场所、计价、周期和算法版本的
  长期产物匹配；当前制度使用最新可用已闭合日线机械标签。条件不一致时长期参照直接不可用。
- “历史参照”首先展示当前日线周期位置和自动客观解读，再显示最近周期时间轴，最后才显示
  所选图表周期的 EMA 指纹参照。当前卡只突出阶段、已闭合日数、阶段收盘涨跌、收盘峰值、
  最大收盘回撤，以及当前持续长度、阶段收盘变化和最大收盘回撤幅度相对完整同类阶段中位数
  与中间一半区间的位置。
- 时间轴按时间升序，默认突出最近 4 段，更早记录渐进展开，发送到浏览器的公开结果最多 7 段；
  每段只显示阶段、日期、已闭合日数与阶段收盘变化，不把完整归档周期表或原始日线发送到客户端。
  `15m` 页面同样展示资产级日线周期，但明确说明该周期自身不提供精确 EMA 历史匹配。
- 自动解读只能陈述固定规则和已完成同类周期的描述性分布，例如当前持续长度低于、位于或超过
  历史 25%–75% 区间。不得写成“接近结束”“更可能上涨 / 下跌”、概率、胜率、目标位、开多 /
  开空或交易建议。正常界面只显示更新时间与异常状态，不重复展示 Provider、checksum 或版本。
- 方向占比仍只允许使用观察窗口互不重叠的事件，并至少需要 20 个独立样本。页面必须同时展示
  样本数、数据覆盖区间、当前机械阶段和更新时间；不足时只展示中位数 / 区间等仍可核验事实，
  不把小样本方向占比包装为概率、胜率、目标位或交易信号。
- 信息层级优先回答“现在属于哪种机械阶段”“相同 EMA 状态过去出现多少次”“在当前阶段和全部
  历史中随后实际发生过什么”。详细算法、checksum 与源文件清单保留在服务端合同和构建 manifest，
  正常页面不铺开技术来源；异常时明确说明长期归档不可用，并保持实时图表和近期参照独立可用。

### 当前明确不做

- 本轮不自动下单、不接交易账户、不生成 Wise 主观策略、不接 AI、不宣称机械牛熊标签代表官方
  周期，也不依据历史频率直接输出开多 / 开空建议。
- 本轮不建设在线数据库、定时任务或自动发布流水线。长期基线通过显式离线命令更新；生产部署前
  仍需为更新频率、失败告警、产物签名与回滚建立独立运维方案。
- 本节只记录已批准范围。只有归档实际下载与 checksum 验证、完整质量检查和浏览器验收均通过后，
  才能在完成报告中写入真实覆盖区间、样本数与构建结果。

### 实施结果（2026-09-06）

- 已通过 Binance 官方月度归档完成 `2017-08` 至 `2026-07` 的 BTCUSDT、ETHUSDT
  `1h / 4h / 1d` 六流离线构建，每流核验 108 个 ZIP 与对应 `.CHECKSUM`。运行时产物版本为
  `8f6f962e24b7492894114f72bf09f2499c0dfd5c2a7d2d4110aa380296c3726f`，并与审计
  manifest 的字节数和 SHA-256 绑定；网页不包含全量 K 线、逐事件列表或源文件清单。
- BTC 三周期共产生 33,842 个完整未来观察事件，ETH 三周期共产生 33,956 个；具体到资产、
  周期、机械阶段、状态指纹和观察窗口的真实样本数由生成产物读取，不补齐缺失阶段。小时级
  归档发现的缺口按连续段隔离；日线无缺口。43 条早期未对齐小时记录与 1 条严格零成交占位
  记录按已批准规则排除，并在 manifest 中独立审计。
- 公开研究结果已把资产级日线周期与所选周期的长期 EMA 指纹拆成两个独立 datum。BTC / ETH
  页面先显示当前周期、close-only 阶段表现、完整同类阶段持续分布与最近最多 7 段时间轴，再在
  `1h / 4h / 1d` 显示同阶段和全部长期历史的 `6 / 12 / 24` 根统计；`15m` 仍显示日线周期，
  但不使用其他周期替代自身的 EMA 指纹统计。进入代表案例回看后，当前阶段、周期时间轴、
  历史统计、关键位、策略和多周期模块均隐藏，避免前视信息混入。
- 日线周期有独立的 fresh、stale、error、unavailable 与客户端绝对过期状态；周期失败不隐藏
  图表、关键位或仍有效的 EMA 历史，其他研究失败也不把周期清空或用零值替代。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`（80 个测试文件、958 项测试）与
  `pnpm build` 全部通过；BTC、ETH、历史回看与 15 分钟降级均已完成生产预览浏览器验收，
  页面无横向溢出或控制台错误。当前只完成本地产物与代码接入，未部署、未修改 DNS、未推送，
  也未建立定时更新或自动发布流程。

## 22. 2026-09-06 新手解释与匿名行为事件

- 当前周期卡新增默认收起的原生术语说明，解释牛市、熊市、过渡结构、EMA、阶段收盘变化、
  最高收盘涨幅、最大收盘回撤、历史中位数和中间一半。说明只解释已经发生的闭合日线事实，
  明确区分收盘统计与盘中高低点，不产生预测、方向、目标位或交易建议。
- 行情工作台新增 `market_interval_change`、`cycle_timeline_toggle` 与
  `key_level_select` provider-neutral 事件；四个工具继续使用 `tool_open` 和
  `tool_complete`。事件只在明确的用户交互或成功计算时触发，统计失败不改变界面或计算结果。
- 行情 payload 仅允许资产、前后周期、展开/收起动作、隐藏段数、关键位类别和展示序号；
  工具 payload 仅允许工具标识、固定页面位置和内容版本。运行时使用逐事件字段白名单与枚举校验，
  价格、关键位 ID、账户、金融输入、计算结果、URL 查询、用户和 Session 标识均被拒绝。
- 当前没有接入第三方 Analytics 或持久化收集端，默认 adapter 仍为 noop。未来选定供应商前必须先
  明确隐私、Cookie 与保留政策；接入时只替换 adapter，不允许业务组件直接依赖供应商 SDK。

## 23. 2026-09-06 合约入门学习工具

- 新增 `/tools/futures-intro`，作为 `/tools` 中的学习型工具；不新增顶层导航、独立学院站、
  登录、交易账户、下单或 Referral 广告流程。现有仓位、杠杆、DCA 和风险回报四个计算器
  继续保持四张同权入口。
- 课程固定为 5 章 26 关，同时提供 8 个核心关组成的快速路径和完整路径。两条路径共用同一份
  完成记录；课程目录默认只展开当前章节，避免把 26 张卡片一次铺满。
- 每关采用“核心对比 → 学习目标与术语 → 机制拆解 → 图表或计算交互 → 完整案例 →
  能力边界 → 三层理解检查 → 下一关”的固定流程。概念、情境与边界三题均正确才完成本关；
  答错可以重试，不使用 XP、等级、徽章、排行榜、倒计时或模拟收益评价学习结果。
- 静态教育内容在市场接口不可用时仍可完整学习。纯教学图必须明确标注为示意且不显示会被误认
  为当前行情的价格；真实历史片段必须来自经过验证的服务端归档。形成中 K 线不得用于答案、
  突破确认或历史统计。
- 课程进度使用经过版本和 ID 校验的本地最小状态，只记录路径、当前关、已完成关、答题状态和
  有界尝试次数；它不证明登录、普通用户、VIP 或任何权限。损坏或旧版本状态安全回退为空进度。
- 新增 provider-neutral 课程事件，payload 只允许课程版本、路径、章节 / 关卡 ID、结果枚举和
  有界尝试次数；不得发送答案、价格、账户、金融输入、模拟结果、URL 查询、用户或 Session。
  默认 adapter 仍为 noop，统计失败不得打断学习。
- 视觉继续使用白色 / 浅灰、黑白灰文字及克制的蓝、红、紫、琥珀图表语义，不复制参考界面的
  深色霓虹与游戏化装饰。2026-09-07 的 V2 改版采用大标题、强对比卡和分段学习画布；返回与
  进度缩为紧凑控件，下一关仅在通过后悬浮于右下角。Mobile 保留完整正文且不得横向滚动，
  主要触控区域至少 44px。
- 详细课程、状态、数据、SEO、Analytics、响应式和验收边界见
  `docs/product-specs/wise-crypto-futures-intro.md`。

## 24. 2026-09-07 首页市场数据解释层

- 首页不再把 BTC / ETH Funding、BTC / ETH OI、24 小时 Liquidations 与 BTC / ETH
  ETF Flow 作为七项同权原始数据默认收起，而是整理为“永续合约持仓状态”“24 小时强平结构”
  和“美国现货 ETF 日资金流”三个直接可读的解释模块。
- 每个模块采用固定顺序：一句客观结论、结论含义、少量支撑事实、下一步观察条件和更新时间。
  Provider、scope、retrievedAt、cache 与完整来源链继续保留在服务端合同中，不在首页重复铺开。
- 解释由确定性纯规则读取标准化 `MarketDatum` 生成，只陈述已经取得的数据事实；它不是 Wise
  Take、人工策略、AI 分析、投资建议或交易信号，不得输出开多、开空、买卖、止损、目标位、
  胜率、概率或收益承诺。
- 资金费率正负只说明费用支付方向。OI 只有取得同一合约、同一采样口径且经 Provider 验证为
  23–25 小时的比较窗口后，才允许描述约 24 小时增加或减少；单点 OI 不得包装为拥挤、建仓
  或减仓，OI 变化也不能判断新增或退出的是多头还是空头。
- 强平只描述完整 24 小时滚动窗口的总额与可靠的多空拆分。没有历史基准时，不得使用“极端”
  “异常高”“去杠杆完成”或“即将反转”等文字。
- ETF Flow 只描述对应资产最近完整交易日的净流入或净流出；BTC 与 ETH 各自保留交易日期，
  不把单日结果写成连续趋势，也不将其等同于全部机构资金方向或盘中价格方向。
- 只有 `fresh / stale` 且非 synthetic 的值可以进入解释。部分数据失败时继续展示可核验事实并
  标记“部分数据”；全部不可用时只显示一条紧凑 unavailable 状态，不显示 `0/7`、零值或三张
  空卡。聚合更新时间取所有已显示事实中最早的 `updatedAt`，stale 必须明确标记。
- 页面顺序调整为先展示市场脉搏，再解释杠杆与资金含义，最后进入交易风险工具；Loading 使用
  与最终三卡结构接近的 Skeleton，减少布局跳动。桌面三列、中屏两列、手机单列且不得横向滚动。

## 25. 2026-09-08 工具返回导航与账户入口基础

- 四个计算器详情页必须提供清晰、可点击且触控高度不低于 44px 的“返回工具”入口，目标固定为
  `/tools`。它与当前工具名称共同组成可读路径，不依赖浏览器历史，也不把细小面包屑作为唯一
  离开方式。
- “合约入门”目录同样提供“返回工具”；进入具体关卡后，“返回课程目录”只负责退出当前关卡，
  页面仍须保留独立的“返回工具”路径。两个动作在文字和层级上必须明确区分，并保持桌面、平板
  与手机均可见、可聚焦且不遮挡正文。
- 公共 Header 预留登录操作位置。Wise ID 尚未接入时，入口只能说明“登录功能准备中”和当前公开
  功能无需登录，不得伪造用户、Session、普通 / VIP 身份、已登录头像或权限切换；公开页面继续
  独立于未来身份服务。
- 白天 / 黑夜模式与福利系统不在本批次内伪装成已完成。福利弹窗后续必须由可核验配置提供活动
  图片、有效期、适用地区、用户条件、领取步骤、Referral 披露和失效状态；没有真实配置时不得
  编造 Bitget 优惠、金额或注册链接。
- 本批次只完成本地界面、语义与导航验收，不部署、不修改 DNS、不推送，也不接入真实认证或
  活动后台。

## 26. 2026-09-08 全站白天 / 黑夜显示模式

- 公共 Header 在登录入口左侧提供白天 / 黑夜切换按钮。按钮必须是可键盘操作的原生按钮，
  触控区域不低于 44px，并根据当前显示模式提供“切换到深色模式”或“切换到浅色模式”的
  中文可访问名称；图标只作装饰，不替代文字语义。
- 主题只允许 `light` 与 `dark` 两种有效值。用户尚未主动选择时，首次渲染跟随操作系统的
  `prefers-color-scheme`，且不把系统推导结果写入存储；用户主动切换后才以版本化的本地键
  保存选择，刷新和公开路由切换后继续生效。损坏、未知或旧格式的值必须安全回退到系统偏好。
- 根布局在浏览器首次绘制前同步设置 `html[data-theme]`，避免浅色页面先闪现再切换成暗色。
  主题是纯本地显示偏好，不使用 Cookie、不让根布局动态化、不依赖 Wise ID、Session、普通 / VIP
  身份，也不向 Analytics 或第三方服务发送主题选择。
- 本批次覆盖公开市场总览、BTC / ETH 行情工作台、工具目录、四个计算器、合约入门目录与课程
  内容。私有 `/studio` 不属于公共主题范围；独立灾难错误页至少应保持系统深浅模式可读，但不
  伪装为具有完整 Header 控件。
- 暗色视觉采用黑色画布、中性深灰表面、浅色正文与克制边框；浅色视觉保持现有 Apple 式白色 /
  浅灰层级。K 线涨蓝跌红、EMA10 金、EMA20 紫、EMA50 蓝、EMA200 灰、支撑蓝、压力红、
  成交密集区紫、Fibonacci 琥珀、BTC 橙与 ETH 蓝紫等既有语义不得交换或通过整体反相破坏。
- 所有公开页面的卡片、表单、弹层、图表网格、提示、Loading 与 Footer 必须随主题保持可读；
  不接受只改变外层背景、内部仍出现大面积白色孤岛的半成品。桌面与 320px、390px 手机宽度下，
  主题按钮和登录入口均不得溢出或遮挡导航。
- 本批次只完成本地主题实现、测试与浏览器验收，不部署、不修改 DNS、不推送，也不接入福利
  系统或真实认证。

## 27. 2026-09-08 Wise ID 主站 OIDC 登录接入

> 本节记录身份协议与 Session 基线。其“页面继续公开”的初始访问假设已被第 28 节明确取代；
> callback、Secret、会员字段与 Session 安全约束继续有效。

### 身份协议与信任边界

- Wise Crypto 作为 Wise Invest 主站 Wise ID 的独立 OIDC Client，采用 OAuth 2.0 / OIDC
  Authorization Code Flow，并强制使用 PKCE、`state` 与 `nonce`。登录、账号恢复、密码和
  会员资料继续由主站负责；子站不复制主站用户库，也不读取或共享主站 Cookie。
- 生产 issuer 固定为 `https://wise-invest.org`，Discovery 固定为
  `https://www.wise-invest.org/.well-known/openid-configuration`，Client ID 固定为
  `wise_crypto`，scope 固定为 `openid profile email wise.membership`。生产 callback 必须
  精确注册为 `https://crypto.wise-invest.org/api/auth/callback/wise`，不接受通配 callback。
- 上述公开且固定的 OIDC 值、生产 origin 与 callback 路径全部保存在服务端代码中。Vercel
  Production 只需配置 `AUTH_SECRET` 与 `WISE_AUTH_CLIENT_SECRET` 两个服务端 Secret；两者
  同时有效时登录自动启用，缺少一项时 fail closed，Preview 环境始终关闭登录。
- 主站会员字段只允许三种已知值：`MEMBER` 映射为站内 `regular`，`VIP` 与 `VIP_PLUS`
  映射为站内 `vip`。缺少、未知或不一致的 subject / membership 一律 fail closed，不授予
  VIP 权限，也不允许 URL、localStorage、客户端状态或环境变量覆盖服务端身份结果。

### 子站 Session 与数据最小化

- OIDC callback 验证成功后，Wise Crypto 只创建属于 `crypto.wise-invest.org` 的独立
  host-only Session Cookie；生产 Cookie 使用 Secure，所有 Session Cookie 使用 HttpOnly 与
  SameSite=Lax。主站和子站不会通过父域 Cookie 共享 Session，各应用可分别撤销自己的会话。
- 子站 Session 的身份有效期固定跟随主站 Provider 当前返回的 1 小时（`expires_in=3600`）
  token 截止时间，不允许依靠 JWT 滑动续期把旧会员状态延长到该截止时间之后。当前主站不提供
  refresh token；到期后必须重新走主站登录 / 授权流程，才能取得新的会员状态。
- Access Token、ID Token、Client Secret 和完整 Provider payload 不进入浏览器可读状态、
  URL、Analytics 或公开页面响应。客户端只接收展示所必需的最小账户状态；服务端权限层只使用
  已验证 subject 与会员等级。

### 身份隔离基线（访问范围由第 28 节更新）

- 本阶段最初约定首页、BTC / ETH 行情、公开研究、工具和合约课程均可匿名访问；该页面范围
  已由第 28 节更新为“仅首页公开”。市场 Provider cache 仍不因登录状态复制或混入口令。
- Header 的账户状态由独立客户端交互读取最小同源账户接口；它不能把 Session、Token 或 VIP
  正文注入公共缓存。个性化账户接口、受限页面和受限数据接口使用 `private, no-store` 或等价隔离。
- 人工策略仍由现有服务端 access-first 边界控制。只有已验证且仍在有效期内的 `vip` 身份才可
  触发私有仓库读取；匿名、普通、会员字段异常或身份服务异常都不得知道策略是否存在。

### 当前注册、存储与发布状态

- 本地已经在被 Git 忽略的环境文件中配置该 Client 的服务端 Secret，但主站是否已启用
  `wise_crypto`、是否登记精确生产 callback，仍需通过正式授权往返确认；在完成之前不能把真实
  OIDC 登录报告为端到端通过。主站注册时必须同时加入生产 callback；本地访问和 callback
  固定使用 `http://127.0.0.1:2222/api/auth/callback/wise`。
- 当前 `/studio/strategies` 的加密文件仓库仍是本地创作基础，并在 Vercel / 其他部署环境强制
  关闭。Wise ID 即使成功识别 VIP，也不会自动让生产环境拥有策略正文；正式上线私有策略前仍需
  独立接入受控的私有 CMS / 数据库与 staff 身份。
- 本批次只修改本地代码和文档，并要求完成 lint、typecheck、tests、production build 与真实
  OIDC smoke test 后再验收。本批次没有部署 Vercel、没有推送代码、没有配置或修改 DNS；
  `crypto.wise-invest.org` 上线及主站 Client 注册仍需单独执行。

## 28. 2026-09-09 上线前访问门禁、账户资料与弹层收口

### 页面访问与会员边界

- `/` 是唯一保持匿名可访问、可进入 sitemap 且允许生产搜索索引的页面。首页的数据加载、
  降级状态和渲染不得依赖 Wise ID Session，也不能因身份服务异常而失效。
- `/btc`、`/eth`、`/tools`、四个计算器、`/tools/futures-intro` 与 `/account` 均需要有效
  Wise ID Session。匿名访问跳转至登录流程并携带经过严格校验的站内 `returnTo`；身份配置异常
  进入明确错误边界，不能把受限页面降级为公开页面。
- 这是“是否登录”的基础门禁，不是 VIP 付费门禁。主站返回并成功验证为 `regular` 或 `vip`
  的用户都可以进入行情、工具、课程与账户页；人工策略等真正私有权益仍需独立的服务端 VIP
  判断，不能凭 URL、客户端状态或页面隐藏实现。

### 服务端页面与接口双重检查

- 每个受限页面在 Server Component 加载业务数据或渲染正文前调用统一页面鉴权。只在 Header
  隐藏链接、依赖客户端跳转或显示登录提示都不构成安全边界。
- 浏览器会直接调用的 `/api/market/candles`、`/api/market/performance`、
  `/api/market/research` 与 `/api/account` 同样独立验证当前 Wise Session；页面已经通过鉴权
  不能替代接口检查。匿名响应使用 `401`，认证服务不可用使用 `503`，两者均不得返回市场正文、
  账户资料或可推断 VIP 内容是否存在的信息。
- 受身份保护的接口响应统一使用 `private, no-store`、`Vary: Cookie` 与 `nosniff`；共享 Provider
  数据仍可在服务端按既有合同缓存，但不得把个性化响应放入公共 CDN 或浏览器缓存。

### 账户资料只读投影

- `/account` 只读展示当前 Wise ID Session 中已经验证并最小化后的昵称、头像、邮箱、邮箱验证
  状态、Wise ID 与会员等级。Access Token、ID Token、Client Secret 和完整 Provider payload
  不进入页面、客户端状态、日志或 Analytics。
- Wise Crypto 不为账户中心新建用户数据库，不复制主站密码，也不提供资料编辑入口。头像、昵称、
  邮箱和会员方案由 Wise Invest 主站统一维护，子站只提供安全的主站账户管理跳转与本地会话退出。

### 搜索索引与弹层交互

- 所有登录后页面使用受保护 Metadata，明确 `noindex`、`nofollow` 与 `noarchive`；生产 robots
  阻止抓取 `/account`、`/btc`、`/eth`、`/tools` 及 `/studio/`，sitemap 只包含首页。
- 公共 Header 的右侧操作区提供固定的“回到主站”入口，目标只能是
  `https://www.wise-invest.org/`；它与白天 / 黑夜切换、Wise ID 账户入口并列，手机端可收为
  保留完整可访问名称的图标按钮，但不得隐藏或由查询参数改写目标地址。
- Header 账户菜单与行情图层菜单采用同一轻量弹层行为：点击或将焦点移到外部时关闭，按
  `Escape` 关闭并把焦点交还触发按钮，路由切换时不保留旧的打开状态。
- 清除学习进度等有风险的确认弹层使用语义化模态对话框：打开后聚焦安全操作、Tab 焦点留在
  对话框内、点击遮罩或按 `Escape` 取消，关闭后恢复此前焦点。弹层不能遮挡后仍让背景操作获得
  键盘焦点，也不能把危险动作设为默认焦点。

### 当前发布状态

- 本批次只完成本地代码、文档和自动化检查，尚未推送到 GitHub，未部署 Vercel，未配置或修改
  DNS，也未把 `crypto.wise-invest.org` 切换到本批代码。生产发布与主站精确 callback 验证仍需
  获得单独授权后执行。
