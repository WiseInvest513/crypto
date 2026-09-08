"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Wise Crypto global error", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="global-error">
        <style>{`
          .global-error {
            box-sizing: border-box;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: #f5f5f7;
            color: #1d1d1f;
            color-scheme: light dark;
            font-family: Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .global-error__eyebrow { color: #06c; font-weight: 700; }
          .global-error__message { color: #6e6e73; line-height: 1.65; }
          .global-error__retry {
            min-height: 44px;
            margin-top: 20px;
            border: 0;
            border-radius: 980px;
            padding: 10px 20px;
            background: #1d1d1f;
            color: #fff;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
          }
          .global-error__retry:focus-visible { outline: 3px solid #0a84ff; outline-offset: 3px; }
          @media (prefers-color-scheme: dark) {
            .global-error { background: #000; color: #f5f5f7; }
            .global-error__eyebrow { color: #0a84ff; }
            .global-error__message { color: #a1a1a6; }
            .global-error__retry { background: #f5f5f7; color: #1d1d1f; }
          }
        `}</style>
        <main style={{ maxWidth: "560px" }}>
          <title>发生意外错误 | Wise Crypto</title>
          <p className="global-error__eyebrow">WISE CRYPTO</p>
          <h1 style={{ fontSize: "40px", lineHeight: 1.05, margin: "16px 0" }}>
            出现了一些问题
          </h1>
          <p className="global-error__message">
            应用基础界面暂时无法加载，请重试。
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="global-error__retry"
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
