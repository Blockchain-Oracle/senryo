/**
 * What a terminal is looking at (S5, both apps): for a market and lane, the window on the server's clock, its K, the
 * series' band menu and σ, the pool's terms, the caller's balance and their call in this window, if any. Renders once a
 * second (the countdown) and on events — never per tick; ticks go through the quote pass (`quote.ts`).
 */
import type { Address } from "@senryo/account";
import type { CadenceSec } from "@senryo/config";
import { useServerSeconds } from "@senryo/live/react";
import { useCatalog, useMarketAccount, useTickets } from "@senryo/query";
import { useMemo } from "react";
import { callKey } from "./book.ts";
import { useSelectedPosition } from "./terminal-ready.ts";
import { useWindowOpen } from "./use-window-open.ts";
import { windowFor } from "./window.ts";

export const DEFAULT_SYMBOL = "BTC";
export const DEFAULT_CADENCE: CadenceSec = 60;
const OPEN_STATES = new Set(["committed", "open", "closing"]);

export function useCallWindow(symbol: string, cadenceSec: CadenceSec, owner: Address | undefined) {
  const now = useServerSeconds();
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const tickets = useTickets(owner);

  const window = useMemo(() => windowFor(symbol, cadenceSec, now), [symbol, cadenceSec, now]);
  const k = useWindowOpen(symbol, window.start, now);

  const market = "value" in catalog ? catalog.value.markets.find((m) => m.symbol === symbol) : undefined;
  const series = market?.series.find((s) => s.cadenceSec === cadenceSec);
  const terms = "value" in catalog ? catalog.value.terms : undefined;
  const balance = "value" in account ? account.value.balance : undefined;
  // The selected call when it's open in this window (a second call in it, D-343), else the first open one.
  const selected = useSelectedPosition();
  const position = useMemo(() => {
    if (!("value" in tickets)) return undefined;
    const open = tickets.value.tickets.filter(
      (t) => t.windowId.toLowerCase() === window.windowId.toLowerCase() && OPEN_STATES.has(t.state),
    );
    return open.find((t) => callKey(t.ticketId) === selected) ?? open[0];
  }, [tickets, window.windowId, selected]);

  return {
    symbol,
    cadenceSec,
    now,
    window,
    k,
    market,
    series,
    terms,
    balance,
    position,
    markets: "value" in catalog ? catalog.value.markets : [],
    owner,
  };
}

export type CallWindowView = ReturnType<typeof useCallWindow>;
