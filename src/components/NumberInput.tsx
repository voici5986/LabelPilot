import React, { useState, useEffect, useId } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

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
  // Local state to handle string input allowing intermediate states like "3."
  const [localVal, setLocalVal] = useState(String(value));

  // Sync from parent prop to local state
  useEffect(() => {
    const next = String(value);
    setLocalVal((prev) => (prev === next ? prev : next));
  }, [value]);

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
      setLocalVal("");
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
    setLocalVal(normalized === num ? nextVal : String(normalized));
    onChange(normalized);
  };

  const handleBlur = () => {
    const num = normalizeValue(parseFloat(localVal));

    setLocalVal(String(num));
    onChange(num);
  };

  const step =
    propsStep ??
    (isInteger ? 1 : decimalPlaces ? Math.pow(10, -decimalPlaces) : 1);

  const increment = () => {
    onChange(normalizeValue(value + step));
  };

  const decrement = () => {
    onChange(normalizeValue(value - step));
  };

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
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={(e) => (e.target as HTMLInputElement).select()}
          className="h-[50px] w-full input-base focus:input-base-focus py-1.5 pl-3 pr-12 text-sm font-mono font-semibold text-text-main"
        />
        <div className="absolute right-0 top-0 flex h-full w-11 flex-col overflow-hidden rounded-r-lg border-l border-border-subtle/30">
          <button
            type="button"
            onClick={increment}
            aria-label={`${label}: +${step}`}
            aria-controls={inputId}
            className="flex-1 flex items-center justify-center hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors group/btn"
          >
            <ChevronUp className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
          </button>
          <div className="h-[1px] w-full bg-border-subtle/30" />
          <button
            type="button"
            onClick={decrement}
            aria-label={`${label}: -${step}`}
            aria-controls={inputId}
            className="flex-1 flex items-center justify-center hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors group/btn"
          >
            <ChevronDown className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
