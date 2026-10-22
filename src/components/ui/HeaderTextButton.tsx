import type { ComponentPropsWithRef } from "react";

export function HeaderTextButton({
  className = "",
  type = "button",
  ...buttonProps
}: ComponentPropsWithRef<"button">) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={`hit-target flex items-center justify-center gap-1.5 rounded-md p-2 text-sm font-semibold text-text-muted transition-colors enabled:hover:bg-text-main/5 enabled:hover:text-brand-primary enabled:active:bg-text-main/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-30 [--hit-target-inset:-4px] ${className}`}
    />
  );
}
