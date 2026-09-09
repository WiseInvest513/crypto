import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";
import { WISE_INVEST_VIP_URL } from "@/config/site";
import { getWiseAuthConfigurationStatus } from "@/server/auth/wise-auth-config";
import { isWiseLocalDevelopmentRequest } from "@/server/auth/wise-local-development";

export async function SiteHeader() {
  const configurationStatus = (await isWiseLocalDevelopmentRequest())
    ? "ready"
    : getWiseAuthConfigurationStatus();

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
            href={WISE_INVEST_VIP_URL}
            aria-label="了解如何加入 Wise VIP"
            title="加入 Wise VIP"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m10 3 1.8 4.2L16 9l-4.2 1.8L10 15l-1.8-4.2L4 9l4.2-1.8L10 3Z" />
            </svg>
            <span>加入 VIP</span>
          </a>
          <ThemeToggle />
          <AccountMenu configurationStatus={configurationStatus} />
        </div>
      </div>
    </header>
  );
}
