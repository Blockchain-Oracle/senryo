/**
 * The ticket's "Pay with" (flow book C3 step 4) lives in `@senryo/query` (`ticket-pay.ts`), shared with the web; the
 * phone passes its own holdings read.
 */
import type { ChainId } from "@senryo/config";
import { type TicketPay, useTicketPay as useSharedTicketPay } from "@senryo/query";
import { useMoneyAssets } from "~/features/money/useMoneyAssets";

export type { TicketPay };

export function useTicketPay(
  chainId: ChainId,
  owner: `0x${string}` | undefined,
  freeToTradeUsd6: bigint | undefined,
  needUsd6: bigint,
): TicketPay {
  return useSharedTicketPay(chainId, owner, freeToTradeUsd6, needUsd6, useMoneyAssets());
}
