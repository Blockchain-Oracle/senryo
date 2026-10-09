/**
 * What the phone's terminal is looking at (S5): the market and lane it remembers (MMKV), over the shared view of that
 * window (`@senryo/calls` `useCallWindow`: the window on the server's clock, K, the series, the pool's terms, the
 * balance and the call in this window). Renders once a second and on events — never per tick.
 */
import { DEFAULT_CADENCE, DEFAULT_SYMBOL, useCallWindow } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import { useAccount } from "~/lib/account/provider";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export function useTerminal() {
  const [storedSymbol, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const [storedCadence, setCadence] = useMMKVNumber(STORAGE_KEYS.terminalCadence, storage);
  const view = useCallWindow(
    storedSymbol ?? DEFAULT_SYMBOL,
    (storedCadence ?? DEFAULT_CADENCE) as CadenceSec,
    useAccount().hint?.address,
  );
  return { ...view, setSymbol, setCadence: (c: CadenceSec) => setCadence(c) };
}

export type TerminalView = ReturnType<typeof useTerminal>;
