"use client";

import { Bell, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionChip } from "@/components/auth/session-chip";
import { Wordmark } from "@/components/shell/seal";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { activeTab, DESK_TABS, ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-(--motion-fast) ease-desk hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/**
 * D2 top strip: SENRYO wordmark · ● MONAD · PRACTICE (the active network from config) · bell, then the Vercel Tabs
 * row. Preview badges sit on the sections still fed by sample data, not here.
 */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-2 px-4 pt-2 pb-1">
        <Link
          href={ROUTES.portfolio}
          aria-label="Senryo portfolio"
          className="rounded-xs focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Wordmark />
        </Link>
        <div className="flex items-center gap-0.5">
          <SessionChip />
          <span
            className="flex items-center gap-1 px-1 font-mono text-label text-muted-foreground"
            title={`${ACTIVE_NETWORK.name} · ${ACTIVE_NETWORK.modeLabel}`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            MONAD
            <span className="hidden text-muted-foreground/70 uppercase sm:inline">· {ACTIVE_NETWORK.modeLabel}</span>
          </span>
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <button type="button" aria-label="Alerts" className={ICON_BUTTON}>
            <Bell className="size-4" />
          </button>
          <Link href={ROUTES.account} aria-label="Account" className={cn(ICON_BUTTON, "hidden sm:inline-flex")}>
            <UserRound className="size-4" />
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-screen-2xl overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <VercelTabs
          tabs={DESK_TABS}
          activeTab={activeTab(pathname) ?? ""}
          label="Desk"
          renderTab={({ tab, active, className, children }) => (
            <Link href={tab.href ?? "/"} aria-current={active ? "page" : undefined} className={className}>
              {children}
            </Link>
          )}
        />
      </div>
    </header>
  );
}
