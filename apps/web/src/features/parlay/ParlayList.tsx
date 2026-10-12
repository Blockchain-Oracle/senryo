"use client";
/**
 * Your parlays as settlement tracks (P3, D-326; the phone's `ParlayList`): the big line (what it pays while live, the
 * result once done) and where it stands, then the legs as a chain of marks — each with its verdict, or live "Ahead" /
 * "Behind" and its countdown while pending; a link lights once both its ends came true. Verdicts already in replay
 * 420 ms apart when a track first shows; one arriving while you watch lands with a tick. Open ones first.
 */
import { parlayHero, parlayStatus } from "@senryo/calls";
import { useLegStanding } from "@senryo/calls/react";
import { lane, sideName, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useParlays } from "@senryo/query";
import { Check, Clock, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { SLOT_CENTRE_PERCENT } from "./constants";

const MARK = 40;
/** Verdicts already in replay this far apart when a track first shows. */
const REPLAY_MS = 420;
const MS = 1000;
const TONE = { up: "text-up", down: "text-down", ink: "text-foreground" } as const;
const STANDING = { up: "text-up", down: "text-down", muted: "text-text-3" } as const;

type Parlay = Extract<ReturnType<typeof useParlays>, { value: unknown }>["value"]["parlays"][number];
type Leg = Parlay["legs"][number];

export function ParlayList({ owner }: { owner: `0x${string}` | undefined }) {
  const parlays = useParlays(owner);
  if (!owner || !("value" in parlays)) return null;
  const list = [...parlays.value.parlays].sort((a, b) => Number(inPlay(b)) - Number(inPlay(a)));
  return (
    <section aria-label="Your parlays" className="flex flex-col gap-3">
      <h2 className="font-semibold text-section-title">Your parlays</h2>
      {list.length === 0 ? (
        <p className="text-body text-text-2">Placed parlays settle here, leg by leg.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <Track key={String(p.parlayId)} parlay={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

const inPlay = (p: Parlay) => p.state === "open" || p.state === "committed";

/** The parlays still in play, on Calls (P3): their tracks under "Parlays in play", with the way to Parlay. */
export function OpenParlays({ owner }: { owner: `0x${string}` | undefined }) {
  const parlays = useParlays(owner);
  if (!owner || !("value" in parlays)) return null;
  const open = parlays.value.parlays.filter(inPlay);
  if (open.length === 0) return null;
  return (
    <section aria-label="Parlays in play" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-section-title">Parlays in play</h2>
        <Link href="/app/parlay/" className="font-semibold text-link text-row-title hover:underline">
          See all
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {open.map((p) => (
          <Track key={String(p.parlayId)} parlay={p} />
        ))}
      </ul>
    </section>
  );
}

function Track({ parlay }: { parlay: Parlay }) {
  const hero = parlayHero(parlay);
  const n = parlay.legs.length;
  return (
    <li className="flex flex-col gap-1 rounded-2xl bg-secondary p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("tnum font-semibold text-num-md", TONE[hero.tone])}>{hero.text}</span>
        <span className="text-right text-meta text-text-3">{parlayStatus(parlay)}</span>
      </div>
      <span className="tnum text-meta text-text-3">
        {usd(parlay.stake)} · {n} legs
      </span>
      <ol className="relative flex pt-2">
        <span
          aria-hidden
          className="absolute top-7 flex -translate-y-1/2"
          style={{ left: `${SLOT_CENTRE_PERCENT / n}%`, right: `${SLOT_CENTRE_PERCENT / n}%` }}
        >
          {parlay.legs.slice(1).map((l, i) => (
            <span
              key={l.windowId}
              className={cn(
                "h-0.5 flex-1 transition-colors duration-(--motion-base)",
                l.outcome === "won" && parlay.legs[i]?.outcome === "won" ? "bg-up" : "bg-(--shell-plate)",
              )}
            />
          ))}
        </span>
        {parlay.legs.map((l, i) => (
          <TrackLeg key={l.windowId} leg={l} index={i} />
        ))}
      </ol>
    </li>
  );
}

function TrackLeg({ leg, index }: { leg: Leg; index: number }) {
  const standing = useLegStanding(leg);
  const reduced = useReducedMotion();
  const firstOutcome = useRef(leg.outcome);
  const arrived = useRef(false);
  useEffect(() => {
    if (leg.outcome === firstOutcome.current && !arrived.current) return;
    arrived.current = true;
    if (leg.outcome !== "pending") fire("tick", { cue: "tap" });
  }, [leg.outcome]);
  const delay = reduced || arrived.current ? 0 : (index * REPLAY_MS) / MS;
  const Icon = leg.outcome === "won" ? Check : leg.outcome === "lost" ? X : Clock;
  return (
    <li className="relative z-10 flex flex-1 flex-col items-center gap-0.5">
      <span className="relative">
        <EntityMark id={marketId(leg.symbol)} size={MARK} decorative />
        <motion.span
          key={leg.outcome}
          initial={leg.outcome === "pending" ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18, delay }}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 grid size-4.5 place-items-center rounded-full",
            leg.outcome === "won"
              ? "bg-up text-background"
              : leg.outcome === "lost"
                ? "bg-down text-background"
                : leg.outcome === "pending"
                  ? "bg-(--shell-plate) text-text-3"
                  : "bg-muted text-background",
          )}
        >
          <Icon aria-hidden className="size-3" strokeWidth={3} />
        </motion.span>
      </span>
      <span className="truncate text-center text-micro">
        {leg.symbol} {sideName(leg.band)} · {lane(leg.cadenceSec)}
      </span>
      <span aria-live="polite" className={cn("tnum truncate text-center text-micro", STANDING[standing.tone])}>
        {standing.text}
      </span>
    </li>
  );
}
