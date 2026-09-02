import type { ToolValidationIssue } from "@/lib/tools";

export type CalculatorFieldErrors = Readonly<Record<string, string>>;

export function parseCalculatorNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function mapCalculatorErrors(
  issues: readonly ToolValidationIssue[],
): CalculatorFieldErrors {
  return Object.fromEntries(
    issues.map((issue) => [issue.field, issue.message]),
  );
}

export function calculatorInputA11y(
  id: string,
  error: string | undefined,
  hasHint = true,
) {
  const describedBy = [
    hasHint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter((descriptionId): descriptionId is string => descriptionId !== null)
    .join(" ");

  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? (true as const) : undefined,
  };
}

export function focusFirstCalculatorError(
  form: HTMLFormElement | null,
): void {
  globalThis.setTimeout(() => {
    const fieldWithError = form?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (fieldWithError) {
      fieldWithError.focus();
      return;
    }

    const errorSummary = form?.querySelector<HTMLElement>(
      ".calculator-form-error",
    );
    if (!errorSummary) {
      return;
    }

    errorSummary.setAttribute("tabindex", "-1");
    errorSummary.focus();
  }, 0);
}
