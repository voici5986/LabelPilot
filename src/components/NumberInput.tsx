import React, { useState, useEffect } from "react";
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
    // Local state to handle string input allowing intermediate states like "3."
    const [localVal, setLocalVal] = useState(String(value));

    // Sync from parent prop to local state
    useEffect(() => {
        const parsed = parseFloat(localVal);
        if (parsed !== value && !isNaN(value)) {
            setLocalVal(String(value));
        }
    }, [value, localVal]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextVal = e.target.value;

        if (nextVal === '') {
            setLocalVal('');
            return;
        }

        if (isInteger && !/^\d+$/.test(nextVal)) return;

        if (decimalPlaces !== undefined) {
            const parts = nextVal.split('.');
            if (parts.length > 2) return;
            if (parts.length === 2 && parts[1].length > decimalPlaces) return;
        }

        setLocalVal(nextVal);
        const num = parseFloat(nextVal);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = () => {
        let num = parseFloat(localVal);
        if (isNaN(num)) num = min;

        if (num < min) num = min;
        if (num > max) num = max;

        if (isInteger) {
            num = Math.round(num);
        } else if (decimalPlaces !== undefined) {
            const m = Math.pow(10, decimalPlaces);
            num = Math.round(num * m) / m;
        }

        setLocalVal(String(num));
        onChange(num);
    };

    const step = propsStep ?? (isInteger ? 1 : (decimalPlaces ? Math.pow(10, -decimalPlaces) : 1));

    const increment = () => {
        const newVal = Math.min(max, value + step);
        const fixed = Number(newVal.toFixed(decimalPlaces || 0));
        onChange(fixed);
    };

    const decrement = () => {
        const newVal = Math.max(min, value - step);
        const fixed = Number(newVal.toFixed(decimalPlaces || 0));
        onChange(fixed);
    };

    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-sm font-medium text-text-muted ml-0.5 tracking-wider">
                {label}
            </label>
            <div className="relative group">
                <input
                    type="text"
                    inputMode={isInteger ? "numeric" : "decimal"}
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full input-base focus:input-base-focus pl-3 pr-8 py-1.5 text-sm font-mono font-semibold text-text-main"
                />
                <div className="absolute right-0 top-0 h-full w-8 flex flex-col border-l border-border-subtle/30 overflow-hidden rounded-r-lg">
                    <button
                        onClick={increment}
                        className="flex-1 flex items-center justify-center hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors group/btn"
                    >
                        <ChevronUp className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                    </button>
                    <div className="h-[1px] w-full bg-border-subtle/30" />
                    <button
                        onClick={decrement}
                        className="flex-1 flex items-center justify-center hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors group/btn"
                    >
                        <ChevronDown className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
