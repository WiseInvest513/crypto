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

  it("limits live announcements to the concise result title", () => {
    const markup = renderToStaticMarkup(
      <CalculatorResult title="仓位估算" description="结果说明">
        <p>一段很长的结果内容</p>
      </CalculatorResult>,
    );

    expect(markup).toContain(
      '<section class="calculator-result" aria-labelledby="calculator-result-title">',
    );
    expect(markup).toContain(
      '<h2 id="calculator-result-title" aria-live="polite" aria-atomic="true">仓位估算</h2>',
    );
    expect(markup).not.toMatch(/<section[^>]+aria-live/);
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
