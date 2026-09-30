"use client";

// shadcn/label (dependency of 21st felipemenezes098/sign-in-4). D2: mono, uppercase, tracked micro label.
import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "font-mono text-label text-muted-foreground uppercase tracking-[0.14em] peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
