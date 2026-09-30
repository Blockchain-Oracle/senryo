/** Public `/stats` (D-022 traction metrics): protocol totals, daily series and the busiest markets. */
import { z } from "zod";
import { defineDocument, type ResultOf } from "../client.ts";
import { PAGE_SIZE, SECONDS_PER_DAY } from "../constants.ts";
import { bigintish, optionalInt, venue } from "../scalars.ts";

interface StatsVars {
  chainId: number;
  sinceDay: number;
  days: number;
}

const totals = z.object({
  users: z.number().int(),
  depositors: z.number().int(),
  traders: z.number().int(),
  deposits: bigintish,
  withdrawals: bigintish,
  volumeOurs: bigintish,
  volumePerplApp: bigintish,
  perplVolumeAll: bigintish,
  builderVolume: bigintish,
  trades: z.number().int(),
  fees: bigintish,
  liquidations: z.number().int(),
  cardHoldsPlaced: z.number().int(),
  cardSpent: bigintish,
  vouchersRedeemed: z.number().int(),
  starterClaims: z.number().int(),
  lpDeposited: bigintish,
  lpRedeemed: bigintish,
  oracleRounds: z.number().int(),
  perplFillsAttributed: z.number().int(),
  unattributedFills: z.number().int(),
  pausedUntil: optionalInt,
  settleOnly: z.boolean(),
  updatedAt: z.number().int(),
});

const day = z.object({
  day: z.number().int(),
  newUsers: z.number().int(),
  activeUsers: z.number().int(),
  deposits: bigintish,
  withdrawals: bigintish,
  volume: bigintish,
  trades: z.number().int(),
  fees: bigintish,
  liquidations: z.number().int(),
  cardSpend: bigintish,
});

const topMarket = z.object({
  id: z.string(),
  venue,
  symbol: z.string(),
  appVolume: bigintish,
  appTradeCount: z.number(),
});

export const ProtocolStatsDocument = defineDocument<StatsVars>()(
  "ProtocolStats",
  `query ProtocolStats($chainId: Int!, $sinceDay: Int!, $days: Int!) {
    ProtocolStats(where: { chainId: { _eq: $chainId } }) {
      users depositors traders deposits withdrawals volumeOurs volumePerplApp perplVolumeAll builderVolume trades fees
      liquidations cardHoldsPlaced cardSpent vouchersRedeemed starterClaims lpDeposited lpRedeemed oracleRounds
      perplFillsAttributed unattributedFills pausedUntil settleOnly updatedAt
    }
    ProtocolDailyStats(where: { chainId: { _eq: $chainId }, day: { _gte: $sinceDay } }, order_by: { day: asc }, limit: $days) {
      day newUsers activeUsers deposits withdrawals volume trades fees liquidations cardSpend
    }
    Market(where: { chainId: { _eq: $chainId }, appTradeCount: { _gt: 0 } }, order_by: { appVolume: desc }, limit: 10) {
      id venue symbol appVolume appTradeCount
    }
  }`,
  z
    .object({ ProtocolStats: z.array(totals).max(1), ProtocolDailyStats: z.array(day), Market: z.array(topMarket) })
    .transform((d) => ({ totals: d.ProtocolStats[0] ?? null, daily: d.ProtocolDailyStats, topMarkets: d.Market })),
);

/** `sinceDay` is a UTC day index (floor(unix / 86400)); defaults to the last PAGE_SIZE.statsDays days. */
export function protocolStatsVars(chainId: number, nowSeconds: number, days: number = PAGE_SIZE.statsDays): StatsVars {
  const today = Math.floor(nowSeconds / SECONDS_PER_DAY);
  return { chainId, sinceDay: today - days + 1, days };
}

export type ProtocolStatsResult = ResultOf<typeof ProtocolStatsDocument>;
