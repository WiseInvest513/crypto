import type { Metadata } from "next";
import Link from "next/link";
import { createNotFoundMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = createNotFoundMetadata();

export default function NotFound() {
  return (
    <div className="state-page page-container">
      <section className="state-panel" aria-labelledby="not-found-title">
        <p className="eyebrow">404 / 页面未找到</p>
        <h1 id="not-found-title">这个页面不在地图上</h1>
        <p>页面可能已移动，或地址有误。</p>
        <div className="state-actions">
          <Link className="state-link" href="/">
            返回市场总览
          </Link>
          <Link className="state-link state-link--secondary" href="/tools">
            浏览工具
          </Link>
        </div>
      </section>
    </div>
  );
}
