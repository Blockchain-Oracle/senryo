"use client";
import { cn } from "@/lib/utils";
import { useEffect, type ReactNode } from "react";

/** 390px mobile canvas: iOS-like status bar + scrollable body + optional bottom nav. */
export function Phone({
  theme,
  dark,
  light,
  children,
  nav,
  className,
}: {
  theme: "d1" | "d2" | "d3" | "d4";
  dark?: boolean;
  light?: boolean;
  children: ReactNode;
  nav?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const cls = [`theme-${theme}`, dark ? "dark" : "", light ? "light" : ""].filter(Boolean);
    const el = document.documentElement;
    el.classList.add(...cls);
    return () => el.classList.remove(...cls);
  }, [theme, dark, light]);
  return (
    <div className={cn(`theme-${theme}`, dark && "dark", light && "light", "min-h-screen")}>
      <div className={cn("relative mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-background text-foreground", className)}>
        <StatusBar />
        <div className="flex-1 pb-6">{children}</div>
        {nav && <div className="relative z-40 w-full">{nav}</div>}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex h-11 items-center justify-between px-7 pt-1 text-[15px] font-semibold">
      <span className="tnum">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" opacity=".4" />
          <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
          <rect x="23" y="4" width="1.5" height="4" rx=".75" fill="currentColor" opacity=".4" />
        </svg>
      </span>
    </div>
  );
}
