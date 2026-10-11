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
  role = "status",
  ...divProps
}: InlineAlertProps) {
  return (
    <div
      {...divProps}
      role={role}
      className={`${toneStyles[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
