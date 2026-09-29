"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import type { Market } from "@/lib/mock";
import { cn } from "@/lib/utils";

export type Screen = "home" | "markets" | "trade" | "confirm" | "card" | "fund" | "states";
export const SCREENS: Screen[] = ["home", "markets", "trade", "confirm", "card", "fund", "states"];

/** Asset glyph: tinted disc with ticker initials (placeholder for real asset logos). */
const hue: Record<string, string> = {
  XAU: "var(--gold)", NVDA: "#76b900", AAPL: "#8e8e93", TSLA: "#e31937", "EUR/USD": "#2a5bd7", "GBP/USD": "#5b2ad7", BTC: "#f7931a", ETH: "#627eea", MON: "#836ef9",
};
export function Glyph({ m, size = 36, square }: { m: Pick<Market, "symbol">; size?: number; square?: boolean }) {
  const c = hue[m.symbol] ?? "var(--primary)";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white", square ? "rounded-[calc(var(--radius)*0.6)]" : "rounded-full")}
      style={{ width: size, height: size, background: c, fontSize: size * 0.3 }}
    >
      {m.symbol === "XAU" ? "Au" : m.symbol.slice(0, m.symbol.includes("/") ? 3 : 2)}
    </span>
  );
}

/** Fires one Sonner toast on mount (21st shadcn/sonner) so the state is visible in a static screenshot. */
export function ToastOnMount({ title, description, kind = "error", dark }: { title: string; description: string; kind?: "error" | "success"; dark?: boolean }) {
  useEffect(() => {
    const t = setTimeout(() => (kind === "error" ? toast.error(title, { description, duration: 1e9 }) : toast.success(title, { description, duration: 1e9 })), 300);
    return () => clearTimeout(t);
  }, [title, description, kind]);
  return <Toaster position="top-center" theme={dark ? "dark" : "light"} richColors={false} />;
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("px-5 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground", className)}>{children}</p>;
}
