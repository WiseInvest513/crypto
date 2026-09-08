import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";
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
          <ThemeToggle />
          <AccountMenu configurationStatus={getWiseAuthConfigurationStatus()} />
        </div>
      </div>
    </header>
  );
}
