import type { ReactNode } from "react";

interface FieldShellProps {
  children: ReactNode;
  htmlFor: string;
  label: string;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
  className?: string;
}

/**
 * Keeps label, hint, and error association in one small interface. Input
 * parsing and validation remain with the caller.
 */
export function FieldShell({
  children,
  className = "",
  error,
  errorId,
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
      {error ? (
        <div id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </div>
      ) : null}
    </div>
  );
}
