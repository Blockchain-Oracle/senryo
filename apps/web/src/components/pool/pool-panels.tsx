"use client";

/**
 * Deposit, Redeem and Claim (flow book D1 steps 2–5, D2; the phone's DepositSheet / RedeemSheet / ClaimSheet) as
 * panels on the pool page. Deposit: the amount as the figure, where the AUSD comes from (trading balance — withdrawn to
 * self first — or wallet AUSD), presets and Max (that balance capped by the pool's room), what it composes, "≈ n sLP",
 * and one slide ("· passkey" above the session's move cap). Redeem: 25 / 50 / 100 % of your sLP, its value now, when the
 * claim opens, "Can't be cancelled". Claim: once ready and every market is open. A panel stays mounted under the outcome
 * so its review guard holds through the send.
 */
import type { LpRedeemView, LpSnapshot } from "@senryo/chain";
import { DECIMALS, formatUnits, parseUnits, RISK, utcSlotLabel } from "@senryo/core";
import { useQueryEnv } from "@senryo/query";
import { useState } from "react";
import { DetailRow } from "@/components/kit/list-row";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { MONEY, money, wholePct } from "@/lib/format";
import { LP_DEPOSIT_CHIPS, LP_MIN_DEPOSIT_USD6, LP_REDEEM_STEPS_BPS } from "@/lib/pool/constants";
import { type DepositSource, type Lp, sharesValueOf } from "@/lib/pool/use-lp";
import { useReviewGuard } from "@/lib/review-guard";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { cn } from "@/lib/utils";

const MS_PER_SECOND = 1000n;
const SOURCES: readonly { value: DepositSource; label: string }[] = [
  { value: "trading", label: "Trading balance" },
  { value: "wallet", label: "Wallet AUSD" },
];

function Chip({
  on,
  label,
  onClick,
  disabled,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-4 text-meta disabled:opacity-40",
        on ? "bg-foreground text-background" : "bg-raised-2 text-text-2 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** A send in flight or with an unknown result blocks the next one. */
function useBusy(lp: Lp): boolean {
  const outcome = useSettledOutcome(lp.trace.events);
  return lp.trace.running || outcome === "unknown";
}

export function DepositPanel({ lp, pool }: { lp: Lp; pool: LpSnapshot }) {
  const env = useQueryEnv();
  const [text, setText] = useState("");
  const [source, setSource] = useState<DepositSource>(lp.available.trading > 0n ? "trading" : "wallet");
  const parsed = parseUnits(text === "" ? "0" : text, DECIMALS.usd6);
  const amount = parsed.ok ? parsed.value : 0n;
  const have = lp.available[source];
  const max = have < pool.maxDeposit ? have : pool.maxDeposit;
  const guard = useReviewGuard([env.chainId, lp.address, amount, source].join(":"));
  const busy = useBusy(lp);
  const passkey = lp.confirmFor(amount) === "passkey";
  const steps = [
    ...(source === "trading" ? ["Withdraw"] : []),
    ...(pool.allowance < amount ? ["Approve"] : []),
    "Deposit",
  ];
  const shares =
    pool.totalAssets > 0n && pool.totalSupply > 0n ? (amount * pool.totalSupply) / pool.totalAssets : amount;
  const blocked =
    amount <= 0n
      ? "Enter an amount"
      : amount < LP_MIN_DEPOSIT_USD6
        ? `Minimum ${money(LP_MIN_DEPOSIT_USD6)}`
        : amount > pool.maxDeposit
          ? "Pool full"
          : amount > have
            ? "Not enough in this balance"
            : undefined;
  return (
    <section className="grid gap-4" aria-label="Deposit">
      <label className="grid justify-items-center gap-1">
        <span className="sr-only">Deposit amount in {MONEY}</span>
        <span className="flex items-baseline font-display text-display-margin tnum">
          <span className={text === "" ? "text-text-3" : ""}>{MONEY}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={text}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d.]/g, "");
              if (/^\d*(\.\d{0,2})?$/.test(next)) setText(next);
            }}
            className="min-w-0 bg-transparent text-center outline-none placeholder:text-text-3"
            style={{ width: `${Math.max(1, text.length) + 1}ch` }}
          />
        </span>
      </label>
      <div className="flex flex-wrap justify-center gap-2">
        {SOURCES.map((s) => (
          <Chip key={s.value} on={source === s.value} label={s.label} onClick={() => setSource(s.value)} />
        ))}
      </div>
      <p className="text-center text-meta text-text-3">
        {money(have)} available · {money(pool.maxDeposit, 0)} room left
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {LP_DEPOSIT_CHIPS.map((c) => (
          <Chip key={String(c)} on={false} label={`${MONEY}${c}`} onClick={() => setText(String(c))} />
        ))}
        <Chip
          on={false}
          label="Max"
          disabled={max <= 0n}
          onClick={() => setText(formatUnits(max, DECIMALS.usd6, DECIMALS.cents, { grouping: false }))}
        />
      </div>
      {amount > 0n ? (
        <div>
          <DetailRow label="You get" value={`≈ ${formatUnits(shares, DECIMALS.usd6, DECIMALS.cents)} sLP`} />
          <DetailRow label="Steps" value={steps.join(" → ")} />
        </div>
      ) : null}
      <SlideToConfirm
        label={blocked ?? (passkey ? "Slide to deposit · passkey" : "Slide to deposit")}
        disabled={blocked !== undefined || busy || !lp.ready}
        busy={busy}
        resetKey={[env.chainId, lp.address, amount, source, passkey, lp.trace.events.length].join("|")}
        onConfirm={() => void lp.deposit(amount, source, guard)}
      />
    </section>
  );
}

export function RedeemPanel({ lp, pool }: { lp: Lp; pool: LpSnapshot }) {
  const env = useQueryEnv();
  const [stepBps, setStepBps] = useState<bigint>(RISK.BPS);
  const shares = stepBps >= RISK.BPS ? pool.shares : (pool.shares * stepBps) / RISK.BPS;
  const guard = useReviewGuard([env.chainId, lp.address, shares].join(":"));
  const busy = useBusy(lp);
  const claimFrom = BigInt(Date.now()) / MS_PER_SECOND + RISK.LP_REDEEM_DELAY;
  return (
    <section className="grid gap-4" aria-label="Redeem">
      <div className="flex justify-center gap-2">
        {LP_REDEEM_STEPS_BPS.map((b) => (
          <Chip key={String(b)} on={stepBps === b} label={wholePct(b)} onClick={() => setStepBps(b)} />
        ))}
      </div>
      <div>
        <DetailRow label="Shares" value={`${formatUnits(shares, DECIMALS.usd6, DECIMALS.cents)} sLP`} />
        <DetailRow label="Value now" value={`≈ ${money(sharesValueOf(shares, pool))}`} />
        <DetailRow label="Claim from" value={utcSlotLabel(claimFrom)} />
        <DetailRow label="Cancel" value="Can’t be cancelled" />
      </div>
      <SlideToConfirm
        label={shares <= 0n ? "Nothing to redeem" : "Slide to request"}
        disabled={shares <= 0n || busy || !lp.ready}
        busy={busy}
        resetKey={[env.chainId, lp.address, shares, lp.trace.events.length].join("|")}
        onConfirm={() => void lp.requestRedeem(shares, guard)}
      />
    </section>
  );
}

export function ClaimPanel({ lp, pool, request }: { lp: Lp; pool: LpSnapshot; request: LpRedeemView }) {
  const env = useQueryEnv();
  const busy = useBusy(lp);
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const ready = request.claimableAt <= nowSec && pool.allMarketsOpen;
  return (
    <section className="grid gap-4" aria-label="Claim">
      <div>
        <DetailRow label="Shares" value={`${formatUnits(request.shares, DECIMALS.usd6, DECIMALS.cents)} sLP`} />
        <DetailRow label="You get" value={`≈ ${money(sharesValueOf(request.shares, pool))}`} />
        <DetailRow label="To" value="Wallet" />
      </div>
      <SlideToConfirm
        label={ready ? "Slide to claim" : "Not claimable now"}
        disabled={!ready || busy || !lp.ready}
        busy={busy}
        resetKey={[env.chainId, lp.address, request.requestId, lp.trace.events.length].join("|")}
        onConfirm={() => void lp.claim(request.requestId)}
      />
    </section>
  );
}
