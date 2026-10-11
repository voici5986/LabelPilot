import type { ReactNode } from "react";

interface FieldShellProps {
  children: ReactNode;
  htmlFor: string;
  label: string;
  hint?: ReactNode;
  hintId?: string;
  className?: string;
}

/**
 * Keeps label and hint association in one small interface. Input
 * parsing and validation remain with the caller.
 */
export function FieldShell({
  children,
  className = "",
  hint,
  hintId,
  htmlFor,
  label,
}: FieldShellProps) {
  return (
    <div className={`flex-1 space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="ml-0.5 text-sm font-medium text-text-muted"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <div id={hintId} className="text-xs text-text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
