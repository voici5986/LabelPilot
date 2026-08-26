import { ChevronUp, ChevronDown, Minus, Plus } from "lucide-react";
import React, { useId, useState } from "react";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  isInteger?: boolean;
  decimalPlaces?: number;
  step?: number;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  isInteger,
  decimalPlaces,
  step: propsStep,
}: NumberInputProps) {
  const inputId = useId();
  // A draft exists only while the user is editing an intermediate value such as "3.".
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  const normalizeValue = (candidate: number) => {
    if (!Number.isFinite(candidate)) return min;

    let next = Math.min(max, Math.max(min, candidate));
    if (isInteger) {
      next = Math.round(next);
    } else if (decimalPlaces !== undefined) {
      const multiplier = Math.pow(10, decimalPlaces);
      next = Math.round(next * multiplier) / multiplier;
    }
    return next;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;

    if (nextVal === "") {
      setDraft("");
      return;
    }

    if (isInteger && !/^\d+$/.test(nextVal)) return;

    if (decimalPlaces !== undefined) {
      const parts = nextVal.split(".");
      if (parts.length > 2) return;
      if (parts.length === 2 && parts[1].length > decimalPlaces) return;
    }

    const num = parseFloat(nextVal);
    if (!Number.isFinite(num)) return;

    const normalized = normalizeValue(num);
    setDraft(normalized === num ? nextVal : String(normalized));
    onChange(normalized);
  };

  const handleBlur = () => {
    setDraft(null);
    const parsed = parseFloat(displayValue);
    if (!Number.isFinite(parsed)) return;
    onChange(normalizeValue(parsed));
  };

  const step =
    propsStep ??
    (isInteger ? 1 : decimalPlaces ? Math.pow(10, -decimalPlaces) : 1);

  // 到达 min / max 边界时禁用对应步进按钮，避免"看起来可点但数值不变"。
  const EPSILON = 1e-9;
  const canIncrement = normalizeValue(value + step) > value + EPSILON;
  const canDecrement = normalizeValue(value - step) < value - EPSILON;

  const increment = () => {
    setDraft(null);
    onChange(normalizeValue(value + step));
  };

  const decrement = () => {
    setDraft(null);
    onChange(normalizeValue(value - step));
  };

  const stepperClass = (enabled: boolean) =>
    `group/btn flex w-10 shrink-0 items-center justify-center transition-colors active:bg-brand-primary/10 lg:w-auto lg:flex-1 ${
      enabled
        ? "text-text-muted hover:bg-brand-primary/10 hover:text-brand-primary"
        : "cursor-not-allowed text-text-muted/40"
    }`;

  const chevronClass = (enabled: boolean) =>
    `w-3.5 h-3.5 transition-transform ${
      enabled ? "group-hover/btn:scale-110" : ""
    }`;

  return (
    <div className="space-y-1.5 flex-1">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-text-muted ml-0.5 tracking-wider"
      >
        {label}
      </label>
      <div className="relative group">
        <input
          id={inputId}
          name={inputId}
          type="text"
          inputMode={isInteger ? "numeric" : "decimal"}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={(e) => {
            setDraft(String(value));
            e.currentTarget.select();
          }}
          className="input-base focus:input-base-focus h-10 w-full py-1.5 pl-3 pr-20 font-mono text-sm font-semibold text-text-main lg:h-auto lg:pr-8"
        />
        <div className="absolute right-0 top-0 flex h-full w-20 flex-row overflow-hidden rounded-r-md border-l border-border-subtle/30 lg:w-8 lg:flex-col">
          <button
            type="button"
            onClick={increment}
            disabled={!canIncrement}
            aria-label={`${label}: +${step}`}
            aria-controls={inputId}
            className={`${stepperClass(canIncrement)} order-2 lg:order-none`}
          >
            <Plus className="h-4 w-4 lg:hidden" />
            <ChevronUp
              className={`${chevronClass(canIncrement)} hidden lg:block`}
            />
          </button>
          <div className="order-1 h-full w-[1px] shrink-0 bg-border-subtle/30 lg:order-none lg:h-[1px] lg:w-full" />
          <button
            type="button"
            onClick={decrement}
            disabled={!canDecrement}
            aria-label={`${label}: -${step}`}
            aria-controls={inputId}
            className={`${stepperClass(canDecrement)} order-0 lg:order-none`}
          >
            <Minus className="h-4 w-4 lg:hidden" />
            <ChevronDown
              className={`${chevronClass(canDecrement)} hidden lg:block`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
