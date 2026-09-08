import type { PricePerformanceSnapshot } from "@/lib/market/price-performance";
import { performanceRows } from "@/lib/market/price-performance-presentation";
import { changeTone, formatChange, formatUpdate } from "@/lib/market/workbench-presentation";

export function MarketPricePerformance({ snapshot, issue, now }: { snapshot: PricePerformanceSnapshot | null; issue: boolean; now: number }) {
  return <dl className="mw-performance" aria-label="近期涨跌">
    {performanceRows(snapshot, issue, now).map((row) => <div key={row.window} title={row.reading ? `${formatUpdate(row.reading.openTime)} → ${formatUpdate(row.reading.closeTime)}；滚动窗口按分钟对齐，非自然日/周/月；约每分钟更新。` : undefined}>
      <dt>{row.label}</dt>
      <dd className={`mw-${changeTone(row.change)}`} aria-busy={row.state === "loading"}>
        {formatChange(row.change)}
        {row.state === "delayed" ? <small>数据延迟</small> : row.state === "unavailable" ? <small>暂不可用</small> : null}
      </dd>
    </div>)}
  </dl>;
}
