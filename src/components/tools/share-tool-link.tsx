"use client";

import { useState } from "react";

export type ShareFeedbackState = Readonly<{
  kind: "idle" | "copied" | "error";
  sequence: number;
}>;

const INITIAL_SHARE_FEEDBACK: ShareFeedbackState = {
  kind: "idle",
  sequence: 0,
};

export function nextShareFeedback(
  current: ShareFeedbackState,
  kind: Exclude<ShareFeedbackState["kind"], "idle">,
): ShareFeedbackState {
  return { kind, sequence: current.sequence + 1 };
}

export function getShareFeedbackLabel(
  kind: ShareFeedbackState["kind"],
): string {
  if (kind === "copied") {
    return "已复制工具链接";
  }
  if (kind === "error") {
    return "复制功能暂不可用，请稍后重试";
  }
  return "";
}

export function getShareFeedbackAnnouncement(
  feedback: ShareFeedbackState,
): string {
  const label = getShareFeedbackLabel(feedback.kind);
  return label ? `第 ${feedback.sequence} 次操作反馈：${label}` : "";
}

export function ShareToolLink({ href }: { href: `/tools/${string}` }) {
  const [feedback, setFeedback] = useState<ShareFeedbackState>(
    INITIAL_SHARE_FEEDBACK,
  );

  async function copyLink() {
    try {
      const url = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setFeedback((current) => nextShareFeedback(current, "copied"));
    } catch {
      setFeedback((current) => nextShareFeedback(current, "error"));
    }
  }

  const feedbackLabel = getShareFeedbackLabel(feedback.kind);
  const announcement = getShareFeedbackAnnouncement(feedback);

  return (
    <div className="tool-share-action">
      <button className="tool-share-button" type="button" onClick={copyLink}>
        <ShareIcon />
        复制工具链接
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {feedback.kind !== "idle" && (
        <span className="tool-share-status" aria-hidden="true">
          {feedbackLabel}
        </span>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      <path d="M7.5 10.8 12.7 5.6m-2.4-.1h2.6c.9 0 1.6.7 1.6 1.6v2.6M9.7 14.5H7.1c-.9 0-1.6-.7-1.6-1.6v-2.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
