/**
 * A position or order size in its own unit (flow book C5 step 3; Part 1 defect 9): troy ounces for the metals, the
 * base currency for FX ("1,250.0000 EUR", "7,412 JPY"). The size is 1e18 units of the base on every engine market.
 */
import { engineMarket } from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";

const METAL_UNIT = "oz";
const SIZE_DECIMALS = 4;
/** The yen has no minor unit worth showing on a position. */
const WHOLE_UNIT_DECIMALS = 0;
const WHOLE_UNIT_SYMBOLS: ReadonlySet<string> = new Set(["JPY"]);

/** The unit word for a market's size: "oz" or the currency code. */
export function sizeUnit(marketId: number): string {
  const market = engineMarket(marketId);
  if (!market) return "";
  return market.category === "metal" ? METAL_UNIT : market.symbol;
}

/** "0.0123 oz" · "1,250.0000 EUR" · "7,412 JPY". */
export function quantityText(marketId: number, size18: bigint): string {
  const market = engineMarket(marketId);
  const decimals = market && WHOLE_UNIT_SYMBOLS.has(market.symbol) ? WHOLE_UNIT_DECIMALS : SIZE_DECIMALS;
  const unit = sizeUnit(marketId);
  const amount = formatUnits(size18, DECIMALS.e18, decimals);
  return unit ? `${amount} ${unit}` : amount;
}

/** Unrealised P&L net of funding and borrow: positive means the position is up. */
export const netPnl = (priceUsd6: bigint, fundingUsd6: bigint, borrowUsd6: bigint) =>
  priceUsd6 - fundingUsd6 - borrowUsd6;
