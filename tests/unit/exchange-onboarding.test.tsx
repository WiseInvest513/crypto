import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExchangeOnboarding } from "@/components/exchanges/exchange-onboarding";
import {
  EXCHANGE_ONBOARDING_ENTRIES,
  EXCHANGE_ONBOARDING_LINKS,
} from "@/lib/exchanges/catalog";

const EXPECTED_EXCHANGES = ["Binance", "OKX", "Bitget", "Bybit", "Gate"];
const EXPECTED_LOGOS = {
  binance: "/exchanges/binance.jpeg",
  okx: "/exchanges/okx.jpeg",
  bitget: "/exchanges/bitget.jpeg",
  bybit: "/exchanges/bybit.jpeg",
  gate: "/exchanges/gate.jpg",
} as const;
const INCORRECT_GATE_VCARD_TUTORIAL =
  "https://www.wise-invest.org/articles/vcard/GUhygjYV";

describe("exchange onboarding", () => {
  it("gives the exchange choice and 20% rebate a clear split headline", () => {
    const html = renderToStaticMarkup(<ExchangeOnboarding />);

    expect(html).toContain('class="exchange-hero__title-lead">选好交易所');
    expect(html).toContain('class="exchange-hero__title-punctuation">，</span>');
    expect(html).toContain(
      '<span class="exchange-hero__title-benefit">获取 <strong>20%</strong> 交易返佣</span>',
    );
    expect(html).toContain('aria-label="当前开户福利摘要"');
    expect(html).toContain("交易手续费返佣");
  });

  it("keeps the directory limited to exactly the five approved exchanges", () => {
    expect(EXCHANGE_ONBOARDING_ENTRIES).toHaveLength(5);
    expect(EXCHANGE_ONBOARDING_ENTRIES.map((entry) => entry.name)).toEqual(
      EXPECTED_EXCHANGES,
    );
    expect(new Set(EXCHANGE_ONBOARDING_ENTRIES.map((entry) => entry.id)).size).toBe(5);
    expect(
      Object.fromEntries(
        EXCHANGE_ONBOARDING_ENTRIES.map((entry) => [entry.id, entry.logoSrc]),
      ),
    ).toEqual(EXPECTED_LOGOS);

    const html = renderToStaticMarkup(<ExchangeOnboarding />);
    expect(html.match(/class="exchange-card"/g)).toHaveLength(5);
    for (const name of EXPECTED_EXCHANGES) {
      expect(html).toContain(`>${name}<`);
    }
    for (const logoSrc of Object.values(EXPECTED_LOGOS)) {
      expect(html).toContain(encodeURIComponent(logoSrc));
    }
  });

  it("does not mix wallet or cold-wallet onboarding into the exchange page", () => {
    const html = renderToStaticMarkup(<ExchangeOnboarding />);

    expect(html).not.toContain("链上钱包");
    expect(html).not.toContain("冷钱包");
    expect(html).not.toMatch(/hardware wallet/i);
  });

  it("does not present the unrelated vcard article as a Gate tutorial", () => {
    const gate = EXCHANGE_ONBOARDING_ENTRIES.find((entry) => entry.id === "gate");
    const html = renderToStaticMarkup(<ExchangeOnboarding />);

    expect(gate).toMatchObject({ name: "Gate", tutorialHref: null });
    expect(html).not.toContain(INCORRECT_GATE_VCARD_TUTORIAL);
    expect(html).toContain("查看 Gate 当前入口");
    expect(html).toContain("独立 CEX 教程整理中");
  });

  it("states that referral registration does not automatically grant VIP", () => {
    const html = renderToStaticMarkup(<ExchangeOnboarding />);

    expect(html).toContain("VIP 需要单独核验");
    expect(html).toContain("使用开户链接不会自动成为 VIP");
    expect(html).toContain("人工核验");
    expect(html).toContain(`href="${EXCHANGE_ONBOARDING_LINKS.vip}"`);
  });

  it("adds safe rel values to every external link and identifies promoted benefit CTAs", () => {
    const html = renderToStaticMarkup(<ExchangeOnboarding />);
    const anchors = [...html.matchAll(/<a\b([^>]*)>/g)].map((match) => match[1]);
    const externalAnchors = anchors.filter((attributes) =>
      /href="https:\/\//.test(attributes),
    );
    const benefitAnchors = externalAnchors.filter((attributes) =>
      attributes.includes(`href="${EXCHANGE_ONBOARDING_LINKS.benefits}"`),
    );

    expect(externalAnchors.length).toBeGreaterThan(0);
    for (const attributes of externalAnchors) {
      expect(attributes).toMatch(/rel="[^"]*noopener[^"]*"/);
      expect(attributes).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    }

    expect(
      benefitAnchors.some((attributes) =>
        /rel="[^"]*sponsored[^"]*"/.test(attributes),
      ),
    ).toBe(true);
  });
});
