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
  return {
    "aria-describedby": error
      ? `${id}-error`
      : hasHint
        ? `${id}-hint`
        : undefined,
    "aria-invalid": error ? (true as const) : undefined,
  };
}

export function focusFirstCalculatorError(
  form: HTMLFormElement | null,
): void {
  window.setTimeout(() => {
    form
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, 0);
}
