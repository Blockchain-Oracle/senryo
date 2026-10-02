"use client";

import { ids } from "@senryo/identity";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionChip } from "@/components/auth/session-chip";
import { EntityMark } from "@/components/identity/entity-mark";
import { SealMark } from "@/components/shell/seal";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MODE_MARK_SIZE } from "@/lib/constants/brand";
import { APP_TABS, activeTab, ROUTES } from "@/lib/constants/routes";

/**
 * The web shell's top strip (the phone's dock as tabs, a declared desktop adaptation): the seal → Home, the five
 * destinations Home · Markets · Card · Social · You, then the session chip and the mode label (Monad mark + Practice).
 * The web runs Practice only until the Mainnet core is deployed; the label says which mode every figure is in.
 */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-border/60 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3">
        <Link
          href={ROUTES.home}
          aria-label="Senryo home"
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-ring"
        >
          <SealMark />
        </Link>
        <div className="hidden min-w-0 flex-1 overflow-x-auto py-1 [scrollbar-width:none] sm:block">
          <VercelTabs
            tabs={APP_TABS}
            activeTab={activeTab(pathname) ?? ""}
            label="Senryo"
            renderTab={({ tab, active, className, children }) => (
              <Link href={tab.href ?? "/"} aria-current={active ? "page" : undefined} className={className}>
                {children}
              </Link>
            )}
          />
        </div>
        <span className="flex-1 sm:hidden" />
        <SessionChip />
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-raised-2 py-1 pr-3 pl-1 text-meta"
          title={`${ACTIVE_NETWORK.name} · ${ACTIVE_NETWORK.modeLabel}`}
        >
          <EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={MODE_MARK_SIZE} decorative />
          {ACTIVE_NETWORK.modeLabel}
        </span>
        <span className="hidden md:inline-flex">
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}
