import type { PerplPosition, PerplScale } from "@senryo/chain";
import { oneUnit } from "@senryo/core";

const COLLATERAL_DECIMALS = 6;
/** Move an Exchange PnL snapshot to a newer mark; preserves its entry residue and booked funding. Display estimate only. */
export function perplPnlAtMark(position: PerplPosition, markPNS: bigint, scale: PerplScale): bigint {
  const signedMove = (markPNS - position.markPricePNS) * (position.side === "long" ? 1n : -1n);
  const change =
    (signedMove * position.lots * oneUnit(COLLATERAL_DECIMALS)) / oneUnit(scale.priceDecimals + scale.lotDecimals);
  return position.pnlCNS + change;
}
