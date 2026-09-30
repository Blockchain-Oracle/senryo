import { encodeAbiParameters, type Hex, keccak256, stringToBytes } from "@senryo/chain";
import { BPS, CARD_CURRENCY, MAX_HOLD_USD6, TIP_MCCS, USD6_PER_CENT } from "./constants.ts";
import type { AsaRequest } from "./lithic/schemas.ts";

/** `bytes32` for a label/token string (Lithic tokens are UUIDs; the contract wants bytes32). */
export function bytes32Of(text: string): Hex {
  return keccak256(stringToBytes(text));
}

/** `holdId = keccak256(abi.encode(issuer, issuerTxnToken))` — CardModule.placeHold (idempotent per token). */
export function holdIdOf(issuer: Hex, txnToken: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "issuer", type: "bytes32" },
        { name: "token", type: "bytes32" },
      ],
      [issuer, txnToken],
    ),
  );
}

export interface HoldAmount {
  /** usd6 to hold onchain. */
  usd6: bigint;
  cents: bigint;
  buffer: "none" | "fx" | "tip";
}

export type AmountRejection = "currency" | "zero" | "too-large";

/**
 * hold = max(amounts.hold, cardholder × (1 + FX_BUFFER_BPS | TIP_BUFFER_BPS by MCC)), cents × 10 000 → usd6
 * (specs/services.md §card 3). The card's billing currency must be USD.
 */
export function holdAmount(
  req: AsaRequest,
  buffers: { fxBps: number; tipBps: number },
): HoldAmount | { rejected: AmountRejection } {
  const { cardholder, hold, merchant } = req.amounts;
  if (cardholder.currency !== CARD_CURRENCY) return { rejected: "currency" };
  const base = BigInt(cardholder.amount);
  if (base <= 0n) return { rejected: "zero" };
  const foreign = merchant.currency !== cardholder.currency;
  const tipped = req.merchant.mcc !== undefined && TIP_MCCS.includes(req.merchant.mcc);
  const bps = BigInt(foreign ? buffers.fxBps : tipped ? buffers.tipBps : 0);
  const buffered = (base * (BPS + bps) + BPS - 1n) / BPS;
  const network = hold && hold.currency === CARD_CURRENCY ? BigInt(hold.amount) : 0n;
  const cents = buffered > network ? buffered : network;
  const usd6 = cents * USD6_PER_CENT;
  if (usd6 > MAX_HOLD_USD6) return { rejected: "too-large" };
  return { usd6, cents, buffer: foreign ? "fx" : tipped ? "tip" : "none" };
}

/** usd6 → whole cents, rounded down (never report more than is available). */
export function usd6ToCents(usd6: bigint): number {
  const cents = usd6 > 0n ? usd6 / USD6_PER_CENT : 0n;
  return Number(cents);
}
