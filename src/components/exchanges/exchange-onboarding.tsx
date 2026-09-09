import Image from "next/image";
import {
  EXCHANGE_BENEFIT_REVIEW,
  EXCHANGE_ONBOARDING_ENTRIES,
  EXCHANGE_ONBOARDING_LINKS,
  type ExchangeOnboardingEntry,
} from "@/lib/exchanges/catalog";

const externalLinkRel = "noopener noreferrer";
const sponsoredLinkRel = "sponsored noopener noreferrer";

export function ExchangeOnboarding() {
  return (
    <main className="exchange-page page-container">
      <section className="exchange-hero" aria-labelledby="exchange-page-title">
        <div className="exchange-hero__copy">
          <p className="exchange-eyebrow">Wise Crypto · 开户福利</p>
          <h1 id="exchange-page-title">
            <span className="exchange-hero__title-lead">
              选好交易所<span className="exchange-hero__title-punctuation">，</span>
            </span>
            <span className="exchange-hero__title-benefit">
              获取 <strong>{EXCHANGE_BENEFIT_REVIEW.label}</strong> 交易返佣
            </span>
          </h1>
          <p className="exchange-hero__lede">
            这里不复制教程。先选择平台，再前往 Wise Invest
            查看完整开户注册步骤、最新活动与资格说明。
          </p>
          <div className="exchange-hero__actions">
            <a className="exchange-button exchange-button--primary" href="#exchange-options">
              选择交易所
              <ArrowIcon />
            </a>
            <a
              className="exchange-button exchange-button--quiet"
              href={EXCHANGE_ONBOARDING_LINKS.vip}
              rel={externalLinkRel}
              target="_blank"
            >
              查看如何加入 VIP
              <ExternalIcon />
            </a>
          </div>
        </div>

        <aside className="exchange-benefit" aria-label="当前开户福利摘要">
          <span>
            {EXCHANGE_BENEFIT_REVIEW.sourceLabel} · 核对日期{" "}
            <time dateTime={EXCHANGE_BENEFIT_REVIEW.reviewedOn}>
              {EXCHANGE_BENEFIT_REVIEW.reviewedOn}
            </time>
          </span>
          <strong>{EXCHANGE_BENEFIT_REVIEW.label}</strong>
          <h2>交易手续费返佣</h2>
          <dl>
            <div>
              <dt>可选平台</dt>
              <dd>5 家</dd>
            </div>
            <div>
              <dt>VIP 路径</dt>
              <dd>UID 人工核验</dd>
            </div>
          </dl>
          <p>
            具体比例、适用账户和活动有效性，以点击后主站与交易所页面的最新说明为准。
          </p>
        </aside>
      </section>

      <section className="exchange-options" id="exchange-options" aria-labelledby="exchange-options-title">
        <header className="exchange-section-heading">
          <div>
            <p className="exchange-eyebrow">五家交易所</p>
            <h2 id="exchange-options-title">一处选择，回主站完成学习与注册</h2>
          </div>
          <p>只提供 Binance、OKX、Bitget、Bybit 与 Gate。</p>
        </header>

        <div className="exchange-card-grid">
          {EXCHANGE_ONBOARDING_ENTRIES.map((entry, index) => (
            <ExchangeCard entry={entry} index={index} key={entry.id} />
          ))}
        </div>
      </section>

      <section className="exchange-journey" aria-labelledby="exchange-journey-title">
        <header className="exchange-journey__heading">
          <p className="exchange-eyebrow">开户注册路径</p>
          <h2 id="exchange-journey-title">教程、返佣与 VIP 是同一条路径</h2>
          <p>
            Crypto 负责把入口放到高频位置；主站继续维护教程、注册链接与审核说明。
          </p>
        </header>

        <ol className="exchange-steps">
          <JourneyStep number="01" title="先看教程">
            到主站确认注册地区、KYC、安全设置与入金准备。
          </JourneyStep>
          <JourneyStep number="02" title="使用 Wise 入口">
            从主站当前开户链接进入，保留可核验的邀请关系。
          </JourneyStep>
          <JourneyStep number="03" title="记录账户 UID">
            完成注册后保存平台 UID；不要提交密码、验证码或 API Secret。
          </JourneyStep>
          <JourneyStep number="04" title="申请 Wise VIP">
            按主站说明提交 UID，经过人工核验后确认会员资格。
          </JourneyStep>
        </ol>

        <div className="exchange-journey__actions">
          <a
            className="exchange-button exchange-button--primary"
            href={EXCHANGE_ONBOARDING_LINKS.benefits}
            rel={sponsoredLinkRel}
            target="_blank"
          >
            查看当前开户链接
            <ExternalIcon />
          </a>
          <a
            className="exchange-button exchange-button--quiet"
            href={EXCHANGE_ONBOARDING_LINKS.existingAccount}
            rel={externalLinkRel}
            target="_blank"
          >
            已有账户：查看补绑说明
            <ExternalIcon />
          </a>
        </div>
      </section>

      <section className="exchange-vip-bridge" aria-labelledby="exchange-vip-title">
        <div>
          <p className="exchange-eyebrow">Wise VIP</p>
          <h2 id="exchange-vip-title">返佣是开户权益，VIP 需要单独核验</h2>
          <p>
            使用开户链接不会自动成为 VIP。主站会说明支持的平台、UID
            提交方式与人工审核流程。
          </p>
        </div>
        <a
          className="exchange-button exchange-button--light"
          href={EXCHANGE_ONBOARDING_LINKS.vip}
          rel={externalLinkRel}
          target="_blank"
        >
          了解 Wise VIP
          <ExternalIcon />
        </a>
      </section>

      <p className="exchange-disclosure">
        开户链接可能包含 Wise 的邀请关系。活动、费率、地区限制及返佣规则可能变化；请在提交资料前核对主站与交易所页面。加密资产交易存在本金损失风险。
      </p>
    </main>
  );
}

function ExchangeCard({
  entry,
  index,
}: {
  entry: ExchangeOnboardingEntry;
  index: number;
}) {
  const tutorialHref = entry.tutorialHref ?? EXCHANGE_ONBOARDING_LINKS.benefits;
  const tutorialLabel = entry.tutorialHref ? "阅读主站教程" : "查看 Gate 当前入口";

  return (
    <article className="exchange-card">
      <div className="exchange-card__topline">
        <span className="exchange-card__logo" aria-hidden="true">
          <Image
            alt=""
            height={56}
            src={entry.logoSrc}
            width={56}
          />
        </span>
        <span className="exchange-card__index">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="exchange-card__identity">
        <h3>{entry.name}</h3>
        {entry.localName ? <span>{entry.localName}</span> : null}
      </div>
      <p className="exchange-card__fit">{entry.fit}</p>
      <div className="exchange-card__benefit">
        <span>{EXCHANGE_BENEFIT_REVIEW.sourceLabel}</span>
        <strong>{EXCHANGE_BENEFIT_REVIEW.label}</strong>
        <small>返佣</small>
      </div>
      <div className="exchange-card__actions">
        <a href={tutorialHref} rel={externalLinkRel} target="_blank">
          {tutorialLabel}
          <ExternalIcon />
        </a>
        <a
          href={EXCHANGE_ONBOARDING_LINKS.benefits}
          rel={sponsoredLinkRel}
          target="_blank"
        >
          核对当前权益
          <ArrowIcon />
        </a>
      </div>
      {!entry.tutorialHref ? (
        <p className="exchange-card__status">独立 CEX 教程整理中，暂由福利页承接。</p>
      ) : null}
    </article>
  );
}

function JourneyStep({
  children,
  number,
  title,
}: {
  children: React.ReactNode;
  number: string;
  title: string;
}) {
  return (
    <li>
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </li>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 5H5v10h10v-3M10 4h6v6M9 11l7-7" />
    </svg>
  );
}
