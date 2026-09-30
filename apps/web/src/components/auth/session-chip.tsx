"use client";

/**
 * Session chip in the D2 top strip (spec client.md): `● TRADING UNLOCKED · 24:10` / `● LOCKS IN 0:59` /
 * `○ LOCKED · PASSKEY TO TRADE`; with no account on this device it becomes the "Create account" entry (F03).
 * Opens the session sheet (address, lock now / unlock, switch account, sign out).
 */
import { UserRoundPlus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { useChip } from "@/lib/account/use-chip";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const SessionSheet = dynamic(() => import("./session-sheet").then((m) => m.SessionSheet), { ssr: false });

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-sm border px-2 font-mono text-micro uppercase tracking-[0.12em] tnum transition-colors duration-(--motion-fast) ease-desk focus-visible:outline-2 focus-visible:outline-ring";

const TONE = {
  unlocked: "border-primary/40 text-primary hover:bg-primary/10",
  warning: "border-gold/60 text-gold hover:bg-gold/10",
  locked: "border-border text-muted-foreground hover:text-foreground",
  none: "border-border text-muted-foreground",
} as const;

/** Short form for phone widths: the dot + the countdown or LOCKED. */
function shortLabel(label: string, tone: keyof typeof TONE): string {
  if (tone === "locked") return "LOCKED";
  const time = label.split(" ").at(-1) ?? "";
  return tone === "warning" ? `LOCKS ${time}` : time;
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
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            chip.tone === "locked" ? "border border-current" : "bg-current",
            chip.tone === "warning" && "animate-pulse motion-reduce:animate-none",
          )}
        />
        <span className="hidden md:inline">{chip.label}</span>
        <span className="md:hidden">{shortLabel(chip.label, chip.tone)}</span>
      </button>
      {open ? <SessionSheet open onOpenChange={setOpen} /> : null}
    </>
  );
}
