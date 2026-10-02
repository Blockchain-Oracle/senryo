import { defineDocument } from "@senryo/indexer-client";
import { z } from "zod";

/**
 * Keeper candidate queries on the S4 schema (indexer/schema.graphql: `User.openPositions`, `Trigger.status`), built
 * with `@senryo/indexer-client`'s `defineDocument`. Candidates only — every action is re-checked onchain before a send.
 */
interface ScanVars {
  chainId: number;
  limit: number;
  offset: number;
}

/** Accounts with at least one open position (lowercase addresses), paged in a stable order (every one is scanned). */
export const OpenPositionUsersDocument = defineDocument<ScanVars>()(
  "KeeperOpenPositionUsers",
  `query KeeperOpenPositionUsers($chainId: Int!, $limit: Int!, $offset: Int!) {
    User(
      where: { chainId: { _eq: $chainId }, openPositions: { _gt: 0 } }
      order_by: { id: asc }
      limit: $limit
      offset: $offset
    ) {
      id
    }
  }`,
  z.object({ User: z.array(z.object({ id: z.string() })) }).transform((d) => d.User.map((u) => u.id)),
);

/** TP/SL orders still PLACED (id = the onchain orderId; expiry in unix seconds). */
export const PlacedTriggersDocument = defineDocument<ScanVars>()(
  "KeeperPlacedTriggers",
  `query KeeperPlacedTriggers($chainId: Int!, $limit: Int!, $offset: Int!) {
    Trigger(
      where: { chainId: { _eq: $chainId }, status: { _eq: "PLACED" } }
      order_by: { id: asc }
      limit: $limit
      offset: $offset
    ) {
      id expiry placedAt user_id market_id
    }
  }`,
  z
    .object({
      Trigger: z.array(
        z.object({
          id: z.string(),
          expiry: z.number().int(),
          placedAt: z.number().int(),
          user_id: z.string(),
          market_id: z.string(),
        }),
      ),
    })
    .transform((d) => d.Trigger),
);

/**
 * When each open position began (unix seconds). A TP/SL belongs to the position it was placed for: one placed before
 * the current position opened is a leftover of a closed or liquidated one and must not fire (flow book C6).
 */
export const OpenPositionStartsDocument = defineDocument<ScanVars>()(
  "KeeperOpenPositionStarts",
  `query KeeperOpenPositionStarts($chainId: Int!, $limit: Int!, $offset: Int!) {
    Position(
      where: { chainId: { _eq: $chainId }, status: { _eq: "OPEN" } }
      order_by: { id: asc }
      limit: $limit
      offset: $offset
    ) {
      user_id market_id openedAt
    }
  }`,
  z
    .object({
      Position: z.array(z.object({ user_id: z.string(), market_id: z.string(), openedAt: z.number().int() })),
    })
    .transform((d) => d.Position),
);

/**
 * Deployed deposit inboxes holding stablecoins that arrived after their last sweep (`Inbox.pending`, usd6). Inboxes
 * not yet deployed are invisible here; those come from the api's `inbox_watches` (S8.24).
 */
export const PendingInboxesDocument = defineDocument<ScanVars>()(
  "KeeperPendingInboxes",
  `query KeeperPendingInboxes($chainId: Int!, $limit: Int!, $offset: Int!) {
    Inbox(
      where: { chainId: { _eq: $chainId }, pending: { _gt: "0" } }
      order_by: { id: asc }
      limit: $limit
      offset: $offset
    ) {
      id user_id
    }
  }`,
  z
    .object({ Inbox: z.array(z.object({ id: z.string(), user_id: z.string() })) })
    .transform((d) => d.Inbox.map((i) => ({ inbox: i.id, user: i.user_id }))),
);
