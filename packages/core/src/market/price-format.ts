/**
 * Live prices in text (Tradash's precision, SPEC-chart §4, as Owarine re-implements it): decimals by magnitude —
 * ≥1e5 → 1, ≥1e3 → 2, ≥10 → 3, ≥0.01 → 4, smaller → enough for 3 significant figures. The phone's chart keeps a
 * worklet twin of `priceDecimals` (it runs on the UI thread) over this same table.
 */

export const PRICE_DECIMAL_BANDS = [
  { min: 1e5, decimals: 1 },
  { min: 1e3, decimals: 2 },
  { min: 10, decimals: 3 },
  { min: 0.01, decimals: 4 },
] as const;
export const PRICE_SIGNIFICANT = 3;
export const PRICE_ZERO_DECIMALS = 2;
export const PRICE_MAX_DECIMALS = 10;
const E8 = 1e8;

export function priceDecimals(price: number): number {
  const a = Math.abs(price);
  for (const band of PRICE_DECIMAL_BANDS) if (a >= band.min) return band.decimals;
  if (a === 0) return PRICE_ZERO_DECIMALS;
  return Math.min(PRICE_MAX_DECIMALS, PRICE_SIGNIFICANT - Math.floor(Math.log10(a)));
}

const formatters = new Map<number, Intl.NumberFormat>();

/** `$81,234.5` from a price at its own precision (or `decimals`); `undefined` → "—". */
export function formatPrice(
  price: number | undefined,
  decimals = price === undefined ? 0 : priceDecimals(price),
): string {
  if (price === undefined) return "—";
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return `${price < 0 ? "−" : ""}$${f.format(Math.abs(price))}`;
}

/** The stream's prices are × 1e8 (Pyth's exponent −8). */
export const priceFromE8 = (priceE8: number): number => priceE8 / E8;
