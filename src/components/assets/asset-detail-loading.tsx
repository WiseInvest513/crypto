export function AssetDetailLoading({
  symbol,
  name,
}: {
  symbol: "BTC" | "ETH";
  name: string;
}) {
  return (
    <div
      className="asset-detail-page asset-detail-page--focus page-container"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="asset-detail-loading" aria-hidden="true">
        <section className="asset-detail-loading__market">
          <div className="asset-detail-loading__identity">
            <div className="asset-detail-loading__switcher">
              <span data-current={symbol === "BTC"}>BTC</span>
              <span data-current={symbol === "ETH"}>ETH</span>
            </div>
            <div className="asset-detail-loading__title">
              <span
                className={`asset-mark ${symbol === "BTC" ? "asset-mark--bitcoin" : "asset-mark--ethereum"}`}
              >
                {symbol.slice(0, 1)}
              </span>
              <div>
                <small>资产工作台</small>
                <h1>
                  {symbol} <span>{name}</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="asset-detail-loading__quote">
            <div>
              <span className="skeleton-line skeleton-line--price" />
              <span className="skeleton-line skeleton-line--label" />
            </div>
            <div className="asset-detail-loading__changes">
              <span className="skeleton-line skeleton-line--label" />
              <span className="skeleton-line skeleton-line--label" />
            </div>
          </div>
        </section>

        <section className="asset-detail-loading__terminal">
          <div className="asset-detail-loading__controls">
            <div className="asset-detail-loading__control-group">
              <span className="skeleton-line skeleton-line--label" />
              <div>
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="asset-detail-loading__control" key={index} />
                ))}
              </div>
            </div>
            <div className="asset-detail-loading__control-group asset-detail-loading__control-group--view">
              <span className="skeleton-line skeleton-line--label" />
              <div>
                {Array.from({ length: 3 }, (_, index) => (
                  <span className="asset-detail-loading__control" key={index} />
                ))}
              </div>
            </div>
            <span className="asset-detail-loading__settings" />
          </div>

          <div className="asset-detail-loading__stage">
            <div className="asset-detail-loading__chart">
              <div className="asset-detail-loading__legend">
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="skeleton-line skeleton-line--label" key={index} />
                ))}
              </div>
              <div className="asset-detail-loading__canvas">
                <div className="asset-detail-loading__ohlc">
                  <span className="skeleton-line skeleton-line--label" />
                  <span className="skeleton-line skeleton-line--value" />
                </div>
              </div>
            </div>

            <aside className="asset-detail-loading__analysis">
              <span className="skeleton-line skeleton-line--label" />
              <span className="skeleton-line skeleton-line--value" />
              <span className="skeleton-line skeleton-line--meta" />
              <div className="asset-detail-loading__analysis-facts">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index}>
                    <span className="skeleton-line skeleton-line--label" />
                    <span className="skeleton-line skeleton-line--value" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
      <span className="sr-only">
        {symbol} {name} 行情、K 线与分析正在加载。
      </span>
    </div>
  );
}
