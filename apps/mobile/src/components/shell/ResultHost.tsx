import { formatUnits } from "@senryo/core";
import { useRefreshCaller, useTickets } from "@senryo/query";
import { useEffect, useRef } from "react";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";

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

/**
 * Results land wherever you are (pivot craft list "Result reveal"): a call of yours that settles plays the win cue
 * and haptic with "Won $9.60 on BTC 1m", the soft thud for a loss, or says "Refunded"; a full cash-out says what came
 * back and what it made against the stake (the close cue already played at the fill). Only transitions this run
 * observed fire — launching the app never replays old results.
 */
export function ResultHost() {
  const owner = useAccount().hint?.address;
  const tickets = useTickets(owner);
  // The book zeroes a cashed-out ticket's stake, so the stake it had before is remembered with its state.
  const seen = useRef(new Map<string, { state: string; stake: bigint }>());
  const refresh = useRefreshCaller(owner);
  const expiries =
    "value" in tickets
      ? [...new Set(tickets.value.tickets.filter((t) => OPEN.has(t.state)).map((t) => t.start + t.cadenceSec))]
          .sort()
          .join(",")
      : "";

  // A held window's result shows when it lands, with or without the user's stream topic.
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
    for (const t of tickets.value.tickets) {
      const id = String(t.ticketId);
      const was = seen.current.get(id);
      seen.current.set(id, { state: t.state, stake: t.state === "closed" ? (was?.stake ?? t.stake) : t.stake });
      if (was === undefined || FINAL.has(was.state) || was.state === "closed") continue;
      const where = `${t.symbol} ${t.cadenceSec / SECONDS_PER_MINUTE}m`;
      if (t.state === "closed" && t.result !== null) {
        notify({ title: `Cashed out ${usd(t.result)}`, description: `${signed(t.result - was.stake)} on ${where}` });
        continue;
      }
      if (!FINAL.has(t.state)) continue;
      if (t.outcome === "win") {
        fire("win", { cue: "win" });
        notify({ title: `Won ${usd(t.result ?? t.payout)} on ${where}`, description: "Paid to your balance." });
      } else if (t.outcome === "lose") {
        fire("loss", { cue: "loss" });
        notify({ title: `${where} closed against you`, description: `The ${usd(t.stake)} stake went to the pool.` });
      } else {
        fire("confirm");
        notify({ title: `Refunded ${usd(t.result ?? t.stake)}`, description: `${where} · back in your balance.` });
      }
    }
  }, [tickets]);
  return null;
}
