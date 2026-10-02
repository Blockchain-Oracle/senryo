"use client";

/**
 * The phone's dock on phone-width browsers: the five destinations Home · Markets · Card · Social · You as a fixed bar
 * at the bottom, icon over label, the active one in full ink. From `sm` up the top strip carries the same tabs.
 */
import { ChartCandlestick, CreditCard, House, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { APP_TABS, activeTab } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const ICON: Record<string, ReactNode> = {
  home: <House />,
  markets: <ChartCandlestick />,
  card: <CreditCard />,
  social: <UsersRound />,
  you: <UserRound />,
};

export function BottomDock() {
  const active = activeTab(usePathname());
  return (
    <nav
      aria-label="Senryo"
      className="fixed inset-x-0 bottom-0 z-30 border-border/60 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {APP_TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={active === tab.id ? "page" : undefined}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-micro [&_svg]:size-5",
                active === tab.id ? "text-foreground" : "text-text-3",
              )}
            >
              {ICON[tab.id]}
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
