import { MARKETS } from "@senryo/config";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useMMKVString } from "react-native-mmkv";
import { TerminalScreen } from "~/features/terminal/TerminalScreen";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/**
 * The seal in the dock: the live terminal (S5). A link may name its market (`/trade?symbol=ETH`, from the web's
 * `/app/trade/eth/`, R2.13): a listed one becomes the terminal's market.
 */
export default function Trade() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  useEffect(() => {
    if (symbol && MARKETS.some((m) => m.symbol === symbol)) setSymbol(symbol);
  }, [symbol, setSymbol]);
  return <TerminalScreen />;
}
