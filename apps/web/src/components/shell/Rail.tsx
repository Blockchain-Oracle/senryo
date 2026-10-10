"use client";
// The floating rail (Mitoshi S22 `Rail.tsx`, ported from Baku/roy-chain's Slush-measured rail; 21st.dev 21517
// unlumen/animated-sidebar for the sliding pill): the seal and the word, the places from the shared nav with their
// keys, Everything, and a foot the shell fills (money and account). The active pill moves by a CSS transform (no
// motion runtime in the first load). Hidden under 768 px, where the top line and the dock take over.
import { ids } from "@senryo/identity";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, Suspense, useEffect } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { EVERYTHING_KEY, isActive, NAV_ICON, RAIL } from "./nav";

const SEAL_SIZE = 28;

/** True while the user is typing or a dialog holds focus, so single-key shortcuts stay out of the way. */
export function shortcutBlocked(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const t = event.target;
  if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)))
    return true;
  return document.querySelector('[role="dialog"]') !== null;
}

/** 1…n jump between the places, the next key opens Everything. Mounted once, by the rail. */
function usePlaceKeys(): void {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shortcutBlocked(event)) return;
      if (event.key === EVERYTHING_KEY) {
        event.preventDefault();
        openDrawer(DRAWERS.everything);
        return;
      }
      const item = /^[1-9]$/.test(event.key) ? RAIL[Number(event.key) - 1] : undefined;
      if (!item) return;
      event.preventDefault();
      router.push(item.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}

function RailNav({ pathname }: { pathname: string | null }) {
  const active = RAIL.findIndex((item) => isActive(pathname, item));
  return (
    <nav aria-label="Places" className="rail-nav">
      <span
        aria-hidden
        className="rail-pill"
        data-on={active >= 0 ? "" : undefined}
        style={{ "--rail-i": Math.max(active, 0) } as CSSProperties}
      />
      {RAIL.map((item, i) => {
        const Icon = NAV_ICON[item.icon];
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={i === active ? "page" : undefined}
            title={`${item.label} — ${item.description} (${i + 1})`}
            className="rail-item"
            onClick={tapFeedback}
          >
            <Icon aria-hidden className="rail-icon" />
            <span className="rail-label">{item.label}</span>
            <kbd aria-hidden className="rail-key">
              {i + 1}
            </kbd>
          </Link>
        );
      })}
      <button
        type="button"
        className="rail-item"
        aria-haspopup="dialog"
        title={`Everything — every other place (${EVERYTHING_KEY})`}
        onClick={() => {
          tapFeedback();
          openDrawer(DRAWERS.everything);
        }}
      >
        <LayoutGrid aria-hidden className="rail-icon" />
        <span className="rail-label">Everything</span>
        <kbd aria-hidden className="rail-key">
          {EVERYTHING_KEY}
        </kbd>
      </button>
    </nav>
  );
}

function RailNavWithPath() {
  return <RailNav pathname={usePathname()} />;
}

export function Rail({ foot }: { foot?: ReactNode }) {
  usePlaceKeys();
  return (
    <aside className="app-rail" aria-label="Senryo">
      <Link href="/app/" aria-label="Senryo home" className="rail-mark">
        <span className="rail-seal">
          <EntityMark id={ids.brand("senryo")} size={SEAL_SIZE} variant="symbol" decorative ground="var(--seal)" />
        </span>
        <span className="rail-word">SENRYO</span>
      </Link>
      <Suspense fallback={<RailNav pathname={null} />}>
        <RailNavWithPath />
      </Suspense>
      {foot ? <div className="rail-foot">{foot}</div> : null}
    </aside>
  );
}
