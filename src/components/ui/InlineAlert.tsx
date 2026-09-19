import type { HTMLAttributes, ReactNode } from "react";

const toneStyles = {
  danger: "text-danger",
  warning: "text-warning",
} as const;

interface InlineAlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: keyof typeof toneStyles;
}

/** Small alert module for inline validation and readiness messages. */
export function InlineAlert({
  children,
  className = "",
  tone = "danger",
  ...divProps
}: InlineAlertProps) {
  return (
    <div
      {...divProps}
      role="alert"
      className={`${toneStyles[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
