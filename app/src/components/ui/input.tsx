import * as React from "react";
import { cn } from "../../lib/utils";

const field =
  "w-full rounded-[10px] border border-line-strong bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 focus-visible:outline-none focus-visible:border-accent disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, "min-h-[46px]", className)} {...props} />
));
Input.displayName = "Input";

export const fieldClass = field;
