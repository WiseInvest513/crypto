export function AssetDetailLoading({
  symbol,
  name,
}: {
  symbol: "BTC" | "ETH";
  name: string;
}) {
  return (
    <div
      className="asset-detail-page page-container"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <section className="asset-detail-header">
        <div className="asset-detail-header__identity">
          <span
            className={`asset-mark ${symbol === "BTC" ? "asset-mark--bitcoin" : "asset-mark--ethereum"}`}
            aria-hidden="true"
          >
            {symbol.slice(0, 1)}
          </span>
          <div>
            <p className="page-kicker">资产工作台 · {symbol}</p>
            <h1>{name}</h1>
          </div>
        </div>
        <span className="status-badge status-badge--neutral">
          <span aria-hidden="true" />加载中
        </span>
      </section>

      <div className="asset-workbench asset-workbench--loading" aria-hidden="true">
        <div className="asset-workbench__chart">
          <span className="skeleton-line skeleton-line--label" />
          <span className="asset-chart-skeleton" />
        </div>
        <div className="asset-workbench__rail">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="asset-rail-skeleton" key={index}>
              <span className="skeleton-line skeleton-line--label" />
              <span className="skeleton-line skeleton-line--value" />
            </div>
          ))}
        </div>
      </div>

      <div className="asset-facts-grid asset-facts-grid--loading" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span className="asset-fact-skeleton" key={index} />
        ))}
      </div>
      <span className="sr-only">{symbol} 资产工作台正在加载。</span>
    </div>
  );
}
