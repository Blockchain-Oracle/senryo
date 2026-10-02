/**
 * Active TP/SL trigger orders, liquidations and LP pool days (F14, F12, F24). Envio adds `chainId` to every entity,
 * so each query is scoped to one network. Trigger ids are EIP-712 digests (chain in the domain) — unique; the LP
 * entities' ids (owner / requestId / day) are not chain-prefixed, which the S8.20 re-sync fixes before mainnet.
 */
import { z } from "zod";
import { defineDocument, type ResultOf } from "../client.ts";
import { PAGE_SIZE } from "../constants.ts";
import { bigintish } from "../scalars.ts";

interface TriggerVars {
  chainId: number;
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
  `query Triggers($chainId: Int!, $user: String!, $limit: Int!) {
    Trigger(
      where: { chainId: { _eq: $chainId }, user_id: { _eq: $user }, status: { _eq: PLACED } }
      order_by: { placedAt: desc }
      limit: $limit
    ) {
      id market_id takeProfit triggerPrice size expiry placedAt
    }
  }`,
  z.object({ Trigger: z.array(trigger) }).transform((d) => d.Trigger),
);

export function triggersVars(chainId: number, user: string, limit: number = PAGE_SIZE.positions): TriggerVars {
  return { chainId, user: user.toLowerCase(), limit };
}

export type Triggers = ResultOf<typeof TriggersDocument>;

// ---------------------------------------------------------------- trigger history (flow book C8)

const triggerHistory = trigger.extend({
  status: z.enum(["PLACED", "CANCELLED", "EXECUTED"]),
  closedAt: z.number().int().nullable(),
  executedSize: bigintish.nullable(),
  txHash: z.string(),
});

/**
 * Every TP/SL the user placed on this network, newest first, whatever became of it (flow book C8 History): the app
 * derives Expired (PLACED past expiry) and Ended with position (PLACED with no matching open position) itself, since
 * the indexer has no such statuses.
 */
export const TriggerHistoryDocument = defineDocument<TriggerVars>()(
  "TriggerHistory",
  `query TriggerHistory($chainId: Int!, $user: String!, $limit: Int!) {
    Trigger(
      where: { chainId: { _eq: $chainId }, user_id: { _eq: $user } }
      order_by: { placedAt: desc }
      limit: $limit
    ) {
      id market_id takeProfit triggerPrice size expiry placedAt status closedAt executedSize txHash
    }
  }`,
  z.object({ Trigger: z.array(triggerHistory) }).transform((d) => d.Trigger),
);

export type TriggerHistory = ResultOf<typeof TriggerHistoryDocument>;

// ---------------------------------------------------------------- liquidations (F12 post-mortem)

interface LiquidationVars {
  chainId: number;
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
  `query Liquidations($chainId: Int!, $user: String!, $since: Int!) {
    Liquidation(
      where: { chainId: { _eq: $chainId }, user_id: { _eq: $user }, venue: { _eq: OURS }, timestamp: { _gte: $since } }
      order_by: { timestamp: desc }
      limit: 5
    ) { id market_id penalty realizedPnl positionsClosed timestamp txHash }
  }`,
  z.object({ Liquidation: z.array(liquidation) }).transform((d) => d.Liquidation),
);

export function liquidationsVars(chainId: number, user: string, since: number): LiquidationVars {
  return { chainId, user: user.toLowerCase(), since };
}

export type Liquidations = ResultOf<typeof LiquidationsDocument>;

// ---------------------------------------------------------------- LP pool days (F24 historical APR)

interface LpDaysVars {
  chainId: number;
  fromDay: number;
}

const lpDay = z.object({ day: z.number().int(), traderFees: bigintish, traderPnl: bigintish });

/** Pool days since `fromDay` (UTC day index): trader fees and trader realised PnL — the pool's side of both. */
export const LpDaysDocument = defineDocument<LpDaysVars>()(
  "LpDays",
  `query LpDays($chainId: Int!, $fromDay: Int!) {
    LpPoolDaily(where: { chainId: { _eq: $chainId }, day: { _gte: $fromDay } }, order_by: { day: asc }) {
      day traderFees traderPnl
    }
  }`,
  z.object({ LpPoolDaily: z.array(lpDay) }).transform((d) => d.LpPoolDaily),
);

export type LpDays = ResultOf<typeof LpDaysDocument>;
