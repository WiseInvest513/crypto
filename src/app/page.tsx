import Link from "next/link";
import { SignalNetwork } from "@/components/home/signal-network";
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
  { index: "01", label: "真实数据" },
  { index: "02", label: "可解释判断" },
  { index: "03", label: "风险优先" },
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <SignalNetwork className={styles.signalNetwork} />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
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
        </div>
      </section>

      <section
        className={styles.capabilities}
        aria-labelledby="capabilities-title"
      >
        <div className={styles.sectionInner}>
          <header className={styles.capabilityHeading}>
            <h2 id="capabilities-title">你需要的，不只是价格。</h2>
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
                      <span className={styles.capabilityIndex} aria-hidden="true">
                        {capability.index}
                      </span>
                      <span className={styles.capabilityNode} aria-hidden="true" />
                      <span className={styles.capabilityIcon} aria-hidden="true">
                        <Icon />
                      </span>
                      <strong>{capability.title}</strong>
                      <span className={styles.capabilityDescription}>
                        {capability.description}
                      </span>
                      <span className={styles.capabilityArrow} aria-hidden="true">
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
        <ConvergenceGraphic />
        <div className={styles.sectionInner}>
          <div className={styles.manifestoCopy}>
            <h2 id="manifesto-title">我们不替你预测，只帮你看清。</h2>
            <ul className={styles.principles} aria-label="Wise Crypto 产品原则">
              {principles.map((principle) => (
                <li key={principle.label}>
                  <span aria-hidden="true">{principle.index}</span>
                  <strong>{principle.label}</strong>
                </li>
              ))}
            </ul>
            <Link
              className={styles.primaryAction}
              href="/btc"
              prefetch={false}
            >
              开始使用 Wise Crypto
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>
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

function ConvergenceGraphic() {
  const paths = [
    "M0 42C132 42 164 168 304 168s172-118 318-118 170 180 334 180",
    "M0 106c154 0 190 92 322 92S514 88 646 88s160 94 310 94",
    "M0 172c144 0 188-52 310-52s196 144 332 144 170-92 314-92",
    "M0 236c126 0 176-92 302-92s198 34 334 34 182 58 320 58",
  ];

  return (
    <svg
      className={styles.convergenceGraphic}
      viewBox="0 0 960 310"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="convergence-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="#4d78ff" stopOpacity="0" />
          <stop offset="0.58" stopColor="#4d78ff" stopOpacity="0.42" />
          <stop offset="0.88" stopColor="#5ce1e6" stopOpacity="0.8" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="convergence-node">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.3" stopColor="#5ce1e6" />
          <stop offset="1" stopColor="#4d78ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="url(#convergence-gradient)" strokeWidth="1">
        {paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
      <circle cx="930" cy="201" r="72" fill="url(#convergence-node)" opacity="0.38" />
      <circle cx="930" cy="201" r="3.5" fill="currentColor" />
    </svg>
  );
}
