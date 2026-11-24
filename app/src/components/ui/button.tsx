import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-[10px] font-semibold transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent hover:bg-accent-deep",
        secondary: "bg-raised text-ink border border-line-strong hover:border-ink-3",
        ghost: "bg-transparent text-ink-2 hover:bg-raised hover:text-ink",
        danger: "bg-transparent text-risk border border-risk/50 hover:bg-risk/10",
      },
      size: {
        default: "min-h-[46px] px-4 text-[15px]",
        sm: "min-h-[44px] px-3 text-sm",
        lg: "min-h-[54px] px-5 text-base",
        icon: "min-h-[44px] min-w-[44px] p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";
