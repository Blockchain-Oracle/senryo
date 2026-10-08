import { formatUnits } from "@senryo/core";
import { useTickets } from "@senryo/query";
import { useEffect, useRef } from "react";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_MINUTE = 60;
const FINAL = new Set(["settled", "refunded"]);

const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

/**
 * Results land wherever you are (pivot craft list "Result reveal"): a call of yours that settles plays the win cue
 * and haptic with "Won $9.60 on BTC 1m", the soft thud for a loss, or says "Refunded". Only transitions this run
 * observed fire — launching the app never replays old results.
 */
export function ResultHost() {
  const owner = useAccount().hint?.address;
  const tickets = useTickets(owner);
  const seen = useRef(new Map<string, string>());

  useEffect(() => {
    if (!("value" in tickets)) return;
    for (const t of tickets.value.tickets) {
      const id = String(t.ticketId);
      const was = seen.current.get(id);
      seen.current.set(id, t.state);
      if (was === undefined || FINAL.has(was) || !FINAL.has(t.state)) continue;
      const where = `${t.symbol} ${t.cadenceSec / SECONDS_PER_MINUTE}m`;
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
