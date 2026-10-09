"use client";
/**
 * Any stake (the phone's `StakeSheet`, as a centred modal on the web, D-190): the amount typed large, checked against
 * the pool's minimum and maximum stake and the balance as it is typed; "Use $7.50" sets it and it is remembered like a
 * preset.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export function StakeModal({
  current,
  min,
  max,
  balance,
  onPick,
  onClose,
}: {
  current: bigint;
  min: bigint;
  max: bigint;
  balance: bigint | undefined;
  onPick: (stake: bigint) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(formatUnits(current, DOLLAR_DECIMALS, CENTS));
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const value = parsed.ok ? parsed.value : 0n;
  const cap = balance !== undefined && balance < max ? balance : max;
  const problem = !parsed.ok
    ? "Enter an amount in dollars"
    : value === 0n
      ? null
      : value < min
        ? `At least ${usd(min)}`
        : value > max
          ? `At most ${usd(max)} a call`
          : balance !== undefined && value > balance
            ? `You have ${usd(balance)}`
            : null;
  const ok = value > 0n && problem === null;
  const use = () => {
    if (!ok) return;
    fire("confirm", { cue: "tap" });
    onPick(value);
    onClose();
  };
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Stake" description={`${usd(min)} to ${usd(cap)}`}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          use();
        }}
      >
        <label className="stake-field">
          <span aria-hidden>$</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            aria-label="Stake in dollars"
            aria-invalid={problem !== null}
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
            // biome-ignore lint/a11y/noAutofocus: the modal exists to type this one number
            autoFocus
          />
        </label>
        <p className={problem ? "text-meta text-down" : "text-meta text-text-3"} role="status">
          {problem ?? " "}
        </p>
        <Button type="submit" size="xl" disabled={!ok}>
          {ok ? `Use ${usd(value)}` : "Enter a stake"}
        </Button>
      </form>
    </Modal>
  );
}
