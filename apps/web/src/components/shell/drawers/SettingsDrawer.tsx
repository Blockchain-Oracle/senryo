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
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
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
import { RecoveryGroup } from "./RecoveryGroup";
import type { DrawerProps } from "./types";

const PERCENT = 100;

/** A 0–100 % volume (F3): effects or music; a cue plays on release so the level is heard as it's set. */
function Volume({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const id = `volume-${label.toLowerCase()}`;
  return (
    <div className="flex items-center gap-3 py-2">
      <label htmlFor={id} className="w-20 font-semibold text-row-title">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={PERCENT}
        value={Math.round(value * PERCENT)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / PERCENT)}
        onPointerUp={() => fire("tick", { cue: "toggle" })}
        className="h-11 flex-1 accent-(--accent)"
      />
      <span className="tnum w-10 text-right text-meta text-text-2">{Math.round(value * PERCENT)}%</span>
    </div>
  );
}

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
          on ? "bg-primary" : "bg-row-pressed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full transition-transform duration-(--motion-base) ease-lacquer",
            // On: the primary's own ink (white on black in light, black on white in dark), as the phone's switch.
            on ? "translate-x-5.5 bg-primary-foreground" : "translate-x-0.5 bg-white",
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
          <Volume
            label="Effects"
            value={feedback.effects}
            disabled={!feedback.sound}
            onChange={(v) => setFeedback({ effects: v })}
          />
          <Volume
            label="Music"
            value={feedback.music}
            disabled={!feedback.sound}
            onChange={(v) => setFeedback({ music: v })}
          />
          <Toggle
            label="Music in the terminal"
            detail="Games always have theirs; the terminal's is your choice"
            on={feedback.terminalMusic}
            onChange={(v) => setFeedback({ terminalMusic: v })}
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
        {address ? (
          <Group title="Recovery">
            <RecoveryGroup />
          </Group>
        ) : (
          <Group title="Account">
            <SignInPrompt line="Sign in for your account, its passkey and recovery." />
          </Group>
        )}
      </div>
    </SlideOver>
  );
}
