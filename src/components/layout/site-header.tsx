import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";
import { WISE_INVEST_SITE_URL } from "@/config/site";
import { getWiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-container site-header__inner">
        <Link className="wordmark" href="/" aria-label="Wise Crypto 首页">
          <span className="wordmark__mark" aria-hidden="true">
            W
          </span>
          <span className="wordmark__text">
            <strong>Wise</strong>
            <span>Crypto</span>
          </span>
        </Link>

        <SiteNav />

        <div className="site-header__actions">
          <a
            className="site-header__main-site-link"
            href={WISE_INVEST_SITE_URL}
            aria-label="回到 Wise Invest 主站"
            title="回到 Wise Invest 主站"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3.5 9.2 10 3.8l6.5 5.4" />
              <path d="M5.3 8.4v7.5h9.4V8.4M8.1 15.9v-4.8h3.8v4.8" />
            </svg>
            <span>回到主站</span>
          </a>
          <ThemeToggle />
          <AccountMenu configurationStatus={getWiseAuthConfigurationStatus()} />
        </div>
      </div>
    </header>
  );
}
