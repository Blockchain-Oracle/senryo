/** Shared selections and their schemas (one field list per entity, so documents never drift from their parsers). */
import { z } from "zod";
import {
  activityKind,
  bigintish,
  fillKind,
  optionalBigint,
  optionalInt,
  optionalString,
  positionStatus,
  side,
  venue,
} from "../scalars.ts";

export const MARKET_REF_FIELDS = "id symbol venue";
export const marketRef = z.object({ id: z.string(), symbol: z.string(), venue });

export const POSITION_FIELDS = `id venue side status size entryPrice margin realizedPnl feesPaid fundingPaid borrowPaid
  openedAt openedBlock updatedAt closedAt market { ${MARKET_REF_FIELDS} }`;
export const position = z.object({
  id: z.string(),
  venue,
  side,
  status: positionStatus,
  size: bigintish,
  entryPrice: bigintish,
  margin: bigintish,
  realizedPnl: bigintish,
  feesPaid: bigintish,
  fundingPaid: bigintish,
  borrowPaid: bigintish,
  openedAt: z.number().int(),
  openedBlock: z.number().int(),
  updatedAt: z.number().int(),
  closedAt: optionalInt,
  market: marketRef,
});
export type IndexedPosition = z.infer<typeof position>;

export const FILL_FIELDS = `id venue kind side size price oraclePrice notional fee realizedPnl funding borrow isMaker
  timestamp block txHash position_id market { ${MARKET_REF_FIELDS} }`;
export const fill = z.object({
  id: z.string(),
  venue,
  kind: fillKind,
  side,
  size: bigintish,
  price: optionalBigint,
  oraclePrice: optionalBigint,
  notional: bigintish,
  fee: bigintish,
  realizedPnl: bigintish,
  funding: bigintish,
  borrow: bigintish,
  isMaker: z.boolean().nullable(),
  timestamp: z.number().int(),
  block: z.number().int(),
  txHash: z.string(),
  position_id: z.string(),
  market: marketRef,
});
export type IndexedFill = z.infer<typeof fill>;

export const ACTIVITY_FIELDS = `id kind timestamp block txHash amount symbol
  market { ${MARKET_REF_FIELDS} }
  fill { kind side size price realizedPnl fee }
  move { kind token symbol amount counterparty source }
  hold { id status amount captured released }
  trigger { id takeProfit triggerPrice size status }
  liquidation { id venue penalty realizedPnl shortfall }`;
export const activity = z.object({
  id: z.string(),
  kind: activityKind,
  timestamp: z.number().int(),
  block: z.number().int(),
  txHash: z.string(),
  amount: optionalBigint,
  symbol: optionalString,
  market: marketRef.nullable(),
  fill: z
    .object({
      kind: fillKind,
      side,
      size: bigintish,
      price: optionalBigint,
      realizedPnl: bigintish,
      fee: bigintish,
    })
    .nullable(),
  move: z
    .object({
      kind: z.string(),
      token: optionalString,
      symbol: optionalString,
      amount: bigintish,
      counterparty: optionalString,
      source: optionalString,
    })
    .nullable(),
  hold: z
    .object({ id: z.string(), status: z.string(), amount: bigintish, captured: bigintish, released: bigintish })
    .nullable(),
  trigger: z
    .object({
      id: z.string(),
      takeProfit: z.boolean(),
      triggerPrice: bigintish,
      size: bigintish,
      status: z.string(),
    })
    .nullable(),
  liquidation: z
    .object({
      id: z.string(),
      venue,
      penalty: bigintish,
      realizedPnl: bigintish,
      shortfall: bigintish,
    })
    .nullable(),
});
export type IndexedActivity = z.infer<typeof activity>;

export const META_FIELDS = "chainId progressBlock sourceBlock isReady";
export const meta = z.object({
  chainId: z.number().int(),
  progressBlock: z.number().int(),
  sourceBlock: z.number().int(),
  isReady: z.boolean(),
});
export type IndexerMeta = z.infer<typeof meta>;
