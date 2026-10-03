/**
 * Exact amounts in any asset's own decimals (B0.2; the phone's `amount.ts`): typed text → raw units, raw units → the
 * plain text a field shows. Integer base units throughout.
 */
import { formatUnits, parseUnits } from "@senryo/core";

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

/** Keeps a typed amount within the asset's decimals (digits and one point). */
export function cleanAmountText(text: string, decimals: number): string | undefined {
  const next = text.replace(/[^\d.]/g, "");
  const [whole = "", frac, extra] = next.split(".");
  if (extra !== undefined) return undefined;
  if (frac !== undefined && frac.length > decimals) return undefined;
  return frac === undefined ? whole : `${whole}.${frac}`;
}
