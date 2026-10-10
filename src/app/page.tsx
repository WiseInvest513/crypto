import Link from "next/link";
import { createPageMetadata } from "@/lib/seo/page-metadata";
import styles from "./home-landing.module.css";

export const metadata = createPageMetadata({
  title: "看懂加密市场，再决定下一步",
  description:
    "Wise Crypto 把行情、风险工具、合约学习与开户福利，整理成一套清晰、可执行的加密市场工作台。",
  path: "/",
  socialTitle: "看懂加密市场，再决定下一步 | Wise Crypto",
  useSiteImage: true,
});

const capabilities = [
  {
    index: "01",
    title: "看懂市场",
    description: "观察 BTC 与 ETH 的趋势、均线与关键位置",
    href: "/btc",
    icon: MarketIcon,
  },
  {
    index: "02",
    title: "算清风险",
    description: "计算仓位、杠杆、盈亏比与定投计划",
    href: "/tools",
    icon: RiskIcon,
  },
  {
    index: "03",
    title: "学会合约",
    description: "用五章二十六关理解规则与风险",
    href: "/learn/futures-intro",
    icon: LearnIcon,
  },
  {
    index: "04",
    title: "找到入口",
    description: "选择交易所，了解返佣与 VIP 路径",
    href: "/exchanges",
    icon: PerkIcon,
  },
] as const;

const principles = [
  {
    index: "01",
    label: "真实数据",
    description: "缺失就明确显示不可用，不用虚构数字填满页面。",
  },
  {
    index: "02",
    label: "可解释判断",
    description: "把结论、依据与失效条件放在一起，方便你自己核对。",
  },
  {
    index: "03",
    label: "风险优先",
    description: "先理解规则、仓位与边界，再考虑是否采取行动。",
  },
] as const;

const productMap = [
  { label: "行情", value: "BTC · ETH", tone: "blue" },
  { label: "工具", value: "4 个计算器", tone: "violet" },
  { label: "学习", value: "5 章 · 26 关", tone: "cyan" },
  { label: "开户", value: "5 家平台", tone: "amber" },
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>WISE CRYPTO · 加密市场工作台</p>
              <h1 id="home-title">
                <span>看懂加密市场，</span>
                <span>再决定下一步。</span>
              </h1>
              <p>
                把行情、工具、学习与开户路径，整理成一套清晰、可执行的加密市场工作台。
              </p>
              <div className={styles.heroActions}>
                <Link
                  className={styles.primaryAction}
                  href="/btc"
                  prefetch={false}
                >
                  进入市场工作台
                  <ArrowRightIcon />
                </Link>
                <Link
                  className={styles.secondaryAction}
                  href="/learn/futures-intro"
                  prefetch={false}
                >
                  从合约入门开始
                  <ArrowRightIcon />
                </Link>
              </div>
            </div>

            <aside className={styles.productMap} aria-label="Wise Crypto 产品能力">
              <div className={styles.productMapHeader}>
                <span>工作台导航</span>
                <strong>从信息到行动</strong>
                <p>市场观察、风险检查、系统学习与开户路径，各自独立又彼此衔接。</p>
              </div>
              <dl className={styles.productMapGrid}>
                {productMap.map((item) => (
                  <div key={item.label} data-tone={item.tone}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <div className={styles.trustStrip} aria-label="Wise Crypto 产品原则概览">
          <p>
            <strong>为判断服务，不为热闹堆数据</strong>
            <span>每个入口只回答一类问题</span>
          </p>
          <ul>
            <li>
              <span aria-hidden="true" />数据有来源
            </li>
            <li>
              <span aria-hidden="true" />结论有依据
            </li>
            <li>
              <span aria-hidden="true" />风险有边界
            </li>
          </ul>
        </div>

        <section
          className={styles.capabilities}
          aria-labelledby="capabilities-title"
        >
          <div className={styles.sectionInner}>
            <header className={styles.capabilityHeading}>
              <div>
                <p className={styles.eyebrow}>四个清晰入口</p>
                <h2 id="capabilities-title">你需要的，不只是价格。</h2>
              </div>
              <p>从观察到行动，把复杂的加密市场拆成四条清晰路径。</p>
            </header>

            <nav aria-label="Wise Crypto 核心能力">
              <ol className={styles.capabilityList}>
                {capabilities.map((capability) => {
                  const Icon = capability.icon;

                  return (
                    <li key={capability.href}>
                      <Link
                        className={styles.capabilityLink}
                        href={capability.href}
                        prefetch={false}
                      >
                        <span
                          className={styles.capabilityIndex}
                          aria-hidden="true"
                        >
                          {capability.index}
                        </span>
                        <span
                          className={styles.capabilityIcon}
                          aria-hidden="true"
                        >
                          <Icon />
                        </span>
                        <strong>{capability.title}</strong>
                        <span className={styles.capabilityDescription}>
                          {capability.description}
                        </span>
                        <span
                          className={styles.capabilityArrow}
                          aria-hidden="true"
                        >
                          <ArrowRightIcon />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        </section>

        <section className={styles.manifesto} aria-labelledby="manifesto-title">
          <div className={styles.sectionInner}>
            <div className={styles.manifestoCopy}>
              <div>
                <p className={styles.eyebrow}>我们的工作方式</p>
                <h2 id="manifesto-title">
                  我们不替你预测，
                  <br />
                  只帮你看清。
                </h2>
                <p className={styles.manifestoLead}>
                  把数据、解释和风险边界放在同一个阅读路径里，让你知道自己看到的是什么，也知道它不能说明什么。
                </p>
                <Link
                  className={styles.primaryAction}
                  href="/btc"
                  prefetch={false}
                >
                  开始使用 Wise Crypto
                  <ArrowRightIcon />
                </Link>
              </div>
              <ul className={styles.principles} aria-label="Wise Crypto 产品原则">
                {principles.map((principle) => (
                  <li key={principle.label}>
                    <span aria-hidden="true">{principle.index}</span>
                    <div>
                      <strong>{principle.label}</strong>
                      <p>{principle.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.75 10h12.5m-4.5-4.5 4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M5 22V13m6 9V7m6 15V11m6 11V4" />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M14 3.5 23 7v6.6c0 5.2-3.2 9.3-9 11-5.8-1.7-9-5.8-9-11V7l9-3.5Z" />
      <path d="M10.5 14.2 13 16.7l5-5.2" />
    </svg>
  );
}

function LearnIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M4 5.5h6.2c2.1 0 3.8 1.7 3.8 3.8V24c0-2.1-1.7-3.8-3.8-3.8H4V5.5Z" />
      <path d="M24 5.5h-6.2c-2.1 0-3.8 1.7-3.8 3.8V24c0-2.1 1.7-3.8 3.8-3.8H24V5.5Z" />
    </svg>
  );
}

function PerkIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none">
      <path d="M4 11h20v13H4V11Zm-1-5.5h22V11H3V5.5ZM14 5.5V24" />
      <path d="M14 5.5H9.8A2.8 2.8 0 1 1 12.6 2c1.4 0 1.4 3.5 1.4 3.5Zm0 0h4.2A2.8 2.8 0 1 0 15.4 2C14 2 14 5.5 14 5.5Z" />
    </svg>
  );
}
