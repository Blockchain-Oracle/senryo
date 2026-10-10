"use client";
// The phone dock on the web (the phone's `components/shell/Dock.tsx`, D-268; Mitoshi `MobileDock.tsx` from 21st.dev
// 15742 starc007/dock via Baku): under 768 px, a floating capsule with the phone dock's order — Home · Markets ·
// [seal = Trade] · Calls · More — icons only (the labels are the accessible names), the current place's glyph filled
// in ink as on the phone (no pill: the seal is wider than a slot), More opening the Everything drawer.
import { ids } from "@senryo/identity";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { DOCK, isActive, NAV_ICON } from "./nav";

const SEAL_SIZE = 40;

function Dock({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Places" className="app-dock">
      <ul className="dock-list">
        {DOCK.map(({ key, seal, place }) => {
          if (!place) {
            return (
              <li key={key}>
                <button
                  type="button"
                  className="dock-item"
                  aria-haspopup="dialog"
                  aria-label="More"
                  onClick={() => {
                    tapFeedback();
                    openDrawer(DRAWERS.everything);
                  }}
                >
                  <LayoutGrid aria-hidden className="dock-icon" />
                </button>
              </li>
            );
          }
          const on = isActive(pathname, place);
          if (seal) {
            return (
              <li key={key}>
                <Link
                  href={place.href}
                  aria-label={place.label}
                  aria-current={on ? "page" : undefined}
                  className="dock-seal"
                  onClick={tapFeedback}
                >
                  <EntityMark
                    id={ids.brand("senryo")}
                    size={SEAL_SIZE}
                    variant="symbol"
                    decorative
                    ground="var(--accent)"
                  />
                </Link>
              </li>
            );
          }
          const Icon = NAV_ICON[place.icon];
          return (
            <li key={key}>
              <Link
                href={place.href}
                aria-label={place.label}
                aria-current={on ? "page" : undefined}
                className="dock-item"
                onClick={tapFeedback}
              >
                <Icon aria-hidden className="dock-icon" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DockWithPath() {
  return <Dock pathname={usePathname()} />;
}

export function MobileDock() {
  return (
    <Suspense fallback={<Dock pathname={null} />}>
      <DockWithPath />
    </Suspense>
  );
}
