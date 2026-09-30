import { defineDocument } from "@senryo/indexer-client";
import { z } from "zod";

/**
 * Keeper candidate queries on the S4 schema (indexer/schema.graphql: `User.openPositions`, `Trigger.status`), built
 * with `@senryo/indexer-client`'s `defineDocument`. Candidates only — every action is re-checked onchain before a send.
 */
interface ScanVars {
  chainId: number;
  limit: number;
}

/** Accounts with at least one open position (lowercase addresses), most recently active first. */
export const OpenPositionUsersDocument = defineDocument<ScanVars>()(
  "KeeperOpenPositionUsers",
  `query KeeperOpenPositionUsers($chainId: Int!, $limit: Int!) {
    User(where: { chainId: { _eq: $chainId }, openPositions: { _gt: 0 } }, order_by: { lastActiveAt: desc }, limit: $limit) {
      id
    }
  }`,
  z.object({ User: z.array(z.object({ id: z.string() })) }).transform((d) => d.User.map((u) => u.id)),
);

/** TP/SL orders still PLACED (id = the onchain orderId; expiry in unix seconds). */
export const PlacedTriggersDocument = defineDocument<ScanVars>()(
  "KeeperPlacedTriggers",
  `query KeeperPlacedTriggers($chainId: Int!, $limit: Int!) {
    Trigger(where: { chainId: { _eq: $chainId }, status: { _eq: "PLACED" } }, order_by: { placedAt: asc }, limit: $limit) {
      id expiry
    }
  }`,
  z.object({ Trigger: z.array(z.object({ id: z.string(), expiry: z.number().int() })) }).transform((d) => d.Trigger),
);
