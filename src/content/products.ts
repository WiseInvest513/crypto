import "server-only";

/**
 * Human-reviewed production product facts.
 *
 * Every published record below was checked against the linked first-party
 * pages on 2026-08-31. There are deliberately no referral URLs, referral
 * codes, claimed Wise benefits, fixed fee quotes or ranking claims.
 */
export const productCatalogDraft = {
  partners: [
    {
      id: "binance",
      name: "Binance",
      website: "https://www.binance.com/en",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "coinbase",
      name: "Coinbase",
      website: "https://www.coinbase.com/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "kraken",
      name: "Kraken",
      website: "https://www.kraken.com/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "okx",
      name: "OKX",
      website: "https://www.okx.com/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "metamask",
      name: "MetaMask",
      website: "https://metamask.io/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "ledger",
      name: "Ledger",
      website: "https://www.ledger.com/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
    {
      id: "coingecko",
      name: "CoinGecko",
      website: "https://www.coingecko.com/",
      allowedReferralHosts: [],
      logo: null,
      enabled: true,
    },
  ],
  products: [
    {
      id: "binance",
      partnerId: "binance",
      name: "Binance",
      slug: "binance",
      type: "exchange",
      logo: null,
      summary:
        "Binance 是中心化数字资产交易平台，提供买币、Convert、现货、保证金、期货与期权等功能，并配有身份验证、安全设置和官方教程。",
      website: "https://www.binance.com/en",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "希望在同一账户使用 Convert、现货及多种进阶交易工具，并愿意分别核对产品规则、所在地资格与风险边界的用户。",
      pros: [
        "现货支持市价、限价、止盈止损限价和 OCO 等多种订单类型。",
        "从账户创建、身份验证、买币到现货操作均有官方分步教程。",
        "官网集中提供费率、交易参数、风险警告与储备金证明入口。",
      ],
      cons: [
        "功能层级较多，现货、保证金和衍生品分别适用不同费用与风险规则。",
        "开户需要身份验证，产品和支付方式会随地区及账户资格变化。",
        "中心化账户涉及托管、系统和服务中断风险，杠杆产品另有强平风险。",
      ],
      feeDescription:
        "交易费用会随产品、交易对、maker / taker、VIP 等级及 BNB 费用优惠状态变化；充值、提现、借贷等还可能另行收费。本站不展示固定费率，使用前请查看实时费率页和账户订单预览。",
      tutorialUrl:
        "https://www.binance.com/en/academy/articles/binance-beginner-s-guide",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "仅限年满 18 岁、具合法缔约能力、非受限人士且不在禁止国家或地区的用户；需完成身份验证，具体产品还受所在地资格规则影响，以最新条款及登录后提示为准。",
      },
      enabled: true,
      disclaimer:
        "数字资产价格、流动性及执行结果可能大幅波动，并可能损失部分或全部资金。平台信息不构成投资建议；使用前应确认所在地资格、具体产品条款、实时费用及自身风险承受能力。",
      sources: [
        {
          id: "official-overview",
          label: "Binance 官网与产品入口",
          url: "https://www.binance.com/en",
        },
        {
          id: "beginner-guide",
          label: "Binance Beginner's Guide",
          url: "https://www.binance.com/en/academy/articles/binance-beginner-s-guide",
        },
        {
          id: "fee-schedule",
          label: "Binance 官方费率页面",
          url: "https://www.binance.com/en/fee/trading",
        },
        {
          id: "proof-of-reserves",
          label: "Binance Proof of Reserves",
          url: "https://www.binance.com/en/proof-of-reserves",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://www.binance.com/en/terms",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "coinbase",
      partnerId: "coinbase",
      name: "Coinbase",
      slug: "coinbase",
      type: "exchange",
      logo: null,
      summary:
        "Coinbase 是中心化数字资产平台。零售端提供简易买卖、转换和资产管理，也提供直接使用订单簿、图表与高级订单类型的 Coinbase Advanced。",
      website: "https://www.coinbase.com/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "需要在同一账户内使用简易买卖与订单簿高级交易功能，并已确认所在地区和账户服务资格的用户。",
      pros: [
        "默认交易界面与 Coinbase Advanced 可在同一账户内切换，资产、历史记录和余额保持一致。",
        "Coinbase Advanced 提供实时订单簿、深度图、TradingView 图表、高级订单类型及 API。",
        "下单确认前会展示适用费用和价差，完成后的交易记录也保留费用信息。",
      ],
      cons: [
        "简易买卖与转换可能同时包含平台费用和价差，实际成本受支付方式、订单规模、市场和地区影响。",
        "Coinbase 与 Coinbase Advanced 使用不同定价机制，具体费率需按当时账户费率等级核对。",
        "法币余额、支付方式、资产及交易功能可能因地区、安全、合规或账户资格受到限制。",
      ],
      feeDescription:
        "简易买卖或转换的费用在下单时计算，受支付方式、订单规模、市场状况、司法辖区和资产等因素影响，报价可能包含价差。Coinbase Advanced 使用订单簿和当前官方费率等级；最终以订单预览及官方费用披露为准。",
      tutorialUrl:
        "https://help.coinbase.com/en/coinbase/trading-and-funding/buying-selling-or-converting-crypto/how-do-i-buy-digital-currency",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "服务受地区和账户资格限制。用户需满足适用地区用户协议、年龄、身份及支付方式验证要求；可用资产、法币账户、支付方式和 Advanced 功能以登录后账户实际显示为准。",
      },
      enabled: true,
      disclaimer:
        "本页不构成投资或平台推荐。数字资产价格波动可能导致本金损失；费用、价差、资产和功能均可能变化，下单前必须查看订单预览。地区、身份及支付资格以用户账户和当地条款为准。",
      sources: [
        {
          id: "advanced-comparison",
          label: "Coinbase 与 Coinbase Advanced 官方对比",
          url: "https://help.coinbase.com/en/getting-started/other/coinbase-vs-coinbase-advanced",
        },
        {
          id: "fee-disclosure",
          label: "Coinbase 官方费用及价差披露",
          url: "https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees",
        },
        {
          id: "service-availability",
          label: "Coinbase 可用交易类型与限制",
          url: "https://help.coinbase.com/en/coinbase/trading-and-funding/depositing-or-withdrawing-fiat-money/available-services",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://www.coinbase.com/legal",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "kraken",
      partnerId: "kraken",
      name: "Kraken",
      slug: "kraken",
      type: "exchange",
      logo: null,
      summary:
        "Kraken 是中心化加密资产交易所，通过撮合客户买卖委托完成交易。平台同时提供简易买卖界面和具备订单簿、图表、高级订单及 API 的 Kraken Pro。",
      website: "https://www.kraken.com/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "需要在一个账户中使用简易买卖或 Kraken Pro 订单簿工具，并愿意自行核对地区、验证等级和具体产品资格的用户。",
      pros: [
        "同一平台覆盖简易买卖以及 Kraken Pro 的订单簿、图表和高级订单工具。",
        "Kraken Pro 提供 maker / taker 费率结构，并公开展示当前费率表和分层依据。",
        "官方帮助中心说明交易所撮合性质、购买流程、地区限制及产品边界。",
      ],
      cons: [
        "简易买卖与 Kraken Pro 使用不同费用机制，简易买卖还可能涉及价差和支付方式费用。",
        "账户、资产、法币通道、保证金和衍生品等存在地区差异，不能假定全球功能一致。",
        "客服不能代表用户创建、修改或取消订单，错误订单也不能按普通商品交易处理。",
      ],
      feeDescription:
        "简易买卖、出售或转换可能包含交易费用、支付方式费用和价差，金额受订单类型、资产、市场、规模及账户条件影响。Kraken Pro 使用当前官方 maker / taker 分层机制；最终以交易确认页和官方费率表为准。",
      tutorialUrl:
        "https://support.kraken.com/articles/360058727972-buying-selling-and-converting-cryptocurrency-with-the-kraken-app",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "Kraken 设有禁止服务地区，并在不同市场设置资产和产品限制。功能取决于验证居住地、账户验证等级及当地规则，必须查看最新官方地区说明和账户实际状态。",
      },
      enabled: true,
      disclaimer:
        "本页不是投资、财务或税务建议。加密资产交易可能导致资金损失；地区、产品、监管保护和税务待遇存在差异。下单前须核对费用、价差、资产、支付通道和账户资格。",
      sources: [
        {
          id: "official-definition",
          label: "Kraken.com 的官方定义与服务边界",
          url: "https://support.kraken.com/articles/360030651871-what-is-kraken-com-",
        },
        {
          id: "fee-schedule",
          label: "Kraken 官方费率表",
          url: "https://www.kraken.com/features/fee-schedule",
        },
        {
          id: "regional-restrictions",
          label: "Kraken 地区、许可与产品限制",
          url: "https://support.kraken.com/articles/where-is-kraken-licensed-or-regulated",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://www.kraken.com/legal",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "okx",
      partnerId: "okx",
      name: "OKX",
      slug: "okx",
      type: "exchange",
      logo: null,
      summary:
        "OKX 是中心化数字资产平台，提供买币、Convert、现货、期货、期权、交易机器人与 API 等工具，并通过帮助中心展示操作、费用及合规说明。",
      website: "https://www.okx.com/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "希望统一使用现货、Convert、衍生品与 API 工具，并能自行区分不同产品风险、费用规则与地区边界的用户。",
      pros: [
        "产品入口覆盖 Convert、现货、期货、期权、交易机器人和 API。",
        "可在账户或交易面板查看当前等级及交易对的 maker / taker 费率。",
        "官网提供分步买币教程、储备金证明及风险合规披露。",
      ],
      cons: [
        "并非所有市场都提供全部服务，支付方式也会依身份材料和地区变化。",
        "费用不是单一固定值，取决于成交角色、产品、交易对、资产量及近 30 日交易量。",
        "杠杆和衍生品可能产生强平与显著损失，不同功能需分别阅读产品规则。",
      ],
      feeDescription:
        "费用按产品、交易对、实际 maker / taker 成交、资产量和近 30 日交易量等级决定；地区定价、充值、提现及支付渠道费用可能另行适用。本站不写固定费率，最终以实时费率页和订单预览为准。",
      tutorialUrl: "https://www.okx.com/help/how-do-i-buy-crypto",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "仅限年满 18 岁、当地法律允许且满足身份验证与合规要求的用户。官方设有完全或部分受限地区，并可能存在地区或产品级限制；请以最新披露和登录后结果为准。",
      },
      enabled: true,
      disclaimer:
        "数字资产交易和持有具有高风险，可能损失部分或全部资金；服务、支付方式和费率会随地区及账户资格变化。本页仅作产品事实说明，不构成投资、法律或税务建议。",
      sources: [
        {
          id: "official-overview",
          label: "OKX 官网与产品入口",
          url: "https://www.okx.com/",
        },
        {
          id: "fee-rules",
          label: "OKX Trading Fee Rules FAQ",
          url: "https://www.okx.com/help/trading-fee-rules-faq",
        },
        {
          id: "risk-disclosure",
          label: "OKX Risk & Compliance Disclosure",
          url: "https://www.okx.com/help/risk-compliance-disclosure",
        },
        {
          id: "proof-of-reserves",
          label: "OKX Proof of Reserves",
          url: "https://www.okx.com/proof-of-reserves",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://www.okx.com/help/terms-of-service",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "metamask",
      partnerId: "metamask",
      name: "MetaMask",
      slug: "metamask",
      type: "wallet",
      logo: null,
      summary:
        "MetaMask 是浏览器扩展与移动端自托管钱包，可管理多条区块链上的私钥、账户和资产，并连接去中心化应用。部分交易与入金功能由第三方服务提供。",
      website: "https://metamask.io/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "愿意自行保管密钥，并主要通过浏览器或手机管理链上账户、连接 Web3 应用的用户。",
      pros: [
        "同时提供主流浏览器扩展和移动应用。",
        "用户自行控制钱包私钥和加密身份，可连接去中心化应用。",
        "官方帮助中心提供安装、钱包恢复和安全边界说明。",
      ],
      cons: [
        "用户必须自行保护助记词；遗失或泄露可能造成无法恢复的资产损失。",
        "买币、兑换、桥接等功能可能由第三方提供，并适用独立费用、资格和条款。",
        "节点、支付服务和部分附加功能会受地区、服务商及制裁规则限制。",
      ],
      feeDescription:
        "MetaMask 钱包本体可免费安装；链上操作仍可能产生网络费，买币、兑换、桥接等第三方或附加服务也可能另收费用。具体金额和费用接收方以操作界面及对应服务商条款为准。",
      tutorialUrl:
        "https://support.metamask.io/start/getting-started-with-metamask/",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "钱包软件可以从官方支持的应用商店或扩展商店安装；默认节点、支付服务、交易功能及其他附加服务可能因所在地区、设备、服务商或制裁要求而不可用。",
      },
      enabled: true,
      disclaimer:
        "MetaMask 是自托管钱包，用户对助记词、私钥和交易确认承担直接责任。请只从官方入口安装，不向任何人披露助记词，并在签名前核对网络、合约和交易内容；第三方服务及链上交互另有费用与风险。",
      sources: [
        {
          id: "install-guide",
          label: "MetaMask 官方安装与可用性说明",
          url: "https://support.metamask.io/start/getting-started-with-metamask/",
        },
        {
          id: "wallet-security",
          label: "MetaMask 助记词、密码与私钥安全指南",
          url: "https://support.metamask.io/start/user-guide-secret-recovery-phrase-password-and-private-keys/",
        },
        {
          id: "provider-availability",
          label: "MetaMask 买币服务商与支付方式可用性",
          url: "https://support.metamask.io/manage-crypto/move-crypto/buy/providers-and-payment-methods/",
        },
        {
          id: "network-fees",
          label: "MetaMask 网络费用说明",
          url: "https://support.metamask.io/more-web3/learn/user-guide-gas",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://metamask.io/terms-of-use",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "ledger-hardware-wallet",
      partnerId: "ledger",
      name: "Ledger 硬件钱包",
      slug: "ledger-hardware-wallet",
      type: "security",
      logo: null,
      summary:
        "Ledger 硬件钱包通过独立硬件保存并使用私钥签署交易，可配合 Ledger Wallet 或兼容钱包管理链上账户；设备本身不保存链上资产。",
      website: "https://www.ledger.com/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "愿意购买并维护实体设备、妥善保管 PIN 与恢复短语，希望把签名密钥与联网电脑或手机隔离的用户。",
      pros: [
        "硬件钱包把私钥保存在独立设备中，并在设备上完成交易签名。",
        "用户可在设备屏幕上核对关键交易信息后再确认。",
        "可以配合 Ledger Wallet 及部分兼容第三方钱包使用。",
      ],
      cons: [
        "需要购买、携带和维护实体设备，并确认型号与软件兼容性。",
        "恢复短语仍由用户自行保管；遗失或泄露可能造成永久失去访问权或资产被盗。",
        "第三方服务、支持资产、配送和功能可用性会随地区与服务商变化。",
      ],
      feeDescription:
        "需要支付设备购买价；最终价格、税费、运费和进口关税取决于型号、币种、配送地址及结账页面。链上网络费与 Ledger Wallet 内第三方买币、兑换或质押服务费用另行计算。",
      tutorialUrl:
        "https://www.ledger.com/academy/topics/ledger-wallet/ledger-wallet-guide",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "网站可公开访问，但部分产品不能配送至特定地点，最终可购买型号、价格、税费、进口要求和配送方式以结账页面及当地法律为准；第三方功能也可能有地区限制。",
      },
      enabled: true,
      disclaimer:
        "硬件钱包可降低部分联网环境中的私钥暴露风险，但不能消除钓鱼、恶意合约、错误地址或用户操作风险。请从官方或授权渠道购买，保护 PIN 和恢复短语，并在设备上核对每笔交易。",
      sources: [
        {
          id: "hardware-wallet-definition",
          label: "Ledger 硬件钱包官方说明",
          url: "https://www.ledger.com/academy/glossary/hardware-wallet",
        },
        {
          id: "hardware-operation",
          label: "Ledger 硬件钱包工作方式",
          url: "https://www.ledger.com/academy/topics/ledgersolutions/how-ledger-hardware-wallets-work",
        },
        {
          id: "wallet-terms",
          label: "Ledger Wallet 使用条款",
          url: "https://shop.ledger.com/pages/ledger-live-terms-of-use",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://shop.ledger.com/pages/terms-and-conditions",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
    {
      id: "coingecko",
      partnerId: "coingecko",
      name: "CoinGecko 市场数据",
      slug: "coingecko",
      type: "data",
      logo: null,
      summary:
        "CoinGecko 是独立加密市场数据聚合平台，通过网站、应用和 API 展示资产价格、成交量、市值、交易所及链上市场信息，并公开数据聚合方法。",
      website: "https://www.coingecko.com/",
      referralUrl: null,
      referralCode: null,
      bestFor:
        "需要比较多资产、多交易所聚合市场信息，或希望在开发前评估加密市场数据 API 覆盖、方法和许可边界的用户。",
      pros: [
        "网站与 API 覆盖价格、市值、成交量、交易所、衍生品和部分链上数据。",
        "官方公开价格、成交量和市值等数据的聚合与筛选方法。",
        "同时提供网页、移动应用、REST API 与开发文档入口。",
      ],
      cons: [
        "聚合价格是参考数据，不等于某一交易场所可立即成交的报价。",
        "API 的请求配额、更新频率、历史深度和授权用途随方案而不同。",
        "站内第三方交易或跳转功能适用对应服务商的独立条款和风险。",
      ],
      feeDescription:
        "公开网站与 API 同时存在免费或演示方案及付费方案；请求配额、更新频率、历史数据、超额费用和商业许可取决于当前方案。本站不固定展示会变化的价格，使用前请核对官方定价与 API 条款。",
      tutorialUrl: "https://docs.coingecko.com/",
      wiseBenefit: null,
      availability: {
        status: "restricted",
        description:
          "官网公开提供市场数据；API 端点、账户功能、调用额度、商业用途和第三方服务是否可用取决于所在地区、订阅方案、授权范围及最新条款。",
      },
      enabled: true,
      disclaimer:
        "CoinGecko 展示的是聚合信息，不是交易执行报价，也不构成投资建议。不同交易所的价格、流动性和时间戳可能不同；交易或开发使用前应核对原始市场、数据方法、更新频率和授权条件。",
      sources: [
        {
          id: "about-platform",
          label: "CoinGecko 官方平台介绍",
          url: "https://www.coingecko.com/en/about",
        },
        {
          id: "data-methodology",
          label: "CoinGecko 数据方法说明",
          url: "https://www.coingecko.com/en/methodology",
        },
        {
          id: "api-overview",
          label: "CoinGecko API 产品与覆盖范围",
          url: "https://www.coingecko.com/en/api",
        },
        {
          id: "api-pricing",
          label: "CoinGecko API 方案与定价",
          url: "https://www.coingecko.com/en/api/pricing",
        },
      ],
      lastVerifiedAt: "2026-08-31T00:00:00.000Z",
      termsUrl: "https://www.coingecko.com/en/terms",
      promotionStartsAt: null,
      promotionEndsAt: null,
      publicationStatus: "published",
      contentVersion: "phase6.2",
    },
  ],
} as const;
