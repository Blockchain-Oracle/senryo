// shadcn/input (dependency of 21st felipemenezes098/sign-in-4, D2 preview copy). D2: hairline, 4 px, mono, no shadow.
import { type ComponentProps, forwardRef } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-11 w-full rounded-sm border border-input bg-transparent px-3 font-mono text-body transition-colors duration-(--motion-fast) ease-desk placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-down",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
