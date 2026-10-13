"use client";
// The Everything drawer (Mitoshi S22 `EverythingDrawer.tsx`; D-190): every destination that isn't a rail place, one
// home each; the right drawer at every width, opened from the rail, the dock's More, its key and `?d=everything`. Its
// search row opens ⌘K — one search (R6.1) — closing the drawer first. A link drops the URL param first, so Back from
// the new page doesn't reopen the drawer.
import { Search } from "lucide-react";
import Link from "next/link";
import { SlideOver } from "@/components/ui/drawer";
import { tapFeedback } from "@/lib/feedback";
import { useModCombo } from "@/lib/platform";
import { closeDrawer, dropDrawerParam, openDrawer } from "@/lib/shell/drawer-param";
import { openSearch } from "@/lib/shell/search-open";
import type { DrawerProps } from "./drawers/types";
import { EVERYTHING, NAV_ICON } from "./nav";

/** `/app/?d=wallet` opens that drawer in place; any other href is a page. */
function drawerOf(href: string): string | null {
  return href.startsWith("/app/?d=") ? href.slice("/app/?d=".length) : null;
}

export function EverythingDrawer({ open, onOpenChange }: DrawerProps) {
  const combo = useModCombo("K");
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Everything" description="Every place in Senryo">
      <div className="everything-search">
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            closeDrawer();
            openSearch();
          }}
        >
          <Search aria-hidden />
          <span>Search Senryo</span>
          <kbd aria-hidden>{combo}</kbd>
        </button>
      </div>
      <nav className="everything-groups" aria-label="Everything">
        {EVERYTHING.map((section) => (
          <section key={section.key} aria-labelledby={`everything-${section.key}`}>
            <h2 id={`everything-${section.key}`} className="everything-heading">
              {section.label}
            </h2>
            <div className="everything-links">
              {section.items.map((item) => {
                const Icon = NAV_ICON[item.icon];
                const drawer = drawerOf(item.href);
                const body = (
                  <>
                    <span className="everything-icon">
                      <Icon aria-hidden />
                    </span>
                    <span className="everything-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </>
                );
                return drawer ? (
                  <button
                    key={item.key}
                    type="button"
                    className="everything-link"
                    onClick={() => {
                      tapFeedback();
                      dropDrawerParam();
                      openDrawer(drawer);
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="everything-link"
                    onClick={() => {
                      tapFeedback();
                      dropDrawerParam();
                    }}
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </SlideOver>
  );
}
