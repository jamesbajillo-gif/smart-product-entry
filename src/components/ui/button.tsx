import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-3d-raised",
        destructive: "btn-3d-raised bg-[#808080] hover:bg-[#606060] active:bg-[#404040]",
        outline: "btn-3d-raised",
        secondary: "btn-3d-raised bg-[#d4d0c8] hover:bg-[#c0c0c0]",
        ghost: "bg-transparent hover:bg-[#d4d0c8] text-foreground border border-transparent",
        link: "text-[#0000ff] underline-offset-4 hover:underline bg-transparent border-0",
      },
      size: {
        default: "h-14 px-6 py-3 min-h-[56px]",
        sm: "h-12 px-4 py-2 min-h-[48px] text-sm",
        lg: "h-16 px-8 py-4 min-h-[64px] text-lg",
        icon: "h-14 w-14 min-h-[56px] min-w-[56px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
