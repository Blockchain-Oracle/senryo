/**
 * Results land wherever you are, both apps (pivot craft list "Result reveal"): a call of yours that settles says
 * "Won $9.60 on BTC 1m" with the win cue and a celebration, the soft thud for a loss, or "Refunded"; a full cash-out
 * says what came back and what it made against the stake (the close cue already played at the fill). Only transitions
 * this run observed fire — opening the app never replays old results. Held windows are re-read when their settlement
 * should have posted, so a result shows with or without the user's stream topic (D-280).
 */
import { formatUnits } from "@senryo/core";
import { useRefreshCaller, useTickets } from "@senryo/query";
import { useEffect, useRef } from "react";
import type { Caller } from "./caller.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_MINUTE = 60;
const FINAL = new Set(["settled", "refunded"]);
const OPEN = new Set(["committed", "open", "closing"]);
const MS = 1_000;
/** Settlement posts about 4 s after a window closes; look then, and once more in case the keeper ran late. */
const SETTLE_LOOK_MS = 5_000;
const SETTLE_RELOOK_MS = 12_000;
const SETTLE_LOOKS_MS = [SETTLE_LOOK_MS, SETTLE_RELOOK_MS] as const;

const usd = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
const signed = (v: bigint) => `${v > 0n ? "+" : v < 0n ? "−" : ""}${usd(v)}`;

export type ResultCue = "win" | "loss" | "refund";

export interface ResultEffects {
  cue(cue: ResultCue): void;
  /** A win or a profitable cash-out: confetti. */
  celebrate(): void;
  notify(notice: { title: string; description: string }): void;
}

export function useResults({ hint }: Caller, effects: ResultEffects): void {
  const owner = hint?.address;
  const tickets = useTickets(owner);
  // The book zeroes a cashed-out ticket's stake, so the stake it had before is remembered with its state.
  const seen = useRef(new Map<string, { state: string; stake: bigint }>());
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const refresh = useRefreshCaller(owner);
  const expiries =
    "value" in tickets
      ? [...new Set(tickets.value.tickets.filter((t) => OPEN.has(t.state)).map((t) => t.start + t.cadenceSec))]
          .sort()
          .join(",")
      : "";

  useEffect(() => {
    if (!expiries) return;
    const timers = expiries
      .split(",")
      .flatMap((e) => SETTLE_LOOKS_MS.map((after) => Number(e) * MS + after - Date.now()))
      .filter((wait) => wait > 0)
      .map((wait) => setTimeout(refresh, wait));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [expiries, refresh]);

  useEffect(() => {
    if (!("value" in tickets)) return;
    const fx = effectsRef.current;
    for (const t of tickets.value.tickets) {
      const id = String(t.ticketId);
      const was = seen.current.get(id);
      seen.current.set(id, { state: t.state, stake: t.state === "closed" ? (was?.stake ?? t.stake) : t.stake });
      if (was === undefined || FINAL.has(was.state) || was.state === "closed") continue;
      const where = `${t.symbol} ${t.cadenceSec / SECONDS_PER_MINUTE}m`;
      if (t.state === "closed" && t.result !== null) {
        if (t.result > was.stake) fx.celebrate();
        fx.notify({ title: `Cashed out ${usd(t.result)}`, description: `${signed(t.result - was.stake)} on ${where}` });
        continue;
      }
      if (!FINAL.has(t.state)) continue;
      if (t.outcome === "win") {
        fx.cue("win");
        fx.celebrate();
        fx.notify({ title: `Won ${usd(t.result ?? t.payout)} on ${where}`, description: "Paid to your balance." });
      } else if (t.outcome === "lose") {
        fx.cue("loss");
        fx.notify({ title: `${where} closed against you`, description: `The ${usd(t.stake)} stake went to the pool.` });
      } else {
        fx.cue("refund");
        fx.notify({ title: `Refunded ${usd(t.result ?? t.stake)}`, description: `${where} · back in your balance.` });
      }
    }
  }, [tickets]);
}
