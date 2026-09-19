import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

const variantStyles = {
  primary:
    "bg-brand-primary text-on-brand transition-[background-color,filter] enabled:hover:brightness-110 enabled:active:brightness-95",
  secondary:
    "border border-border-subtle text-text-main transition-colors enabled:hover:bg-text-main/5 enabled:active:bg-text-main/10",
  quiet:
    "text-text-muted transition-colors enabled:hover:bg-text-main/5 enabled:hover:text-text-main enabled:active:bg-text-main/10",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
} as const;

const weightStyles = {
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

const disabledOpacityStyles = {
  subtle: "disabled:opacity-40",
  visible: "disabled:opacity-70",
} as const;

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  weight?: keyof typeof weightStyles;
  disabledOpacity?: keyof typeof disabledOpacityStyles;
}

/**
 * Deep text-action module. Callers choose intent and own layout; this module
 * owns focus, disabled, hover, and pressed-state behavior.
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      className = "",
      disabledOpacity = "subtle",
      size = "md",
      type = "button",
      variant = "primary",
      weight = "semibold",
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 rounded-md ${weightStyles[weight]} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed ${disabledOpacityStyles[disabledOpacity]} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      />
    );
  },
);
