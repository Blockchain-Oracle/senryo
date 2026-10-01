/**
 * History screens: positions, fills, the unified activity feed and the equity curve. Each document takes a Hasura
 * `where` built by the matching `*Vars` helper, which always scopes to one chain and one user.
 */
import { z } from "zod";
import { type ChainWhere, defineDocument, type ResultOf } from "../client.ts";
import { PAGE_SIZE } from "../constants.ts";
import { bigintish, type PositionStatus } from "../scalars.ts";
import { ACTIVITY_FIELDS, activity, FILL_FIELDS, fill, POSITION_FIELDS, position } from "./fragments.ts";
import type { AccountVars } from "./portfolio.ts";

type Where = ChainWhere;

interface PageVars {
  where: Where;
  limit: number;
  offset: number;
}

const scope = ({ chainId, user }: AccountVars): Where => ({
  chainId: { _eq: chainId },
  user_id: { _eq: user.toLowerCase() },
});

// ---------------------------------------------------------------- positions

export const PositionsDocument = defineDocument<PageVars>()(
  "Positions",
  `query Positions($where: Position_bool_exp!, $limit: Int!, $offset: Int!) {
    Position(where: $where, order_by: { updatedAt: desc }, limit: $limit, offset: $offset) { ${POSITION_FIELDS} }
  }`,
  z.object({ Position: z.array(position) }).transform((d) => d.Position),
);

export function positionsVars(
  account: AccountVars,
  opts: { status?: readonly PositionStatus[]; limit?: number; offset?: number } = {},
): PageVars {
  const where: Where = { ...scope(account), ...(opts.status ? { status: { _in: opts.status } } : {}) };
  return { where, limit: opts.limit ?? PAGE_SIZE.positions, offset: opts.offset ?? 0 };
}

// ---------------------------------------------------------------- fills

export const FillsDocument = defineDocument<PageVars>()(
  "Fills",
  `query Fills($where: Fill_bool_exp!, $limit: Int!, $offset: Int!) {
    Fill(where: $where, order_by: [{ timestamp: desc }, { id: desc }], limit: $limit, offset: $offset) { ${FILL_FIELDS} }
  }`,
  z.object({ Fill: z.array(fill) }).transform((d) => d.Fill),
);

export function fillsVars(
  account: AccountVars,
  opts: { marketId?: string; positionId?: string; limit?: number; offset?: number } = {},
): PageVars {
  const where: Where = {
    ...scope(account),
    ...(opts.marketId ? { market_id: { _eq: opts.marketId } } : {}),
    ...(opts.positionId ? { position_id: { _eq: opts.positionId } } : {}),
  };
  return { where, limit: opts.limit ?? PAGE_SIZE.fills, offset: opts.offset ?? 0 };
}

// ---------------------------------------------------------------- activity (keyset: pass the last row as `before`)

interface ActivityVars {
  where: Where;
  limit: number;
}

export const ActivityDocument = defineDocument<ActivityVars>()(
  "Activity",
  `query Activity($where: Activity_bool_exp!, $limit: Int!) {
    Activity(where: $where, order_by: [{ timestamp: desc }, { id: desc }], limit: $limit) { ${ACTIVITY_FIELDS} }
  }`,
  z.object({ Activity: z.array(activity) }).transform((d) => d.Activity),
);

/**
 * Next page = rows strictly after `before` in (timestamp desc, id desc) order — no gaps or repeats within a block.
 * `after` keeps only rows strictly later than that unix second (a window's money movements).
 */
export function activityVars(
  account: AccountVars,
  opts: {
    before?: { timestamp: number; id: string };
    after?: number;
    kinds?: readonly string[];
    /** One market's rows only (`ours-0`), for a market's history. */
    marketId?: string;
    limit?: number;
  } = {},
): ActivityVars {
  const b = opts.before;
  const where: Where = {
    ...scope(account),
    ...(b
      ? { _or: [{ timestamp: { _lt: b.timestamp } }, { timestamp: { _eq: b.timestamp }, id: { _lt: b.id } }] }
      : {}),
    ...(opts.after !== undefined ? { timestamp: { _gt: opts.after } } : {}),
    ...(opts.kinds ? { kind: { _in: opts.kinds } } : {}),
    ...(opts.marketId ? { market_id: { _eq: opts.marketId } } : {}),
  };
  return { where, limit: opts.limit ?? PAGE_SIZE.activity };
}

// ---------------------------------------------------------------- equity curve (one point per account mutation)

interface EquityVars {
  where: Where;
  limit: number;
}

const equityPoint = z.object({
  timestamp: z.number().int(),
  block: z.number().int(),
  equityInit: bigintish,
  freeToTrade: bigintish,
  freeToSpend: bigintish,
});

export const EquityDocument = defineDocument<EquityVars>()(
  "Equity",
  `query Equity($where: RiskSnapshot_bool_exp!, $limit: Int!) {
    RiskSnapshot(where: $where, order_by: [{ timestamp: desc }, { id: desc }], limit: $limit) {
      timestamp block equityInit freeToTrade freeToSpend
    }
  }`,
  z.object({ RiskSnapshot: z.array(equityPoint) }).transform((d) => [...d.RiskSnapshot].reverse()),
);

/** Oldest → newest points since `since` (unix seconds). */
export function equityVars(account: AccountVars, opts: { since?: number; limit?: number } = {}): EquityVars {
  const where: Where = { ...scope(account), ...(opts.since !== undefined ? { timestamp: { _gte: opts.since } } : {}) };
  return { where, limit: opts.limit ?? PAGE_SIZE.equity };
}

export type Positions = ResultOf<typeof PositionsDocument>;
export type Fills = ResultOf<typeof FillsDocument>;
export type ActivityPage = ResultOf<typeof ActivityDocument>;
export type EquityCurve = ResultOf<typeof EquityDocument>;
