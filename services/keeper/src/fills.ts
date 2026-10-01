import { type Address, receiptEvents, type SentTx } from "@senryo/chain";

/**
 * What a keeper transaction did to the user, read from its own receipt (so a push states the onchain result, not the
 * keeper's guess): `PositionUpdated` fills of a kind, and the `Deposited` total of a sweep.
 */

type Receipt = SentTx["receipt"];

/** `PositionKind` in declaration order (contracts/src/libraries/Types.sol); the event carries the index. */
const POSITION_KINDS = ["OPEN", "INCREASE", "DECREASE", "CLOSE", "LIQUIDATE", "TRIGGER"] as const;

export interface Fill {
  marketId: number;
  isLong: boolean;
  execPrice18: bigint;
  sizeAfter: bigint;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The user's fills of `kind` (an executed trigger has one; a liquidation one per market it closed). */
export function receiptFills(receipt: Receipt, user: Address, kind: "LIQUIDATE" | "TRIGGER"): Fill[] {
  return receiptEvents(receipt, "SenryoCore").flatMap((e) =>
    e.eventName === "PositionUpdated" && POSITION_KINDS[e.args.kind] === kind && same(e.args.user, user)
      ? [
          {
            marketId: e.args.marketId,
            isLong: e.args.isLong,
            execPrice18: e.args.execPrice,
            sizeAfter: e.args.sizeAfter,
          },
        ]
      : [],
  );
}

/** usd6 credited to the user (AUSD and USDC are both 6-decimal collateral). */
export function receiptDepositedUsd6(receipt: Receipt, user: Address): bigint {
  return receiptEvents(receipt, "SenryoCore").reduce(
    (sum, e) => (e.eventName === "Deposited" && same(e.args.user, user) ? sum + e.args.amount : sum),
    0n,
  );
}
