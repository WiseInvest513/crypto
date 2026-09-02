import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/components/products/product-detail-page";
import {
  getPublishedProductBySlug,
  listPublishedProductSlugs,
} from "@/server/products/product-catalog-service";
import {
  createNotFoundMetadata,
  createPageMetadata,
} from "@/lib/seo/page-metadata";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return listPublishedProductSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getPublishedProductBySlug(slug);

  if (product === null) {
    return createNotFoundMetadata();
  }

  return createPageMetadata({
    title: product.name,
    description: product.summary,
    path: `/products/${product.slug}`,
    socialTitle: `${product.name} 产品指南`,
  });
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = getPublishedProductBySlug(slug);

  if (product === null) {
    notFound();
  }

  return <ProductDetailPage product={product} />;
}
