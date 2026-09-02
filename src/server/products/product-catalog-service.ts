import "server-only";

import { productCatalogDraft } from "../../content/products";
import {
  parseProductCatalog,
  selectPublishedProductBySlug,
  selectPublishedProducts,
  type ResolvedProduct,
} from "../../lib/products/product-catalog";

export type ProductCatalogPayload = {
  publishedProducts: readonly ResolvedProduct[];
  /** All configured records currently withheld from public rendering. */
  unpublishedCount: number;
};

export type ProductCatalogClock = number | (() => number);

const productionCatalog = parseProductCatalog(productCatalogDraft);

export function loadProductCatalog(
  now: ProductCatalogClock = Date.now,
): ProductCatalogPayload {
  const publishedProducts = selectPublishedProducts(
    productionCatalog,
    readNow(now),
  );
  return {
    publishedProducts,
    unpublishedCount:
      productionCatalog.products.length - publishedProducts.length,
  };
}

export function listPublishedProducts(
  now: ProductCatalogClock = Date.now,
): readonly ResolvedProduct[] {
  return loadProductCatalog(now).publishedProducts;
}

export function getPublishedProductBySlug(
  slug: string,
  now: ProductCatalogClock = Date.now,
): ResolvedProduct | null {
  return selectPublishedProductBySlug(productionCatalog, slug, readNow(now));
}

export function listPublishedProductSlugs(
  now: ProductCatalogClock = Date.now,
): readonly string[] {
  return listPublishedProducts(now).map((product) => product.slug);
}

function readNow(now: ProductCatalogClock): number {
  const value = typeof now === "function" ? now() : now;
  if (!Number.isFinite(value)) {
    throw new Error("Product catalog clock must return a finite timestamp.");
  }
  return value;
}
