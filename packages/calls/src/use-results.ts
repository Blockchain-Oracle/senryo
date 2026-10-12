/**
 * Results land wherever you are, both apps (pivot craft list "Result reveal"): a call of yours that settles says
 * "Won $9.60 on BTC 1m" with the win cue and a celebration, the soft thud for a loss, or "Refunded"; a full cash-out
 * says what it realised against the stake — "Realized +$1.24" — on the cash-out's own toast (R5.11), with win or loss
 * by that sign (R5.12). Only transitions this run observed fire — opening the app never replays old results. Held
 * windows are re-read when their settlement should have posted, so a result shows with or without the user's stream
 * topic (D-280). Rides' results join from `useRideResults`.
 */
import { useRefreshCaller, useTickets } from "@senryo/query";
import { useEffect, useRef } from "react";
import type { Caller } from "./caller.ts";
import { type ResultEffects, realisedCue, signed, usd } from "./result-cue.ts";
import { tradeResulted, tradeToastId } from "./toast-run.ts";
import { finishRun } from "./trade-run.ts";
import { useRideResults } from "./use-ride-results.ts";

const SECONDS_PER_MINUTE = 60;
const FINAL = new Set(["settled", "refunded"]);
const OPEN = new Set(["committed", "open", "closing"]);
const MS = 1_000;
/** Settlement posts about 4 s after a window closes; look then, and once more in case the keeper ran late. */
const SETTLE_LOOK_MS = 5_000;
const SETTLE_RELOOK_MS = 12_000;
const SETTLE_LOOKS_MS = [SETTLE_LOOK_MS, SETTLE_RELOOK_MS] as const;

export function useResults({ hint }: Caller, effects: ResultEffects): void {
  const owner = hint?.address;
  const tickets = useTickets(owner);
  // The book zeroes a cashed-out ticket's stake, so the stake it had before is remembered with its state.
  const seen = useRef(new Map<string, { state: string; stake: bigint }>());
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  const refresh = useRefreshCaller(owner);
  useRideResults(owner, effects);
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
      const key = String(t.ticketId);
      const was = seen.current.get(key);
      seen.current.set(key, { state: t.state, stake: t.state === "closed" ? (was?.stake ?? t.stake) : t.stake });
      if (was === undefined || FINAL.has(was.state) || was.state === "closed") continue;
      const where = `${t.symbol} ${t.cadenceSec / SECONDS_PER_MINUTE}m`;
      const id = tradeToastId.call(t.ticketId);
      // Ended this session: its slip joins "Just finished" (R5.11).
      if ((t.state === "closed" && t.result !== null) || FINAL.has(t.state))
        finishRun({ instrument: "call", id: t.ticketId, symbol: t.symbol });
      if (t.state === "closed" && t.result !== null) {
        const net = t.result - was.stake;
        tradeResulted(id);
        realisedCue(fx, net);
        fx.notify({
          title: `Realized ${signed(net)}`,
          description: `Cashed out ${usd(t.result)} on ${where}`,
          symbol: t.symbol,
          id,
        });
        continue;
      }
      if (!FINAL.has(t.state)) continue;
      if (t.outcome === "win") {
        fx.cue("win");
        fx.celebrate();
        fx.notify({
          title: `Won ${usd(t.result ?? t.payout)} on ${where}`,
          description: "Paid to your balance.",
          symbol: t.symbol,
          id,
        });
      } else if (t.outcome === "lose") {
        fx.cue("loss");
        fx.notify({
          title: `${where} closed against you`,
          description: `The ${usd(t.stake)} stake went to the pool.`,
          symbol: t.symbol,
          id,
        });
      } else {
        fx.cue("refund");
        fx.notify({
          title: `Refunded ${usd(t.result ?? t.stake)}`,
          description: `${where} · back in your balance.`,
          symbol: t.symbol,
          id,
        });
      }
    }
  }, [tickets]);
}
