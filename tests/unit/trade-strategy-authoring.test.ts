import { describe, expect, it } from "vitest";
import {
  buildPublishedTradeStrategy,
  createBlankTradeStrategyDraft,
  parseStoredTradeStrategyDraft,
  parseTradeStrategyDraftInput,
  parseTradeStrategyPublicationMetadata,
  TRADE_STRATEGY_AUTHORING_LIMITS,
  validateTradeStrategyReadyForReview,
  type TradeStrategyDraftInput,
  type TradeStrategyPublicationMetadata,
} from "@/lib/strategy/trade-strategy-authoring";
import { parseTradeStrategy } from "@/lib/strategy/trade-strategy";

function completeDraft(): TradeStrategyDraftInput {
  return {
    asset: "btc",
    bias: "wait",
    headline: "内部合同测试标题",
    summary: "内部合同测试摘要",
    timeframes: ["1h"],
    priceZones: [
      {
        id: "zone-a",
        role: "watch",
        lower: Number.EPSILON,
        upper: Number.EPSILON,
        label: "内部合同测试区域",
        rationale: "仅用于验证合同完整性",
        sourceIds: ["source-a"],
      },
    ],
    confirmationConditions: ["内部合同确认条件"],
    invalidationConditions: ["内部合同失效条件"],
    watchItems: [],
    riskDisclosure: "内部合同风险说明",
    sources: [
      {
        id: "source-a",
        label: "内部合同来源",
        url: "https://research.invalid/method",
      },
    ],
    validFrom: "2026-01-02T00:00:00Z",
    validUntil: "2026-01-03T00:00:00Z",
  };
}

function publicationMetadata(): TradeStrategyPublicationMetadata {
  return {
    id: "contract-test",
    revision: 1,
    author: "author-a",
    reviewer: "reviewer-b",
    createdAt: "2026-01-01T00:00:00Z",
    reviewedAt: "2026-01-01T01:00:00Z",
    publishedAt: "2026-01-01T02:00:00Z",
    validFrom: "2026-01-02T00:00:00Z",
    validUntil: "2026-01-03T00:00:00Z",
  };
}

describe("trade strategy authoring contract", () => {
  it.each(["btc", "eth"] as const)(
    "creates and accepts a genuinely blank %s draft",
    (asset) => {
      const blank = createBlankTradeStrategyDraft(asset);
      expect(blank).toEqual({
        asset,
        bias: null,
        headline: "",
        summary: "",
        timeframes: [],
        priceZones: [],
        confirmationConditions: [],
        invalidationConditions: [],
        watchItems: [],
        riskDisclosure: "",
        sources: [],
        validFrom: null,
        validUntil: null,
      });
      expect(parseTradeStrategyDraftInput(blank)).toEqual({
        ok: true,
        value: blank,
        errors: [],
      });
    },
  );

  it("reports stable Chinese paths and codes for missing and unknown fields", () => {
    const input: Record<string, unknown> = {
      ...createBlankTradeStrategyDraft("btc"),
      extra: true,
    };
    delete input.headline;

    expect(parseTradeStrategyDraftInput(input)).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          path: "draft.headline",
          code: "missing_field",
          message: "缺少字段。",
        },
        {
          path: "draft.extra",
          code: "unknown_field",
          message: "不允许此字段。",
        },
      ],
    });
  });

  it.each([
    ["asset", "sol", "invalid_option"],
    ["bias", "up", "invalid_option"],
    ["headline", `x${"字".repeat(TRADE_STRATEGY_AUTHORING_LIMITS.headline)}`, "too_long"],
  ] as const)("rejects invalid %s", (field, value, code) => {
    const result = parseTradeStrategyDraftInput({
      ...createBlankTradeStrategyDraft("btc"),
      [field]: value,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: `draft.${field}`, code }),
        ]),
      );
    }
  });

  it("allows nullable draft prices and rejects every non-positive or non-finite price", () => {
    const nullable = {
      ...createBlankTradeStrategyDraft("btc"),
      priceZones: [
        {
          id: "",
          role: null,
          lower: null,
          upper: null,
          label: "",
          rationale: "",
          sourceIds: [],
        },
      ],
    };
    expect(parseTradeStrategyDraftInput(nullable).ok).toBe(true);

    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = parseTradeStrategyDraftInput({
        ...nullable,
        priceZones: [{ ...nullable.priceZones[0], lower: value }],
      });
      expect(result).toMatchObject({
        ok: false,
        errors: [
          {
            path: "draft.priceZones[0].lower",
            code: "invalid_number",
            message: "非空价格必须是大于 0 的有限数值。",
          },
        ],
      });
    }
  });

  it("rejects a reversed non-null price zone", () => {
    const result = parseTradeStrategyDraftInput({
      ...createBlankTradeStrategyDraft("btc"),
      priceZones: [
        {
          id: "",
          role: null,
          lower: 2,
          upper: 1,
          label: "",
          rationale: "",
          sourceIds: [],
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          path: "draft.priceZones[0].lower",
          code: "invalid_range",
          message: "区域下界不能高于上界。",
        },
      ],
    });
  });

  it("enforces array limits and duplicate timeframes", () => {
    const tooMany = parseTradeStrategyDraftInput({
      ...createBlankTradeStrategyDraft("btc"),
      confirmationConditions: Array.from(
        { length: TRADE_STRATEGY_AUTHORING_LIMITS.conditions + 1 },
        () => "",
      ),
    });
    expect(tooMany).toMatchObject({
      ok: false,
      errors: [
        {
          path: "draft.confirmationConditions",
          code: "too_many_items",
        },
      ],
    });

    const duplicate = parseTradeStrategyDraftInput({
      ...createBlankTradeStrategyDraft("btc"),
      timeframes: ["1h", "1h"],
    });
    expect(duplicate).toMatchObject({
      ok: false,
      errors: [{ path: "draft.timeframes[1]", code: "duplicate" }],
    });
  });

  it("allows a blank draft source URL but rejects unsafe non-empty URLs", () => {
    const blankSource = {
      ...createBlankTradeStrategyDraft("btc"),
      sources: [{ id: "", label: "", url: "" }],
    };
    expect(parseTradeStrategyDraftInput(blankSource).ok).toBe(true);

    for (const url of [
      "http://research.invalid",
      "https://user:secret@research.invalid",
      "https://research.invalid/page#private",
      "https://research.invalid/page#",
      "not-a-url",
    ]) {
      const result = parseTradeStrategyDraftInput({
        ...blankSource,
        sources: [{ id: "", label: "", url }],
      });
      expect(result).toMatchObject({
        ok: false,
        errors: [
          {
            path: "draft.sources[0].url",
            code: "invalid_url",
            message: "非空链接必须是绝对 HTTPS URL，且不能包含凭据或片段。",
          },
        ],
      });
    }
  });

  it("rejects source links that carry credential-like query parameters", () => {
    const result = parseTradeStrategyDraftInput({
      ...createBlankTradeStrategyDraft("btc"),
      sources: [
        {
          id: "source-a",
          label: "内部来源",
          url: "https://research.invalid/report?api_key=secret",
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          path: "draft.sources[0].url",
          code: "invalid_url",
          message: "链接不能包含疑似凭证的查询参数。",
        },
      ],
    });
  });

  it("keeps saveable drafts separate from the ready-for-review gate", () => {
    const result = validateTradeStrategyReadyForReview(
      createBlankTradeStrategyDraft("btc"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(({ path }) => path)).toEqual(
        expect.arrayContaining([
          "draft.headline",
          "draft.summary",
          "draft.bias",
          "draft.timeframes",
          "draft.priceZones",
          "draft.sources",
          "draft.confirmationConditions",
          "draft.invalidationConditions",
          "draft.riskDisclosure",
          "draft.validFrom",
          "draft.validUntil",
        ]),
      );
      expect(result.errors.every(({ message }) => /[\u4e00-\u9fff]/u.test(message))).toBe(
        true,
      );
    }
  });

  it("requires complete zones, sources and valid source references for review", () => {
    const draft = completeDraft();
    const result = validateTradeStrategyReadyForReview({
      ...draft,
      priceZones: [{ ...draft.priceZones[0], sourceIds: ["missing-source"] }],
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          path: "draft.priceZones[0].sourceIds[0]",
          code: "invalid_reference",
          message: "引用了不存在的来源。",
        },
      ],
    });
  });

  it("accepts a complete draft as ready for review", () => {
    const result = validateTradeStrategyReadyForReview(completeDraft());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bias).toBe("wait");
      expect(result.value.priceZones[0]?.lower).toBe(Number.EPSILON);
      expect(result.value.validUntil).toBe("2026-01-03T00:00:00Z");
    }
  });

  it("parses stored draft records without weakening their metadata", () => {
    const record = {
      schemaVersion: 1,
      id: "stored-draft",
      revision: 1,
      storedStatus: "draft",
      content: createBlankTradeStrategyDraft("eth"),
      author: "author-a",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(parseStoredTradeStrategyDraft(record)).toEqual({
      ok: true,
      value: record,
      errors: [],
    });

    const invalid = parseStoredTradeStrategyDraft({
      ...record,
      updatedAt: "2025-12-31T23:59:59Z",
    });
    expect(invalid).toMatchObject({
      ok: false,
      errors: [
        {
          path: "record.updatedAt",
          code: "invalid_time_order",
          message: "更新时间不能早于创建时间。",
        },
      ],
    });
  });

  it("requires every publication audit field explicitly", () => {
    const input: Record<string, unknown> = { ...publicationMetadata() };
    delete input.reviewer;
    expect(parseTradeStrategyPublicationMetadata(input)).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          path: "publication.reviewer",
          code: "missing_field",
          message: "缺少字段。",
        },
      ],
    });
  });

  it("prevents self-review after identity normalization", () => {
    const result = parseTradeStrategyPublicationMetadata({
      ...publicationMetadata(),
      author: "Author-A",
      reviewer: "author-a",
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          path: "publication.reviewer",
          code: "self_review",
          message: "作者不能审核自己的策略。",
        },
      ],
    });
  });

  it("rejects invalid audit chronology and invalid effective windows", () => {
    const chronology = parseTradeStrategyPublicationMetadata({
      ...publicationMetadata(),
      reviewedAt: "2025-12-31T23:59:59Z",
    });
    expect(chronology).toMatchObject({
      ok: false,
      errors: [
        {
          path: "publication.reviewedAt",
          code: "invalid_time_order",
          message: "审核时间不能早于创建时间。",
        },
      ],
    });

    const window = parseTradeStrategyPublicationMetadata({
      ...publicationMetadata(),
      validUntil: "2026-01-02T00:00:00Z",
    });
    expect(window).toMatchObject({
      ok: false,
      errors: [
        {
          path: "publication.validUntil",
          code: "invalid_time_order",
          message: "到期时间必须晚于生效时间。",
        },
      ],
    });
  });

  it("builds a strict published snapshot without ambient defaults", () => {
    const result = buildPublishedTradeStrategy(
      completeDraft(),
      publicationMetadata(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(parseTradeStrategy(result.value)).toEqual(result.value);
    expect(result.value).toMatchObject({
      id: "contract-test",
      revision: 1,
      storedStatus: "published",
      author: "author-a",
      reviewer: "reviewer-b",
      reviewedAt: "2026-01-01T01:00:00Z",
      publishedAt: "2026-01-01T02:00:00Z",
    });
  });

  it("allows a reviewed strategy to publish after validFrom while the window remains open", () => {
    const result = buildPublishedTradeStrategy(completeDraft(), {
      ...publicationMetadata(),
      reviewedAt: "2026-01-02T01:00:00Z",
      publishedAt: "2026-01-02T01:00:00Z",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects publication at or after the reviewed window expires", () => {
    const result = parseTradeStrategyPublicationMetadata({
      ...publicationMetadata(),
      reviewedAt: "2026-01-03T00:00:00Z",
      publishedAt: "2026-01-03T00:00:00Z",
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          path: "publication.publishedAt",
          code: "invalid_time_order",
          message: "发布时间必须早于到期时间。",
        },
      ],
    });
  });

  it("refuses to publish when the explicit window differs from the reviewed draft", () => {
    const result = buildPublishedTradeStrategy(completeDraft(), {
      ...publicationMetadata(),
      validUntil: "2026-01-04T00:00:00Z",
    });
    expect(result).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          path: "publication.validUntil",
          code: "window_mismatch",
          message: "发布到期时间必须与已审核草稿一致。",
        },
      ],
    });
  });
});
