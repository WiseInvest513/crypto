import Link from "next/link";
import { SiteNav } from "./site-nav";

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

        <div className="header-context" aria-label="当前工作台">
          市场工作台
        </div>
      </div>
    </header>
  );
}
