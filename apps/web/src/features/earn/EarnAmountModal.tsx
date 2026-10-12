"use client";
/**
 * Supply or withdraw (P5, D-325; the phone's keypad sheet as the web's centred modal, D-190): the amount typed large,
 * what's in reach (your wallet's dollars, or what you can withdraw) with ¼ ½ ¾ All of it, about what it buys or pays
 * at today's share price, when it settles, the risk in one sentence, and the confirm. A guest types freely; their
 * confirm is the passkey step.
 */
import type { EarnView } from "@senryo/api-client";
import { EARN_RISK, estimateLine } from "@senryo/calls";
import { checkEarnAmount } from "@senryo/calls/react";
import { formatUnits, usd } from "@senryo/core";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";

const DOLLAR_DECIMALS = 6;
/** The amount field grows with what's typed, so the "$" stays beside it. */
const INPUT_SLACK_CH = 0.5;
const CENTS = 2;
const QUARTERS = [
  { label: "¼", num: 1n, den: 4n },
  { label: "½", num: 1n, den: 2n },
  { label: "¾", num: 3n, den: 4n },
  { label: "All", num: 1n, den: 1n },
] as const;

export type EarnSide = "supply" | "withdraw";

export function EarnAmountModal(p: {
  side: EarnSide | null;
  max: bigint | undefined;
  pool: NonNullable<EarnView["pool"]>;
  next: string;
  signedIn: boolean;
  onConfirm: (side: EarnSide, amount: bigint, all: boolean) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const side = p.side ?? "supply";
  const supply = side === "supply";
  const check = checkEarnAmount(
    text,
    p.signedIn ? p.max : undefined,
    supply ? "Sign in when you confirm" : "Nothing supplied yet",
  );
  const value = check.value ?? 0n;
  const guestOk = !p.signedIn && value > 0n && !check.problem;
  const ready = check.ok || guestOk;
  const close = () => {
    setText("");
    p.onClose();
  };
  return (
    <Modal open={p.side !== null} onOpenChange={(o) => !o && close()} title={supply ? "Supply" : "Withdraw"}>
      <div className="flex flex-col gap-4">
        <label className="flex items-baseline justify-center gap-1">
          <span className="font-display text-display-balance text-text-3">$</span>
          <input
            inputMode="decimal"
            value={text}
            placeholder="0"
            aria-label={supply ? "Dollars to supply" : "Dollars to withdraw"}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{ width: `${Math.max(1, text.length) + INPUT_SLACK_CH}ch` }}
            className="tnum bg-transparent text-left font-display text-display-balance outline-none placeholder:text-text-3"
          />
        </label>
        <p className="text-center text-meta text-text-3">
          {check.problem ??
            (p.signedIn && p.max !== undefined
              ? supply
                ? `${usd(p.max)} in your wallet`
                : `${usd(p.max)} you can withdraw`
              : supply
                ? "Sign in when you confirm"
                : "Nothing supplied to withdraw yet")}
        </p>
        {p.signedIn && p.max !== undefined && p.max > 0n ? (
          <div className="grid grid-cols-4 gap-2">
            {QUARTERS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  fire("tick", { cue: "tap" });
                  setText(formatUnits(((p.max as bigint) * q.num) / q.den, DOLLAR_DECIMALS, CENTS));
                }}
                className="h-10 rounded-full bg-secondary font-semibold text-button-compact hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                {q.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-center text-meta text-text-3">
          {estimateLine(side, value, p.pool)} · {p.next}
        </p>
        <p className="text-center text-meta text-text-3">{EARN_RISK}</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            p.onConfirm(side, value, p.max !== undefined && value === p.max);
            close();
          }}
          className="h-14 rounded-full bg-primary font-semibold text-button text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {!ready
            ? "Enter an amount"
            : `${supply ? "Supply" : "Withdraw"} ${usd(value)}${p.signedIn ? " at the next hour" : " · sign in"}`}
        </button>
      </div>
    </Modal>
  );
}
