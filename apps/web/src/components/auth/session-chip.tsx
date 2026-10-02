"use client";

/**
 * Session chip in the top strip (spec client.md): `● TRADING UNLOCKED · 24:10` / `● LOCKS IN 0:59` /
 * `○ LOCKED · PASSKEY TO TRADE`; with no account on this device it becomes the "Create account" entry (F03).
 * Opens the session sheet (address, lock now / unlock, switch account, sign out).
 */
import { LockKeyhole, LockKeyholeOpen, UserRoundPlus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { useChip } from "@/lib/account/use-chip";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const SessionSheet = dynamic(() => import("./session-sheet").then((m) => m.SessionSheet), { ssr: false });

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
  const [open, setOpen] = useState(false);

  if (account.status === "loading") return null;
  if (chip.tone === "none") {
    return (
      <Link href={ROUTES.welcome} className={cn(CHIP, "border-primary/40 text-primary hover:bg-primary/10")}>
        <UserRoundPlus className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Create account</span>
        <span className="sm:hidden">Sign up</span>
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
      {open ? <SessionSheet open onOpenChange={setOpen} /> : null}
    </>
  );
}
