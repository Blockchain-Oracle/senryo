"use client";
// The Everything drawer (Mitoshi S22 `EverythingDrawer.tsx`; D-190): every destination that isn't a rail place, one
// home each, with search at the top; the right drawer at every width, opened from the rail, the dock's More, its key
// and `?d=everything`. A link drops the URL param first, so Back from the new page doesn't reopen the drawer.
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SlideOver } from "@/components/ui/drawer";
import { tapFeedback } from "@/lib/feedback";
import { dropDrawerParam, openDrawer } from "@/lib/shell/drawer-param";
import type { DrawerProps } from "./drawers/types";
import { EVERYTHING, NAV_ICON, searchNav } from "./nav";

/** `/app/?d=wallet` opens that drawer in place; any other href is a page. */
function drawerOf(href: string): string | null {
  return href.startsWith("/app/?d=") ? href.slice("/app/?d=".length) : null;
}

export function EverythingDrawer({ open, onOpenChange }: DrawerProps) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const sections = useMemo(
    () => EVERYTHING.map((s) => ({ ...s, items: searchNav(s.items, query) })).filter((s) => s.items.length > 0),
    [query],
  );

  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Everything" description="Every place in Senryo">
      <search className="everything-search">
        <label>
          <span className="sr-only">Search everything</span>
          <Search aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            autoComplete="off"
            enterKeyHint="go"
          />
        </label>
      </search>
      <nav className="everything-groups" aria-label="Everything">
        {sections.length === 0 ? (
          <p className="everything-empty" role="status">
            Nothing matches “{query}”.
          </p>
        ) : null}
        {sections.map((section) => (
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
