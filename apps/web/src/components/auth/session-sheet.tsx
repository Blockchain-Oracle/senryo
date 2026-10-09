"use client";

/**
 * Session sheet (F04 / F02 / F09): who is signed in, how long trading stays unlocked, and the controls — lock now,
 * unlock, switch account (discoverable passkey), sign out. Loosening the timing lives in Account → Security (step-up).
 */
import { type AuthFailure, authFailureCopy, classifyAuthError, isSilent, SESSION_IDLE_MS } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { Lock, LogOut, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/ui/copy-code-button";
import { Modal } from "@/components/ui/modal";
import { useAccount } from "@/lib/account/provider";
import { useChip } from "@/lib/account/use-chip";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES } from "@/lib/constants/routes";

const MS_PER_MINUTE = 60_000;

export function SessionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const account = useAccount();
  const chip = useChip();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure>();
  const address = account.snapshot.status === "none" ? undefined : account.snapshot.address;
  const idleMinutes = Math.round((account.settings.idleMs ?? SESSION_IDLE_MS) / MS_PER_MINUTE);

  const attempt = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      const kind = classifyAuthError(error);
      if (!isSilent(kind)) setFailure(kind);
    } finally {
      setBusy(false);
    }
  };

  const unlocked = account.snapshot.status === "unlocked";
  const copy = failure ? authFailureCopy(failure, "web") : undefined;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      locked={busy}
      title="Trading session"
      description={
        unlocked
          ? `Small trades need no prompt while unlocked. Locks after ${idleMinutes} idle minutes, at the time shown, or when you close the tab.`
          : "Locked. Your portfolio stays visible; your passkey unlocks trading."
      }
      footer={
        <>
          {unlocked ? (
            <Button variant="outline" className="w-full" onClick={() => account.lock()}>
              <Lock />
              Lock now
            </Button>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => void attempt(account.unlock)}>
              <PasskeyGlyph />
              {busy ? "Waiting for your passkey…" : "Unlock with passkey"}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void attempt(account.signIn)}>
              <PasskeyGlyph />
              Switch
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void account.signOut().then(() => onOpenChange(false))}
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </>
      }
    >
      <div className="grid gap-3 pb-2">
        <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
          <span className="font-mono text-label text-muted-foreground uppercase tracking-[0.14em]">
            {ACTIVE_NETWORK.modeLabel}
          </span>
          <span
            className={
              unlocked ? "font-mono text-micro text-primary tnum" : "font-mono text-micro text-muted-foreground"
            }
          >
            {chip.label}
          </span>
        </div>
        {address ? <CopyCode code={address} display={shortAddress(address)} copiedLabel="Address copied" /> : null}
        {copy ? (
          <p role="alert" className="text-caption text-down">
            <span className="font-medium">{copy.title}.</span> {copy.body}
          </p>
        ) : null}
        <Link
          href={ROUTES.account}
          onClick={() => onOpenChange(false)}
          className="flex items-center gap-1.5 font-mono text-micro text-muted-foreground uppercase tracking-[0.12em] hover:text-foreground"
        >
          <Settings2 className="size-3.5" aria-hidden />
          Account · security · recovery
        </Link>
      </div>
    </Modal>
  );
}
