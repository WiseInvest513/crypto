"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Wise Crypto route error", error);
  }, [error]);

  return (
    <div className="state-page page-container">
      <section className="state-panel" aria-labelledby="error-title">
        <p className="eyebrow">发生意外错误</p>
        <h1 id="error-title">暂时无法加载此页面</h1>
        <p>问题可能只是暂时的。你可以重试，或返回市场总览。</p>
        <div className="state-actions">
          <button className="state-button" type="button" onClick={() => retry()}>
            重试
          </button>
          <Link className="state-link state-link--secondary" href="/">
            返回市场总览
          </Link>
        </div>
      </section>
    </div>
  );
}
