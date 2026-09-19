import React, { useId, useRef, useState } from "react";

import { FieldShell } from "./ui/FieldShell";
import { StepperButton } from "./ui/StepperButton";

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
  const draftStartValue = useRef(value);
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

  const commitDraft = () => {
    const parsed = parseFloat(displayValue);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const normalized = normalizeValue(parsed);
    draftStartValue.current = normalized;
    onChange(normalized);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Escape" && draft !== null) {
      event.preventDefault();
      setDraft(null);
      onChange(draftStartValue.current);
    }
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

  return (
    <FieldShell label={label} htmlFor={inputId}>
      <div className="relative group">
        <input
          id={inputId}
          name={inputId}
          type="text"
          inputMode={isInteger ? "numeric" : "decimal"}
          value={displayValue}
          onChange={handleChange}
          onBlur={commitDraft}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            draftStartValue.current = value;
            setDraft(String(value));
            e.currentTarget.select();
          }}
          className="input-base focus:input-base-focus h-10 w-full py-1.5 pl-3 pr-20 font-mono text-sm font-semibold text-text-main lg:h-auto lg:pr-8"
        />
        <div className="absolute right-0 top-0 flex h-full w-20 flex-row overflow-hidden rounded-r-md border-l border-border-subtle/30 lg:w-8 lg:flex-col">
          <StepperButton
            direction="increment"
            layout="responsive"
            onClick={increment}
            disabled={!canIncrement}
            aria-label={`${label}: +${step}`}
            aria-controls={inputId}
          />
          <div className="order-1 h-full w-[1px] shrink-0 bg-border-subtle/30 lg:order-none lg:h-[1px] lg:w-full" />
          <StepperButton
            direction="decrement"
            layout="responsive"
            onClick={decrement}
            disabled={!canDecrement}
            aria-label={`${label}: -${step}`}
            aria-controls={inputId}
          />
        </div>
      </div>
    </FieldShell>
  );
}
