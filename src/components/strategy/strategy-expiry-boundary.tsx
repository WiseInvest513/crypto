"use client";

import { useEffect, useState, type ReactNode } from "react";

const MAX_TIMEOUT_MILLISECONDS = 2_147_000_000;

export function strategyHasExpired(validUntil: string, now: number): boolean {
  const expiresAt = Date.parse(validUntil);
  return !Number.isFinite(expiresAt) || !Number.isFinite(now) || now >= expiresAt;
}

/** Removes an already-authorized strategy from the current UI at its expiry. */
export function StrategyExpiryBoundary({
  children,
  validUntil,
}: {
  children: ReactNode;
  validUntil: string;
}) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const schedule = () => {
      if (!active) return;
      const remaining = Date.parse(validUntil) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setExpired(true);
        return;
      }
      timeout = setTimeout(
        schedule,
        Math.min(remaining, MAX_TIMEOUT_MILLISECONDS),
      );
    };

    schedule();
    return () => {
      active = false;
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [validUntil]);

  if (!expired) return children;

  return (
    <section
      className="mw-research-section mw-strategy mw-strategy--status"
      aria-labelledby="wise-strategy-expired-title"
    >
      <div className="mw-strategy-heading">
        <div>
          <p>WISE STRATEGY</p>
          <h2 id="wise-strategy-expired-title">Wise 人工策略</h2>
        </div>
        <span>已到期</span>
      </div>
      <p className="mw-strategy-status-copy">
        本期策略已到期，正文已从当前参考中移除。
      </p>
    </section>
  );
}
