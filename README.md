# Wise Crypto

Wise Crypto 是面向 Crypto / Web3 用户的中文市场工作台，提供可追溯的
BTC/ETH 市场信息、人工审核背景、四个风险计算器与合约入门学习工具。
V0 按七个阶段完成，随后持续完善实用性、K 线与风险工具。2026-09-03 用户确认
行情工作台 V2：公开客观关键位和多周期研究，人工策略继续保留独立私有边界。权威范围见
[`docs/product-specs/wise-crypto-v0.md`](docs/product-specs/wise-crypto-v0.md)，最终验收见
[`docs/wise-crypto-v0-completion-report.md`](docs/wise-crypto-v0-completion-report.md)；当前
行情工作台的已批准设计见
[`docs/designs/market-workbench-v2/README.md`](docs/designs/market-workbench-v2/README.md)。
旧阶段、旧工作台与 VIP 基础文档记录当时的实现；公开研究和人工策略边界以
主产品规范第 16–21 节的后续决策为准，Wise ID 登录以第 27 节为准，不沿用旧文档的
多周期 VIP 限制或“尚未接入真实登录”的历史描述。

## 当前状态

Wise Crypto V0 的 Phase 1–7 已完成。当前公开体验包括：

- 中文响应式 Layout、Header、Footer、Navigation、loading、error 与 404。
- 首页 Market Pulse、BTC/ETH 概览、关键市场数据、人工配置的 Market Status、
  Today in Crypto 和 Wise Take；其中 Market Status 与 Wise Take 属于 VIP 主观内容，
  普通权限只可能看到带来源的 Today in Crypto 公共事实简报。
- 导航只保留市场总览、行情、工具；BTC/ETH 在行情工作台内切换，原 `/btc`、`/eth`
  分享地址继续有效。整体采用黑白灰表面、系统无衬线字体与蓝红涨跌色。
- BTC/ETH 行情工作台首屏优先呈现当前 USDT 价格和大尺寸 K 线，右侧依次显示
  当前价格与 EMA 的关系、最近支撑/压力、估算成交密集区、观察条件及多周期对照。
  右上角显示同 Binance Spot USDT 口径的近 1 天、7 天、30 天涨跌，独立于图表周期，
  约每分钟更新；主价格继续每 5 秒检查，两者具有独立采样时间，不混用聚合 USD 报价。
  页面左右保留响应式留白。主界面只显示简洁更新时间与异常状态，来源、缓存、原始 K 线表和
  可见区间统计不占用界面；完整数据链仍保留在服务端及标准化合同内。
- 公开客观研究：不读取身份即可比较 15m / 1h / 4h / 1d 的已完成周期与 EMA，
  并查看由最近最多 500 根已完成 K 线计算的关键位置；至少需要 200 根。
  默认展示上方三档压力、下方三档支撑，附距离与真实计算依据；不足三档不补数。
  “更多关键位”可展开其余候选并点击定位，成交密集区与斐波那契图层独立开关。
  成交密集价 POC、成交区上下沿 VAL/VAH 为 OHLCV 分桶估算，不是逐笔成交或持仓成本。
  图层显隐、拖动和缩放只影响画布，不改变最新研究的计算窗口。
- 右侧“通用观察”增加最新已闭合成交量相对前 20 根均量，以及四周期位于 EMA20
  上下方的实际数量；这些是确认事实，不转换成概率、开仓或自动多空判断。方法定义与
  局限见 [`docs/research/strategy-methods.md`](docs/research/strategy-methods.md)。
- BTC/ETH `1h / 4h / 1d` 支持由 Binance 官方月度归档离线编译的长期机械历史基线：
  所有 ZIP 逐文件核对官方 SHA-256，只向网页投影紧凑 EMA 状态与
  bull/bear/transition 分组统计，不发送全量 K 线或完整事件表。运行时只校验并读取
  仓库内的静态产物，页面请求不会临时下载、解压或重算归档。
- 同一份已验证日线归档还提供独立于所选图表周期的“当前周期位置”：展示最新已闭合日线
  所在机械阶段、当前阶段的 close-only 表现、历史完整同类阶段分布，以及按时间排列的最近
  最多 7 段周期。`15m` 仍不进行自身的精确 EMA 历史匹配，但会显示这份资产级日线周期；
  周期数据不可用或过期时独立降级，不影响实时图表、关键位或其他历史参照。周期卡提供默认
  收起的简明术语说明，解释机械结构、阶段收盘变化、最高收盘涨幅、最大收盘回撤、历史中位数
  和中间一半，且明确区分闭合收盘统计与盘中高低点。
- Wise 人工策略使用独立的服务端 access-first 边界。普通用户只看到紧凑权限说明，
  不会触发私有仓库或收到策略是否存在、方向、价位、作者、时间与来源；只有服务端验证为
  VIP、人工审核并处于半开有效期内的正文才可披露。`/studio/strategies` 已提供
  仅限本机的编辑、独立复核、发布、退回与撤回闭环；草稿使用 AES-256-GCM 加密文件
  保存，目录与文件权限按 `0700/0600` 校验；初始化后若主密文丢失会停止读写，不会静默
  建立空库。真实内容不进入 Git。该发布台在任何检测到的部署环境强制关闭，不能替代未来的
  Wise staff 身份与私有 CMS。Wise ID 的 OIDC 本地接入已经建立，但主站 `wise_crypto`
  Client 尚未注册 / 启用，真实登录还不能完成端到端验证；AI、主观牛熊判断及持久化关键位
  事件仍未接入。当前 bull/bear 仅是用于历史分组的可复算日线机械标签。
- 仓位风险、杠杆与盈亏、历史 DCA、风险回报四个独立计算器，通过“工具”导航进入；
  工具地址支持 `asset=btc|eth`，金融输入与计算结果不会通过 URL 传递。
- 合约入门也位于“工具”内，提供 5 章 26 关、8 关快速路径、逐关练习与本地进度。
  每章都有导读和学习目标，每关都有概念对比、机制步骤、关键术语、完整案例、图解、
  能力边界，以及概念 / 情境 / 边界三层检查（全课程 78 题）；8 个核心关提供专属状态互动，
  其余关卡使用引导式图解。课程不依赖
  实时行情，也不生成交易方向或收益承诺。
- 完整 canonical、Open Graph/X、分享图、robots、sitemap、WebSite 与真实面包屑
  JSON-LD，以及 provider-neutral Analytics 接口。

### 长期基线本地产物（本轮总 QA 已通过，未部署）

本地已用 `2017-08` 至 `2026-07` 的 Binance 官方月度归档生成 6 条长期基线；每条流
核验 108 个月档，生成于 `2026-09-06T12:39:53.320Z`，数据集版本为
`8f6f962…3726f`。下表的两类排除是“未对齐旧毫秒行 / 严格零成交旧毫秒占位行”：

| 流 | 源行 / 接受 | 排除 | 段 / 缺口 / 缺根 | 完整事件 |
|---|---:|---:|---:|---:|
| BTC 1h | 78,373 / 78,329 | 43 / 1 | 29 / 28 / 171 | 26,788 |
| BTC 4h | 19,608 / 19,608 | 0 / 0 | 10 / 9 / 17 | 6,085 |
| BTC 1d | 3,271 / 3,271 | 0 / 0 | 1 / 0 / 0 | 969 |
| ETH 1h | 78,373 / 78,329 | 43 / 1 | 29 / 28 / 171 | 26,649 |
| ETH 4h | 19,608 / 19,608 | 0 / 0 | 10 / 9 / 17 | 6,295 |
| ETH 1d | 3,271 / 3,271 | 0 / 0 | 1 / 0 / 0 | 1,012 |

运行时产物不含全量 K 线、逐点制度、完整 EMA 逐事件表、代表案例或源文件清单；只保留
可继续计算的紧凑日线周期段与聚合统计，其余审计信息留在 manifest。2026-09-06 本轮总 QA
已通过 `pnpm lint`、`pnpm typecheck`、`pnpm test` 与
`pnpm build`；本次变更仍未部署。

### 已闭合日线周期口径

- 周期阶段使用固定日线规则：`bull` 为已闭合日线收盘与 EMA50 都高于 EMA200，`bear`
  为两者都低于 EMA200，其余为 `transition`。它是 Wise Crypto 的机械分组标签，不是
  Binance 官方牛熊定义，也不是人工或 AI 预测。
- 标签改变时结束上一段并开始下一段。归档中的第一段可能在真实阶段开始以后才进入覆盖，
  因而是左截断；最新一段仍在延续，因而是右截断。历史同类分布只统计起点和终点都由真实
  标签切换确认的完整阶段，当前未完成段不会混入完成样本。
- 阶段涨跌、峰值和最大回撤都只基于逐日已闭合收盘价计算，不使用盘中最高价或最低价。
  页面先显示当前阶段与自动客观解读，再显示时间升序的最近周期；默认只展开最近 4 段，
  更早记录渐进展开，完整公开投影最多 7 段。
- 周期作为独立 `MarketDatum` 保留 source、scope、更新时间、获取时间、stale、cache、
  error 与 provenance，但正常界面只显示更新时间或延迟 / 不可用状态。自动解读只比较当前
  持续长度与完整同类阶段的中位数、25%–75% 区间，不输出预测、概率、开多 / 开空或交易建议。

本站不提供交易、托管、钱包连接或自动投资建议。算法关键位是有明确计算规则的
客观价格区域，不是 Wise 人工策略；Wise Scenario 与 Wise Take 不会由行情自动生成。

## 本地运行

要求：

- Node.js 20.9 或更高版本，推荐 Node.js 24。
- pnpm 10.28.0。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 <http://localhost:2222>。本仓库的开发服务器与生产预览都固定使用
`2222`，不会回退到 `3000`；脚本只监听 `127.0.0.1`，不会把本地策略发布台暴露到局域网。
`pnpm dev` 在精确的 `localhost:2222` / `127.0.0.1:2222` 请求下自动使用固定普通调试身份，
因此调试行情、工具和课程不需要反复登录。该身份不模拟 VIP、不创建登录 Cookie，也没有额外
环境变量开关；`pnpm start`、Vercel、线上域名、局域网地址和其他端口始终关闭旁路。

本地生产预览：

```bash
pnpm build
pnpm start
```

## 环境变量

| 变量 | 必需 | 作用与边界 |
|---|---:|---|
| `COINMARKETCAP_API_KEY` | 否 | 仅服务端读取。配置后 CMC 成为核心聚合数据主源，并启用 CMC 跟踪市场的 24h Liquidations |
| `VERCEL_ENV` | 平台管理 | Vercel 自动提供；只有值为 `production` 且 canonical 为正式域名时才允许索引，不应手工伪造 |
| `AUTH_SECRET` | 启用登录时 | 至少 32 字符的服务端 Session Secret，不得使用 `NEXT_PUBLIC_*` 名称 |
| `WISE_AUTH_CLIENT_SECRET` | 启用登录时 | 主站为 `wise_crypto` 签发的服务端 Secret，至少 32 字符；与 `AUTH_SECRET` 同时存在时自动启用登录 |
| `WISE_STRATEGY_STUDIO_MODE` | 本地创作时 | 只有精确值 `local` 才尝试启用；Vercel 或其他检测到的部署环境仍强制关闭 |
| `WISE_STRATEGY_STUDIO_SESSION_KEY` / `WISE_STRATEGY_STUDIO_ENCRYPTION_KEY` | 本地创作时 | 两个不同的 32-byte canonical base64url 服务端密钥，分别用于会话签名和本地文件加密 |
| `WISE_STRATEGY_STUDIO_EDITOR_*` / `WISE_STRATEGY_STUDIO_REVIEWER_*` | 本地创作时 | 两套不同的 32-byte canonical base64url Token 的 SHA-256 digest、subject 与 display name；原始 Token 不写入仓库或 URL |
| `WISE_STRATEGY_STUDIO_STORE_DIR` | 否 | 本地加密存储目录；默认使用已被 Git 忽略的 `.wise-crypto-private/strategies` |

生产域名、issuer、Discovery、Client ID、scope 与 callback 均已作为公开常量固定在服务端
代码中，不需要在 Vercel 重复配置。Preview 环境自动关闭登录；本地固定使用
`http://127.0.0.1:2222`。完整空白模板见 [`.env.example`](.env.example)。严禁创建
`NEXT_PUBLIC_COINMARKETCAP_API_KEY`、`NEXT_PUBLIC_WISE_AUTH_*` 或任何
`NEXT_PUBLIC_WISE_STRATEGY_*`；发布台会在发现公开策略变量时主动关闭，客户端也不导入
市场 Provider、OIDC Secret、登录 digest 或加密密钥。

本地登录固定使用 `127.0.0.1:2222`，主站登记的本地 callback 必须是
`http://127.0.0.1:2222/api/auth/callback/wise`。主站管理员需在
[`/admin/sso`](https://www.wise-invest.org/admin/sso) 创建并启用名称为 `Wise Crypto`、
Client ID 为 `wise_crypto`、要求 PKCE 的独立 Client，登记生产 callback 与实际使用的本地
callback；创建时只显示一次的 Client Secret 必须立即保存到服务端环境。

## 数据源与口径

| 数据 | 当前生产来源 | 口径 |
|---|---|---|
| BTC/ETH USD、总市值、BTC Dominance | CoinMarketCap + Alternative.me 降级链 | 实际 Provider、覆盖范围、source、数据时间、获取时间与 cache 保留在数据合同；首页摘要不重复显示来源 |
| Fear & Greed | CMC Crypto F&G 或 Alternative.me Bitcoin F&G | 两个独立专有序列，只做 latest 故障降级，不拼成一条历史；主序列仍有 stale 值时不会跨方法替换 |
| ETH/BTC | Wise Crypto 由同一 Provider 的 BTC/USD、ETH/USD 派生 | 两个报价源时间差不得超过 10 分钟，采用较早数据时间；不满足时返回 error |
| BTC/ETH 交互 K 线 | Binance Spot `BTCUSDT` / `ETHUSDT` | USDT、UTC，支持 `15m / 1h / 4h / 1d`；默认取 1000 根 `1h`，每 5 秒通过同源服务增量刷新，最后一根可明确标记为形成中；形成中数值标记为服务器观测时间，不冒充上游数据截至时间 |
| 公开多周期客观参考 | Binance Spot K 线的 Wise Crypto 服务端派生 | 不依赖身份；各周期首次最多取 1,000 根，后续增量合并；仅已完成 K 线参与，保留独立来源、时间、stale、cache 与 error |
| EMA 指纹长期机械参照 | Binance Public Data 月度 Spot 归档的 Wise Crypto 离线派生 | `BTCUSDT / ETHUSDT`、USDT、UTC、`1h / 4h / 1d`；逐 ZIP 校验官方 `.CHECKSUM`，小时缺口按连续段计算且绝不插值，日线缺口 fail closed；运行时只读取经过 schema 与版本校验的静态聚合产物；`15m` 不进行自身的精确 EMA 历史匹配 |
| 已闭合日线牛熊周期 | 同一 Binance 日线归档与最新已闭合 Spot 日线的 Wise Crypto 服务端派生 | 资产级 `1d` 机械标签，不随当前图表周期改变；所有 `15m / 1h / 4h / 1d` 页面均可展示当前阶段、最多 7 段时间轴及完整同类阶段分布；涨跌、峰值和回撤均为 close-only，不是预测或交易建议 |
| 客观关键位、POC / VAL / VAH | 同一 Binance Spot OHLCV 的服务端派生 | 最近最多 500 根已完成 K 线，最低 200 根；摆动点、Pivot、Fibonacci、成交高密度节点构成候选；成交分布为估算，目标价值区覆盖 70% 成交量 |
| BTC/ETH 日线事实、SMA、DCA 历史 | Binance Spot `BTCUSDT` / `ETHUSDT` | USDT、UTC、`1d`，只接受已闭合 K 线；与形成中图表数据隔离 |
| Funding、OI | Binance USDⓈ-M | `BTCUSDT` / `ETHUSDT` 单场所数据，绝不标为全市场 |
| 24h Liquidations | CoinMarketCap | CMC 跟踪的衍生品交易所滚动总额；需要服务端 CMC key |
| BTC/ETH ETF Flow | 未配置 | 缺少已确认商业许可的数据源时明确显示 `unavailable`，不会填 0 |

未配置 CMC key 时，Alternative.me 是核心聚合数据主源，官方 CMC keyless 接口为
降级源；配置 key 后顺序相反。详情见
[`docs/data-sources.md`](docs/data-sources.md)。

## Mock 与生产数据政策

- Mock Provider 只位于 `src/server/data/testing/`，只供单元测试使用。
- Production Provider Registry 不导入 Mock；生产路径也会拒绝
  `provenance: synthetic`。
- 缺失、超时、超额、无许可或 schema 不合法的数据必须显示
  `error`、`stale` 或 `unavailable`，不得显示为 0。
- 构建流程不依赖实时 API 成功；页面运行时通过服务器领域服务取数。
- 编辑判断、人工关键位与情景必须来自人工审核配置和可核验来源，不能由代码补写。
  公开算法关键位与人工内容采用不同合同，不填充未发布的作者判断。

## 路由

- `/`：市场总览。
- `/btc`、`/eth`：资产工作台。
- `/tools`：工具目录。
- `/tools/position-size`、`/tools/leverage`、`/tools/dca`、
  `/tools/risk-reward`：独立计算器。
- `/tools/futures-intro`：合约入门学习工具，包含快速路径和完整课程。
- `/studio/strategies`：本地私有人工策略发布台；不进入公开导航、sitemap、页面统计或索引。

### 同源行情接口与刷新

- `/api/market/candles?asset=btc&interval=1h&mode=full|tail`：图表首次完整同步，
  可见页面每 5 秒检查三根尾部 K 线；仅支持 BTC/ETH 和 `15m / 1h / 4h / 1d`。
- `/api/market/research?asset=btc&interval=1h`：返回所选周期关键位、近期 / 长期 EMA
  参照、独立资产级日线周期与四周期客观摘要；不接受身份、任意币种、历史数量或外部 URL
  参数。客户端约每 60 秒检查，
  切换周期、恢复可见及手动刷新也会请求；浏览器不直连第三方 API。
- `/api/market/performance?asset=btc`：独立返回近 1 天、7 天和 30 天涨跌。
  1 天与 7 天使用 Binance 分钟对齐滚动统计；30 天由最新分钟价格与真实历史分钟
  开盘价派生，不是自然月或日线替代。每窗独立 60 秒缓存与 300 秒 last-good，
  保留起止时间、计算依据及异常状态；一个窗口失败不会隐藏其他窗口。
- 公开研究使用独立进程内缓存和 single-flight。每个 Provider 实例最多保留
  BTC/ETH × 四周期的 8 项；最长 60 秒 TTL，在对应周期闭合边界提前失效。
  初次读取完整历史，之后合并三根增量；源切换、缺口或无法补全旧形成中 K 线时
  重新完整同步，不每 5 秒重复拉四份完整历史。
- 研究 last-known-good 最长保留 300 秒，失败退避最长 15 秒；后续失败不延长
  最后成功数据的绝对有效期。关键位、近期参照、长期指纹、日线周期与四周期摘要分别保留
  stale/error/绝对过期状态，一项失败不会隐藏其他仍有效的结果。
  HTTP 响应不缓存，公共复用由服务层控制，不与未来私有策略缓存混合。

产品目录已经退出 Wise Crypto 的核心体验。为兼容历史分享链接，`/products` 与
其全部子路径由 `src/proxy.ts` 使用固定的服务端 `308` 永久重定向前往 Wise Invest 的
[`Crypto 福利页`](https://www.wise-invest.org/perk/crypto)，不会从路径或查询参数
构造目的地址。这些旧路由不在导航、`PUBLIC_ROUTES`、sitemap 或 `page_view` 中。

## 项目结构

```text
src/
  proxy.ts               旧产品地址的固定 308 请求层跳转
  app/                    Next.js 路由、Metadata、robots、sitemap、状态页
  components/             Layout、首页、资产、工具、合约课程、策略发布台与 SEO 组件
  config/                 站点 canonical 与公开路由配置
  content/                人工审核的首页、资产与产品配置
  lib/                    计算公式、展示层、Analytics、SEO 与产品 schema
    learning/             合约课程内容模型、路径解锁与本地进度校验
    market/               关键位、历史事件、机械制度与长期聚合纯计算
    strategy/             通用观察摘要与人工策略严格 schema / 生命周期
  server/
    auth/                 Wise ID OIDC 配置、Profile 校验与独立 Session 接入
    data/                 Provider、校验、cache、领域 service、测试 Mock
      generated/          经离线 checksum 校验后发布的紧凑长期统计（无全量 K 线）
    offline/              官方归档下载校验、缺口审计与长期产物编译器
    access/               Wise ID 的服务端身份适配与 regular / vip 权限边界
    editorial/            人工内容读取与有效期过滤
    strategy/             私有策略身份、加密存储、仓库接口与 access-first 脱敏服务
    products/             服务端产品目录
    tools/                DCA 历史数据服务
tests/unit/               领域、组件、Metadata、安全与阶段完整性测试
scripts/offline/          Binance 官方归档的单流验证与六流长期统计编译
data/history-baselines/   可提交的完整归档审计 manifest（URL、SHA、行数与版本）
docs/                     产品规范、数据口径与 V0 完成报告
public/                   品牌分享图等静态资源
.github/workflows/        Pull Request 与 main 分支质量检查
```

公开页面默认使用 Server Components；只有计算器、交互 K 线、分享、Analytics
跟踪等真实浏览器交互使用 Client Components。K 线及研究客户端只请求上述同源 API，
第三方 Binance 请求、校验、缓存与 fallback 均留在服务端。

行情工作台的主要模块：

- `src/components/assets/market-workbench*.tsx`：公开页面与交互工作区。
- `src/components/assets/market-chart-canvas.tsx`：K 线、EMA、成交量和关键位联动。
- `src/components/assets/market-research-panel.tsx`：当前阶段、日线周期时间轴与渐进式客观研究摘要。
- `src/components/strategy/strategy-disclosure-panel.tsx`：人工策略锁定、状态与有效正文视图。
- `src/lib/market/key-levels.ts`：关键位与成交分布纯计算，包含算法版本和确认时间。
- `src/lib/market/public-research.ts`：仅含公开数据的序列化合同。
- `src/lib/market/historical-context.ts` 与 `historical-baseline.ts`：无前视的事件匹配、
  日线机械制度、左右截断周期段、分段观察窗与统计聚合。
- `src/lib/strategy/trade-strategy.ts`：BTC/ETH 共用的人工策略 schema、严格校验与生命周期。
- `src/lib/strategy/public-strategy-observations.ts`：已闭合量能和多周期 EMA20 客观摘要。
- `src/server/data/services/public-research-service.ts`：公开缓存、校验和独立故障隔离。
- `src/server/data/services/long-term-history-service.ts`：只读取并投影经过验证的静态长期产物，
  同时用最新已闭合日线延续资产级周期；不在请求期间访问官方归档。
- `src/server/offline/historical-baseline-compiler.ts`：六条归档流的 checksum、连续段和发布门槛。
- `src/server/data/services/price-performance-service.ts`：独立三窗口涨跌与服务端校验。
- `src/server/data/services/multi-timeframe-service.ts`：保留旧的 fail-closed VIP 服务边界，
  不被新公开工作台用来绕过身份；人工内容继续由独立 editorial 服务处理。
- `src/server/strategy/trade-strategy-service.ts`：先鉴权、后懒读取私有仓库，并只返回最小 DTO。
- `src/lib/strategy/trade-strategy-authoring.ts`：允许空白草稿、严格送审门槛与发布快照构造。
- `src/server/strategy/local-strategy-store.ts`：仅限本机的加密、原子、乐观锁策略存储；包含
  初始化标记、所有权/权限检查与可验证的陈旧锁恢复。
- `src/app/studio/strategies/`：编辑、独立复核、发布、退回与撤回 Server Actions。

## Analytics 与历史产品基础设施

当前公开体验使用 `page_view`、`tool_open`、`tool_complete`、
`market_interval_change`、`cycle_timeline_toggle` 与 `key_level_select`
provider-neutral 事件；默认 adapter 为 noop。行情事件只记录 BTC/ETH、周期切换、时间轴
展开/收起、关键位类别及展示序号等匿名枚举，不记录价位或关键位 ID。工具事件只记录工具名称、
页面位置与内容版本。所有事件白名单均拒绝金融输入、计算结果、URL 查询、账户、用户或 Session
标识，adapter 失败也不会阻断行情交互、导航或计算。

Phase 6 建立的产品 schema、来源校验、Referral hostname 白名单及
`product_view`、`referral_click`、`tutorial_click` facade 暂时保留，供未来复用，
但不再由公开路由调用。现有资料没有 Referral URL、code、promotion 或
Wise-exclusive benefit；全部历史 Partner / Product 已设为 disabled + unpublished，
当前所有 Partner 白名单均为空，不预授权任何目的地。

## 测试与质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

一次运行全部检查：

```bash
pnpm check
```

长期基线不是普通 `build` 或网页请求的隐式网络依赖。可先对单一资产 / 周期做离线核验：

```bash
pnpm history:download -- --symbol BTCUSDT --interval 1h --from 2024-01 --to 2024-03 --allow-gaps
```

该命令下载 Binance 官方月度 Spot ZIP，并在读取 CSV 前核对相邻的官方 `.CHECKSUM`。
正式更新 BTC/ETH × `1h / 4h / 1d` 六条长期基线时，再显式运行：

```bash
pnpm history:build -- --from <first-archive-month> --to <last-complete-month> --concurrency 2
```

结束月份必须替换为当时已经发布的最后一个完整 UTC 月；完整校验、异常兼容边界和产物说明见
[`docs/data/binance-history-baseline.md`](docs/data/binance-history-baseline.md)。
小时级官方缺口会被原样审计并分段计算，不插值、不跨缺口延续 EMA 或未来观察窗；日线缺口
会使构建失败，避免污染 EMA200 牛熊制度。官方归档目录与 checksum 约定见
[Binance Public Data README](https://github.com/binance/binance-public-data/blob/master/README.md)。
旧毫秒 `1h / 4h` 中可审计的非 UTC 边界行和严格零成交占位行会分别计数后排除，绝不移动或
补造；微秒与日线的同类异常继续 fail closed，完整判定条件见上面的构建说明。

GitHub Actions 会在 Pull Request 和 `main` 分支 push 时使用仓库声明的 Node.js、
pnpm 版本，依次执行同样的 lint、typecheck、tests 与 production build，避免仅依赖
本机验收结果。

最终验收还应在 `pnpm start` 的 `http://localhost:2222` 检查 320/390/1280px、
键盘操作、路由状态、Metadata、security headers、控制台和外部数据降级。

## 部署

目标是独立 Vercel 项目，正式域名为 `https://crypto.wise-invest.org`。本仓库没有
执行自动部署；上线时按以下顺序操作：

1. 在 Vercel 新建独立项目并导入仓库。
2. 保持 framework 为 Next.js，install 使用 `pnpm install`，build 使用
   `pnpm build`。
3. 先在主站 OIDC 管理中注册并启用 `wise_crypto`，登记精确生产 callback
   `https://crypto.wise-invest.org/api/auth/callback/wise`，启用 Authorization Code、
   PKCE 及 `openid profile email wise.membership` scope，并取得服务端 Client Secret。
4. 在 Production 环境只配置 `AUTH_SECRET` 与 `WISE_AUTH_CLIENT_SECRET` 两个认证 Secret；
   两者有效时登录自动启用。生产域名和其他公开 OIDC 值已经固定在代码中，不需要重复填写。
   如启用 CMC，再配置可选的服务端 `COINMARKETCAP_API_KEY`。
5. 先完成 Preview 验收。Preview 必须保持 `noindex, nofollow`，代码会自动关闭 Preview 登录，
   不会复用生产 callback 冒充预览登录。
6. 发布 Production，确认首页、所有公开路由、登录 / 退出、普通 / VIP 身份映射、Session
   过期、`/robots.txt`、`/sitemap.xml`、
   `/og.png`、canonical 和安全响应头。
7. 若生产域名或环境值错误，登录会 fail closed；不要通过修改代码绕过。

本地已通过被 Git 忽略的环境文件配置 Client Secret，但 `wise_crypto` 的主站启用状态、生产
callback 登记与真实 OIDC 往返仍需在正式域名上完成 smoke test。Vercel 部署和 DNS 修改都不是
本地代码接入已经自动完成的事情。

## DNS

DNS 也未由本仓库自动配置。上线时：

1. 在 Vercel 项目中添加 `crypto.wise-invest.org`，读取 Vercel 当时显示的精确
   DNS 记录目标。
2. 在 `wise-invest.org` 的 DNS 服务商中，为 `crypto` 添加 Vercel 要求的 CNAME
   或其明确给出的替代记录；不要猜测或写死通用目标。
3. 删除同名冲突记录，等待 Vercel 验证并签发 TLS。
4. 用 HTTPS 检查证书、重定向、canonical、robots 与 sitemap host 全部指向
   `https://crypto.wise-invest.org`。

## Wise ID 主站登录边界

本地已按主站架构接入 Wise ID OIDC，并已在被 Git 忽略的本地环境中配置 Client Secret；但在
主站确认启用 `wise_crypto`、登记精确生产 callback，并在正式域名完成真实授权往返之前，仍不能
报告为已上线：

- 使用 Authorization Code + PKCE、`state`、`nonce` 与精确 callback allowlist；子站不共享
  主站 Cookie 或用户数据库，而是创建自己的 host-only Session；生产 Cookie 使用 Secure，
  所有 Session Cookie 使用 HttpOnly / SameSite=Lax。
- `MEMBER` 映射为 `regular`，`VIP` / `VIP_PLUS` 映射为 `vip`；未知或缺失会员字段 fail closed，
  不存在 URL、localStorage、客户端状态或环境变量 VIP 开关。
- Session 身份期限固定跟随 Provider 当前返回的 1 小时（`expires_in=3600`）截止时间，不通过
  滑动 JWT 延长旧会员状态；当前没有 refresh token，到期后需重新通过主站确认身份。
- Access Token、ID Token、Client Secret 与完整 Provider payload 不进入客户端 bundle、URL、
  Analytics 或公开页面响应；个性化账户接口与受限内容使用 `private, no-store`。
- 首页及其公共 Provider cache、Metadata 不依赖登录；行情、工具、课程与账户页按服务端门禁要求
  有效 Wise ID Session。本地 `pnpm dev` 只有在精确 loopback Host 与 2222 端口下使用固定
  `MEMBER / regular` 调试身份；生产、Vercel 与其他 Host 继续 fail closed。人工策略仍由服务端
  Identity Adapter 与权限表单独检查，普通调试身份不能读取 VIP 内容。
- 真实 VIP 策略不得提交到 Git 或写入客户端 bundle。当前 Vercel 环境没有私有策略存储，且本地
  `/studio/strategies` 文件仓库会在部署环境强制关闭；正式策略仍需受控私有 CMS / 数据库与
  staff 身份，Wise ID 登录本身不会自动补齐这些内容。

## 已知限制

- V0 cache 与 retry backoff 是进程内实现，最多分别保留 256 个条目，不跨 Vercel
  实例或冷启动共享；过期 last-known-good 和对应 backoff 会在同一硬截止时间失效。
- ETF Flow 尚无已配置的商业许可来源；无 CMC key 时全市场 Liquidations 不可用。
- Binance Funding/OI 是单场所口径；公开接口的正式商业再分发条款仍应由上线方做
  法务确认。
- 历史产品目录代码仍在仓库中但不公开渲染；若未来重新启用，必须先重新核验所有
  费用、资格、地区与条款。
- Analytics 默认 noop；部署第三方 Analytics 前必须先确定隐私、Cookie 与数据保留政策。
- 人工策略发布台当前只支持单机文件存储与两名预配置 staff，不支持多实例、账号恢复、
  远程协作或正式生产持久化；检测到部署环境时会强制关闭。
- 公开多周期与算法关键位不依赖 Wise ID；人工策略依赖服务端验证且未过期的 VIP。
  主站 `wise_crypto` Client 尚未注册 / 启用，生产也没有私有策略存储；当前没有客户端 VIP
  开关、AI 结果或虚构的关键位事件历史。
- 公开研究缓存每 Provider 实例最多 8 项，仍不跨 Serverless 实例或冷启动共享。
  OHLCV 成交分布并非逐笔成交；缺少有效成交量时成交分布不可用，不补零估算。
- 精确 EMA 指纹长期统计当前只覆盖 BTC/ETH 的 `1h / 4h / 1d`；`15m` 仍可查看独立的
  资产级已闭合日线周期，但不提供自身的 EMA 指纹历史匹配。归档更新仍是人工触发的离线
  流程，没有后台定时发布或在线数据库；机械阶段和历史分布不会自动生成 Wise 主观判断、
  开多 / 开空结论或交易建议。
