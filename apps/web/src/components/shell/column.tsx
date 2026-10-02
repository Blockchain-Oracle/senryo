import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The phone column on the web: every page but the trade desk reads as the app, centred, with a 16 px gutter. */
export function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-xl px-4 pb-16", className)}>{children}</div>;
}
