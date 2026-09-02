"use client";

import { useEffect, useState } from "react";
import { DatumMeta, DatumStatus } from "@/components/market/datum-presentation";
import type { DatumPresentation } from "@/lib/market/homepage-presentation";
import type {
  Asset,
  ChartCandleInterval,
  ChartCandleState,
} from "@/lib/market/live-chart";

export const ASSET_LIVE_PRICE_EVENT = "wise-crypto:live-price";

export type AssetLivePriceEventDetail =
  | {
      kind: "value";
      asset: Asset;
      currency: "USDT";
      interval: ChartCandleInterval;
      price: number;
      state: ChartCandleState;
      updatedAt: string;
      presentation: DatumPresentation;
    }
  | {
      kind: "issue";
      asset: Asset;
      message: string;
    };

type DisplayPrice = {
  currency: "USD" | "USDT";
  formatted: string;
  label: string;
  note: string | null;
  updatedAt: string | null;
  presentation: DatumPresentation;
};

export function AssetLivePrice({
  asset,
  initialCurrency,
  initialFormatted,
  initialLabel,
  initialNote,
  initialPresentation,
  aggregatePresentation,
  showAggregateProvenance,
}: {
  asset: Asset;
  initialCurrency: "USD" | "USDT";
  initialFormatted: string;
  initialLabel: string;
  initialNote: string | null;
  initialPresentation: DatumPresentation;
  aggregatePresentation: DatumPresentation;
  showAggregateProvenance: boolean;
}) {
  const [display, setDisplay] = useState<DisplayPrice>({
    currency: initialCurrency,
    formatted: initialFormatted,
    label: initialLabel,
    note: initialNote ?? initialPresentation.note,
    updatedAt: initialPresentation.updatedAt,
    presentation: initialPresentation,
  });

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as AssetLivePriceEventDetail | null;
      if (!detail || detail.asset !== asset) {
        return;
      }

      if (detail.kind === "issue") {
        setDisplay((current) => ({
          ...current,
          label: "Binance 上次可用价 · 刷新失败",
          note: detail.message,
          presentation: {
            ...current.presentation,
            state: "stale",
            statusLabel: "刷新失败",
            note: detail.message,
          },
        }));
        return;
      }

      if (
        typeof detail.price !== "number" ||
        !Number.isFinite(detail.price) ||
        typeof detail.updatedAt !== "string" ||
        (detail.state !== "forming" && detail.state !== "closed") ||
        !isChartInterval(detail.interval) ||
        !isDatumPresentation(detail.presentation)
      ) {
        return;
      }

      setDisplay({
        currency: "USDT",
        formatted: formatPrice(detail.price),
        label: livePriceLabel(
          detail.state,
          detail.interval,
          detail.presentation.state,
        ),
        note:
          detail.state === "closed" && detail.interval === "1d"
            ? "不是实时现货价"
            : detail.presentation.note,
        updatedAt: detail.updatedAt,
        presentation: detail.presentation,
      });
    };

    window.addEventListener(ASSET_LIVE_PRICE_EVENT, handleUpdate);
    return () => window.removeEventListener(ASSET_LIVE_PRICE_EVENT, handleUpdate);
  }, [asset]);

  return (
    <>
      <div className="asset-market-header__price">
        <span>{display.label}</span>
        <strong>
          {display.formatted}
          <small>{display.currency}</small>
        </strong>
        {display.presentation.state !== "fresh" && (
          <span className={`asset-market-header__price-state asset-market-header__price-state--${display.presentation.state}`}>
            {display.presentation.statusLabel}
          </span>
        )}
        {display.note && (
          <small className="asset-market-header__price-note">{display.note}</small>
        )}
        {display.updatedAt && (
          <time dateTime={display.updatedAt}>
            图表更新 {formatUpdateTime(display.updatedAt)}
          </time>
        )}
      </div>
      <div className="asset-market-header__meta">
        <DatumStatus presentation={display.presentation} compact />
        <div className="asset-market-header__provenance">
          <span>主价</span>
          <DatumMeta presentation={display.presentation} />
          {showAggregateProvenance && (
            <>
              <span>涨跌</span>
              <DatumMeta presentation={aggregatePresentation} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function livePriceLabel(
  state: ChartCandleState,
  interval: ChartCandleInterval,
  presentationState: DatumPresentation["state"],
): string {
  if (presentationState === "stale") {
    return "Binance 上次可用价 · 数据延迟";
  }
  if (state === "forming") {
    return "Binance 最新价 · 当前 K 线形成中";
  }
  return interval === "1d"
    ? "Binance 最新已闭合日线收盘"
    : "Binance 最新已闭合价";
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUpdateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "时间待确认";
  }
  return `${date.toISOString().slice(11, 19)} UTC`;
}

function isChartInterval(value: string): value is ChartCandleInterval {
  return value === "15m" || value === "1h" || value === "4h" || value === "1d";
}

function isDatumPresentation(value: unknown): value is DatumPresentation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<DatumPresentation>;
  return (
    (candidate.state === "fresh" ||
      candidate.state === "stale" ||
      candidate.state === "error" ||
      candidate.state === "unavailable" ||
      candidate.state === "loading") &&
    typeof candidate.statusLabel === "string" &&
    typeof candidate.value === "object" &&
    candidate.value !== null
  );
}
