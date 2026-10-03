"use client";

/**
 * Deposit, Redeem and Claim (flow book D1 steps 2–5, D2; the phone's DepositSheet / RedeemSheet / ClaimSheet) as
 * panels on the pool page. Deposit: the amount as the figure, a "Pay with AUSD ⌄" chip over every holding (rule 1):
 * AUSD comes from the wallet first, then the trading balance (withdrawn to self); on Mainnet any other verified holding
 * is swapped to AUSD inside the same operation (its minimum covers the deposit, impact over 1 % warns, over 5 %
 * blocks); Practice "dollars only" — test USDC pays through the par swap to test AUSD (D-252). Presets and Max (what
 * the chosen asset brings, capped by the pool's room), what it composes ("Swap USDC → AUSD · Approve AUSD · Deposit",
 * "Network fee" first on Mainnet when MON is short), "≈ n sLP", and one slide ("· passkey" with a swap leg or above
 * the session's move cap). Redeem: 25 / 50 / 100 % of your sLP, its value now, when the claim opens, "Can't be
 * cancelled". Claim: once ready and every market is open. A panel stays mounted under the outcome so its review guard
 * holds through the send.
 */
import type { LpRedeemView, LpSnapshot } from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { DECIMALS, formatUnits, parseUnits, RISK, utcSlotLabel } from "@senryo/core";
import {
  type PoolDeposit,
  payWithReason,
  poolDepositOperation,
  poolDepositSteps,
  practiceNote,
  stepsLine,
  swappableUsd6,
  usePaySwap,
  useQueryEnv,
} from "@senryo/query";
import { useState } from "react";
import { DetailRow } from "@/components/kit/list-row";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import { AssetChip } from "@/components/money/asset-chip";
import { AssetPicker } from "@/components/money/asset-picker";
import { MONEY, money, wholePct } from "@/lib/format";
import { amountOf } from "@/lib/money/format";
import { useMoneyAssets } from "@/lib/money/use-money-assets";
import { usePreparedOperation } from "@/lib/money/use-money-operation";
import { LP_DEPOSIT_CHIPS, LP_MIN_DEPOSIT_USD6, LP_REDEEM_STEPS_BPS, LP_SHARE_DECIMALS } from "@/lib/pool/constants";
import { type Lp, sharesValueOf } from "@/lib/pool/use-lp";
import { useReviewGuard } from "@/lib/review-guard";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { cn } from "@/lib/utils";

const MS_PER_SECOND = 1000n;

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
  const held = useMoneyAssets(lp.address);
  const [text, setText] = useState("");
  const [payKey, setPayKey] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string>();
  const parsed = parseUnits(text === "" ? "0" : text, DECIMALS.usd6);
  const amount = parsed.ok ? parsed.value : 0n;
  const ausd = held.assets.find((a) => a.collateral === "AUSD");
  const payWith = (payKey ? held.find(payKey) : undefined) ?? ausd;
  const direct = payWith?.collateral === "AUSD";
  const swap = usePaySwap(env.chainId, direct ? undefined : payWith, amount, lp.address);
  const have = !payWith ? 0n : direct ? payWith.wallet + payWith.tradingFree : swappableUsd6(payWith, env.chainId);
  const max = have < pool.maxDeposit ? have : pool.maxDeposit;
  const passkey = !direct || lp.confirmFor(amount) === "passkey";
  const guard = useReviewGuard([env.chainId, lp.address, amount, payWith?.key, swap.status].join(":"));
  const busy = useBusy(lp);
  const deposit: PoolDeposit | undefined =
    payWith && lp.vaultAddress && lp.trading
      ? {
          amountUsd6: amount,
          payWith,
          swap,
          vault: lp.vaultAddress,
          allowance: pool.allowance,
          positionBitmap: lp.trading.positionBitmap,
          passkey,
        }
      : undefined;
  const blocked =
    amount <= 0n
      ? "Enter an amount"
      : amount < LP_MIN_DEPOSIT_USD6
        ? `Minimum ${money(LP_MIN_DEPOSIT_USD6)}`
        : amount > pool.maxDeposit
          ? "Pool full"
          : amount > have
            ? `Not enough ${payWith?.symbol ?? ""}`
            : swap.status === "blocked"
              ? swap.reason
              : swap.status === "quoting"
                ? "Getting a quote"
                : undefined;
  const reviewKey =
    deposit && !blocked
      ? [amount, payWith?.key, swap.status === "ok" ? swap.quote.quote.minOut : swap.status, passkey].join(":")
      : undefined;
  // B11: the network fee is planned with the review — the slide signs exactly the steps Details shows.
  const prepared = usePreparedOperation(lp.runner, reviewKey, async () => {
    if (!deposit || !lp.address) return undefined;
    const steps = await poolDepositSteps(env, lp.address, deposit);
    return steps ? poolDepositOperation(env, lp.address, deposit, steps, guard, (v) => money(v)) : undefined;
  });
  const plan = prepared.data;
  const why = blocked ?? problem ?? (plan && !plan.ok ? plan.block : undefined);
  const shares =
    pool.totalAssets > 0n && pool.totalSupply > 0n ? (amount * pool.totalSupply) / pool.totalAssets : amount;
  const impact = swap.status === "ok" ? swap.quote.quote.impact : undefined;
  if (picking)
    return (
      <section className="grid gap-3" aria-label="Pay with">
        <div className="flex items-baseline justify-between">
          <p className="text-row">Pay with</p>
          {env.chainId === MAINNET_CHAIN_ID ? null : <p className="text-meta text-text-3">{practiceNote()}</p>}
        </div>
        <AssetPicker
          assets={held.assets}
          other={held.other}
          selectedKey={payWith?.key}
          reasonFor={(a) => payWithReason(a, "pool", env.chainId)}
          detailFor={(a) => amountOf(a, a.total)}
          onPick={(a) => {
            setPayKey(a.key);
            setProblem(undefined);
            setPicking(false);
          }}
        />
        <button type="button" onClick={() => setPicking(false)} className="text-meta text-link hover:underline">
          Back to deposit
        </button>
      </section>
    );
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
      {payWith ? (
        <div className="grid justify-items-center gap-1">
          <AssetChip asset={payWith} label="Pay with" onClick={() => setPicking(true)} />
          {env.chainId === MAINNET_CHAIN_ID ? null : <p className="text-meta text-text-3">{practiceNote()}</p>}
        </div>
      ) : null}
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
          <DetailRow label="You get" value={`≈ ${formatUnits(shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
          {plan?.ok ? <DetailRow label="Steps" value={stepsLine(plan.op.steps)} /> : null}
          {impact === "warn" ? <DetailRow label="Price impact" value="Over 1%" tone="warn" /> : null}
        </div>
      ) : null}
      <SlideToConfirm
        label={why ?? (passkey ? "Slide to deposit · passkey" : "Slide to deposit")}
        disabled={why !== undefined || busy || !lp.ready || !plan?.ok}
        busy={busy || prepared.isFetching}
        resetKey={[env.chainId, lp.address, reviewKey ?? "", passkey, lp.trace.events.length].join("|")}
        onConfirm={() => {
          if (!plan?.ok) return;
          // The typed amount stays: clearing it would change the reviewed intent the guard holds.
          void lp.deposit(plan.op).then(setProblem);
        }}
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
        <DetailRow label="Shares" value={`${formatUnits(shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
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
        <DetailRow label="Shares" value={`${formatUnits(request.shares, LP_SHARE_DECIMALS, DECIMALS.cents)} sLP`} />
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
