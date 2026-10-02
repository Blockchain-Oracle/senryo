/**
 * An exact amount for a send or withdrawal (review S02): typed in the token's own units to the cent, with the shares
 * as conveniences that fill the field — never the only control. "All" is exactly what can leave (not a rounded cent
 * string); any edit makes it a typed amount again. The amount is integer base units throughout (usd6).
 */
import { RISK } from "@senryo/core";
import { useId } from "react";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";
import { storage } from "~/lib/storage";

const USD6_PER_CENT = 10_000n;
const CENTS_PER_UNIT = 100n;
const CENT_DIGITS = 2;
const WHOLE_DIGITS_MAX = 9;
const AMOUNT_TEXT = /^\d*(\.\d{0,2})?$/;

/** usd6 → "12.34", rounded down to the cent so a share never asks for more than it can. */
export function floorCentsText(usd6: bigint): string {
  const cents = usd6 / USD6_PER_CENT;
  return `${cents / CENTS_PER_UNIT}.${(cents % CENTS_PER_UNIT).toString().padStart(CENT_DIGITS, "0")}`;
}

/** "12.34" → usd6, or undefined while it isn't a number yet. */
function parseCents(text: string): bigint | undefined {
  if (text === "" || text === ".") return undefined;
  const [whole = "0", frac = ""] = text.split(".");
  return (BigInt(whole || "0") * CENTS_PER_UNIT + BigInt(frac.padEnd(CENT_DIGITS, "0"))) * USD6_PER_CENT;
}

export function useAmountDraft(max: bigint, scope?: string) {
  const local = useId();
  const key = `senryo.amount-draft.v1:${scope ?? local}`;
  const [saved, setTextRaw] = useMMKVString(key, storage);
  const [all, setAll] = useMMKVBoolean(`${key}:max`, storage);
  const text = saved ?? "";
  const typed = parseCents(text) ?? 0n;
  const amount = all ? max : typed;
  return {
    text,
    amount,
    all,
    over: amount > max,
    /** Keeps only a valid money string (digits, one point, two decimals); an edit ends "All". */
    setText: (next: string) => {
      const cleaned = next.replace(/,/g, "");
      const [whole = ""] = cleaned.split(".");
      if (!AMOUNT_TEXT.test(cleaned) || whole.length > WHOLE_DIGITS_MAX) return;
      setAll(false);
      setTextRaw(cleaned);
    },
    /** A share of what can leave; the whole of it is exact. */
    setShare: (bps: bigint) => {
      const full = bps >= RISK.BPS;
      setAll(full);
      setTextRaw(floorCentsText(full ? max : (max * bps) / RISK.BPS));
    },
    reset: () => {
      setAll(false);
      setTextRaw("");
    },
  };
}
