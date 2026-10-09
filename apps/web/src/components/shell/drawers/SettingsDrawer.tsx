"use client";
/**
 * Settings (`?d=settings`; the phone's Settings → Preferences and Security): sound and vibration, hiding balances, the
 * theme, and the session — who is signed in, how long calls stay unlocked, lock or unlock, switch account, sign out.
 */
import { classifyAuthError, isSilent } from "@senryo/account";
import { shortAddress } from "@senryo/core";
import { Lock, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { PasskeyGlyph } from "@/components/identity/passkey-glyph";
import { Button } from "@/components/ui/button";
import { CopyCode } from "@/components/ui/copy-code-button";
import { SlideOver } from "@/components/ui/drawer";
import { useAccount } from "@/lib/account/provider";
import { useChip } from "@/lib/account/use-chip";
import { fire, setFeedback, useFeedback } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { setPrivacy, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import type { DrawerProps } from "./types";

function Toggle({
  label,
  detail,
  on,
  onChange,
}: {
  label: string;
  detail?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        onChange(!on);
        fire("tick", { cue: "tap" });
      }}
      className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row">{label}</span>
        {detail ? <span className="text-meta text-text-3">{detail}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--motion-base)",
          on ? "bg-up" : "bg-row-pressed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-white transition-transform duration-(--motion-base) ease-lacquer",
            on ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="pb-1 font-semibold text-meta text-text-3">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsDrawer({ open, onOpenChange }: DrawerProps) {
  const feedback = useFeedback();
  const hidden = usePrivacy();
  const { resolvedTheme, setTheme } = useTheme();
  const account = useAccount();
  const chip = useChip();
  const address = account.hint?.address;
  const unlocked = account.snapshot.status === "unlocked";
  const attempt = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      const kind = classifyAuthError(error);
      if (!isSilent(kind))
        notify({ title: "That didn't work", description: (error as Error).message, tone: "warning" });
    }
  };
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="flex flex-col gap-6 pt-2">
        <Group title="Sound & vibration">
          <Toggle
            label="Sounds"
            detail="Calls, results and the live line"
            on={feedback.sound}
            onChange={(v) => setFeedback({ sound: v })}
          />
          <Toggle
            label="Vibration"
            detail="Where this device can"
            on={feedback.haptics}
            onChange={(v) => setFeedback({ haptics: v })}
          />
        </Group>
        <Group title="Display">
          <Toggle label="Hide balances" detail="Amounts read ••••" on={hidden} onChange={setPrivacy} />
          <Toggle label="Light theme" on={resolvedTheme === "light"} onChange={(v) => setTheme(v ? "light" : "dark")} />
        </Group>
        {address ? (
          <Group title="Account">
            <p className="pb-1 text-meta text-text-2">{chip.label}</p>
            <CopyCode code={address} display={shortAddress(address)} copiedLabel="Address copied" />
            <div className="flex flex-col gap-2 pt-2">
              {unlocked ? (
                <Button variant="secondary" size="xl" onClick={() => account.lock()}>
                  <Lock aria-hidden />
                  Lock now
                </Button>
              ) : (
                <Button size="xl" onClick={() => void attempt(account.unlock)}>
                  <PasskeyGlyph />
                  Unlock with passkey
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => void attempt(account.signIn)}>
                  <PasskeyGlyph />
                  Switch
                </Button>
                <Button variant="ghost" onClick={() => void attempt(account.signOut)}>
                  <LogOut aria-hidden />
                  Sign out
                </Button>
              </div>
            </div>
          </Group>
        ) : null}
      </div>
    </SlideOver>
  );
}
