import { describe, expect, it } from "vitest";
import {
  parseHomepageEditorialConfig,
  resolveEditorialEntry,
  resolveTodayInCryptoEntry,
} from "../../src/lib/editorial/homepage-editorial";
import {
  loadHomepageEditorialForAccess,
  restrictHomepageEditorialForAccess,
} from "../../src/server/editorial/homepage-editorial-service";
import {
  ANONYMOUS_USER_ACCESS,
  type UserAccess,
} from "../../src/lib/access/user-access";

const EFFECTIVE_AT = "2026-08-29T00:00:00.000Z";
const VALID_UNTIL = "2026-08-30T00:00:00.000Z";
const REVIEWED_AT = "2026-08-28T12:00:00.000Z";

function sources() {
  return [
    {
      id: "example-source",
      label: "示例来源",
      url: "https://example.com/source",
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

function validConfig() {
  return {
    marketStatus: {
      ...entryBase(),
      content: {
        headline: "人工状态",
        summary: "仅用于配置校验测试。",
        watchItems: ["观察条件"],
      },
    },
    todayInCrypto: {
      ...entryBase(),
      content: {
        date: "2026-08-29",
        items: [
          {
            title: "已核验事件",
            summary: "事实摘要。",
            sourceIds: ["example-source"],
          },
        ],
      },
    },
    wiseTake: {
      ...entryBase(),
      content: {
        headline: "人工观点",
        body: "仅用于配置校验测试。",
        watchItems: [] as string[],
      },
    },
  };
}

describe("homepage editorial configuration", () => {
  it("parses reviewed entries with bounded content and per-item sources", () => {
    const config = parseHomepageEditorialConfig(validConfig());

    expect(config.marketStatus).toMatchObject({
      publicationStatus: "published",
      effectiveAt: EFFECTIVE_AT,
      validUntil: VALID_UNTIL,
      lastReviewedAt: REVIEWED_AT,
      sources: [{ id: "example-source", label: "示例来源" }],
    });
    expect(config.todayInCrypto.content?.items[0]).toMatchObject({
      title: "已核验事件",
      sourceIds: ["example-source"],
    });
    expect(config.wiseTake.content?.headline).toBe("人工观点");
  });

  it("rejects published content with missing review metadata", () => {
    const input = validConfig();
    input.marketStatus.sources = [];

    expect(() => parseHomepageEditorialConfig(input)).toThrow(
      "require at least one source",
    );
  });

  it("strictly rejects impossible UTC timestamps and invalid windows", () => {
    for (const timestamp of [
      "not-a-date",
      "2026-02-30T00:00:00.000Z",
      "2026-08-29T24:00:00.000Z",
      "2026-08-29T00:00:00+08:00",
    ]) {
      const input = validConfig();
      input.marketStatus.effectiveAt = timestamp;
      expect(() => parseHomepageEditorialConfig(input)).toThrow(
        "valid ISO 8601 UTC timestamp",
      );
    }

    const invalidWindow = validConfig();
    invalidWindow.wiseTake.validUntil = EFFECTIVE_AT;
    expect(() => parseHomepageEditorialConfig(invalidWindow)).toThrow(
      "must be after effectiveAt",
    );
  });

  it("rejects invalid source metadata and references", () => {
    const invalidUrl = validConfig();
    invalidUrl.todayInCrypto.sources[0].url = "http://example.com/source";
    expect(() => parseHomepageEditorialConfig(invalidUrl)).toThrow(
      "must use HTTPS",
    );

    const credentialedUrl = validConfig();
    credentialedUrl.marketStatus.sources[0].url =
      "https://user:password@example.com/source";
    expect(() => parseHomepageEditorialConfig(credentialedUrl)).toThrow(
      "must not contain URL credentials",
    );

    const unknownSource = validConfig();
    unknownSource.todayInCrypto.content.items[0].sourceIds = ["missing-source"];
    expect(() => parseHomepageEditorialConfig(unknownSource)).toThrow(
      "references unknown source ID",
    );

    const duplicateSourceId = validConfig();
    duplicateSourceId.wiseTake.sources.push({
      ...sources()[0],
      url: "https://example.com/another-source",
    });
    expect(() => parseHomepageEditorialConfig(duplicateSourceId)).toThrow(
      "source IDs must be unique",
    );
  });

  it("binds the daily brief date to its UTC publication window", () => {
    const invalidDate = validConfig();
    invalidDate.todayInCrypto.content.date = "2026-02-30";
    expect(() => parseHomepageEditorialConfig(invalidDate)).toThrow(
      "valid YYYY-MM-DD",
    );

    const mismatchedWindow = validConfig();
    mismatchedWindow.todayInCrypto.content.date = "2026-08-28";
    expect(() => parseHomepageEditorialConfig(mismatchedWindow)).toThrow(
      "must match the UTC date of effectiveAt",
    );
  });

  it("enforces the no-hard-coded-market-values policy for judgments", () => {
    const marketValue = validConfig();
    marketValue.marketStatus.content.summary = "价格达到 $100 时转向乐观。";
    expect(() => parseHomepageEditorialConfig(marketValue)).toThrow(
      "cannot contain hard-coded market numbers",
    );

    const percentage = validConfig();
    percentage.wiseTake.content.body = "上涨百分之五后追涨。5%";
    expect(() => parseHomepageEditorialConfig(percentage)).toThrow(
      "cannot contain hard-coded market numbers",
    );
  });

  it("enforces editorial information-density limits", () => {
    const tooManyWatchItems = validConfig();
    tooManyWatchItems.wiseTake.content.watchItems = [
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
    ];
    expect(() => parseHomepageEditorialConfig(tooManyWatchItems)).toThrow(
      "more than five items",
    );

    const longSummary = validConfig();
    longSummary.todayInCrypto.content.items[0].summary = "事".repeat(401);
    expect(() => parseHomepageEditorialConfig(longSummary)).toThrow(
      "cannot exceed 400 characters",
    );
  });

  it("hides unpublished, scheduled, and expired judgments", () => {
    const entry = parseHomepageEditorialConfig(validConfig()).marketStatus;

    expect(
      resolveEditorialEntry(entry, Date.parse("2026-08-28T23:59:59.999Z")),
    ).toMatchObject({ state: "scheduled", content: null });
    expect(
      resolveEditorialEntry(entry, Date.parse("2026-08-29T12:00:00.000Z")),
    ).toMatchObject({ state: "active", content: { headline: "人工状态" } });
    expect(
      resolveEditorialEntry(entry, Date.parse("2026-08-30T00:00:00.001Z")),
    ).toMatchObject({ state: "expired", content: null });

    const unpublished = { ...entry, publicationStatus: "unpublished" as const };
    expect(
      resolveEditorialEntry(unpublished, Date.parse(EFFECTIVE_AT)),
    ).toMatchObject({ state: "unpublished", content: null });
  });

  it("does not show content with a future review timestamp", () => {
    const entry = parseHomepageEditorialConfig(validConfig()).marketStatus;
    const futureReview = {
      ...entry,
      effectiveAt: "2026-08-27T00:00:00.000Z",
      lastReviewedAt: "2026-08-29T18:00:00.000Z",
    };

    expect(
      resolveEditorialEntry(
        futureReview,
        Date.parse("2026-08-29T12:00:00.000Z"),
      ),
    ).toMatchObject({ state: "scheduled", content: null });
  });

  it("keeps generic validity boundaries inclusive", () => {
    const entry = parseHomepageEditorialConfig(validConfig()).wiseTake;

    expect(resolveEditorialEntry(entry, Date.parse(EFFECTIVE_AT)).state).toBe(
      "active",
    );
    expect(resolveEditorialEntry(entry, Date.parse(VALID_UNTIL)).state).toBe(
      "active",
    );
  });

  it("never presents a previous-day brief as today's brief", () => {
    const entry = parseHomepageEditorialConfig(validConfig()).todayInCrypto;

    expect(
      resolveTodayInCryptoEntry(
        entry,
        Date.parse("2026-08-29T12:00:00.000Z"),
      ),
    ).toMatchObject({ state: "active", content: { date: "2026-08-29" } });
    expect(
      resolveTodayInCryptoEntry(entry, Date.parse(VALID_UNTIL)),
    ).toMatchObject({ state: "expired", content: null });
  });

  it("redacts subjective homepage judgment for regular access", () => {
    const config = parseHomepageEditorialConfig(validConfig());
    const redacted = restrictHomepageEditorialForAccess(
      config,
      ANONYMOUS_USER_ACCESS,
    );
    const forgedVip = restrictHomepageEditorialForAccess(config, {
      tier: "vip",
      isAuthenticated: false,
      source: "anonymous-default",
    } as UserAccess);

    expect(redacted.marketStatus.content).toBeNull();
    expect(redacted.wiseTake.content).toBeNull();
    expect(redacted.todayInCrypto).toBe(config.todayInCrypto);
    expect(forgedVip.marketStatus.content).toBeNull();
    expect(forgedVip.wiseTake.content).toBeNull();
  });

  it("keeps subjective homepage judgment for verified VIP access", () => {
    const config = parseHomepageEditorialConfig(validConfig());
    const access: UserAccess = {
      tier: "vip",
      isAuthenticated: true,
      source: "verified-identity",
    };

    expect(restrictHomepageEditorialForAccess(config, access)).toBe(config);
  });

  it("loads the server-only production config through the gated service", async () => {
    const payload = await loadHomepageEditorialForAccess(
      Promise.resolve(ANONYMOUS_USER_ACCESS),
      () => Date.parse(EFFECTIVE_AT),
    );

    expect(payload.now).toBe(Date.parse(EFFECTIVE_AT));
    expect(Object.keys(payload.config)).toEqual([
      "marketStatus",
      "todayInCrypto",
      "wiseTake",
    ]);
    for (const entry of Object.values(payload.config)) {
      expect(["published", "unpublished"]).toContain(entry.publicationStatus);
    }
  });
});
