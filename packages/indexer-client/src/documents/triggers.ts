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

// ---------------------------------------------------------------- liquidations (F12 post-mortem)

interface LiquidationVars {
  user: string;
  since: number;
}

const liquidation = z.object({
  id: z.string(),
  market_id: z.string().nullable(),
  penalty: bigintish,
  realizedPnl: bigintish,
  positionsClosed: z.number().int(),
  timestamp: z.number().int(),
  txHash: z.string(),
});

/** The user's liquidations on our engine since `since` (unix s), newest first. */
export const LiquidationsDocument = defineDocument<LiquidationVars>()(
  "Liquidations",
  `query Liquidations($user: String!, $since: Int!) {
    Liquidation(
      where: { user_id: { _eq: $user }, venue: { _eq: OURS }, timestamp: { _gte: $since } }
      order_by: { timestamp: desc }
      limit: 5
    ) { id market_id penalty realizedPnl positionsClosed timestamp txHash }
  }`,
  z.object({ Liquidation: z.array(liquidation) }).transform((d) => d.Liquidation),
);

export function liquidationsVars(user: string, since: number): LiquidationVars {
  return { user: user.toLowerCase(), since };
}

export type Liquidations = ResultOf<typeof LiquidationsDocument>;

// ---------------------------------------------------------------- LP pool days (F24 historical APR)

interface LpDaysVars {
  fromDay: number;
}

const lpDay = z.object({ day: z.number().int(), traderFees: bigintish, traderPnl: bigintish });

/** Pool days since `fromDay` (UTC day index): trader fees and trader realised PnL — the pool's side of both. */
export const LpDaysDocument = defineDocument<LpDaysVars>()(
  "LpDays",
  `query LpDays($fromDay: Int!) {
    LpPoolDaily(where: { day: { _gte: $fromDay } }, order_by: { day: asc }) { day traderFees traderPnl }
  }`,
  z.object({ LpPoolDaily: z.array(lpDay) }).transform((d) => d.LpPoolDaily),
);

export type LpDays = ResultOf<typeof LpDaysDocument>;
