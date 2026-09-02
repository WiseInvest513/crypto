import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseAssetEditorialConfig,
  resolveAssetEditorialEntry,
} from "../../src/lib/editorial/asset-editorial";
import { loadAssetEditorial } from "../../src/server/editorial/asset-editorial-service";

const EFFECTIVE_AT = "2026-08-31T00:00:00.000Z";
const VALID_UNTIL = "2026-09-02T00:00:00.000Z";
const REVIEWED_AT = "2026-08-30T12:00:00.000Z";

function sources() {
  return [
    {
      id: "verified-market-source",
      label: "已核验市场来源",
      url: "https://example.com/verified-market-source",
    },
  ];
}

function entryBase() {
  return {
    publicationStatus: "published",
    effectiveAt: EFFECTIVE_AT,
    validUntil: VALID_UNTIL,
    lastReviewedAt: REVIEWED_AT,
    sources: sources(),
  };
}

function keyLevelsEntry() {
  return {
    ...entryBase(),
    content: {
      quoteCurrency: "USDT",
      levels: [
        {
          id: "primary-support",
          role: "support",
          price: 60_000,
          label: "主要支撑",
          rationale: "用于验证结构化人工关键位。",
          invalidationCondition: "日线收盘有效跌破后失效。",
          sourceIds: ["verified-market-source"],
        },
        {
          id: "primary-resistance",
          role: "resistance",
          price: 70_000,
          label: "主要阻力",
          rationale: "用于验证结构化人工关键位。",
          invalidationCondition: "日线收盘有效突破后失效。",
          sourceIds: ["verified-market-source"],
        },
      ],
    },
  };
}

function wiseScenarioEntry() {
  return {
    ...entryBase(),
    content: {
      headline: "人工情景标题",
      summary: "这是经过人工维护的情景配置测试内容。",
      confirmationConditions: ["确认条件完成后才视为情景成立。"],
      invalidationConditions: ["失效条件出现后不再展示为当前情景。"],
      watchItems: ["持续观察市场结构。"],
      sourceIds: ["verified-market-source"],
    },
  };
}

function validConfig() {
  return {
    btc: {
      keyLevels: keyLevelsEntry(),
      wiseScenario: wiseScenarioEntry(),
    },
    eth: {
      keyLevels: keyLevelsEntry(),
      wiseScenario: wiseScenarioEntry(),
    },
  };
}

describe("asset editorial configuration", () => {
  it("parses reviewed BTC and ETH levels and scenarios", () => {
    const config = parseAssetEditorialConfig(validConfig());

    expect(config.btc.keyLevels.content).toMatchObject({
      quoteCurrency: "USDT",
      levels: [
        {
          id: "primary-support",
          role: "support",
          price: 60_000,
          sourceIds: ["verified-market-source"],
        },
        {
          id: "primary-resistance",
          role: "resistance",
          price: 70_000,
        },
      ],
    });
    expect(config.eth.wiseScenario.content).toMatchObject({
      headline: "人工情景标题",
      confirmationConditions: ["确认条件完成后才视为情景成立。"],
      invalidationConditions: ["失效条件出现后不再展示为当前情景。"],
      sourceIds: ["verified-market-source"],
    });
  });

  it("requires complete publication and review metadata", () => {
    const noSources = validConfig();
    noSources.btc.wiseScenario.sources = [];
    expect(() => parseAssetEditorialConfig(noSources)).toThrow(
      "require at least one source",
    );

    const noReview = validConfig();
    (
      noReview.eth.keyLevels as { lastReviewedAt: string | null }
    ).lastReviewedAt = null;
    expect(() => parseAssetEditorialConfig(noReview)).toThrow(
      "require all review dates",
    );

    const noContent = validConfig();
    (noContent.btc.keyLevels as { content: unknown | null }).content = null;
    expect(() => parseAssetEditorialConfig(noContent)).toThrow(
      "require content",
    );
  });

  it("strictly rejects impossible or non-UTC dates and invalid windows", () => {
    for (const timestamp of [
      "not-a-date",
      "2026-02-30T00:00:00.000Z",
      "2026-08-31T24:00:00.000Z",
      "2026-08-31T00:00:00+08:00",
    ]) {
      const input = validConfig();
      input.btc.keyLevels.effectiveAt = timestamp;
      expect(() => parseAssetEditorialConfig(input)).toThrow(
        "valid ISO 8601 UTC timestamp",
      );
    }

    const reversedWindow = validConfig();
    reversedWindow.btc.keyLevels.validUntil = EFFECTIVE_AT;
    expect(() => parseAssetEditorialConfig(reversedWindow)).toThrow(
      "must be after effectiveAt",
    );

    const lateReview = validConfig();
    lateReview.eth.wiseScenario.lastReviewedAt = "2026-09-01T00:00:00.000Z";
    expect(() => parseAssetEditorialConfig(lateReview)).toThrow(
      "must not be after effectiveAt",
    );
  });

  it("requires HTTPS sources with unique slug IDs", () => {
    const insecureUrl = validConfig();
    insecureUrl.btc.keyLevels.sources[0].url = "http://example.com/source";
    expect(() => parseAssetEditorialConfig(insecureUrl)).toThrow(
      "must use HTTPS",
    );

    const credentialedUrl = validConfig();
    credentialedUrl.eth.keyLevels.sources[0].url =
      "https://user:password@example.com/source";
    expect(() => parseAssetEditorialConfig(credentialedUrl)).toThrow(
      "must not contain URL credentials",
    );

    const invalidId = validConfig();
    invalidId.btc.wiseScenario.sources[0].id = "Invalid Source";
    expect(() => parseAssetEditorialConfig(invalidId)).toThrow(
      "must be a lowercase slug",
    );

    const duplicateId = validConfig();
    duplicateId.eth.keyLevels.sources.push({
      ...sources()[0],
      url: "https://example.com/duplicate",
    });
    expect(() => parseAssetEditorialConfig(duplicateId)).toThrow(
      "source IDs must be unique",
    );
  });

  it("validates key-level prices, roles, unique IDs and invalidation text", () => {
    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const input = validConfig();
      input.btc.keyLevels.content.levels[0].price = price;
      expect(() => parseAssetEditorialConfig(input)).toThrow(
        "positive finite number",
      );
    }

    const wrongQuote = validConfig();
    wrongQuote.btc.keyLevels.content.quoteCurrency = "USD";
    expect(() => parseAssetEditorialConfig(wrongQuote)).toThrow(
      "quoteCurrency must be USDT",
    );

    const wrongRole = validConfig();
    wrongRole.eth.keyLevels.content.levels[0].role = "pivot";
    expect(() => parseAssetEditorialConfig(wrongRole)).toThrow(
      "must be support or resistance",
    );

    const duplicateLevelId = validConfig();
    duplicateLevelId.btc.keyLevels.content.levels[1].id = "primary-support";
    expect(() => parseAssetEditorialConfig(duplicateLevelId)).toThrow(
      "levels IDs must be unique",
    );

    const noResistance = validConfig();
    noResistance.eth.keyLevels.content.levels[1].role = "support";
    expect(() => parseAssetEditorialConfig(noResistance)).toThrow(
      "at least one resistance",
    );

    const noInvalidation = validConfig();
    noInvalidation.btc.keyLevels.content.levels[0].invalidationCondition = " ";
    expect(() => parseAssetEditorialConfig(noInvalidation)).toThrow(
      "must be a non-empty string",
    );
  });

  it("rejects unknown and duplicate source references", () => {
    const unknownLevelSource = validConfig();
    unknownLevelSource.btc.keyLevels.content.levels[0].sourceIds = ["missing"];
    expect(() => parseAssetEditorialConfig(unknownLevelSource)).toThrow(
      "references unknown source ID missing",
    );

    const duplicateScenarioSource = validConfig();
    duplicateScenarioSource.eth.wiseScenario.content.sourceIds = [
      "verified-market-source",
      "verified-market-source",
    ];
    expect(() => parseAssetEditorialConfig(duplicateScenarioSource)).toThrow(
      "must not contain duplicates",
    );
  });

  it("requires bounded scenario confirmation and invalidation conditions", () => {
    const noConfirmation = validConfig();
    noConfirmation.btc.wiseScenario.content.confirmationConditions = [];
    expect(() => parseAssetEditorialConfig(noConfirmation)).toThrow(
      "must contain at least 1 item",
    );

    const noInvalidation = validConfig();
    noInvalidation.eth.wiseScenario.content.invalidationConditions = [];
    expect(() => parseAssetEditorialConfig(noInvalidation)).toThrow(
      "must contain at least 1 item",
    );

    const longSummary = validConfig();
    longSummary.btc.wiseScenario.content.summary = "情".repeat(601);
    expect(() => parseAssetEditorialConfig(longSummary)).toThrow(
      "cannot exceed 600 characters",
    );

    const tooManyWatchItems = validConfig();
    tooManyWatchItems.eth.wiseScenario.content.watchItems = [
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
    ];
    expect(() => parseAssetEditorialConfig(tooManyWatchItems)).toThrow(
      "more than 5 items",
    );
  });

  it("rejects unknown fields instead of silently ignoring editor typos", () => {
    const input = validConfig();
    const keyLevels = input.btc.keyLevels as typeof input.btc.keyLevels & {
      validUntill?: string;
    };
    keyLevels.validUntill = VALID_UNTIL;

    expect(() => parseAssetEditorialConfig(input)).toThrow(
      "contains unknown field validUntill",
    );
  });

  it("resolves scheduled, active, expired and unpublished states", () => {
    const entry = parseAssetEditorialConfig(validConfig()).btc.wiseScenario;

    expect(
      resolveAssetEditorialEntry(
        entry,
        Date.parse("2026-08-30T23:59:59.999Z"),
      ),
    ).toMatchObject({ state: "scheduled", content: null });
    expect(resolveAssetEditorialEntry(entry, Date.parse(EFFECTIVE_AT))).toMatchObject(
      { state: "active", content: { headline: "人工情景标题" } },
    );
    expect(resolveAssetEditorialEntry(entry, Date.parse(VALID_UNTIL)).state).toBe(
      "active",
    );
    expect(
      resolveAssetEditorialEntry(
        entry,
        Date.parse("2026-09-02T00:00:00.001Z"),
      ),
    ).toMatchObject({ state: "expired", content: null });

    const unpublished = {
      ...entry,
      publicationStatus: "unpublished" as const,
    };
    expect(
      resolveAssetEditorialEntry(unpublished, Date.parse(EFFECTIVE_AT)),
    ).toMatchObject({ state: "unpublished", content: null });
  });

  it("keeps production drafts server-only and safely unpublished", () => {
    const btc = loadAssetEditorial("btc", () => Date.parse(EFFECTIVE_AT));
    const eth = loadAssetEditorial("eth", () => Date.parse(EFFECTIVE_AT));

    expect(btc).toMatchObject({ asset: "btc", now: Date.parse(EFFECTIVE_AT) });
    for (const payload of [btc, eth]) {
      expect(payload.config.keyLevels).toMatchObject({
        publicationStatus: "unpublished",
        content: null,
        sources: [],
      });
      expect(payload.config.wiseScenario).toMatchObject({
        publicationStatus: "unpublished",
        content: null,
        sources: [],
      });
    }

    const contentSource = readFileSync(
      new URL("../../src/content/asset-editorial.ts", import.meta.url),
      "utf8",
    );
    const serviceSource = readFileSync(
      new URL(
        "../../src/server/editorial/asset-editorial-service.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(contentSource).toContain('import "server-only"');
    expect(serviceSource).toContain('import "server-only"');
  });
});
