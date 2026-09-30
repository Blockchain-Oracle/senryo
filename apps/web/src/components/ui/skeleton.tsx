// 21st: shadcn/skeleton (#1588). D2: square-ish row blocks on the muted surface.
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-xs bg-muted", className)} {...props} />;
}

export { Skeleton };
