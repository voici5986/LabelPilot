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
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  label,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`bg-text-main/5 p-0.5 rounded-lg flex border border-border-subtle relative isolate ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`relative z-0 flex flex-1 items-center justify-center gap-2 rounded-lg px-1 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "text-brand-primary"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-md border border-border-subtle bg-surface"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            {Icon && (
              <Icon
                className={`w-4 h-4 ${isActive ? "text-brand-primary" : "text-text-muted"} ${option.value === "landscape" ? "transform rotate-90" : ""}`}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
