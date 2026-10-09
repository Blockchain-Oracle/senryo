"use client";

/**
 * Session chip in the top strip (spec client.md): `● TRADING UNLOCKED · 24:10` / `● LOCKS IN 0:59` /
 * `○ LOCKED · PASSKEY TO TRADE`; with no account on this device it becomes the "Create account" entry (F03), which opens
 * the account drawer. Otherwise it opens Settings, where the session lives (address, lock / unlock, switch, sign out).
 */
import { LockKeyhole, LockKeyholeOpen, UserRoundPlus } from "lucide-react";
import { useAccount } from "@/lib/account/provider";
import { useChip } from "@/lib/account/use-chip";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-meta tnum transition-colors duration-(--motion-fast) ease-lacquer focus-visible:outline-2 focus-visible:outline-ring";

const TONE = {
  unlocked: "border-primary/40 text-primary hover:bg-primary/10",
  warning: "border-gold/60 text-gold hover:bg-gold/10",
  locked: "border-border text-muted-foreground hover:text-foreground",
  none: "border-border text-muted-foreground",
} as const;

/** Short form for phone widths: the lock glyph + the countdown, or nothing when locked. */
function shortLabel(label: string, tone: keyof typeof TONE): string {
  if (tone === "locked") return "";
  return label.split(" ").at(-1) ?? "";
}

export function SessionChip() {
  const account = useAccount();
  const chip = useChip();

  if (account.status === "loading") return null;
  if (chip.tone === "none") {
    return (
      <button
        type="button"
        onClick={() => openDrawer(DRAWERS.account)}
        className={cn(CHIP, "border-primary/40 text-primary hover:bg-primary/10")}
      >
        <UserRoundPlus className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Create account</span>
        <span className="sm:hidden">Sign up</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openDrawer(DRAWERS.settings)}
      aria-label={`Trading session: ${chip.label}`}
      className={cn(CHIP, TONE[chip.tone])}
    >
      {chip.tone === "locked" ? (
        <LockKeyhole className="size-3.5" aria-hidden />
      ) : (
        <LockKeyholeOpen
          className={cn("size-3.5", chip.tone === "warning" && "animate-pulse motion-reduce:animate-none")}
          aria-hidden
        />
      )}
      <span className="hidden lg:inline">{chip.label}</span>
      <span className="lg:hidden">{shortLabel(chip.label, chip.tone)}</span>
    </button>
  );
}
