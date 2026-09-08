import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CalculatorField,
  CalculatorResult,
  ResultGrid,
} from "../../src/components/tools/calculator-ui";
import {
  calculatorInputA11y,
  focusFirstCalculatorError,
  revalidateCalculatorErrors,
} from "../../src/components/tools/calculator-form-utils";
import {
  getShareFeedbackAnnouncement,
  getShareFeedbackLabel,
  nextShareFeedback,
  type ShareFeedbackState,
} from "../../src/components/tools/share-tool-link";

describe("calculator accessibility behavior", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps field guidance available alongside a non-alert field error", () => {
    const inputA11y = calculatorInputA11y(
      "position-balance",
      "账户余额必须大于 0。",
    );
    const markup = renderToStaticMarkup(
      CalculatorField({
        id: "position-balance",
        label: "账户余额",
        hint: "用于计算风险预算。",
        error: "账户余额必须大于 0。",
        children: createElement("input", {
          ...inputA11y,
          id: "position-balance",
        }),
      }),
    );

    expect(inputA11y["aria-describedby"]).toBe(
      "position-balance-hint position-balance-error",
    );
    expect(markup).toContain('id="position-balance-hint"');
    expect(markup).toContain('id="position-balance-error"');
    expect(markup).not.toContain('role="alert"');
  });

  it("focuses a field error before considering the general error summary", () => {
    vi.useFakeTimers();
    const field = { focus: vi.fn() };
    const summary = { focus: vi.fn(), setAttribute: vi.fn() };
    const form = {
      querySelector: vi
        .fn()
        .mockReturnValueOnce(field)
        .mockReturnValueOnce(summary),
    } as unknown as HTMLFormElement;

    focusFirstCalculatorError(form);
    vi.runAllTimers();

    expect(field.focus).toHaveBeenCalledOnce();
    expect(summary.focus).not.toHaveBeenCalled();
    expect(form.querySelector).toHaveBeenCalledTimes(1);
  });

  it("focuses the general error summary only when no field is invalid", () => {
    vi.useFakeTimers();
    const summary = { focus: vi.fn(), setAttribute: vi.fn() };
    const form = {
      querySelector: vi.fn((selector: string) =>
        selector === ".calculator-form-error" ? summary : null,
      ),
    } as unknown as HTMLFormElement;

    focusFirstCalculatorError(form);
    vi.runAllTimers();

    expect(summary.setAttribute).toHaveBeenCalledWith("tabindex", "-1");
    expect(summary.focus).toHaveBeenCalledOnce();
  });

  it("keeps focus on the result region and announces only a concise summary", () => {
    const markup = renderToStaticMarkup(
      <CalculatorResult
        title="仓位估算"
        description="结果说明"
        ready
        resultKey="result-1"
        announcement="仓位估算已更新。资产数量 0.05。"
      >
        <p>一段很长的结果内容</p>
      </CalculatorResult>,
    );

    expect(markup).toContain(
      '<section class="calculator-result" aria-labelledby="calculator-result-title" tabindex="-1">',
    );
    expect(markup).toContain(
      '<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">仓位估算已更新。资产数量 0.05。</p>',
    );
    expect(markup).toContain('<h2 id="calculator-result-title">仓位估算</h2>');
    expect(markup).not.toMatch(/<section[^>]+aria-live/);
    expect(markup).not.toMatch(/<h2[^>]+aria-live/);
  });

  it("clears a stale relationship error when the edited form becomes valid", () => {
    expect(
      revalidateCalculatorErrors(
        { stopPrice: "多单止损价必须低于入场价。" },
        { ok: true, value: { quantity: 0.05 } },
      ),
    ).toEqual({});
  });

  it("replaces a relationship error with the current validation result", () => {
    expect(
      revalidateCalculatorErrors(
        { targetPrice: "多单价格顺序错误。" },
        {
          ok: false,
          errors: [
            {
              field: "targetPrice",
              code: "invalid_price_order",
              message: "空单价格顺序必须为：目标价 < 入场价 < 止损价。",
            },
          ],
        },
      ),
    ).toEqual({
      targetPrice: "空单价格顺序必须为：目标价 < 入场价 < 止损价。",
    });
  });

  it("marks an optional primary result without changing other result items", () => {
    const markup = renderToStaticMarkup(
      createElement(ResultGrid, {
        items: [
          { label: "核心结果", value: "1.00 USDT", primary: true },
          { label: "辅助结果", value: "2.00 USDT" },
        ],
      }),
    );

    expect(markup).toContain('class="calculator-result-grid__item--primary"');
    expect(markup.match(/calculator-result-grid__item--primary/g)).toHaveLength(1);
  });
});

describe("share feedback announcements", () => {
  it("produces a new sequence for every repeated outcome", () => {
    const initial: ShareFeedbackState = { kind: "idle", sequence: 0 };
    const first = nextShareFeedback(initial, "copied");
    const second = nextShareFeedback(first, "copied");

    expect(first).toEqual({ kind: "copied", sequence: 1 });
    expect(second).toEqual({ kind: "copied", sequence: 2 });
    expect(getShareFeedbackLabel(second.kind)).toBe("已复制工具链接");
    expect(getShareFeedbackAnnouncement(first)).toBe(
      "第 1 次操作反馈：已复制工具链接",
    );
    expect(getShareFeedbackAnnouncement(second)).toBe(
      "第 2 次操作反馈：已复制工具链接",
    );
  });
});
