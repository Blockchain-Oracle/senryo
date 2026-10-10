"use client";
// The line above the stage (Mitoshi S22 `TopLine.tsx`, from Baku/roy-chain's top line): on phones the seal (the rail is
// hidden there); Back below a place; search (⌘K or /), the `?` keyboard map, the mode capsule, the live health, the
// balance with its eye, the theme and the account. The palette and the keyboard map are lazy islands.
import { ids } from "@senryo/identity";
import { ChevronLeft, CircleHelp, Search } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SessionChip } from "@/components/auth/session-chip";
import { EntityMark } from "@/components/identity/entity-mark";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { tapFeedback } from "@/lib/feedback";
import { BalanceChip, HealthChip, ModeCapsule } from "./chips";
import { backOf } from "./nav";
import { shortcutBlocked } from "./Rail";

const CommandPalette = dynamic(() => import("./CommandPalette").then((m) => m.CommandPalette), { ssr: false });
const ShortcutsModal = dynamic(() => import("./ShortcutsModal").then((m) => m.ShortcutsModal), { ssr: false });

const SEAL_SIZE = 26;

function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const back = backOf(pathname);
  if (!back) return null;
  return (
    <button
      type="button"
      className="topline-icon"
      aria-label={`Back to ${back.label}`}
      onClick={() => router.push(back.href)}
    >
      <ChevronLeft aria-hidden />
    </button>
  );
}

export function TopLine() {
  // null = never opened (the island isn't loaded yet); then true / false.
  const [palette, setPalette] = useState<boolean | null>(null);
  const [keys, setKeys] = useState<boolean | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
        return;
      }
      if (shortcutBlocked(event)) return;
      if (event.key === "/") {
        event.preventDefault();
        setPalette(true);
      } else if (event.key === "?") {
        event.preventDefault();
        setKeys(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="app-topline">
      <div className="topline-lead">
        <Suspense fallback={null}>
          <BackButton />
        </Suspense>
        <Link href="/app/" aria-label="Senryo home" className="topline-seal">
          <EntityMark id={ids.brand("senryo")} size={SEAL_SIZE} variant="symbol" decorative ground="var(--seal)" />
        </Link>
        <button
          type="button"
          className="topline-search"
          aria-label="Search markets, places and actions"
          aria-keyshortcuts="Meta+K Control+K /"
          onClick={() => {
            tapFeedback();
            setPalette(true);
          }}
        >
          <Search aria-hidden />
          <span className="topline-search-label">Search</span>
          <kbd aria-hidden className="topline-kbd">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="topline-tools">
        <HealthChip className="topline-health" />
        <ModeCapsule className="topline-mode" />
        <BalanceChip className="topline-balance" />
        <button
          type="button"
          className="topline-icon topline-keys"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="?"
          onClick={() => {
            tapFeedback();
            setKeys(true);
          }}
        >
          <CircleHelp aria-hidden />
        </button>
        <ThemeToggle />
        <SessionChip />
      </div>
      {palette !== null ? <CommandPalette open={palette} onOpenChange={setPalette} /> : null}
      {keys !== null ? <ShortcutsModal open={keys} onOpenChange={setKeys} /> : null}
    </header>
  );
}
