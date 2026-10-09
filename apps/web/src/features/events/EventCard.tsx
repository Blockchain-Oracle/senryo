"use client";
/**
 * One question on the board (S8.7; Owarine's event card, the 21st Prediction Market Card #2537): both sides' marks, the
 * league and start, the question, the pools and Yes's share, Yes / No, and the call in place. A settled question says
 * how it ended; the question links to its page with the committee's statements.
 */
import type { EventView } from "@senryo/api-client";
import { estimateFor, eventPhase, leagueName, sideWord, spanText, statusLine } from "@senryo/calls";
import type { EventReceipt, EventsFlow } from "@senryo/calls/react";
import { EVENTS, explorerTxUrl } from "@senryo/config";
import { usd } from "@senryo/core";
import Link from "next/link";
import { PredictionMarketCard } from "@/components/ui/prediction-market-card";
import { TeamMark } from "./TeamMark";

const USD = 1_000_000n;
const PRESETS = EVENTS.stakePresetsUsd.map((d) => BigInt(d) * USD);
const MS_PER_SECOND = 1000;

const startText = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export const eventHref = (eventId: string) => `/app/event/?id=${eventId}`;

export function EventCard(p: { event: EventView; flow: EventsFlow; now: number; blocked: string | null }) {
  const e = p.event;
  const phase = eventPhase(e, p.now);
  const mine = p.flow.receipt?.eventId === e.eventId ? p.flow.receipt : null;
  return (
    <PredictionMarketCard
      marks={
        <>
          <TeamMark team={e.home} />
          <TeamMark team={e.away} />
        </>
      }
      meta={`${leagueName(e.league)} · ${startText(e.startsAt)}`}
      question={
        <Link
          href={eventHref(e.eventId)}
          className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {e.question}
        </Link>
      }
      clock={phase === "open" ? spanText(e.closesAt - p.now) : null}
      closing={phase === "open" ? (e.closesAt - p.now) / EVENTS.listAheadSec : 0}
      pools={{ yes: e.yesPool, no: e.noPool }}
      calls={e.calls}
      open={phase === "open"}
      status={statusLine(e, p.now)}
      answer={e.answer}
      limits={{ min: p.flow.limits?.minStake ?? 0n, max: p.flow.limits?.maxStake ?? 0n }}
      presets={PRESETS}
      balance={p.flow.balance}
      estimate={(yes, stake) =>
        `Pays about ${usd(estimateFor(e, yes, stake))} if ${sideWord(yes)} wins as the pools stand`
      }
      busy={p.flow.busy}
      onConfirm={async (yes, stake) => (await p.flow.call(e, yes, stake)) !== null}
      receipt={mine ? receiptOf(mine, p.flow.chainId, p.flow.clearReceipt) : null}
      blocked={p.blocked}
    />
  );
}

function receiptOf(r: EventReceipt, chainId: Parameters<typeof explorerTxUrl>[0], again: () => void) {
  return {
    title: `${sideWord(r.yes)} · ${usd(r.stake)} placed`,
    lines: [
      r.question,
      `Call #${r.ticketId.toString()} · paid out on its own once the committee answers`,
      <a
        key="tx"
        href={explorerTxUrl(chainId, r.txHash)}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-foreground"
      >
        See the transaction
      </a>,
    ],
    action: { label: "Done", onClick: again },
  };
}
