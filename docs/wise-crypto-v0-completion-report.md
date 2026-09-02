# Wise Crypto V0 Completion Report

> 完成日期：2026-08-31；最近优化：2026-09-02
> 状态：Phase 1–7、实用性批次 A、K 线专项及批次 B 的 B1–B4 已完成；未部署、未修改 DNS、未开始 V1。

## 1. V0 已完成范围

Wise Crypto V0 已形成一个中文、响应式、可追溯来源的 Crypto 市场工作台，包含：

- 首页市场总览、BTC/ETH 概览、Market Pulse、关键市场数据，以及人工审核内容槽位。
- BTC 与 ETH 独立资产工作台：紧凑价格摘要、已闭合日线 SMA20/SMA50、当前周期
  EMA 分析、客观趋势、Funding、OI、Liquidations、ETF 状态、BTC Dominance /
  ETH-BTC 与人工情景槽位。
- 仓位风险、杠杆与盈亏、历史 DCA、风险回报四个独立计算器，以及从资产到工具、
  工具到下一步检查的安全任务路径。
- 七份经过来源核验的产品指南，以及可配置但当前未启用的 Referral 基础设施。
- 完整 Layout、导航、状态页、SEO、Analytics facade、数据 Provider、缓存和安全边界。

本站不交易、不托管、不连接钱包，也不自动生成投资判断。Wise Take、Market Status、
Support、Resistance 和 Wise Scenario 只接受人工审核配置。

## 2. 路由与核心模块

固定公开路由共 9 个：

- `/`
- `/btc`
- `/eth`
- `/tools`
- `/tools/position-size`
- `/tools/leverage`
- `/tools/dca`
- `/tools/risk-reward`
- `/products`

产品详情路由共 7 个：

- `/products/binance`
- `/products/coinbase`
- `/products/kraken`
- `/products/okx`
- `/products/metamask`
- `/products/ledger-hardware-wallet`
- `/products/coingecko`

核心边界分别位于 `src/server/data`、`src/server/editorial`、
`src/server/products`、`src/server/tools`、`src/lib/analytics` 和
`src/lib/seo`。UI 只消费标准化服务结果，不直接调用第三方行情 API。

## 3. 数据源与不可用项

| 数据 | 当前来源与口径 | 状态 |
|---|---|---|
| BTC/ETH USD、总市值、BTC 市占率 | CoinMarketCap / Alternative.me 显式降级链 | 可用时展示实际 Provider、scope、数据时间、获取时间、stale 与 cache |
| Fear & Greed | CMC Crypto F&G 或 Alternative.me Bitcoin F&G | 两个独立序列；主序列 stale 时不跨方法替换 |
| ETH/BTC | 同一 Provider 的 ETH/USD ÷ BTC/USD | 时间偏差超过 10 分钟时拒绝派生 |
| 交互 K 线 | Binance Spot `BTCUSDT` / `ETHUSDT` | `15m / 1h / 4h / 1d`、最多 1000 根，最后一根可明确标记 forming；客户端每 5 秒通过同源服务增量检查；forming 使用“服务器观测于”，不冒充上游数据截至时间 |
| 日线、MA、DCA 历史 | Binance Spot `BTCUSDT` / `ETHUSDT` | 只接受已闭合 UTC 日线 |
| Funding、OI | Binance USDⓈ-M | 明确标注单场所、单合约口径 |
| 24h Liquidations | CoinMarketCap | 需要服务端 CMC key；未配置时 unavailable |
| BTC/ETH ETF Flow | 无已配置商业许可来源 | unavailable，不填 0 |

首页的 quote、market pulse、衍生品/资金流，以及资产页的 price、chart、context
分别流式加载。资产摘要中的价格与日线事实也使用独立 Suspense 边界。慢数据源只影响
所属区块；错误、stale 和 unavailable 都保留来源、时间与 cache 信息，不会用 Mock
或零值掩盖。全部缓存策略均有测试约束 `revalidateSeconds <= maxSourceAgeSeconds`。

## 4. 产品与 Referral 状态

- 当前 7 份产品指南均为 2026-08-31 对照第一方来源核验的客观资料，展示适用场景、
  Pros、Cons、费用口径、资格/地区边界、教程、条款与免责声明。
- 当前没有 Referral URL、Referral Code、推广期或 Wise-exclusive benefit。
- `product_view`、`referral_click`、`tutorial_click` 已接入 provider-neutral facade。
- Referral 外链固定使用 `sponsored nofollow noopener noreferrer`，不经过开放重定向。
- 每个 Partner 的首跳域名必须精确进入 `allowedReferralHosts`；当前白名单全部为空，
  不接受通配符、未列明子域、IP、localhost、credentials 或自定义端口。

## 5. SEO、可访问性与性能

- 所有公开路由具有独立 title、description、canonical、Open Graph 和 X metadata。
- 分享图为 `public/og.png`，精确 1200×630；详情页没有真实主图时清除继承图片。
- Sitemap 只包含 9 个固定路由和 7 个已发布产品；未知产品返回真实 404、无 canonical、
  `noindex`。Preview/Development robots fail closed，只有正式 production origin 可索引。
- 已加入 WebSite 与可见导航一致的 Breadcrumb JSON-LD、安全响应头和无密钥客户端边界。
- 320、390、1280px 代表页面没有全局横向溢出；语义 heading、skip link、表单标签、
  错误焦点、状态播报、键盘滚动入口和主要触控目标均已检查。
- 最终浏览器验收没有前端 console error、重复 ID、缺失图片 alt 或无名称交互控件。
  计算器中的 radio 使用包裹式 `<label>`，可访问名称为“做多 Long / 做空 Short”。
- 冷启动动态行情页首字节约 14–82ms；外部数据区在上游超时场景下可持续到约 9–10 秒，
  期间页面主体和独立 Skeleton 已可读。缓存命中后首页完成响应约 8ms，静态页多数低于
  20ms。本结果来自本机生产预览，不等同于线上 Core Web Vitals。
- 仓位、杠杆与风险回报页的查询参数读取被限制在局部 Suspense / Client Component，
  三页主体保持静态预渲染；DCA 因服务端历史 K 线保持动态渲染。

## 6. 安全与数据真实性

- Provider URL 只允许 HTTPS，拒绝 credentials 与 redirect；响应体流式限制为 2 MB。
- 429、5xx、timeout 与中断响应体使用有界重试；完整但无效 JSON 不重试。
- last-known-good 与 retry backoff 有硬失效边界；成功缓存和 backoff 各最多 256 项。
- `COINMARKETCAP_API_KEY` 只在服务端读取，`NEXT_PUBLIC_COINMARKETCAP_API_KEY` 会被拒绝。
- 使用构建期 sentinel 扫描 `.next` 与客户端静态产物，没有发现 secret、Mock Provider
  或 synthetic fixture 泄漏。
- Analytics payload 白名单不接收金融输入、计算结果、Referral URL/code 或用户标识；
  默认 adapter 为 noop。

## 7. 最终检查结果

| 检查 | 实际结果 |
|---|---|
| `pnpm lint` | 通过，0 warning |
| `pnpm typecheck` | 通过，Next route types 与 `tsc --noEmit` 均通过 |
| `pnpm test` | 通过，46 个测试文件、481 项测试 |
| `pnpm build` | 通过，Next.js 16.3.3，17 个页面完成生成；三个非 DCA 工具详情保持静态预渲染 |
| HTTP smoke | 16 个公开页面均为 200；未知产品与未知路由为 404；robots、sitemap、OG 图为 200 |
| Browser QA | 在 390×844、768×900 与 1280×900 验收资产摘要、工具闭环、参数过滤及横向溢出；BTC/ETH 实际数据和形成中观测时间正常，无前端 console error |

生产预览当前运行在 `http://localhost:2222`。

## 8. 已知限制与风险

- 缓存是单进程内存缓存，不跨实例、区域或冷启动共享。
- ETF Flow 未配置可靠商业来源；无 CMC key 时 Liquidations 不可用。
- Binance Funding/OI 的商业再分发条款仍需上线方完成法务确认。
- Analytics 尚未接入供应商；上线前需先确定隐私、Cookie 和保留政策。
- 产品费用、资格、地区与条款会变化，需要运营复核流程。
- `dynamicParams=false` 让未知产品得到正确 404；Next.js 16.3.3 的本地 `next start`
  会为这条预期控制流打印内部 `NoFallbackError`，但响应仍为 404，浏览器控制台无错误。
  后续升级 Next.js 时应复测并移除这项框架日志噪声。

## 9. 未来 Wise ID 接入边界

Wise ID 不属于 V0。未来应通过服务端 Identity Adapter 和独立 Entitlement Service
接入，优先采用标准 OIDC/OAuth 2.0、Authorization Code + PKCE、`state`、`nonce`
和严格 callback allowlist。Session 使用 Secure、HttpOnly、SameSite Cookie；token、
用户标识和权益数据不得进入 URL、Analytics 或公共缓存。公开市场页、SEO metadata 与
Provider cache 必须继续独立于登录态。

## 10. K 线专项补充（2026-09-01）

- BTC / ETH 资产页新增独立实时图表数据路径，默认读取 1000 根 `1h` Binance Spot
  K 线、显示 500 根，并支持 `15m / 1h / 4h / 1d`、200 / 500 / 全部和历史浏览。
- 图表增加成交量、短线 EMA10/20/50 与趋势 EMA20/50/200 视角、当前价线、OHLCV、形成中状态、
  十字定位、键盘操作与语义化数据表。
- 浏览器只访问白名单同源路由；第三方调用、schema 校验、缓存、stale 与 fallback
  全部保留在服务端。5 秒轮询只取最后三根；缺口、切周期和恢复可见时完整同步。
- 形成中 K 线和图表周期均线不进入已闭合日线 Trend、首页事实或 DCA。没有新增
  自动信号、支撑阻力或投资判断。

## 11. 实用性批次 B（B1–B4）补充（2026-09-02）

- BTC/ETH 首屏新增价格、24h、7d、SMA20、SMA50、客观趋势、来源和时间摘要；页面
  提供价格、趋势、衍生品和条件式人工情景锚点。
- fresh/stale 衍生品继续完整显示，失败与 unavailable 状态收进一个覆盖说明；
  unpublished/scheduled 人工内容不占页面，expired 只保留等待复核提示。
- 资产页可进入四个计算工具，URL 只传 `asset=btc|eth`。工具页只保留这一安全上下文，
  不传价格、余额、止损、目标价或结果；分享按钮固定复制无参数空白工具链接。
- 工具页首屏更紧凑，并提供中性的后续检查路径；风险回报比不再以红绿颜色判断好坏。
- 测试已从未使用的旧资产组件切换到真实 `AssetDetailStreamPage` 流式 SSR，旧入口已删除。
- 新增本地 Git 基线与 GitHub Actions 质量门禁。没有 push、部署、DNS 修改或下一版本开发。
- B5 的 DCA 三基线与批次 C 的产品筛选/比较仍明确暂缓。

## 12. 结论

Wise Crypto V0 已完成既定七个阶段，以及用户另行确认的实用性批次 A、BTC/ETH
K 线专项和批次 B 的 B1–B4。当前没有执行部署、Git push、DNS 配置或下一版本开发。
