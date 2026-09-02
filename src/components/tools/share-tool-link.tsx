"use client";

import { useState } from "react";

export function ShareToolLink({ href }: { href: `/tools/${string}` }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyLink() {
    try {
      const url = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "copied"
      ? "已复制工具链接"
      : status === "error"
        ? "复制功能暂不可用，请稍后重试"
        : "复制空白工具链接";

  return (
    <div className="tool-share-action">
      <button className="tool-share-button" type="button" onClick={copyLink}>
        复制空白链接
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "idle" ? "" : label}
      </span>
      {status !== "idle" && (
        <span className="tool-share-status" aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}
