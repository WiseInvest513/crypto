import type { ReactNode } from "react";

export type ToolDirection = "long" | "short";
export type ToolCurrency = "USD" | "USDT";

export function CalculatorIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="calculator-intro">
      <div>
        <p className="panel-kicker">输入与结果</p>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </header>
  );
}

export function CalculatorFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="calculator-form-section">
      <legend>{title}</legend>
      {description && <p className="calculator-form-section__help">{description}</p>}
      <div className="calculator-fields">{children}</div>
    </fieldset>
  );
}

export function CalculatorField({
  id,
  label,
  hint,
  error,
  children,
  full = false,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`calculator-field${full ? " calculator-field--full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p className="calculator-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="calculator-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function DirectionField({
  value,
  onChange,
}: {
  value: ToolDirection;
  onChange: (value: ToolDirection) => void;
}) {
  return (
    <fieldset className="calculator-choice calculator-field--full">
      <legend>方向</legend>
      <div>
        <label>
          <input
            checked={value === "long"}
            name="direction"
            onChange={() => onChange("long")}
            type="radio"
            value="long"
          />
          <span>做多 Long</span>
        </label>
        <label>
          <input
            checked={value === "short"}
            name="direction"
            onChange={() => onChange("short")}
            type="radio"
            value="short"
          />
          <span>做空 Short</span>
        </label>
      </div>
    </fieldset>
  );
}

export function CurrencyField({
  value,
  onChange,
}: {
  value: ToolCurrency;
  onChange: (value: ToolCurrency) => void;
}) {
  return (
    <CalculatorField id="quote-currency" label="计价单位">
      <select
        id="quote-currency"
        value={value}
        onChange={(event) => onChange(event.target.value as ToolCurrency)}
      >
        <option value="USDT">USDT</option>
        <option value="USD">USD</option>
      </select>
    </CalculatorField>
  );
}

export function CalculatorActions({
  onReset,
  submitLabel = "计算结果",
  submitDisabled = false,
}: {
  onReset: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="calculator-actions">
      <button
        className="calculator-submit"
        disabled={submitDisabled}
        type="submit"
      >
        {submitLabel}
      </button>
      <button className="calculator-reset" type="button" onClick={onReset}>
        重置
      </button>
    </div>
  );
}

export function CalculatorResult({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="calculator-result" aria-live="polite" aria-atomic="true">
      <header>
        <p className="panel-kicker">估算结果</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function ResultGrid({
  items,
}: {
  items: readonly {
    label: string;
    value: string;
    detail?: string;
    tone?: "positive" | "negative" | "neutral";
  }[];
}) {
  return (
    <dl className="calculator-result-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={`value-direction--${item.tone ?? "neutral"}`}>
            {item.value}
          </dd>
          {item.detail && (
            <dd className="calculator-result-grid__detail">{item.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function ResultEmpty({ children }: { children: ReactNode }) {
  return <div className="calculator-result-empty">{children}</div>;
}
