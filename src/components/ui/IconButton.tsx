import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const sizeStyles = {
  compact: {
    button: "h-[22px] w-[22px]",
    icon: "h-3.5 w-3.5",
    hitTarget: "[--hit-target-inset:-11px]",
    borderedHitTarget: "[--hit-target-inset:-12px]",
  },
  sm: {
    button: "h-6 w-6",
    icon: "h-4 w-4",
    hitTarget: "[--hit-target-inset:-10px]",
    borderedHitTarget: "[--hit-target-inset:-11px]",
  },
  md: {
    button: "h-8 w-8",
    icon: "h-4 w-4",
    hitTarget: "[--hit-target-inset:-6px]",
    borderedHitTarget: "[--hit-target-inset:-7px]",
  },
  lg: {
    button: "h-9 w-9",
    icon: "h-5 w-5",
    hitTarget: "[--hit-target-inset:-4px]",
    borderedHitTarget: "[--hit-target-inset:-5px]",
  },
} as const;

const toneStyles = {
  default:
    "text-text-main enabled:hover:bg-text-main/5 enabled:active:bg-text-main/10",
  neutral:
    "text-text-muted enabled:hover:bg-text-main/5 enabled:hover:text-text-main enabled:active:bg-text-main/10",
  brand:
    "text-text-muted enabled:hover:bg-text-main/5 enabled:hover:text-brand-primary enabled:active:bg-text-main/10",
  elevated:
    "border border-border-subtle bg-elevated text-text-muted enabled:hover:text-brand-primary enabled:active:bg-text-main/5",
  success:
    "text-text-muted enabled:hover:bg-success/10 enabled:hover:text-text-main enabled:active:bg-success/15",
  danger:
    "text-text-muted enabled:hover:bg-danger/10 enabled:hover:text-text-main enabled:active:bg-danger/15",
  warning:
    "text-text-muted enabled:hover:bg-warning/10 enabled:hover:text-text-main enabled:active:bg-warning/15",
} as const;

const shapeStyles = {
  sm: "rounded",
  md: "rounded-md",
  full: "rounded-full",
} as const;

type IconButtonSize = keyof typeof sizeStyles;
type IconButtonTone = keyof typeof toneStyles;
type IconButtonShape = keyof typeof shapeStyles;

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  "aria-label": string;
  children: ReactNode;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  shape?: IconButtonShape;
  expandedHitArea?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      "aria-label": ariaLabel,
      children,
      className = "",
      expandedHitArea = false,
      shape = "md",
      size = "md",
      tone = "neutral",
      type = "button",
      ...buttonProps
    },
    ref,
  ) {
    const hitTargetStyle =
      tone === "elevated"
        ? sizeStyles[size].borderedHitTarget
        : sizeStyles[size].hitTarget;

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={`flex shrink-0 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-30 ${sizeStyles[size].button} ${toneStyles[tone]} ${shapeStyles[shape]} ${expandedHitArea ? `hit-target ${hitTargetStyle}` : ""} ${className}`}
      >
        <span
          aria-hidden="true"
          className={`flex items-center justify-center [&>svg]:h-full [&>svg]:w-full ${sizeStyles[size].icon}`}
        >
          {children}
        </span>
      </button>
    );
  },
);
