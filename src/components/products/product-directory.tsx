import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ResolvedProduct } from "@/lib/products/product-catalog";
import { getProductTypeLabel } from "@/lib/products/product-presentation";

type ProductDirectoryProps = Readonly<{
  products: readonly ResolvedProduct[];
  unpublishedCount: number;
}>;

const reviewPrinciples = [
  {
    index: "01",
    title: "事实有来源",
    description: "名称、费用、资格和权益必须能够回到官方页面或条款。",
  },
  {
    index: "02",
    title: "边界写清楚",
    description: "可用地区、限制条件与最后核验日期会和结论一起展示。",
  },
  {
    index: "03",
    title: "同时写优缺点",
    description: "不做排行榜，也不会把合作关系包装成产品推荐。",
  },
  {
    index: "04",
    title: "合作可识别",
    description: "Referral 链接会在跳转前明确披露，普通官网链接保持独立。",
  },
] as const;

export function ProductDirectory({
  products,
  unpublishedCount,
}: ProductDirectoryProps) {
  const referralCount = products.filter(
    (product) => product.referralUrl !== null,
  ).length;
  const typeCount = new Set(products.map((product) => product.type)).size;

  return (
    <div className="products-page page-container">
      <header className="products-hero">
        <div className="products-hero__copy">
          <p className="page-kicker">产品与合作披露</p>
          <h1>加密产品指南</h1>
          <p>
            把产品事实、适用场景、限制和合作关系放在同一张桌面上。目录只发布完成来源核验的内容，不用未经确认的优惠填充页面。
          </p>
        </div>
        <dl className="products-summary" aria-label="产品目录摘要">
          <div>
            <dt>已发布</dt>
            <dd>{products.length}</dd>
          </div>
          <div>
            <dt>覆盖类型</dt>
            <dd>{typeCount}</dd>
          </div>
          <div>
            <dt>推广链接</dt>
            <dd>{referralCount === 0 ? "未启用" : `${referralCount} 个`}</dd>
          </div>
        </dl>
      </header>

      <section className="products-workspace" aria-labelledby="product-catalog-title">
        <div className="product-directory product-panel">
          <header className="section-bar">
            <div>
              <p className="panel-kicker">审核目录</p>
              <h2 id="product-catalog-title">已核验产品</h2>
            </div>
            <span className="section-context">
              按类型整理 · 不代表排名
              {unpublishedCount > 0 ? ` · ${unpublishedCount} 个待核验` : ""}
            </span>
          </header>

          {products.length === 0 ? (
            <div className="product-empty-state">
              <span className="status-badge status-badge--neutral">
                <span aria-hidden="true" />
                待核验 · unpublished
              </span>
              <h3>暂无可用的产品指南</h3>
              <p>
                目前没有同时完成费用、资格、可用地区、条款与合作披露核验的真实产品资料。目录会保持为空，不展示示例优惠或虚构权益。
              </p>
              <ul aria-label="发布前必须核验的内容">
                <li>官方事实来源</li>
                <li>费用与资格边界</li>
                <li>客观 Pros / Cons</li>
                <li>Referral 与免责声明</li>
              </ul>
            </div>
          ) : (
            <ul className="product-directory__grid">
              {products.map((product) => (
                <li key={product.id}>
                  <article className="product-card">
                    <div className="product-card__topline">
                      <ProductMark product={product} />
                      <span className="product-type-label">
                        {getProductTypeLabel(product.type)}
                      </span>
                    </div>
                    <div className="product-card__body">
                      <h3>
                        <Link href={`/products/${product.slug}` as Route}>
                          {product.name}
                        </Link>
                      </h3>
                      <p>{product.summary}</p>
                    </div>
                    <dl className="product-card__facts">
                      <div>
                        <dt>可能适合</dt>
                        <dd>{product.bestFor}</dd>
                      </div>
                      <div>
                        <dt>已核验特点</dt>
                        <dd>{product.pros[0]}</dd>
                      </div>
                      <div>
                        <dt>需注意</dt>
                        <dd>{product.cons[0]}</dd>
                      </div>
                    </dl>
                    <div className="product-card__footer">
                      <span>
                        核验 <time dateTime={product.lastVerifiedAt}>
                          {product.lastVerifiedAt.slice(0, 10)}
                        </time>
                        {" · "}
                        {product.referralUrl === null
                          ? "无推广链接"
                          : "含已披露合作链接"}
                      </span>
                      <span aria-hidden="true">查看详情 →</span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="product-review-standard product-panel" aria-labelledby="review-standard-title">
          <header className="panel-header">
            <div>
              <p className="panel-kicker">发布门槛</p>
              <h2 id="review-standard-title">不是广告榜单</h2>
            </div>
          </header>
          <ol>
            {reviewPrinciples.map((principle) => (
              <li key={principle.index}>
                <span aria-hidden="true">{principle.index}</span>
                <div>
                  <strong>{principle.title}</strong>
                  <p>{principle.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="products-disclosure" aria-labelledby="products-disclosure-title">
        <div>
          <p className="panel-kicker">合作原则</p>
          <h2 id="products-disclosure-title">商业关系不改变事实标准</h2>
        </div>
        <p>
          部分未来产品可能包含 Referral 链接，Wise Crypto 可能因此获得收益。链接会被明确标记；是否存在合作关系不会改变 Pros、Cons、费用和可用范围的核验要求。
        </p>
      </section>
    </div>
  );
}

function ProductMark({ product }: { product: ResolvedProduct }) {
  if (product.logo !== null) {
    return (
      <span className="product-mark product-mark--image">
        <Image
          src={product.logo.src}
          alt=""
          width={44}
          height={44}
        />
      </span>
    );
  }

  return (
    <span className="product-mark" aria-hidden="true">
      {product.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
