/**
 * A pool operation's outcome (flow book D1 step 5, D2 steps 3 and 5; Part A8): the one outcome surface in the pool's
 * words — "Depositing" → "Deposited P$50" with Investment · Share of pool · APR once finalized; "Redemption requested";
 * "Claimed P$49.80". A composed deposit (withdraw → approve → deposit) shares one operation, so a partial outcome stays
 * visible and nothing is resent; an unknown result offers no new action.
 */
import { RISK } from "@senryo/core";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { Facts } from "~/features/trade/TicketReceipt";
import { ORDER_WORDS, type TraceWords, TradeTrace } from "~/features/trade/TradeTrace";
import { pct, usd } from "~/lib/money";
import type { useLp } from "./useLp";

const POOL_WORDS: TraceWords = {
  ...ORDER_WORDS,
  thing: "pool transaction",
  again: "send it again",
  landed: "Confirmed — your investment shows it.",
  back: "Back",
  done: "Done",
};

export function PoolOutcome({
  lp,
  words,
  onDone,
  onLeave,
}: {
  lp: ReturnType<typeof useLp>;
  words: { pending: string; success: string };
  onDone: () => void;
  /** Closes the sheet without touching the trace (while it runs, or while its result is unknown). */
  onLeave: () => void;
}) {
  const outcome = useSettledOutcome(lp.trace.events);
  const settled = lp.trace.events.some((e) => e.stage === "finalized");
  const pool = lp.snapshot;
  const invested = pool ? pool.sharesValue + pool.pendingValue : undefined;
  const share = pool && pool.totalAssets > 0n ? (pool.sharesValue * RISK.BPS) / pool.totalAssets : undefined;
  const apr = lp.apr.status === "fresh" || lp.apr.status === "stale" ? lp.apr.value : undefined;
  return (
    <TradeTrace
      events={lp.trace.events}
      record={lp.trace.record}
      running={lp.trace.running}
      outcome={outcome}
      words={{ ...POOL_WORDS, ...words }}
      onDone={onDone}
      onLeave={onLeave}
    >
      {settled && invested !== undefined ? (
        <Facts
          facts={[
            { label: "Investment", value: usd(invested) },
            { label: "Share of pool", value: share === undefined ? "—" : pct(share) },
            { label: "APR", value: apr ? pct(apr.bps) : "—" },
          ]}
        />
      ) : null}
    </TradeTrace>
  );
}
