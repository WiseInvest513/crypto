export default function Loading() {
  return (
    <div className="loading-page page-container" role="status" aria-live="polite">
      <p className="loading-page__label">页面加载中</p>
      <div aria-hidden="true">
        <div className="loading-page__line loading-page__line--title" />
        <div className="loading-page__line" />
        <div className="loading-page__line loading-page__line--short" />
      </div>
      <span className="sr-only">Wise Crypto 正在加载此页面。</span>
    </div>
  );
}
