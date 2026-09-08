import { WISE_INVEST_CRYPTO_PERKS_URL } from "@/config/site";
import { periodLabels } from "@/lib/market/workbench-presentation";
import type {
  ActiveTradeStrategyView,
  TradeStrategyBias,
  TradeStrategyPriceZone,
} from "@/lib/strategy/trade-strategy";
import type { TradeStrategyDisclosure } from "@/server/strategy/trade-strategy-service";
import { StrategyExpiryBoundary } from "./strategy-expiry-boundary";

const STATUS_COPY: Record<
  Extract<TradeStrategyDisclosure, { kind: "status" }>["state"],
  Readonly<{ label: string; title: string; description: string }>
> = {
  unpublished: {
    label: "尚未发布",
    title: "本期人工策略尚未发布",
    description: "没有经过完整审核的内容时，不给出方向或价位。",
  },
  scheduled: {
    label: "等待生效",
    title: "本期人工策略已排期",
    description: "到达人工设定的生效时间后，才会展示当前策略。",
  },
  expired: {
    label: "已到期",
    title: "上一期人工策略已到期",
    description: "过期正文与价位已从当前参考中移除。",
  },
  withdrawn: {
    label: "已撤回",
    title: "本期人工策略已撤回",
    description: "撤回内容不再作为当前判断展示。",
  },
  unavailable: {
    label: "暂不可用",
    title: "人工策略服务暂不可用",
    description: "当前不展示旧判断，也不会用公开模板自动补齐。",
  },
};

export function StrategyDisclosurePanel({
  disclosure,
}: {
  disclosure: TradeStrategyDisclosure;
}) {
  if (disclosure.kind === "locked") {
    return <LockedStrategy asset={disclosure.asset} />;
  }
  if (disclosure.kind === "status") {
    const copy = STATUS_COPY[disclosure.state];
    return (
      <section
        className="mw-research-section mw-strategy mw-strategy--status"
        aria-labelledby={`wise-strategy-${disclosure.asset}-title`}
      >
        <StrategyHeading
          id={`wise-strategy-${disclosure.asset}-title`}
          label={copy.label}
        />
        <h3>{copy.title}</h3>
        <p className="mw-strategy-status-copy">{copy.description}</p>
      </section>
    );
  }

  return (
    <StrategyExpiryBoundary validUntil={disclosure.strategy.validUntil}>
      <ActiveStrategy strategy={disclosure.strategy} />
    </StrategyExpiryBoundary>
  );
}

export function StrategyDisclosureLoading() {
  return (
    <section
      className="mw-research-section mw-strategy mw-strategy--loading"
      aria-busy="true"
      aria-label="正在确认人工策略权限"
    >
      <span />
      <span />
    </section>
  );
}

function LockedStrategy({ asset }: { asset: "btc" | "eth" }) {
  return (
    <section
      className="mw-research-section mw-strategy mw-strategy--locked"
      aria-labelledby={`wise-strategy-${asset}-title`}
    >
      <StrategyHeading
        id={`wise-strategy-${asset}-title`}
        label="普通权限"
      />
      <h3>客观研究已开放，人工策略待验证</h3>
      <p>
        均线、关键区域与多周期可直接查看；Wise 的人工方向和有效窗口将在主站身份接入后按权限开放。
      </p>
      <a
        href={WISE_INVEST_CRYPTO_PERKS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        了解 Wise Crypto 权益
        <span aria-hidden="true">↗</span>
        <span className="sr-only">（在新标签页打开）</span>
      </a>
    </section>
  );
}

function ActiveStrategy({ strategy }: { strategy: ActiveTradeStrategyView }) {
  const primaryZones = strategy.priceZones.slice(0, 3);
  const remainingZones = strategy.priceZones.slice(3);
  return (
    <section
      className="mw-research-section mw-strategy mw-strategy--active"
      aria-labelledby={`wise-strategy-${strategy.asset}-title`}
    >
      <StrategyHeading
        id={`wise-strategy-${strategy.asset}-title`}
        label={biasLabel(strategy.bias)}
      />
      <h3>{strategy.headline}</h3>
      <p className="mw-strategy-summary">{strategy.summary}</p>
      <dl className="mw-strategy-context">
        <div>
          <dt>适用周期</dt>
          <dd>{strategy.timeframes.map((item) => periodLabels[item]).join(" · ")}</dd>
        </div>
        <div>
          <dt>有效至</dt>
          <dd>
            <time dateTime={strategy.validUntil}>
              {formatUtc(strategy.validUntil)}
            </time>
          </dd>
        </div>
      </dl>
      <div className="mw-strategy-core">
        <StrategyZones zones={primaryZones} />
        <StrategyCondition
          title="确认条件"
          item={strategy.confirmationConditions[0]}
        />
        <StrategyCondition
          title="失效条件"
          item={strategy.invalidationConditions[0]}
        />
      </div>
      <details className="mw-strategy-details">
        <summary>查看完整人工研究</summary>
        <div>
          {remainingZones.length > 0 && <StrategyZones zones={remainingZones} />}
          <StrategyList
            title="全部确认条件"
            items={strategy.confirmationConditions}
          />
          <StrategyList
            title="全部失效条件"
            items={strategy.invalidationConditions}
          />
          {strategy.watchItems.length > 0 && (
            <StrategyList title="持续观察" items={strategy.watchItems} />
          )}
          <p className="mw-strategy-risk">
            <strong>风险说明</strong>
            {strategy.riskDisclosure}
          </p>
          <p className="mw-strategy-review">
            {strategy.author} 发布 · {strategy.reviewer} 审核 · 版本 {strategy.revision}
          </p>
        </div>
      </details>
    </section>
  );
}

function StrategyHeading({ id, label }: { id: string; label: string }) {
  return (
    <div className="mw-strategy-heading">
      <div>
        <p>WISE STRATEGY</p>
        <h2 id={id}>Wise 人工策略</h2>
      </div>
      <span>{label}</span>
    </div>
  );
}

function StrategyZones({
  zones,
}: {
  zones: readonly Pick<
    TradeStrategyPriceZone,
    "id" | "role" | "lower" | "upper" | "label" | "rationale"
  >[];
}) {
  return (
    <div className="mw-strategy-zones">
      <strong>人工观察区域</strong>
      {zones.map((zone) => (
        <div key={zone.id}>
          <span>{zoneRoleLabel(zone.role)} · {zone.label}</span>
          <b>{formatZone(zone.lower, zone.upper)}</b>
          <small>{zone.rationale}</small>
        </div>
      ))}
    </div>
  );
}

function StrategyCondition({ title, item }: { title: string; item: string }) {
  return (
    <div className="mw-strategy-condition">
      <strong>{title}</strong>
      <p>{item}</p>
    </div>
  );
}

function StrategyList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="mw-strategy-list">
      <strong>{title}</strong>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function biasLabel(bias: TradeStrategyBias): string {
  return {
    bullish: "人工偏多",
    bearish: "人工偏空",
    neutral: "人工中性",
    wait: "等待确认",
  }[bias];
}

function zoneRoleLabel(role: TradeStrategyPriceZone["role"]): string {
  return {
    support: "支撑",
    resistance: "压力",
    target: "目标观察",
    watch: "重点观察",
  }[role];
}

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatZone(lower: number, upper: number): string {
  return lower === upper
    ? `${priceFormatter.format(lower)} USDT`
    : `${priceFormatter.format(lower)} — ${priceFormatter.format(upper)} USDT`;
}

function formatUtc(value: string): string {
  return `${value.slice(5, 10)} ${value.slice(11, 16)} UTC`;
}
