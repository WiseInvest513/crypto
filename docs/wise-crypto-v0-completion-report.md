# Wise Crypto V0 Completion Report

> 完成日期：2026-08-31；最近优化：2026-09-02
> 状态：Phase 1–7、实用性批次 A、K 线专项、批次 B 的 B1–B4、VIP 行情研究基础、多周期客观参考、资产工作台与首页信息层级重设计已完成；产品线已退出子站公开体验；未部署、未修改 DNS。

## 1. V0 已完成范围

Wise Crypto V0 已形成一个中文、响应式、可追溯来源的 Crypto 市场工作台，包含：

- 首页市场总览、首屏 BTC/ETH 核心行情、“市场现在”客观事实、Market Pulse、
  默认收起的关键市场数据，以及只在有效时出现的人工审核内容槽位。
- BTC 与 ETH 独立资产工作台：紧凑价格摘要、已闭合日线 SMA20/SMA50、当前周期
  EMA 分析、客观趋势、Funding、OI、Liquidations、ETF 状态、BTC Dominance /
  ETH-BTC，以及紧随 K 线的 VIP 行情策略台。
- 仓位风险、杠杆与盈亏、历史 DCA、风险回报四个独立计算器，以及从资产到工具、
  工具到下一步检查的安全任务路径。
- Phase 6 建立的产品核验与 Referral 安全基础设施仍保留，但不再公开展示。
- 完整 Layout、导航、状态页、SEO、Analytics facade、数据 Provider、缓存和安全边界。

本站不交易、不托管、不连接钱包，也不自动生成投资判断。Wise Take、Market Status、
Support、Resistance 和 Wise Scenario 只接受人工审核配置。

## 2. 路由与核心模块

固定公开路由共 8 个：

- `/`
- `/btc`
- `/eth`
- `/tools`
- `/tools/position-size`
- `/tools/leverage`
- `/tools/dca`
- `/tools/risk-reward`

历史 `/products` 与其全部子路径仍可访问，但不再是公开内容页。请求层 Proxy 固定
返回 `308` 到 `https://www.wise-invest.org/perk/crypto`，不读取 path、slug 或查询参数
构造目的地址；原产品页面文件已经删除。

核心边界分别位于 `src/server/data`、`src/server/editorial`、`src/server/tools`、`src/lib/analytics` 和
`src/lib/seo`。UI 只消费标准化服务结果，不直接调用第三方行情 API。
`src/server/products` 与对应 schema/组件作为未公开历史基础设施保留。

## 3. 数据源与不可用项

| 数据 | 当前来源与口径 | 状态 |
|---|---|---|
| BTC/ETH USD、总市值、BTC 市占率 | CoinMarketCap / Alternative.me 显式降级链 | 完整 Provider、scope、时间、stale 与 cache 保留在数据合同；首页只显示更新时间，资产核验界面继续展示完整口径 |
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

## 4. 产品线退出与历史 Referral 状态

- Header、Footer 与首页已经移除产品目录入口；`PUBLIC_ROUTES`、sitemap 和公开
  `page_view` 白名单也不再包含产品地址。
- Wise Invest 主站 Crypto 福利页成为产品、邀请码与权益内容的唯一公开归属；旧地址
  仅执行固定服务端永久重定向，不再生成子站 canonical 或 Open Graph 页面。
- 2026-08-31 核验的 7 份历史资料不再公开，不能自动视为持续有效。若未来恢复使用，
  必须重新核验费用、资格、地区、条款与合作关系；当前记录已统一设为 disabled +
  unpublished，产品服务返回 0 个可发布条目。
- 产品 schema、来源校验、精确 `allowedReferralHosts` 白名单和
  `product_view`、`referral_click`、`tutorial_click` facade 暂时保留。当前所有白名单
  为空，公开页面不会触发这些事件或 Referral 跳转。

## 5. SEO、可访问性与性能

- 所有公开路由具有独立 title、description、canonical、Open Graph 和 X metadata。
- 分享图为 `public/og.png`，精确 1200×630；资产和工具详情没有真实主图时清除继承图片。
- Sitemap 只包含 8 个当前固定公开路由，不包含任何产品地址。历史产品地址返回固定
  308 并由主站承接；Preview/Development robots fail closed，只有正式 production
  origin 可索引。
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
| `pnpm test` | 通过，50 个测试文件、536 项测试 |
| `pnpm build` | 通过，Next.js 16.3.3，9 个静态页面完成生成；产品页不再进入 App Route 清单，固定跳转由 Proxy 处理 |
| HTTP smoke | `/`、`/btc`、`/eth`、`/tools` 均为 200；`/products`、任意旧 slug 和带恶意 query 的旧地址均为固定 308，`Location` 不透传参数 |
| Browser QA | 原 V0 已完成全站验收；本轮首页在 320×800、390×844 与 1280×900 复验信息层级、完整价格、核心事实、触控尺寸、折叠数据与横向溢出。首页主区域没有 Provider/“查看数据口径”文本，BTC 工作台入口和深层数据展开可用，无前端 console error |

生产预览当前运行在 `http://localhost:2222`。

## 8. 已知限制与风险

- 缓存是单进程内存缓存，不跨实例、区域或冷启动共享。
- ETF Flow 未配置可靠商业来源；无 CMC key 时 Liquidations 不可用。
- Binance Funding/OI 的商业再分发条款仍需上线方完成法务确认。
- Analytics 尚未接入供应商；上线前需先确定隐私、Cookie 和保留政策。
- 历史产品地址依赖 Wise Invest 主站 Crypto 福利页可用；目的地址是固定常量，不接受
  用户输入，但上线验收仍应检查跨域 308 和主站落地页状态。

## 9. Wise ID 与 VIP 接入边界

真实 Wise ID 仍未接入。当前已建立 `regular / vip` 两级权限合同、集中功能表与
fail-closed 的服务端 Identity Adapter；未接入身份时固定使用匿名普通权限，不存在
URL、localStorage、客户端状态或环境变量 VIP 开关。未来应通过该 Adapter 和独立 Entitlement Service
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
  提供价格、趋势、VIP 策略和衍生品锚点。
- fresh/stale 衍生品继续完整显示，失败与 unavailable 状态收进一个覆盖说明；
  unpublished/scheduled 人工内容不占页面，expired 只保留等待复核提示。
- 资产页可进入四个计算工具，URL 只传 `asset=btc|eth`。工具页只保留这一安全上下文，
  不传价格、余额、止损、目标价或结果；分享按钮固定复制无参数空白工具链接。
- 工具页首屏更紧凑，并提供中性的后续检查路径；风险回报比不再以红绿颜色判断好坏。
- 测试已从未使用的旧资产组件切换到真实 `AssetDetailStreamPage` 流式 SSR，旧入口已删除。
- 新增本地 Git 基线与 GitHub Actions 质量门禁。没有 push、部署、DNS 修改或下一版本开发。
- B5 的 DCA 三基线仍明确暂缓；原批次 C 的产品筛选/比较已经取消。

## 12. VIP 行情研究基础补充（2026-09-02）

- 资产页顺序重排为价格、K 线与 EMA、VIP 行情策略台、衍生品、风险工具，避免工具
  入口先于核心图表分散注意力；首页也增加 BTC / ETH 策略台入口。
- 普通用户只能看到能力名称、透明的规划状态和 Wise Invest 主站权益入口。自动化
  SSR 测试确认 active 人工策略的价格、正文、确认与失效条件不会进入普通用户 HTML。
- 首页 Market Status 与 Wise Take 同样在服务端按 VIP 权限过滤；Today in Crypto
  继续作为公共事实简报，不把事实内容误锁为主观策略。逐条来源仍由服务端配置与
  schema 校验，首页视觉层只显示审核和有效期，避免重复来源链接干扰阅读。
- 已验证 VIP 路径复用现有人工关键位和 Wise Scenario 生命周期，覆盖 active、expired
  与 unpublished；生产默认配置仍未发布，因而不会展示虚构策略。
- 人工策略 schema 已包含倾向、作者、适用窗口、依据、确认/失效条件和风险说明；
  真实 VIP 内容禁止提交到 Git，当前只以测试 fixture 验证渲染与隔离。
- 多周期客观参考已在 VIP 服务端边界内实现。15m / 1h / 4h / 1d 各自读取最多
  1,000 根 Binance Spot K 线，排除 forming 后计算 EMA10/20/50/200、近 3/20 根
  变化、距区间高点、区间位置与量能比例；顶部只汇总机械事实，不给出多空评分。
- 每个周期可展开核验算法版本、闭合样本数、形成中 K 线的实际排除状态与区间位置定义；
  历史不足或派生校验失败时仍保留来源、口径、获取时间与缓存元信息。
- 普通权限与身份异常路径不会创建多周期 Provider 请求，也不会收到周期、来源、时间、
  算法版本或数值。已验证 VIP 才取得四周期摘要；单周期失败不会拖垮其余周期。
- 牛熊周期模型与 DeepSeek 回撤分析仍未实现，页面继续明确标记“规划中”或“尚未接入”，
  不把路线图冒充成当前能力。
- 产品目录退出公开导航、sitemap 和 page_view；原产品页面文件已删除，请求层 Proxy
  将全部历史产品路径固定 308 到主站 Crypto 福利页，历史安全模型仍作为未公开代码保留。

## 13. 资产工作台重设计补充（2026-09-02）

- BTC / ETH 页面改为图表优先：第一屏直接完成资产切换、价格与涨跌确认、周期和分析视角选择，并显示大尺寸 K 线，不再要求先滚过多层摘要。
- 周期、价格 / 短线 / 趋势视角与高级设置整合进一条命令区；单条 EMA、显示数量、历史浏览和刷新等低频选项按需展开，原始 K 线、完整 EMA 与日线背景继续渐进披露。
- 图表切换为白底冷灰网格和更高对比的行情色：上涨 / 下跌 K 线为翡翠绿 / 珊瑚红，EMA10 / EMA20 / EMA50 / EMA200 分别为翠绿 / 亮蓝 / 橙色 / 蓝灰虚线，并提高主均线线宽。
- 右栏先给一句可核验的客观结论，再显示观察条件、近 3 根变化与已闭合 K 线区间位置。区间与距高点只使用闭合 K 线，形成中的极端值不会污染这些事实。
- 图表增量成功时同步更新头部价格、来源、状态与时间；失败时保留上次可用值并显示刷新失败。实时 K 线不可用时可明确降级至已闭合日线，绝不补造走势。
- 移动端周期与视角重排成两行完整控件，OHLCV 读数移到图表上方且不遮挡画布；高级设置支持显式关闭与 Escape，关键触控目标保持至少 44px。

## 14. 首页信息层级重设计补充（2026-09-02）

- 首页主线调整为“BTC/ETH 核心报价 → 市场事实 → VIP 人工策略入口 → 市场脉搏 →
  风险工具 → 深层数据”，首屏不再由同权表格和重复元数据占据。
- 价格、24 小时、7 天变化和工作台入口合并为两张大尺寸资产卡；桌面两列，手机纵向，
  320px 和 390px 均可完整显示价格，不依赖横向滚动。
- 首页新增专用紧凑更新时间视图，Provider、scope、retrievedAt、cache 和完整来源链仍在
  标准化数据对象中保留，BTC/ETH 详情页的完整 `DatumMeta` 未删除。
- “市场现在”保留三张明确事实卡。报价只剩单个资产时显示 `1/2 项可用`；K 线失败、
  派生历史不足或 unavailable 时仍显示明确状态，不再静默缺列。
- VIP 区使用与 Wise Invest 主站更接近的暖色权益层，工具区只保留四个可执行计算器；
  衍生品与资金流默认收起。没有增加装饰性假走势、自动交易判断或新数据请求。
- 设计合同与概念稿路径记录在
  `docs/product-specs/wise-crypto-homepage-redesign.md`。

## 15. 结论

Wise Crypto V0 已完成既定七个阶段，以及用户另行确认的实用性批次 A、BTC/ETH
K 线专项、批次 B 的 B1–B4、VIP 行情研究基础、多周期客观参考、资产工作台与首页信息层级重设计。产品目录已退出子站公开体验，
历史链接安全交给主站 Crypto 福利页承接；当前没有执行部署、Git push 或 DNS 配置。
