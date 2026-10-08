/**
 * What the terminal is looking at (S5): the market and cadence (remembered), the window on the server's clock, its K,
 * the series' band menu and σ, the pool's terms, the caller's balance and their call in this window, if any. Renders
 * once a second (the countdown text) and on events — never per tick; ticks go through `useLiveQuote`.
 */
import type { CadenceSec } from "@senryo/config";
import { useServerSeconds } from "@senryo/live/react";
import { useCatalog, useMarketAccount, useTickets } from "@senryo/query";
import { useMemo } from "react";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import { useAccount } from "~/lib/account/provider";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { useWindowOpen } from "../calls/useWindowOpen";
import { windowFor } from "../calls/window";

export const DEFAULT_SYMBOL = "BTC";
export const DEFAULT_CADENCE: CadenceSec = 60;
const OPEN_STATES = new Set(["committed", "open", "closing"]);

export function useTerminal() {
  const [storedSymbol, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const [storedCadence, setCadence] = useMMKVNumber(STORAGE_KEYS.terminalCadence, storage);
  const symbol = storedSymbol ?? DEFAULT_SYMBOL;
  const cadenceSec = (storedCadence ?? DEFAULT_CADENCE) as CadenceSec;
  const now = useServerSeconds();
  const owner = useAccount().hint?.address;
  const catalog = useCatalog();
  const account = useMarketAccount(owner);
  const tickets = useTickets(owner);

  const window = useMemo(() => windowFor(symbol, cadenceSec, now), [symbol, cadenceSec, now]);
  const k = useWindowOpen(symbol, window.start, now);

  const market = "value" in catalog ? catalog.value.markets.find((m) => m.symbol === symbol) : undefined;
  const series = market?.series.find((s) => s.cadenceSec === cadenceSec);
  const terms = "value" in catalog ? catalog.value.terms : undefined;
  const balance = "value" in account ? account.value.balance : undefined;
  const position = useMemo(() => {
    if (!("value" in tickets)) return undefined;
    return tickets.value.tickets.find(
      (t) => t.windowId.toLowerCase() === window.windowId.toLowerCase() && OPEN_STATES.has(t.state),
    );
  }, [tickets, window.windowId]);

  return {
    symbol,
    cadenceSec,
    setSymbol,
    setCadence: (c: CadenceSec) => setCadence(c),
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

export type TerminalView = ReturnType<typeof useTerminal>;
