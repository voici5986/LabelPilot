import type { ComponentPropsWithRef } from "react";

interface DialogBodyProps extends ComponentPropsWithRef<"div"> {
  "aria-labelledby": string;
}

export function DialogBody({
  className = "",
  role = "region",
  tabIndex = 0,
  ...divProps
}: DialogBodyProps) {
  return (
    <div
      {...divProps}
      role={role}
      tabIndex={tabIndex}
      className={`min-h-0 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary ${className}`}
    />
  );
}
