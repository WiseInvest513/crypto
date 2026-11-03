import Link from "next/link";
import { CryptoWordmark } from "./crypto-wordmark";
import { navigation } from "./navigation";
import s from "./network-footer.module.css";

const links = navigation.map(({ label, href }) => [label, href] as const);
const socials = [
  [
    "home",
    "Wise 主站",
    "https://www.wise-invest.org/"
  ],
  [
    "x",
    "Twitter / X",
    "https://x.com/WiseInvest513"
  ],
  [
    "youtube",
    "YouTube",
    "https://www.youtube.com/@WiseInvest513"
  ],
  [
    "book",
    "小红书",
    "https://www.xiaohongshu.com/user/profile/6373a8ba0000000024014988"
  ]
] as const;

type FooterIconName = "home" | "x" | "youtube" | "book";
function FooterIcon({name}: {name: FooterIconName}) {
  return <svg className={s.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" && <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z"/></>}
    {name === "x" && <><path d="M4 3h4l12 18h-4L4 3Zm16 0L4 21"/></>}
    {name === "youtube" && <><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/></>}
    {name === "book" && <><path d="M5 3h12a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-1 15a3 3 0 0 1 3-3h12M8 7h7M8 11h5"/></>}
  </svg>;
}

export function SiteFooter() {
  return (
    <footer className={s.footer} data-wise-footer="crypto">
      <div className={s.inner}>
        <div className={s.intro}>
          <Link href="/" className={s.brand} aria-label="CRYPTO 首页">
            <CryptoWordmark />
          </Link>
          <p className={s.description}>看清价格位置，理解关键变化，做好交易前的风险评估。</p>
          <p className={s.note}>提供市场数据、研究工具与教育内容，不提供个性化投资建议。加密资产价格波动剧烈，可能导致本金损失；数据也可能存在延迟。</p>

        </div>
        <div role="navigation" aria-label="本站功能导航">
          <h2 className={s.heading}>功能导航</h2>
          <ul className={s.links}>{links.map(([label, href]) => <li key={href}><Link href={href} prefetch={false} className={s.link}>{label}</Link></li>)}</ul>
        </div>
        <div role="navigation" aria-label="关注 Wise">
          <h2 className={s.heading}>关注 Wise</h2>
          <ul className={s.links}>{socials.map(([icon, label, href]) => <li key={href}>
            <a href={href} className={s.link} target="_blank" rel="noopener noreferrer">
              <FooterIcon name={icon} /><span>{label}</span>
              <svg className={s.arrow} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" /></svg>
            </a>
          </li>)}</ul>
        </div>
      </div>
      <div className={s.bottom}>
        <p className={s.copyright}>© {new Date().getFullYear()} Wise-CRYPTO · 加密市场与风险工具</p>
        <p className={s.disclaimer}>内容仅供参考，不构成任何投资建议。</p>
      </div>
    </footer>
  );
}
