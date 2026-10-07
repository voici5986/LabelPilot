import { Minus, Plus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type StepperDirection = "increment" | "decrement";
type StepperVariant = "quantity" | "form";

interface StepperButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> {
  "aria-label": string;
  direction: StepperDirection;
  variant?: StepperVariant;
}

/**
 * Shared stepper action. Callers own value validation and normalization; this
 * module owns the button's icon, geometry, and interaction states.
 */
export function StepperButton({
  direction,
  variant = "quantity",
  className = "",
  ...buttonProps
}: StepperButtonProps) {
  const isIncrement = direction === "increment";
  const Icon = isIncrement ? Plus : Minus;

  return (
    <button
      {...buttonProps}
      type="button"
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors enabled:hover:bg-brand-primary/10 enabled:hover:text-brand-primary enabled:active:bg-brand-primary/10 focus-visible:z-10 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:text-text-muted/40 ${
        variant === "form" ? "lg:h-8 lg:w-8" : ""
      } ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
