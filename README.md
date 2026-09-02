# Wise Crypto

Wise Crypto 是面向 Crypto / Web3 用户的中文市场工作台，提供可追溯的
BTC/ETH 市场信息、人工审核背景、四个风险计算工具，以及客观的产品指南。
V0 按七个阶段完成，权威范围见
[`docs/product-specs/wise-crypto-v0.md`](docs/product-specs/wise-crypto-v0.md)，最终验收见
[`docs/wise-crypto-v0-completion-report.md`](docs/wise-crypto-v0-completion-report.md)。

## 当前状态

Wise Crypto V0 的 Phase 1–7 已完成。当前公开体验包括：

- 中文响应式 Layout、Header、Footer、Navigation、loading、error 与 404。
- 首页 Market Pulse、BTC/ETH 概览、关键市场数据、人工配置的 Market Status、
  Today in Crypto 和 Wise Take。
- BTC/ETH 资产工作台：聚合 USD 价格、Binance 现货实时 K 线工作台、已闭合 UTC
  日线 SMA20/SMA50 与客观趋势、Funding、OI、Liquidations、ETF 状态，以及人工配置槽位。
- 仓位风险、杠杆与盈亏、历史 DCA、风险回报四个独立计算器。
- 七份已核验产品指南：Binance、Coinbase、Kraken、OKX、MetaMask、
  Ledger 硬件钱包和 CoinGecko。
- 完整 canonical、Open Graph/X、分享图、robots、sitemap、WebSite 与真实面包屑
  JSON-LD，以及 provider-neutral Analytics 接口。

本站不提供交易、托管、钱包连接或自动投资建议。Support、Resistance、
Wise Scenario、Wise Take 与产品事实不会由行情数据自动生成。

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
| BTC/ETH 交互 K 线 | Binance Spot `BTCUSDT` / `ETHUSDT` | USDT、UTC，支持 `15m / 1h / 4h / 1d`；默认取 1000 根 `1h`，每 5 秒通过同源服务增量刷新，最后一根可明确标记为形成中 |
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
- 编辑判断、关键位、情景、产品费用、资格、优惠与 Referral 权益必须来自人工审核
  配置和可核验来源，不能由代码补写。

## 路由

- `/`：市场总览。
- `/btc`、`/eth`：资产工作台。
- `/tools`：工具目录。
- `/tools/position-size`、`/tools/leverage`、`/tools/dca`、
  `/tools/risk-reward`：独立计算器。
- `/products`：产品目录。
- `/products/[slug]`：只公开 enabled、published 且仍在有效期内的已核验产品。

未知、disabled、expired、future 或 unpublished 产品返回 404，并明确 `noindex`。

## 项目结构

```text
src/
  app/                    Next.js 路由、Metadata、robots、sitemap、状态页
  components/             Layout、首页、资产、工具、产品与 SEO 组件
  config/                 站点 canonical 与公开路由配置
  content/                人工审核的首页、资产与产品配置
  lib/                    计算公式、展示层、Analytics、SEO 与产品 schema
  server/
    data/                 Provider、校验、cache、领域 service、测试 Mock
    editorial/            人工内容读取与有效期过滤
    products/             服务端产品目录
    tools/                DCA 历史数据服务
tests/unit/               领域、组件、Metadata、安全与阶段完整性测试
docs/                     产品规范、数据口径与 V0 完成报告
public/                   品牌分享图等静态资源
```

公开页面默认使用 Server Components；只有计算器、交互 K 线、分享、Analytics
跟踪等真实浏览器交互使用 Client Components。K 线客户端只请求同源
`/api/market/candles`，第三方 Binance 请求、校验、缓存与 fallback 均留在服务端。

## Analytics 与 Referral

V0 提供 `page_view`、`tool_open`、`tool_complete`、`product_view`、
`referral_click`、`tutorial_click` 六类 provider-neutral 事件。默认 adapter 为
noop；在确定供应商、Cookie 和隐私政策前不发送数据。事件白名单不允许金融输入、
计算结果、Referral URL、Referral code 或用户标识进入 payload，失败也不会阻断
页面、计算或外链跳转。

当前七份产品资料都没有 Referral URL、code、promotion 或 Wise-exclusive
benefit。未来 Referral URL 只能从服务端验证配置进入页面，并使用
`sponsored nofollow noopener noreferrer`。每个 Partner 还必须逐项配置精确的
`allowedReferralHosts`；不接受通配符、任意子域、IP、localhost、credentials 或
自定义端口。当前所有 Partner 的白名单均为空，不预授权任何 Referral 目的地。

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

Wise ID 不属于 V0，页面不会渲染假的登录入口。未来集成应遵守：

- 身份读取集中在服务端 `Identity Adapter`，优先使用标准 OIDC/OAuth 2.0、
  Authorization Code + PKCE、`state`、`nonce` 和严格 callback allowlist。
- 权益判断集中在独立 `Entitlement Service`，不能散落进 Client Components。
- Session 使用 Secure、HttpOnly、SameSite Cookie；密钥和 token 不进入浏览器
  bundle、Analytics 或 URL。
- 公共市场页、Provider cache 和公开 Metadata 永远不依赖登录态；私有页面使用独立
  路由与 `private/no-store` 缓存边界，防止用户数据进入公共缓存。
- Wise ID 上线前需要单独的威胁建模、隐私政策、账号恢复与授权撤销设计，不在 V0
  中预埋假的状态。

## 已知限制

- V0 cache 与 retry backoff 是进程内实现，最多分别保留 256 个条目，不跨 Vercel
  实例或冷启动共享；过期 last-known-good 和对应 backoff 会在同一硬截止时间失效。
- ETF Flow 尚无已配置的商业许可来源；无 CMC key 时全市场 Liquidations 不可用。
- Binance Funding/OI 是单场所口径；公开接口的正式商业再分发条款仍应由上线方做
  法务确认。
- Product 事实已在 2026-08-31 核验，但仍需运营流程定期复核费用、资格、地区与条款。
- Analytics 默认 noop；部署第三方 Analytics 前必须先确定隐私、Cookie 与数据保留政策。
