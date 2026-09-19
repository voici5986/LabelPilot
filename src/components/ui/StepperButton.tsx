import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type StepperDirection = "increment" | "decrement";
type StepperLayout = "horizontal" | "responsive";

interface StepperButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> {
  "aria-label": string;
  direction: StepperDirection;
  layout?: StepperLayout;
}

/**
 * Shared stepper action. Callers own value validation and normalization; this
 * module owns the button's icon, geometry, and interaction states.
 */
export function StepperButton({
  direction,
  layout = "horizontal",
  className = "",
  ...buttonProps
}: StepperButtonProps) {
  const isIncrement = direction === "increment";
  const MobileIcon = isIncrement ? Plus : Minus;
  const DesktopIcon = isIncrement ? ChevronUp : ChevronDown;
  const responsiveOrder = isIncrement
    ? "order-2 lg:order-none"
    : "order-0 lg:order-none";

  return (
    <button
      {...buttonProps}
      type="button"
      className={`group/stepper relative flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors enabled:hover:bg-brand-primary/10 enabled:hover:text-brand-primary enabled:active:bg-brand-primary/10 focus-visible:z-10 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:text-text-muted/40 ${
        layout === "responsive"
          ? `lg:h-auto lg:w-auto lg:flex-1 ${responsiveOrder}`
          : ""
      } ${className}`}
    >
      <MobileIcon
        className={`h-4 w-4 ${layout === "responsive" ? "lg:hidden" : ""}`}
        aria-hidden="true"
      />
      {layout === "responsive" ? (
        <DesktopIcon
          className="hidden h-3.5 w-3.5 transition-transform group-enabled/stepper:group-hover/stepper:scale-110 lg:block"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}
