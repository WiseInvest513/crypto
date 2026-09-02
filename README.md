# Wise Crypto

Wise Crypto 是面向 Crypto / Web3 用户的中文市场工作台，提供可追溯的
BTC/ETH 市场信息、人工审核背景与四个风险计算工具。
V0 按七个阶段完成，并已完成实用性批次 A、K 线专项、批次 B 的 B1–B4 与
VIP 行情研究基础与首个多周期客观参考批次。权威范围见
[`docs/product-specs/wise-crypto-v0.md`](docs/product-specs/wise-crypto-v0.md)，最终验收见
[`docs/wise-crypto-v0-completion-report.md`](docs/wise-crypto-v0-completion-report.md)；当前
资产工作台的视觉与任务层级见
[`docs/product-specs/wise-crypto-asset-workbench-redesign.md`](docs/product-specs/wise-crypto-asset-workbench-redesign.md)；当前 VIP
边界见 [`docs/product-specs/wise-crypto-vip-research-foundation.md`](docs/product-specs/wise-crypto-vip-research-foundation.md)。

## 当前状态

Wise Crypto V0 的 Phase 1–7 已完成。当前公开体验包括：

- 中文响应式 Layout、Header、Footer、Navigation、loading、error 与 404。
- 首页 Market Pulse、BTC/ETH 概览、关键市场数据、人工配置的 Market Status、
  Today in Crypto 和 Wise Take；其中 Market Status 与 Wise Take 属于 VIP 主观内容，
  普通权限只可能看到带来源的 Today in Crypto 公共事实简报。
- BTC/ETH 资产工作台：首屏合并资产切换、同步 Binance 图表价格、聚合涨跌、周期与
  分析视角；大尺寸实时 K 线旁优先显示已闭合收盘相对 EMA 的一句结论、区间位置和
  客观变化条件。完整 EMA、区间统计与日线 SMA20/SMA50 按需展开；Funding、OI、
  Liquidations、ETF 状态继续保留，
  以及紧随 K 线的 VIP 行情策略台。人工配置内容只有在服务端确认 VIP、审核通过且
  处于有效期内时才进入响应；当前生产默认身份为普通用户。
- VIP 多周期客观参考：在服务端鉴权后并行比较 15m / 1h / 4h / 1d 的已闭合 K 线、
  EMA10/20/50/200、近 3/20 根变化、距区间高点、区间位置与量能比例；不自动输出
  多空结论。真实 Wise ID 尚未接入，因此生产默认不会向匿名请求读取或披露这些摘要。
- 仓位风险、杠杆与盈亏、历史 DCA、风险回报四个独立计算器；资产页可用只含
  `asset=btc|eth` 的链接进入工具，金融输入与计算结果不会通过 URL 传递。
- 完整 canonical、Open Graph/X、分享图、robots、sitemap、WebSite 与真实面包屑
  JSON-LD，以及 provider-neutral Analytics 接口。

本站不提供交易、托管、钱包连接或自动投资建议。Support、Resistance、
Wise Scenario 与 Wise Take 不会由行情数据自动生成。

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
`2222`，不会回退到 `3000`。

本地生产预览：

```bash
pnpm build
pnpm start
```

## 环境变量

| 变量 | 必需 | 作用与边界 |
|---|---:|---|
| `SITE_URL` | 建议配置 | canonical origin。必须是无账号、path、query、hash 的 HTTPS origin；生产环境固定为 `https://crypto.wise-invest.org` |
| `COINMARKETCAP_API_KEY` | 否 | 仅服务端读取。配置后 CMC 成为核心聚合数据主源，并启用 CMC 跟踪市场的 24h Liquidations |
| `VERCEL_ENV` | 平台管理 | Vercel 自动提供；只有值为 `production` 且 canonical 为正式域名时才允许索引，不应手工伪造 |

严禁创建 `NEXT_PUBLIC_COINMARKETCAP_API_KEY`。配置层会主动拒绝它，客户端也不
导入任何市场 Provider 或第三方密钥。

## 数据源与口径

| 数据 | 当前生产来源 | 口径 |
|---|---|---|
| BTC/ETH USD、总市值、BTC Dominance | CoinMarketCap + Alternative.me 降级链 | 显示实际返回 Provider 的覆盖范围、source、数据时间、获取时间与 cache 状态 |
| Fear & Greed | CMC Crypto F&G 或 Alternative.me Bitcoin F&G | 两个独立专有序列，只做 latest 故障降级，不拼成一条历史；主序列仍有 stale 值时不会跨方法替换 |
| ETH/BTC | Wise Crypto 由同一 Provider 的 BTC/USD、ETH/USD 派生 | 两个报价源时间差不得超过 10 分钟，采用较早数据时间；不满足时返回 error |
| BTC/ETH 交互 K 线 | Binance Spot `BTCUSDT` / `ETHUSDT` | USDT、UTC，支持 `15m / 1h / 4h / 1d`；默认取 1000 根 `1h`，每 5 秒通过同源服务增量刷新，最后一根可明确标记为形成中；形成中数值标记为服务器观测时间，不冒充上游数据截至时间 |
| VIP 多周期客观参考 | Binance Spot K 线的 Wise Crypto 服务端派生 | 通过 VIP 权限后，各周期最多取 1,000 根；只使用闭合 K 线并分别保留 source、scope、截至/获取时间、stale、cache 与 error；不向普通响应写入摘要 |
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
- 编辑判断、关键位与情景必须来自人工审核配置和可核验来源，不能由代码补写。

## 路由

- `/`：市场总览。
- `/btc`、`/eth`：资产工作台。
- `/tools`：工具目录。
- `/tools/position-size`、`/tools/leverage`、`/tools/dca`、
  `/tools/risk-reward`：独立计算器。

产品目录已经退出 Wise Crypto 的核心体验。为兼容历史分享链接，`/products` 与
其全部子路径由 `src/proxy.ts` 使用固定的服务端 `308` 永久重定向前往 Wise Invest 的
[`Crypto 福利页`](https://www.wise-invest.org/perk/crypto)，不会从路径或查询参数
构造目的地址。这些旧路由不在导航、`PUBLIC_ROUTES`、sitemap 或 `page_view` 中。

## 项目结构

```text
src/
  proxy.ts               旧产品地址的固定 308 请求层跳转
  app/                    Next.js 路由、Metadata、robots、sitemap、状态页
  components/             Layout、首页、资产、工具与 SEO 组件；保留未公开的产品组件
  config/                 站点 canonical 与公开路由配置
  content/                人工审核的首页、资产与产品配置
  lib/                    计算公式、展示层、Analytics、SEO 与产品 schema
  server/
    data/                 Provider、校验、cache、领域 service、测试 Mock
    access/               未来 Wise ID 的服务端身份适配边界
    editorial/            人工内容读取与有效期过滤
    products/             服务端产品目录
    tools/                DCA 历史数据服务
tests/unit/               领域、组件、Metadata、安全与阶段完整性测试
docs/                     产品规范、数据口径与 V0 完成报告
public/                   品牌分享图等静态资源
.github/workflows/        Pull Request 与 main 分支质量检查
```

公开页面默认使用 Server Components；只有计算器、交互 K 线、分享、Analytics
跟踪等真实浏览器交互使用 Client Components。K 线客户端只请求同源
`/api/market/candles`，第三方 Binance 请求、校验、缓存与 fallback 均留在服务端。

## Analytics 与历史产品基础设施

当前公开体验使用 `page_view`、`tool_open` 与 `tool_complete` provider-neutral
事件；默认 adapter 为 noop。事件白名单不允许金融输入、计算结果或用户标识进入
payload，失败也不会阻断页面或计算。

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
3. 在 Production 环境设置 `SITE_URL=https://crypto.wise-invest.org`；如启用
   CMC，再配置服务端 `COINMARKETCAP_API_KEY`。
4. 先完成 Preview 验收。Preview 必须保持 `noindex, nofollow`。
5. 发布 Production，确认首页、所有公开路由、`/robots.txt`、`/sitemap.xml`、
   `/og.png`、canonical 和安全响应头。
6. 若生产域名或环境值错误，构建会 fail closed；不要通过修改代码绕过。

## DNS

DNS 也未由本仓库自动配置。上线时：

1. 在 Vercel 项目中添加 `crypto.wise-invest.org`，读取 Vercel 当时显示的精确
   DNS 记录目标。
2. 在 `wise-invest.org` 的 DNS 服务商中，为 `crypto` 添加 Vercel 要求的 CNAME
   或其明确给出的替代记录；不要猜测或写死通用目标。
3. 删除同名冲突记录，等待 Vercel 验证并签发 TLS。
4. 用 HTTPS 检查证书、重定向、canonical、robots 与 sitemap host 全部指向
   `https://crypto.wise-invest.org`。

## 未来 Wise ID 集成边界

真实 Wise ID 仍未接入，页面不会渲染假的登录入口。当前只落地了
`regular / vip` 两级权限合同、统一功能表和服务端 Identity Adapter 边界；所有公开
请求默认是匿名普通权限，也没有 URL 或浏览器状态 VIP 开关。未来集成应遵守：

- 身份读取集中在服务端 `Identity Adapter`，优先使用标准 OIDC/OAuth 2.0、
  Authorization Code + PKCE、`state`、`nonce` 和严格 callback allowlist。
- 权益判断集中在独立 `Entitlement Service`，不能散落进 Client Components。
- Session 使用 Secure、HttpOnly、SameSite Cookie；密钥和 token 不进入浏览器
  bundle、Analytics 或 URL。
- 公共市场数据请求、Provider cache 和公开 Metadata 永远不依赖登录态；同页受限内容
  只能在服务端鉴权后进入响应。真实 Session 接入时必须使用 `private/no-store` 或等价
  的用户隔离缓存边界，防止 VIP 内容进入公共缓存。
- 真实 VIP 策略不得提交到 Git 或写入客户端 bundle；当前仓库只保留空生产配置与
  测试 fixture，未来内容必须在鉴权后从受控私有 CMS / 数据库读取。
- Wise ID 上线前需要单独的威胁建模、隐私政策、账号恢复与授权撤销设计，不在 V0
  中预埋假的状态。

## 已知限制

- V0 cache 与 retry backoff 是进程内实现，最多分别保留 256 个条目，不跨 Vercel
  实例或冷启动共享；过期 last-known-good 和对应 backoff 会在同一硬截止时间失效。
- ETF Flow 尚无已配置的商业许可来源；无 CMC key 时全市场 Liquidations 不可用。
- Binance Funding/OI 是单场所口径；公开接口的正式商业再分发条款仍应由上线方做
  法务确认。
- 历史产品目录代码仍在仓库中但不公开渲染；若未来重新启用，必须先重新核验所有
  费用、资格、地区与条款。
- Analytics 默认 noop；部署第三方 Analytics 前必须先确定隐私、Cookie 与数据保留政策。
- 多周期客观参考的真实用户入口依赖未来 Wise ID；当前没有客户端 VIP 开关。派生缓存
  仍随单进程 Provider cache 生命周期，不跨 Serverless 实例共享。
