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
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f7f6",
          color: "#111a17",
          fontFamily:
            'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: "560px" }}>
          <title>发生意外错误 | Wise Crypto</title>
          <p style={{ color: "#0c6b4b", fontWeight: 700 }}>WISE CRYPTO</p>
          <h1 style={{ fontSize: "40px", lineHeight: 1.05, margin: "16px 0" }}>
            出现了一些问题
          </h1>
          <p style={{ color: "#5c6762", lineHeight: 1.65 }}>
            应用基础界面暂时无法加载，请重试。
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: "44px",
              marginTop: "20px",
              border: 0,
              borderRadius: "8px",
              padding: "10px 16px",
              background: "#13231d",
              color: "#edf4f0",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
