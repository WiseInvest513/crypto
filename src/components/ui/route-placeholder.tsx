import Link from "next/link";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTitle: string;
  statusDescription: string;
  coverageLabel: string;
  coverage: readonly string[];
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTitle,
  statusDescription,
  coverageLabel,
  coverage,
}: RoutePlaceholderProps) {
  return (
    <div className="route-page page-container">
      <section className="route-heading" aria-labelledby="route-title">
        <div>
          <p className="page-kicker">{eyebrow}</p>
          <h1 id="route-title">{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <div className="route-workspace">
        <section className="product-panel route-coverage" aria-labelledby="coverage-title">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">工作台</p>
              <h2 id="coverage-title">{coverageLabel}</h2>
            </div>
            <span className="panel-count">{coverage.length} 个模块</span>
          </header>
          <ul>
            {coverage.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className="availability-label">暂不可用</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="product-panel route-availability" aria-label="页面可用状态">
          <span className="status-badge status-badge--neutral">
            <span aria-hidden="true" />
            {statusLabel}
          </span>
          <strong>{statusTitle}</strong>
          <p>{statusDescription}</p>
        </aside>
      </div>

      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 返回市场总览
      </Link>
    </div>
  );
}
