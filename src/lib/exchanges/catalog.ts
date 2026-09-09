import {
  WISE_INVEST_CRYPTO_PERKS_URL,
  WISE_INVEST_EXCHANGE_REFERRAL_GUIDE_URL,
  WISE_INVEST_VIP_URL,
} from "@/config/site";

export type ExchangeOnboardingEntry = Readonly<{
  id: "binance" | "okx" | "bitget" | "bybit" | "gate";
  name: string;
  localName: string;
  logoSrc: string;
  fit: string;
  tutorialHref: string | null;
}>;

/**
 * This is a deliberately small link directory, not a copy of the main site's
 * tutorial or promotion database. Benefit details remain owned by Wise Invest.
 */
export const EXCHANGE_ONBOARDING_ENTRIES = [
  {
    id: "binance",
    name: "Binance",
    localName: "币安",
    logoSrc: "/exchanges/binance.jpeg",
    fit: "适合第一次完成注册、KYC、入金与基础交易的用户。",
    tutorialHref: "https://www.wise-invest.org/articles/crypto/GaM38JYk",
  },
  {
    id: "okx",
    name: "OKX",
    localName: "欧易",
    logoSrc: "/exchanges/okx.jpeg",
    fit: "适合希望集中了解入金、买币与日常现货操作的用户。",
    tutorialHref: "https://www.wise-invest.org/articles/crypto/mAPQm7WZ",
  },
  {
    id: "bitget",
    name: "Bitget",
    localName: "",
    logoSrc: "/exchanges/bitget.jpeg",
    fit: "适合希望继续了解跟单、衍生品与平台活动的用户。",
    tutorialHref: "https://www.wise-invest.org/articles/crypto/k3RVVcw4",
  },
  {
    id: "bybit",
    name: "Bybit",
    localName: "",
    logoSrc: "/exchanges/bybit.jpeg",
    fit: "适合希望系统了解衍生品、理财与基础交易流程的用户。",
    tutorialHref: "https://www.wise-invest.org/articles/crypto/e6utod7B",
  },
  {
    id: "gate",
    name: "Gate",
    localName: "",
    logoSrc: "/exchanges/gate.jpg",
    fit: "适合希望补充更多币种与平台选择的用户。",
    tutorialHref: null,
  },
] as const satisfies readonly ExchangeOnboardingEntry[];

export const EXCHANGE_ONBOARDING_LINKS = Object.freeze({
  benefits: `${WISE_INVEST_CRYPTO_PERKS_URL}#uex-exchange`,
  existingAccount: WISE_INVEST_EXCHANGE_REFERRAL_GUIDE_URL,
  vip: WISE_INVEST_VIP_URL,
});

export const EXCHANGE_BENEFIT_REVIEW = Object.freeze({
  label: "20%",
  reviewedOn: "2026-09-09",
  sourceLabel: "Wise Invest 主站当前展示",
});
