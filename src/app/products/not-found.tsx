import type { Metadata } from "next";
import Link from "next/link";
import { createNotFoundMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = createNotFoundMetadata();

export default function ProductNotFound() {
  return (
    <div className="state-page page-container">
      <section className="state-panel" aria-labelledby="product-not-found-title">
        <p className="page-kicker">产品指南</p>
        <h1 id="product-not-found-title">这份产品资料暂不可用</h1>
        <p>
          该产品不存在、尚未完成事实核验，或相关合作与条款已经失效。未发布内容不会对外展示。
        </p>
        <div className="state-actions">
          <Link className="state-link" href="/products">
            返回产品目录
          </Link>
          <Link className="state-link state-link--secondary" href="/">
            返回市场总览
          </Link>
        </div>
      </section>
    </div>
  );
}
