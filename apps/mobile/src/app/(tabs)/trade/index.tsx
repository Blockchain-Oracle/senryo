import { setTerminalReady } from "@senryo/calls/react";
import { MARKETS } from "@senryo/config";
import { hasIntent, parseIntent } from "@senryo/search";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useMMKVString } from "react-native-mmkv";
import { TerminalScreen } from "~/features/terminal/TerminalScreen";
import { STORAGE_KEYS, storage } from "~/lib/storage";

type Params = { symbol?: string; lane?: string; mode?: string; side?: string; position?: string };

/**
 * The seal in the dock: the live terminal (S5). A link may name its market (`/trade?symbol=ETH`, from the web's
 * `/app/trade/eth/`, R2.13) and how to open (D-340, search's results): `lane`, `mode` (call | ride), a `side` to have
 * ready and a `position` to open with Cash out ready — lit a few seconds, never placed. The params clear once read.
 */
export default function Trade() {
  const params = useLocalSearchParams<Params>();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const { symbol, lane, mode, side, position } = params;
  useEffect(() => {
    if (symbol && MARKETS.some((m) => m.symbol === symbol)) setSymbol(symbol);
    const intent = parseIntent((k) => ({ lane, mode, side, position })[k]);
    if (!hasIntent(intent)) return;
    if (intent.instrument) storage.set(STORAGE_KEYS.terminalInstrument, intent.instrument);
    if (intent.lane && intent.instrument !== "ride") storage.set(STORAGE_KEYS.terminalCadence, intent.lane);
    setTerminalReady({ side: intent.side ?? null, position: intent.position ?? null });
    router.setParams({ lane: undefined, mode: undefined, side: undefined, position: undefined });
  }, [symbol, lane, mode, side, position, setSymbol]);
  return <TerminalScreen />;
}
