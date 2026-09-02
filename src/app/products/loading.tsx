export default function ProductsLoading() {
  return (
    <div
      className="products-loading page-container"
      aria-busy="true"
      aria-label="正在加载产品目录"
      role="status"
    >
      <span className="loading-page__label">正在核对产品目录</span>
      <div className="loading-page__line loading-page__line--title" />
      <div className="loading-page__line" />
      <div className="products-loading__grid" aria-hidden="true">
        <div />
        <div />
      </div>
    </div>
  );
}
