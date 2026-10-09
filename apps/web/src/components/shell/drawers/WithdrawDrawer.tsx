"use client";
/**
 * Withdraw (`?d=withdraw`; the phone's `WithdrawSheet`, the full money-action contract): a recipient (pasted or typed,
 * checked), an exact amount with Max, a review that freezes the request, one passkey prompt signing an EIP-3009
 * transfer the relay submits (no MON needed), and a receipt that stays until "Send again". A failure says so and
 * moved nothing. The check and the send are `@senryo/calls`, the phone's too.
 */
import { checkWithdraw, useWithdrawFlow } from "@senryo/calls/react";
import { explorerTxUrl } from "@senryo/config";
import { formatUnits, shortAddress } from "@senryo/core";
import { useMarketAccount, useQueryEnv } from "@senryo/query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/drawer";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import type { DrawerProps } from "./types";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

type Stage =
  | { kind: "edit" }
  | { kind: "review"; to: `0x${string}`; value: bigint }
  | { kind: "sending"; to: `0x${string}`; value: bigint }
  | { kind: "sent"; to: `0x${string}`; value: bigint; txHash: string }
  | { kind: "failed"; message: string };

const FIELD =
  "h-12 w-full rounded-md bg-secondary px-3 text-body text-foreground outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-ring";

export function WithdrawDrawer({ open, onOpenChange }: DrawerProps) {
  const env = useQueryEnv();
  const caller = useAccount();
  const owner = caller.hint?.address;
  const account = useMarketAccount(owner);
  const balance = "value" in account ? account.value.balance : undefined;
  const flow = useWithdrawFlow(caller);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "edit" });
  const check = checkWithdraw(to, amount, owner, balance);

  const send = async (target: `0x${string}`, v: bigint) => {
    setStage({ kind: "sending", to: target, value: v });
    try {
      const result = await flow.send(target, v);
      if (result.state === "cancelled") return setStage({ kind: "review", to: target, value: v });
      fire("confirm", { cue: "close" });
      setStage({ kind: "sent", to: target, value: v, txHash: result.txHash });
    } catch (error) {
      fire("fail");
      setStage({ kind: "failed", message: (error as Error).message });
    }
  };

  return (
    <SlideOver
      open={open}
      onOpenChange={(o) => (stage.kind === "sending" ? undefined : onOpenChange(o))}
      title="Withdraw"
      description="Send dollars to a Monad address"
    >
      {!owner ? (
        <p className="text-body text-text-2">Sign in to send.</p>
      ) : stage.kind === "edit" ? (
        <form
          className="flex flex-col gap-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (check.ok && check.to && check.value !== undefined)
              setStage({ kind: "review", to: check.to, value: check.value });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-meta text-text-2">To</span>
            <span className="flex gap-2">
              <input
                className={FIELD}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12"
                onClick={() =>
                  void navigator.clipboard
                    ?.readText()
                    .then((t) => setTo(t.trim()))
                    .catch(() => undefined)
                }
              >
                Paste
              </Button>
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-meta text-text-2">
              Amount{balance !== undefined ? ` · you have ${usd(balance)}` : ""}
            </span>
            <span className="flex gap-2">
              <input
                className={FIELD}
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12"
                disabled={balance === undefined}
                onClick={() =>
                  balance !== undefined && setAmount(formatUnits(balance, DOLLAR_DECIMALS, DOLLAR_DECIMALS))
                }
              >
                Max
              </Button>
            </span>
          </label>
          <p className="min-h-5 text-meta text-down" role="status">
            {check.problem ?? ""}
          </p>
          <Button type="submit" size="xl" disabled={!check.ok}>
            Review
          </Button>
        </form>
      ) : stage.kind === "review" || stage.kind === "sending" ? (
        <div className="flex flex-col gap-4 pt-2">
          <p className="font-semibold text-title">
            {usd(stage.value)} to {shortAddress(stage.to)}
          </p>
          <p className="break-all text-meta text-text-3">{stage.to}</p>
          <p className="text-meta text-text-2">One passkey prompt signs it; the relay sends it. No MON needed.</p>
          <Button size="xl" disabled={stage.kind === "sending"} onClick={() => void send(stage.to, stage.value)}>
            {stage.kind === "sending" ? "Sending…" : `Send ${usd(stage.value)}`}
          </Button>
          <Button variant="ghost" disabled={stage.kind === "sending"} onClick={() => setStage({ kind: "edit" })}>
            Change
          </Button>
        </div>
      ) : stage.kind === "sent" ? (
        <div className="flex flex-col gap-4 pt-2">
          <p className="font-semibold text-title text-up">
            Sent {usd(stage.value)} to {shortAddress(stage.to)}
          </p>
          <a
            href={explorerTxUrl(env.chainId, stage.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-meta text-link"
          >
            View transaction <ExternalLink aria-hidden className="size-3" />
          </a>
          <Button
            variant="secondary"
            size="xl"
            onClick={() => {
              setTo("");
              setAmount("");
              setStage({ kind: "edit" });
            }}
          >
            Send again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-2">
          <p className="font-semibold text-title">Nothing moved</p>
          <p className="text-meta text-down">{stage.message}</p>
          <Button variant="secondary" size="xl" onClick={() => setStage({ kind: "edit" })}>
            Try again
          </Button>
        </div>
      )}
    </SlideOver>
  );
}
