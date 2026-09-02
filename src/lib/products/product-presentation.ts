import type { ProductType } from "./product-catalog";

const productTypeLabels = {
  exchange: "交易平台",
  wallet: "钱包",
  data: "数据工具",
  security: "安全工具",
  tax: "税务工具",
  other: "其他产品",
} satisfies Record<ProductType, string>;

export function getProductTypeLabel(type: ProductType): string {
  return productTypeLabels[type];
}

export function formatProductVerifiedAt(value: string): string {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}年${month}月${day}日 UTC`;
}
