"use client";

/**
 * The review of a move (flow book B7 step 3 / B8 step 4; rule 5): who it goes to, the exact amount, where it comes
 * from (wallet and/or the free trading part), the network and its fee, the steps it composes, the warnings — then one
 * slide, and the passkey (money leaving the account always asks). After the slide the outcome takes over: "Sent" once
 * finalized, "Not confirmed yet" when the watch lost a signed send (nothing is offered until it settles), and a failure
 * hands back to review without resending.
 */
import { ids } from "@senryo/identity";
import { Avatar } from "@/components/identity/avatar";
import { EntityMark } from "@/components/identity/entity-mark";
import { DetailRow } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { SlideToConfirm } from "@/components/kit/slide-to-confirm";
import type { TraceWords } from "@/components/kit/trace-words";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { MARK_ROW, MARK_SMALL, MODE_MARK_SIZE } from "@/lib/constants/brand";
import { exactAmount } from "@/lib/money/format";
import type { ReviewedMove } from "@/lib/money/move";
import { splitSource } from "@/lib/money/requests";
import type { useMoneyOperation } from "@/lib/money/use-money-operation";
import { useSettledOutcome } from "@/lib/trade/send-outcome";
import { AssetMark } from "./asset-mark";

export function MoveReview({
  move,
  runner,
  avatar,
  warnings,
  block,
  busy,
  words,
  onConfirm,
  onDone,
  onLeave,
}: {
  move: ReviewedMove;
  runner: ReturnType<typeof useMoneyOperation>;
  avatar: string | null;
  warnings: readonly string[];
  block: string | undefined;
  busy: boolean;
  words: TraceWords;
  onConfirm: () => void;
  onDone: () => void;
  onLeave: () => void;
}) {
  const outcome = useSettledOutcome(runner.trace.events);
  const split = splitSource(move.asset, move.amount);
  const exact = exactAmount(move.asset, move.amount);
  const source =
    split.trading > 0n
      ? split.wallet > 0n
        ? `Wallet + ${exactAmount(move.asset, split.trading)} from trades`
        : "From trades"
      : "Wallet";
  if (runner.trace.events.length > 0)
    return (
      <OperationStatus
        events={runner.trace.events}
        record={runner.trace.record}
        running={runner.trace.running}
        outcome={outcome}
        words={words}
        facts={
          <>
            <DetailRow label="Amount" value={exact} />
            <DetailRow label="To" value={move.label === move.to ? `${move.to.slice(0, 10)}…` : move.label} />
          </>
        }
        details={
          <>
            <DetailRow label="Address" value={<span className="font-mono">{move.to}</span>} />
            <DetailRow label="Steps" value={move.steps.map((s) => s.label).join(" · ")} />
          </>
        }
        onDone={onDone}
        onLeave={onLeave}
      />
    );
  return (
    <div className="grid gap-5">
      <div className="grid justify-items-center gap-2 pt-2 text-center">
        <span className="relative">
          <AssetMark asset={move.asset} size={MARK_ROW + MARK_SMALL} />
        </span>
        <p className="font-display text-display-margin tnum">{exact}</p>
        <p className="flex items-center gap-2 text-row text-text-2">
          to <Avatar avatar={avatar} address={move.to} size={MARK_SMALL} />{" "}
          {move.label === move.to ? "address" : move.label}
        </p>
      </div>
      <div>
        <DetailRow label="To" value={<span className="font-mono text-meta">{move.to}</span>} />
        <DetailRow label="From" value={source} />
        <DetailRow
          label="Network"
          value={
            <span className="inline-flex items-center gap-1.5">
              <EntityMark id={ids.evmChain(ACTIVE_NETWORK.chainId)} size={MODE_MARK_SIZE} decorative />
              {ACTIVE_NETWORK.name}
            </span>
          }
        />
        <DetailRow label="Network fee" value={ACTIVE_NETWORK.key === "testnet" ? "Sponsored" : "Paid in MON"} />
        {move.steps.length > 1 ? <DetailRow label="Steps" value={move.steps.map((s) => s.label).join(" · ")} /> : null}
        <DetailRow label="Confirm with" value="Passkey" />
      </div>
      {warnings.map((w) => (
        <p key={w} className="text-center text-meta text-warn">
          {w}
        </p>
      ))}
      {block ? (
        <p role="alert" className="text-center text-meta text-down">
          {block}
        </p>
      ) : null}
      <SlideToConfirm
        label={move.kind === "send" ? "Slide to send" : "Slide to withdraw"}
        busy={busy}
        resetKey={`${move.key}|${block ?? ""}|${busy}`}
        onConfirm={onConfirm}
      />
    </div>
  );
}
