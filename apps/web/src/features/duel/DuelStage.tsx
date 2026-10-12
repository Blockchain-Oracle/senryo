"use client";
/**
 * The duel's stage (P4, D-322; the phone's `DuelStage`): your seat and the opponent's face each other across a VS with
 * the pot on the line between, through every phase. Yours is solid — portrait, handle, rating ("Your seat",
 * "Unranked" for a guest); the other is an empty silhouette until you queue, a breathing search while you wait, then
 * the person you drew. Under each seat, its running total once cards settle (provisional until all are in). The last
 * ten seconds of picking beat.
 */
import { signedUsd } from "@senryo/core";
import { useProfile } from "@senryo/query";
import { OVERSHOOT_EASE } from "@senryo/tokens";
import { User } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/identity/avatar";
import { cn } from "@/lib/utils";
import "./duel.css";

const PORTRAIT = 72;
const RINGS = 3;
/** One breath of the search (`duel.css` `duel-breathe`); the rings share it evenly. */
const BREATH_SEC = 2.4;
const VS_SEC = 0.7;
const VS_FROM = 1.8;
const ARRIVE_SEC = 0.24;

export type OpponentSeat =
  | { kind: "empty" }
  | { kind: "searching"; line: string; detail: string }
  | { kind: "person"; address: string };

export interface SeatTotal {
  total: bigint | null;
  provisional: boolean;
}

function usePerson(address: string | undefined, fallback: string) {
  const profile = useProfile(address);
  const p = address && "value" in profile ? profile.value : undefined;
  return { name: p?.handle ? `@${p.handle}` : fallback, avatar: p?.avatar ?? null };
}

export function DuelStage(p: {
  me: string | undefined;
  rating: string;
  opponent: OpponentSeat;
  opponentName?: string;
  pot: string;
  totals?: readonly [SeatTotal, SeatTotal] | undefined;
  beating?: boolean;
  matchKey?: string | undefined;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const me = usePerson(p.me, "Your seat");
  const them = usePerson(p.opponent.kind === "person" ? p.opponent.address : undefined, p.opponentName ?? "Opponent");
  return (
    <section
      aria-label="The arena"
      className={cn("flex min-h-55 flex-col gap-3 rounded-3xl p-5 text-(--arena-ink)", p.beating && "duel-heartbeat")}
      style={{ background: "radial-gradient(80% 90% at 50% 0%, var(--arena-raised), var(--arena))" }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <Seat name={me.name} detail={p.rating} total={p.totals?.[0]}>
          {p.me ? (
            <Avatar avatar={me.avatar} address={p.me} size={PORTRAIT} />
          ) : (
            <span className="grid size-18 place-items-center rounded-full bg-white/20">
              <User aria-hidden className="size-8" />
            </span>
          )}
        </Seat>
        <motion.span
          key={p.matchKey ?? "stage"}
          initial={reduce ? false : { scale: VS_FROM, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: VS_SEC, ease: OVERSHOOT_EASE }}
          className="duel-vs flex h-18 items-center"
        >
          VS
        </motion.span>
        {p.opponent.kind === "person" ? (
          <Seat name={them.name} detail="Opponent" total={p.totals?.[1]}>
            <motion.span
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: ARRIVE_SEC }}
            >
              <Avatar avatar={them.avatar} address={p.opponent.address} size={PORTRAIT} />
            </motion.span>
          </Seat>
        ) : (
          <Seat
            name={p.opponent.kind === "searching" ? p.opponent.line : "Opponent seat"}
            detail={p.opponent.kind === "searching" ? p.opponent.detail : "Waiting for you"}
          >
            <span className="relative grid size-18 place-items-center">
              {p.opponent.kind === "searching" ? (
                <span aria-hidden className="absolute -inset-6">
                  {Array.from({ length: RINGS }, (_, i) => (
                    <span key={i} className="duel-ring" style={{ animationDelay: `${(i * BREATH_SEC) / RINGS}s` }} />
                  ))}
                </span>
              ) : null}
              <span className="grid size-18 place-items-center rounded-full bg-white/10">
                <User aria-hidden className="size-8 opacity-70" />
              </span>
            </span>
          </Seat>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 flex-1 bg-accent opacity-50" />
        <span className="tnum font-semibold text-meta">
          <span className="sr-only">On the line: </span>
          {p.pot}
        </span>
        <span aria-hidden className="h-0.5 flex-1 bg-accent opacity-50" />
      </div>
      {p.children}
    </section>
  );
}

function Seat(p: { name: string; detail: string; total?: SeatTotal | undefined; children: ReactNode }) {
  const t = p.total;
  const tone = !t || t.total === null ? "opacity-70" : t.total > 0n ? "text-up" : t.total < 0n ? "text-down" : "";
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      {p.children}
      <span className="max-w-full truncate font-semibold text-row-title">{p.name}</span>
      <span className="max-w-full truncate text-meta opacity-70">{p.detail}</span>
      {t ? (
        <span aria-live="polite" className={cn("tnum font-semibold text-num-md", tone)}>
          {t.total === null ? "—" : `${signedUsd(t.total)}${t.provisional ? " so far" : ""}`}
        </span>
      ) : null}
    </div>
  );
}
