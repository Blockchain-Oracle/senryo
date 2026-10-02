/**
 * The Markets tab's categories (flow book C1 rules): Commodities = XAU, XAG and crude oil; FX = EUR, GBP, JPY, CHF,
 * CAD; Crypto = Perpl's markets; Equities = the calculated equity feeds. `market-items.ts` places each instrument.
 */
export const MARKET_FILTERS = [
  { value: "all", label: "All" },
  { value: "commodities", label: "Commodities" },
  { value: "fx", label: "FX" },
  { value: "crypto", label: "Crypto" },
  { value: "equities", label: "Equities" },
] as const;
export type MarketFilter = (typeof MARKET_FILTERS)[number]["value"];
