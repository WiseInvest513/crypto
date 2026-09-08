import { describe, expect, it } from "vitest";
import {
  parseTradeStrategy,
  resolveTradeStrategyDisplayState,
  toActiveTradeStrategyView,
} from "@/lib/strategy/trade-strategy";
import { tradeStrategyFixture } from "../fixtures/trade-strategy";

describe("trade strategy contract", () => {
  it.each(["btc", "eth"] as const)(
    "parses a reviewed %s strategy through the shared contract",
    (asset) => {
      const strategy = parseTradeStrategy(tradeStrategyFixture(asset));
      expect(strategy.asset).toBe(asset);
      expect(strategy.priceZones[0]).toMatchObject({
        lower: 71_000,
        upper: 72_000,
      });
    },
  );

  it("uses a half-open publication window", () => {
    const strategy = parseTradeStrategy(tradeStrategyFixture());
    expect(
      resolveTradeStrategyDisplayState(
        strategy,
        Date.parse("2026-09-05T23:59:59Z"),
      ),
    ).toBe("scheduled");
    expect(
      resolveTradeStrategyDisplayState(
        strategy,
        Date.parse("2026-09-06T00:00:00Z"),
      ),
    ).toBe("active");
    expect(
      resolveTradeStrategyDisplayState(
        strategy,
        Date.parse("2026-09-06T23:59:59.999Z"),
      ),
    ).toBe("active");
    expect(
      resolveTradeStrategyDisplayState(
        strategy,
        Date.parse("2026-09-07T00:00:00Z"),
      ),
    ).toBe("expired");
  });

  it.each([
    ["unknown field", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value, { secret: true })],
    ["wrong asset", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value, { asset: "sol" })],
    ["non-finite price", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value.priceZones[0], { lower: Number.NaN })],
    ["reversed zone", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value.priceZones[0], { lower: 73_000 })],
    ["unknown source reference", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value.priceZones[0], { sourceIds: ["missing-source"] })],
    ["invalid timestamp", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value, { validUntil: "2026-09-07" })],
    ["impossible UTC date", (value: ReturnType<typeof tradeStrategyFixture>) => Object.assign(value, { validUntil: "2026-02-30T00:00:00Z" })],
  ])("rejects %s", (_label, mutate) => {
    const value = tradeStrategyFixture();
    mutate(value);
    expect(() => parseTradeStrategy(value)).toThrow();
  });

  it("rejects sources whose URL contains credential-like query parameters", () => {
    const value = tradeStrategyFixture();
    value.sources[0]!.url =
      "https://research.example.com/wise-note?api_key=secret";
    expect(() => parseTradeStrategy(value)).toThrow(
      /credential-like query parameters/u,
    );
  });

  it("accepts late publication only while the reviewed validity window is open", () => {
    const open = tradeStrategyFixture();
    open.reviewedAt = "2026-09-06T12:00:00Z";
    open.publishedAt = "2026-09-06T12:00:00Z";
    expect(parseTradeStrategy(open).publishedAt).toBe(
      "2026-09-06T12:00:00Z",
    );

    const expired = tradeStrategyFixture();
    expired.reviewedAt = "2026-09-07T00:00:00Z";
    expired.publishedAt = "2026-09-07T00:00:00Z";
    expect(() => parseTradeStrategy(expired)).toThrow(/published < validUntil/u);
  });

  it("requires the complete review and publication bundle", () => {
    const value = tradeStrategyFixture();
    value.reviewer = null as unknown as string;
    expect(() => parseTradeStrategy(value)).toThrow(/reviewer/i);
  });

  it("derives withdrawn before the time window and keeps drafts unpublished", () => {
    const withdrawn = tradeStrategyFixture();
    withdrawn.storedStatus = "withdrawn";
    const draft = tradeStrategyFixture();
    draft.storedStatus = "draft";
    expect(
      resolveTradeStrategyDisplayState(
        parseTradeStrategy(withdrawn),
        Date.parse("2026-09-06T12:00:00Z"),
      ),
    ).toBe("withdrawn");
    expect(
      resolveTradeStrategyDisplayState(
        parseTradeStrategy(draft),
        Date.parse("2026-09-06T12:00:00Z"),
      ),
    ).toBe("unpublished");
  });

  it("projects an active DTO without repository sources or workflow metadata", () => {
    const view = toActiveTradeStrategyView(
      parseTradeStrategy(tradeStrategyFixture()),
    );
    const serialized = JSON.stringify(view);
    expect(serialized).toContain("PRIVATE_HEADLINE_SENTINEL");
    expect(serialized).not.toContain("PRIVATE_SOURCE_SENTINEL");
    expect(serialized).not.toContain("research.example.com");
    expect(serialized).not.toContain("storedStatus");
    expect(serialized).not.toContain("publishedAt");
    expect(serialized).not.toContain("PRIVATE_AUTHOR_SENTINEL");
    expect(serialized).not.toContain("PRIVATE_REVIEWER_SENTINEL");
    expect(view.author).toBe("Wise 研究");
    expect(view.reviewer).toBe("Wise 独立复核");
  });
});
