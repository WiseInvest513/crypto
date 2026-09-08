import { Suspense, type ReactNode } from "react";
import type { Asset, ChartCandle, MarketDatum } from "@/lib/market/live-chart";
import { resolveUserAccess } from "@/server/access/resolve-user-access";
import { wiseIdentityAdapter } from "@/server/auth/wise-identity-adapter";
import {
  loadTradeStrategyDisclosure,
  type TradeStrategyDisclosure,
} from "@/server/strategy/trade-strategy-service";
import {
  StrategyDisclosureLoading,
  StrategyDisclosurePanel,
} from "@/components/strategy/strategy-disclosure-panel";
import { MarketWorkbench } from "./market-workbench";

/** Public market facts deliberately have no identity or private editorial dependency. */
export function MarketWorkbenchPage({
  asset,
  liveChart,
  strategy = loadTradeStrategyDisclosure(
    asset,
    resolveUserAccess(wiseIdentityAdapter),
  ),
}: {
  asset: Asset;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
  strategy?: Promise<TradeStrategyDisclosure>;
}) {
  const strategySlot = (
    <Suspense key="wise-strategy" fallback={<StrategyDisclosureLoading />}>
      <StreamedStrategy disclosure={strategy} />
    </Suspense>
  );

  return (
    <Suspense
      fallback={
        <div className="market-workbench mw-loading" aria-busy="true">
          <h1>{asset.toUpperCase()} 行情</h1>
          <p>正在载入价格与图表…</p>
          <div />
        </div>
      }
    >
      <StreamedWorkbench
        asset={asset}
        liveChart={liveChart}
        strategySlot={strategySlot}
      />
    </Suspense>
  );
}

async function StreamedWorkbench({
  asset,
  liveChart,
  strategySlot,
}: {
  asset: Asset;
  liveChart: Promise<MarketDatum<readonly ChartCandle[]>>;
  strategySlot: ReactNode;
}) {
  const initialDatum = await liveChart;
  return (
    <MarketWorkbench
      key={asset}
      asset={asset}
      initialDatum={initialDatum}
      strategySlot={strategySlot}
    />
  );
}

async function StreamedStrategy({
  disclosure,
}: {
  disclosure: Promise<TradeStrategyDisclosure>;
}) {
  return <StrategyDisclosurePanel disclosure={await disclosure} />;
}
