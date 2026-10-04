import { CARD_CURRENCY } from "../constants.ts";
import type { TransactionEvent } from "./schemas.ts";

/** Settled debits/credits use settlement units; a RETURN's cardholder amount can legitimately be zero. */
export function eventAmountCents(event: TransactionEvent): bigint {
  const settled = event.type === "CLEARING" || event.type === "RETURN";
  const settlement = settled ? event.amounts?.settlement : undefined;
  if (settlement && settlement.currency !== CARD_CURRENCY)
    throw new Error(`Unsupported card settlement currency: ${settlement.currency}`);
  const cents = settlement?.amount ?? event.amounts?.cardholder.amount ?? event.amount ?? 0;
  return BigInt(Math.abs(cents));
}
