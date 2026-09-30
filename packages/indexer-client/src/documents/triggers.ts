/**
 * Active TP/SL trigger orders of one user (F14). The indexer's `Trigger` rows carry no `chainId` yet (the order id is
 * an EIP-712 digest with the chain in its domain, so ids never collide) — until the S8.20 re-sync adds it, callers
 * on one network see that user's triggers from both; practice is the only deployed network today.
 */
import { z } from "zod";
import { defineDocument, type ResultOf } from "../client.ts";
import { PAGE_SIZE } from "../constants.ts";
import { bigintish } from "../scalars.ts";

interface TriggerVars {
  user: string;
  limit: number;
}

const trigger = z.object({
  id: z.string(),
  market_id: z.string(),
  takeProfit: z.boolean(),
  triggerPrice: bigintish,
  size: bigintish,
  expiry: z.number().int(),
  placedAt: z.number().int(),
});

export const TriggersDocument = defineDocument<TriggerVars>()(
  "Triggers",
  `query Triggers($user: String!, $limit: Int!) {
    Trigger(where: { user_id: { _eq: $user }, status: { _eq: PLACED } }, order_by: { placedAt: desc }, limit: $limit) {
      id market_id takeProfit triggerPrice size expiry placedAt
    }
  }`,
  z.object({ Trigger: z.array(trigger) }).transform((d) => d.Trigger),
);

export function triggersVars(user: string, limit: number = PAGE_SIZE.positions): TriggerVars {
  return { user: user.toLowerCase(), limit };
}

export type Triggers = ResultOf<typeof TriggersDocument>;
