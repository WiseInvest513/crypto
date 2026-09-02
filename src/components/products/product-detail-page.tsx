import Image from "next/image";
import Link from "next/link";
import type { ResolvedProduct } from "@/lib/products/product-catalog";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/config/site";
import {
  formatProductVerifiedAt,
  getProductTypeLabel,
} from "@/lib/products/product-presentation";
import { ProductViewTracker } from "./product-view-tracker";
import { ReferralLink } from "./referral-link";
import { TutorialLink } from "./tutorial-link";

type ProductDetailPageProps = Readonly<{
  product: ResolvedProduct;
}>;

export function ProductDetailPage({ product }: ProductDetailPageProps) {
  const sourcePage = `/products/${product.slug}` as const;
  const verifiedAt = formatProductVerifiedAt(product.lastVerifiedAt);

  return (
    <div className="product-detail-page page-container">
      <BreadcrumbJsonLd
        origin={SITE_URL}
        items={[
          { name: "产品指南", path: "/products" },
          { name: product.name, path: sourcePage },
        ]}
      />
      <ProductViewTracker
        slug={product.slug}
        sourcePage={sourcePage}
        contentVersion={product.contentVersion}
      />

      <nav className="product-breadcrumb" aria-label="面包屑导航">
        <Link href="/products">产品指南</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <header className="product-detail-hero">
        <div className="product-detail-identity">
          <DetailProductMark product={product} />
          <div>
            <p className="page-kicker">
              {getProductTypeLabel(product.type)} · {product.partner.name}
            </p>
            <h1>{product.name}</h1>
            <p>{product.summary}</p>
            <div className="product-verified-line">
              <span className="status-badge status-badge--success">
                <span aria-hidden="true" />
                资料已核验
              </span>
              <span>
                最后核验：<time dateTime={product.lastVerifiedAt}>{verifiedAt}</time>
              </span>
            </div>
          </div>
        </div>

        <div className="product-detail-actions" aria-label="产品外部链接">
          {product.referralUrl !== null ? (
            <ReferralLink
              className="product-action product-action--primary"
              href={product.referralUrl}
              slug={product.slug}
              placement="product_detail"
              sourcePage={sourcePage}
              contentVersion={product.contentVersion}
            >
              访问合作方
            </ReferralLink>
          ) : null}
          {product.tutorialUrl !== null ? (
            <TutorialLink
              className="product-action product-action--secondary"
              href={product.tutorialUrl}
              slug={product.slug}
              sourcePage={sourcePage}
              contentVersion={product.contentVersion}
            >
              查看教程
            </TutorialLink>
          ) : null}
          <a
            className="product-official-link"
            href={product.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            官方网站<span className="sr-only">（在新标签页打开）</span>
          </a>
        </div>
      </header>

      {product.referralUrl !== null ? (
        <section className="product-referral-disclosure" aria-labelledby="referral-disclosure-title">
          <span className="product-referral-disclosure__mark" aria-hidden="true">i</span>
          <div>
            <h2 id="referral-disclosure-title">合作链接披露</h2>
            <p>
              “访问合作方”是 Referral 链接，Wise Crypto 可能因符合条件的操作获得收益。使用链接不会改变本页对优点、限制、费用与资格的客观展示。
            </p>
          </div>
        </section>
      ) : null}

      <div className="product-detail-layout">
        <div className="product-detail-main">
          <section className="product-detail-section product-panel" aria-labelledby="product-fit-title">
            <header className="panel-header">
              <div>
                <p className="panel-kicker">使用边界</p>
                <h2 id="product-fit-title">可能适合</h2>
              </div>
            </header>
            <p className="product-detail-section__lead">{product.bestFor}</p>
          </section>

          <section className="product-detail-section product-panel" aria-labelledby="product-balance-title">
            <header className="panel-header">
              <div>
                <p className="panel-kicker">客观对照</p>
                <h2 id="product-balance-title">Pros / Cons</h2>
              </div>
              <span className="section-context">不构成排名或推荐</span>
            </header>
            <div className="product-balance-grid">
              <section aria-labelledby="product-pros-title">
                <h3 id="product-pros-title">Pros · 已核验优点</h3>
                <ul>
                  {product.pros.map((pro) => (
                    <li key={pro}>{pro}</li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="product-cons-title">
                <h3 id="product-cons-title">Cons · 已核验限制</h3>
                <ul>
                  {product.cons.map((con) => (
                    <li key={con}>{con}</li>
                  ))}
                </ul>
              </section>
            </div>
          </section>

          <section className="product-detail-section product-panel" aria-labelledby="product-sources-title">
            <header className="panel-header">
              <div>
                <p className="panel-kicker">核验记录</p>
                <h2 id="product-sources-title">来源与条款</h2>
              </div>
              <time className="panel-date" dateTime={product.lastVerifiedAt}>
                {verifiedAt}
              </time>
            </header>
            <ul className="product-source-list">
              {product.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    <span>{source.label}</span>
                    <span aria-hidden="true">↗</span>
                    <span className="sr-only">（在新标签页打开）</span>
                  </a>
                </li>
              ))}
              <li>
                <a href={product.termsUrl} target="_blank" rel="noopener noreferrer">
                  <span>官方条款与条件</span>
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only">（在新标签页打开）</span>
                </a>
              </li>
            </ul>
          </section>
        </div>

        <aside className="product-detail-rail" aria-label="产品事实摘要">
          <section className="product-facts product-panel">
            <header className="panel-header">
              <div>
                <p className="panel-kicker">核验事实</p>
                <h2>
                  {product.wiseBenefit === null
                    ? "费用与可用范围"
                    : "费用、地区与权益"}
                </h2>
              </div>
            </header>
            <dl>
              <div>
                <dt>费用说明</dt>
                <dd>{product.feeDescription}</dd>
              </div>
              <div>
                <dt>可用范围</dt>
                <dd>
                  <strong>
                    {product.availability.status === "available"
                      ? "已核验可用范围"
                      : "存在地区或资格限制"}
                  </strong>
                  {product.availability.description}
                </dd>
              </div>
              {product.referralUrl === null ? (
                <div>
                  <dt>合作披露</dt>
                  <dd>
                    <strong>无推广链接</strong>
                    本页的产品外链仅指向官方资料，未配置 Referral URL 或邀请码。
                  </dd>
                </div>
              ) : null}
              {product.wiseBenefit !== null ? (
                <div>
                  <dt>Wise Benefit</dt>
                  <dd>{product.wiseBenefit}</dd>
                </div>
              ) : null}
              {product.referralCode !== null ? (
                <div>
                  <dt>Referral Code</dt>
                  <dd><code>{product.referralCode}</code></dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="product-disclaimer product-panel" aria-labelledby="product-disclaimer-title">
            <p className="panel-kicker">重要说明</p>
            <h2 id="product-disclaimer-title">使用前请核对最新条款</h2>
            <p>{product.disclaimer}</p>
            <p>
              本页资料截至上述核验日期。费用、资格、地区限制与活动条款可能改变，请以产品官方页面为准。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DetailProductMark({ product }: { product: ResolvedProduct }) {
  if (product.logo !== null) {
    return (
      <span className="product-detail-mark product-detail-mark--image">
        <Image
          src={product.logo.src}
          alt=""
          width={72}
          height={72}
          loading="eager"
        />
      </span>
    );
  }

  return (
    <span className="product-detail-mark" aria-hidden="true">
      {product.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
