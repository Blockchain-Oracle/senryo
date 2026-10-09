/**
 * One question on the phone's board (S8.7; the web's `EventCard`, the 21st Prediction Market Card #2537 ported): both
 * sides' marks, the league and start, the question (a tap opens its page with the committee's statements), the pools,
 * Yes's share, Yes / No and the call in place; a settled question says how it ended.
 */
import type { EventView } from "@senryo/api-client";
import { estimateFor, eventPhase, leagueName, sideWord, spanText, statusLine } from "@senryo/calls";
import type { EventReceipt, EventsFlow } from "@senryo/calls/react";
import { type ChainId, EVENTS, explorerTxUrl } from "@senryo/config";
import { usd } from "@senryo/core";
import { type Href, router } from "expo-router";
import { Linking } from "react-native";
import { type PredictionCallView, PredictionMarketCard } from "~/components/kit/PredictionMarketCard";
import { TeamMark } from "./TeamMark";

const USD = 1_000_000n;
const PRESETS = EVENTS.stakePresetsUsd.map((d) => BigInt(d) * USD);
const MS_PER_SECOND = 1000;

const startText = (sec: number) =>
  new Date(sec * MS_PER_SECOND).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

/** A question's page (a payout push opens here too: `/events/<id>`). */
export const eventRoute = (eventId: string) => `/events/${eventId}` as Href;

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
      question={e.question}
      onQuestion={() => router.push(eventRoute(e.eventId))}
      clock={phase === "open" ? spanText(e.closesAt - p.now) : null}
      closing={phase === "open" ? (e.closesAt - p.now) / EVENTS.listAheadSec : 0}
      pools={{ yes: e.yesPool, no: e.noPool }}
      calls={e.calls}
      open={phase === "open"}
      status={statusLine(e, p.now)}
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

function receiptOf(r: EventReceipt, chainId: ChainId, done: () => void): PredictionCallView {
  return {
    title: `${sideWord(r.yes)} · ${usd(r.stake)} placed`,
    lines: [r.question, `Call #${r.ticketId.toString()} · paid out on its own once the committee answers`],
    link: { label: "See the transaction", onPress: () => void Linking.openURL(explorerTxUrl(chainId, r.txHash)) },
    action: { label: "Done", onPress: done },
  };
}
