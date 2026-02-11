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
    labelSize?: 'xs' | 'sm';
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
    labelSize = 'sm'
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
        <div className="space-y-1.5">
            <label className={`font-medium text-text-muted ml-1 ${labelSize === 'xs' ? 'text-xs' : 'text-sm'}`}>{label}</label>
            <div className="relative">
                <input
                    type="text"
                    inputMode={isInteger ? "numeric" : "decimal"}
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full input-base focus:input-base-focus px-3 py-1.5 text-sm font-mono font-semibold text-text-main"
                />
                <div className="absolute right-0 top-0 h-full flex flex-col border-l border-border-subtle">
                    <button onClick={increment} className="flex-1 px-2 hover:bg-text-main/5 text-text-muted hover:text-brand-primary rounded-lg flex items-center justify-center group">
                        <ChevronUp className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={decrement} className="flex-1 px-2 hover:bg-text-main/5 text-text-muted hover:text-brand-primary rounded-lg flex items-center justify-center group">
                        <ChevronDown className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
