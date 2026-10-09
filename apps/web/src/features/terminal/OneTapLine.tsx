"use client";
/**
 * One-tap's state where calls are made (the phone's `OneTapLine`): while this browser's capped key is live, "One-tap ·
 * 12 min · $76 left"; otherwise "One-tap is off · Turn on" — the next call then asks for the passkey, and this line
 * says why before it does. A leaf: its countdown never re-renders the terminal. Nothing for a guest.
 */
import { useOneTap } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";

const DOLLAR_DECIMALS = 6;
const SECONDS_PER_MINUTE = 60;

export function OneTapLine() {
  const account = useAccount();
  const oneTap = useOneTap(account);
  if (!account.hint) return null;
  const s = oneTap.state;
  if (s.on) {
    return (
      <p className="terminal-note is-on">
        One-tap · {Math.ceil(s.secondsLeft / SECONDS_PER_MINUTE)} min · ${formatUnits(s.left, DOLLAR_DECIMALS, 0)} left
      </p>
    );
  }
  return (
    <button
      type="button"
      className="terminal-note"
      disabled={oneTap.busy}
      onClick={async () => {
        fire("tick", { cue: "tap" });
        try {
          await oneTap.turnOn();
        } catch (error) {
          notify({ title: "Couldn't turn on one-tap", description: (error as Error).message });
        }
      }}
    >
      {oneTap.busy ? (
        "Turning on one-tap…"
      ) : (
        <>
          One-tap is off · <span className="terminal-link">Turn on</span>
        </>
      )}
    </button>
  );
}
