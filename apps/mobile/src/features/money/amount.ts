/**
 * Exact amounts in any asset's own decimals (B0.2): the keypad's text rules for every money flow, with the ONE digit
 * cap the trade ticket's keypad uses (`AMOUNT_MAX_WHOLE_DIGITS`, plan Part F3), a units ↔ $ toggle where the asset is
 * priced, and Max as the exact spendable amount (never a rounded string). Integer base units throughout.
 */
import { formatUnits, parseUnits } from "@senryo/core";
import { useState } from "react";
import { AMOUNT_MAX_WHOLE_DIGITS, type KeypadKey } from "~/components/trade/Keypad";
import { unitsOfValue, valueOfUnits } from "./assets";

const USD_DECIMALS = 2;
const USD6 = 6;

/** Next amount text after a key, in `decimals` places; unchanged when the key would make it invalid. */
export function applyMoneyKey(text: string, key: KeypadKey, decimals: number): string {
  if (key === "del") return text.slice(0, -1);
  const [whole = "", frac] = text.split(".");
  if (key === ".") return frac !== undefined || decimals === 0 ? text : `${whole === "" ? "0" : whole}.`;
  if (frac !== undefined) return frac.length >= decimals ? text : `${text}${key}`;
  if (whole === "0") return key;
  return whole.length >= AMOUNT_MAX_WHOLE_DIGITS ? text : `${text}${key}`;
}

/** "12.5" → raw units; 0 while it isn't a number yet. */
export function parseAmount(text: string, decimals: number): bigint {
  if (text === "" || text === ".") return 0n;
  const parsed = parseUnits(text, decimals);
  return parsed.ok ? parsed.value : 0n;
}

/** Raw units → the plain text the field shows (no grouping, trailing zeros dropped). */
export function plainAmount(raw: bigint, decimals: number): string {
  const text = formatUnits(raw, decimals, decimals).replace(/,/g, "");
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

export type AmountMode = "units" | "usd";

/**
 * The typed amount of one asset. `priceUsd18` enables the $ toggle; `available` is what Max fills (exact). Any key
 * press after Max makes it a typed amount again. `initial` pre-fills an exact amount (a scanned payment code).
 */
export function useAmountInput(decimals: number, priceUsd18: bigint | null, available: bigint, initial?: bigint) {
  const [text, setText] = useState(() => (initial !== undefined && initial > 0n ? plainAmount(initial, decimals) : ""));
  const [mode, setMode] = useState<AmountMode>("units");
  const [max, setMax] = useState(false);
  const usdMode = mode === "usd" && priceUsd18 !== null;
  const typed = usdMode
    ? unitsOfValue(parseAmount(text, USD6), decimals, priceUsd18 ?? 0n)
    : parseAmount(text, decimals);
  const amount = max ? available : typed;
  const usd6 = priceUsd18 === null ? null : valueOfUnits(amount, decimals, priceUsd18);
  return {
    text,
    mode: usdMode ? ("usd" as const) : ("units" as const),
    amount,
    usd6,
    max,
    over: amount > available,
    key: (k: KeypadKey) => {
      setMax(false);
      setText((t) => applyMoneyKey(max ? "" : t, k, usdMode ? USD_DECIMALS : decimals));
    },
    fillMax: () => {
      setMax(true);
      setText(
        usdMode && priceUsd18 !== null
          ? formatUnits(valueOfUnits(available, decimals, priceUsd18), USD6, USD_DECIMALS).replace(/,/g, "")
          : plainAmount(available, decimals),
      );
    },
    /** A share of what's available (bps of 10 000), typed in units. */
    fillShare: (bps: bigint, totalBps: bigint) => {
      setMax(false);
      setMode("units");
      setText(plainAmount((available * bps) / totalBps, decimals));
    },
    toggleMode: () => {
      if (priceUsd18 === null) return;
      const next: AmountMode = usdMode ? "units" : "usd";
      setMode(next);
      setText(
        amount === 0n
          ? ""
          : next === "usd"
            ? formatUnits(valueOfUnits(amount, decimals, priceUsd18), USD6, USD_DECIMALS).replace(/,/g, "")
            : plainAmount(amount, decimals),
      );
    },
    reset: () => {
      setMax(false);
      setText("");
    },
  };
}

export type AmountInput = ReturnType<typeof useAmountInput>;
