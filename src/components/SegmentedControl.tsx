import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Option<T> {
    label: string;
    value: T;
    icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    layoutId: string;
    className?: string;
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    layoutId,
    className = ""
}: SegmentedControlProps<T>) {
    return (
        <div className={`bg-text-main/5 p-0.5 rounded-lg flex border border-border-subtle relative isolate ${className}`}>
            {options.map((option) => {
                const isActive = option.value === value;
                const Icon = option.icon;

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`flex-1 py-1.5 px-1 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors relative z-0 ${isActive ? "text-brand-primary" : "text-text-muted hover:text-text-main"
                            }`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={layoutId}
                                className="absolute inset-0 bg-surface shadow-sm rounded-lg -z-10"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        {Icon && <Icon className={`w-4 h-4 ${isActive ? "text-brand-primary" : "text-text-muted"} ${option.value === 'landscape' ? 'transform rotate-90' : ''}`} />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
