import Link from "next/link";

const footerLinks = [
  { href: "/btc", label: "比特币" },
  { href: "/eth", label: "以太坊" },
  { href: "/tools", label: "工具" },
  { href: "/products", label: "产品" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div>
          <Link className="footer-wordmark" href="/">
            Wise Crypto
          </Link>
          <p className="site-footer__mission">
            清晰的市场背景，透明的数据来源，更踏实的判断依据。
          </p>
        </div>

        <nav className="footer-nav" aria-label="页脚导航">
          {footerLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="site-footer__disclaimer">
          Wise Crypto 提供市场数据、研究工具与教育内容，不提供个性化投资建议。
          加密资产价格波动剧烈，可能导致本金损失；数据也可能存在延迟。
        </p>
      </div>
      <div className="page-container site-footer__legal">
        <span>© {new Date().getUTCFullYear()} Wise Crypto</span>
        <span>Wise Invest 旗下产品</span>
      </div>
    </footer>
  );
}
