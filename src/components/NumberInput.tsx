import React, { useId, useRef, useState } from "react";

import { useI18n } from "../utils/i18nContext";
import { FieldShell } from "./ui/FieldShell";
import { StepperButton } from "./ui/StepperButton";

interface NumberInputProps {
  label: string;
  value: number;
  /** Logical value to restore when the displayed value is temporarily constrained. */
  rollbackValue?: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  isInteger?: boolean;
  decimalPlaces?: number;
  step?: number;
  showStepper?: boolean;
}

export function NumberInput({
  label,
  value,
  rollbackValue,
  onChange,
  min,
  max,
  isInteger,
  decimalPlaces,
  step: propsStep,
  showStepper = false,
}: NumberInputProps) {
  const { t } = useI18n();
  const inputId = useId();
  const [clampAnnouncement, setClampAnnouncement] = useState("");
  // Preserve the raw draft until commit, including intermediate out-of-range values.
  const [draft, setDraft] = useState<string | null>(null);
  const draftStartValue = useRef(rollbackValue ?? value);
  const displayValue = draft ?? String(value);
  const visibleNumber = Number(displayValue);
  const hasVisibleNumber =
    displayValue.trim() !== "" && Number.isFinite(visibleNumber);
  const invalidDraft =
    draft !== null &&
    (!hasVisibleNumber || visibleNumber < min || visibleNumber > max);

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
    setClampAnnouncement("");

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

    setDraft(nextVal);
    if (num >= min && num <= max) {
      onChange(normalizeValue(num));
    }
  };

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseFloat(displayValue);
    setDraft(null);
    if (!Number.isFinite(parsed)) {
      draftStartValue.current = rollbackValue ?? value;
      return;
    }
    const normalized = normalizeValue(parsed);
    if (parsed < min || parsed > max) {
      setClampAnnouncement(t("number_clamped", { label, value: normalized }));
    }
    draftStartValue.current = normalized;
    onChange(normalized);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Escape" && draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      onChange(draftStartValue.current);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const parsed = parseFloat(displayValue);
      const current = Number.isFinite(parsed) ? parsed : value;
      const next = normalizeValue(
        current + (event.key === "ArrowUp" ? step : -step),
      );
      if (next === current) return;
      setDraft(String(next));
      onChange(next);
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
      <div
        className={
          showStepper
            ? "flex h-10 items-center overflow-hidden rounded-md bg-surface outline-1 outline-offset-[-1px] outline-border-subtle lg:h-8"
            : ""
        }
      >
        {showStepper && (
          <StepperButton
            direction="decrement"
            variant="form"
            onClick={decrement}
            disabled={!canDecrement}
            aria-label={`${label}: -${step}`}
            aria-controls={inputId}
          />
        )}
        <input
          id={inputId}
          name={inputId}
          type="text"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hasVisibleNumber ? visibleNumber : undefined}
          aria-valuetext={`${label}: ${displayValue}`}
          aria-invalid={invalidDraft || undefined}
          inputMode={isInteger ? "numeric" : "decimal"}
          value={displayValue}
          onChange={handleChange}
          onBlur={commitDraft}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setClampAnnouncement("");
            draftStartValue.current = rollbackValue ?? value;
            e.currentTarget.select();
          }}
          className={`font-mono text-sm font-semibold text-text-main ${
            showStepper
              ? "input-disabled relative h-full min-w-0 flex-1 border-x border-border-subtle/40 bg-transparent px-1 text-center focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary"
              : "input-base focus:input-base-focus h-10 w-full px-3 py-1.5 text-left lg:h-8"
          }`}
        />
        {showStepper && (
          <StepperButton
            direction="increment"
            variant="form"
            onClick={increment}
            disabled={!canIncrement}
            aria-label={`${label}: +${step}`}
            aria-controls={inputId}
          />
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {clampAnnouncement}
      </div>
    </FieldShell>
  );
}
