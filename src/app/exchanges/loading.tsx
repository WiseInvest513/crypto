export default function ExchangesLoading() {
  return (
    <div className="exchange-loading page-container" aria-label="正在加载开户福利">
      <div className="exchange-loading__hero" />
      <div className="exchange-loading__cards">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
