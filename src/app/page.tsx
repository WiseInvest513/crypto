import Image from "next/image";
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
    description: "观察 BTC 与 ETH 所处趋势、均线关系与关键位置。",
    proof: "BTC / ETH · K 线 · EMA · 关键区域",
    action: "进入市场分析",
    href: "/btc",
  },
  {
    index: "02",
    title: "算清风险",
    description: "在交易前，把仓位、杠杆和可能损失先算清楚。",
    proof: "仓位 · 风险回报 · 杠杆 · DCA",
    action: "使用风险工具",
    href: "/tools",
  },
  {
    index: "03",
    title: "学会合约",
    description: "从规则和杠杆开始，一步步建立自己的观察流程。",
    proof: "5 章 · 26 关 · 8 关快速路径",
    action: "开始系统学习",
    href: "/learn/futures-intro",
  },
  {
    index: "04",
    title: "找到入口",
    description: "核对平台教程、活动规则与 VIP 加入路径。",
    proof: "Binance · OKX · Bitget · Bybit · Gate",
    action: "查看交易所指南",
    href: "/exchanges",
  },
] as const;

const workflow = [
  {
    index: "01",
    label: "先观察",
    title: "确认市场位置",
    detail: "周期 · 均线 · 关键区域 · 机械结论",
  },
  {
    index: "02",
    label: "再计算",
    title: "限定风险边界",
    detail: "账户风险 · 仓位 · 杠杆 · 回报条件",
  },
  {
    index: "03",
    label: "补认知",
    title: "理解工具规则",
    detail: "合约规则 · K 线 · 指标 · 交易计划",
  },
  {
    index: "04",
    label: "再行动",
    title: "选择合适入口",
    detail: "平台教程 · 活动规则 · VIP 路径",
  },
] as const;

const principles = [
  {
    index: "01",
    label: "真实数据",
    description: "基于公开信息，缺失就明确显示不可用。",
  },
  {
    index: "02",
    label: "可解释判断",
    description: "给出逻辑与依据，而不只是抛出结论。",
  },
  {
    index: "03",
    label: "风险优先",
    description: "先理解风险边界，再谈任何行动。",
  },
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Wise Crypto 市场工作台</span>
              <h1 id="home-title">
                <span>看懂加密市场，</span>
                <span>再决定下一步。</span>
              </h1>
              <p>
                先判断 BTC 与 ETH 所处位置，再计算仓位与杠杆；需要时补齐合约规则，最后再选择交易入口。
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

            <figure className={styles.heroVisual} aria-hidden="true">
              <Image
                className={styles.heroArtwork}
                src="/home/crypto-network.png"
                alt=""
                width={1448}
                height={1086}
                sizes="(max-width: 900px) 92vw, (max-width: 1280px) 46vw, 620px"
                loading="eager"
              />
            </figure>
          </div>

          <nav className={styles.heroRail} aria-label="从当前问题开始">
            <ol>
              {capabilities.map((capability) => (
                <li key={capability.href}>
                  <Link href={capability.href} prefetch={false}>
                    <span aria-hidden="true">{capability.index}</span>
                    <div>
                      <strong>{capability.title}</strong>
                      <small>{capability.action}</small>
                    </div>
                    <ArrowRightIcon />
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        <section
          className={styles.capabilities}
          aria-labelledby="capabilities-title"
        >
          <div className={styles.capabilityLayout}>
            <header className={styles.capabilityHeading}>
              <span className={styles.sectionIndex}>01 / Core paths</span>
              <h2 id="capabilities-title">从问题出发，找到对应入口。</h2>
              <p>
                Wise Crypto 不把所有信息堆在一起。你现在需要看行情、算风险、补规则，还是找平台，都有独立入口。
              </p>
            </header>

            <nav aria-label="Wise Crypto 核心能力">
              <ol className={styles.capabilityList}>
                {capabilities.map((capability) => (
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
                      <span className={styles.capabilityMain}>
                        <strong>{capability.title}</strong>
                        <span>{capability.description}</span>
                      </span>
                      <span className={styles.capabilityProof}>
                        {capability.proof}
                      </span>
                      <span className={styles.capabilityArrow}>
                        <ArrowRightIcon />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className={styles.workflow} aria-label="Wise Crypto 使用流程">
            <div className={styles.workflowIntro}>
              <span>一条完整路径</span>
              <strong>不是替你做决定，而是把决定前的步骤排列清楚。</strong>
            </div>
            <ol>
              {workflow.map((step) => (
                <li key={step.index}>
                  <span aria-hidden="true">{step.index}</span>
                  <small>{step.label}</small>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.manifesto} aria-labelledby="manifesto-title">
          <div className={styles.manifestoCopy}>
            <div className={styles.manifestoStatement}>
              <span className={styles.sectionIndex}>02 / Product method</span>
              <h2 id="manifesto-title">
                我们不替你预测，
                <br />
                只帮你看清。
              </h2>
              <p>
                把数据、解释和风险边界放在同一个阅读路径里，让你知道自己看到的是什么，也知道它不能说明什么。
              </p>
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

          <div className={styles.boundaries} aria-label="Wise Crypto 使用边界">
            <strong>使用边界</strong>
            <span>不替用户下单</span>
            <span>机械观察不等于买卖建议</span>
            <span>计算结果只用于检查计划</span>
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
