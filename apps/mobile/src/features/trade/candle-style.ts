/**
 * The candle style (FT106/C41, F40; Codex S1b.7 consult #10): body on/off, an up/down colour pair from the tokens
 * (green/red or cyan/rose), and colouring by the previous close. Persisted in MMKV under `senryo.candles.v1`, written
 * only when the settings child saves. Borders are reserved: victory-native 42's Candlestick has no body-stroke option,
 * so drawing them honestly needs an overlay (FT106's border branch stays pending).
 */
import { useMMKVString } from "react-native-mmkv";
import type { CandleStyle } from "~/components/charts/CandleChart";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export type { CandleStyle };
export type CandlePalette = CandleStyle["palette"];

export const DEFAULT_CANDLE_STYLE: CandleStyle = { body: true, palette: "greenRed", previousClose: false };

function parse(raw: string | undefined): CandleStyle {
  if (!raw) return DEFAULT_CANDLE_STYLE;
  try {
    const value = JSON.parse(raw) as Partial<CandleStyle>;
    return {
      body: typeof value.body === "boolean" ? value.body : DEFAULT_CANDLE_STYLE.body,
      palette: value.palette === "cyanRose" ? "cyanRose" : "greenRed",
      previousClose: typeof value.previousClose === "boolean" ? value.previousClose : false,
    };
  } catch {
    return DEFAULT_CANDLE_STYLE;
  }
}

export function useCandleStyle(): CandleStyle {
  const [raw] = useMMKVString(STORAGE_KEYS.candles, storage);
  return parse(raw);
}

export function saveCandleStyle(style: CandleStyle): void {
  storage.set(STORAGE_KEYS.candles, JSON.stringify(style));
}
