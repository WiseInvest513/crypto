import type { Metadata } from "next";
import { ProductDirectory } from "@/components/products/product-directory";
import { loadProductCatalog } from "@/server/products/product-catalog-service";
import { createPageMetadata } from "@/lib/seo/page-metadata";

export const revalidate = 300;

export const metadata: Metadata = createPageMetadata({
  title: "加密产品",
  description:
    "客观的 Wise Crypto 产品指南，平衡展示优缺点、可用地区、费用与披露信息。",
  path: "/products",
  socialTitle: "加密产品指南",
  useSiteImage: true,
});

export default function ProductsPage() {
  const { publishedProducts, unpublishedCount } = loadProductCatalog();

  return (
    <ProductDirectory
      products={publishedProducts}
      unpublishedCount={unpublishedCount}
    />
  );
}
