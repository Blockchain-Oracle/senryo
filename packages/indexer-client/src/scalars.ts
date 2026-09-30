/**
 * Hasura scalars → app types. Envio stores BigInt as Postgres numeric; Hasura returns it as a string
 * (HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES=true in the compose). Money stays bigint — a JSON number is accepted only
 * when it is a safe integer, so precision can never be lost silently. Enums mirror indexer/schema.graphql.
 */
import { z } from "zod";

const INTEGER = /^-?\d+$/;

export const bigintish = z.union([z.string(), z.number()]).transform((value, ctx) => {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value)) return BigInt(value);
  } else if (INTEGER.test(value)) {
    return BigInt(value);
  }
  ctx.addIssue({ code: "custom", message: `not an integer base-unit value: ${String(value)}` });
  return z.NEVER;
});

export const optionalBigint = bigintish.nullable().transform((value) => value ?? undefined);
export const optionalInt = z
  .number()
  .int()
  .nullable()
  .transform((value) => value ?? undefined);
export const optionalString = z
  .string()
  .nullable()
  .transform((value) => value ?? undefined);

export const venue = z.enum(["OURS", "PERPL"]);
export const side = z.enum(["LONG", "SHORT"]);
export const positionStatus = z.enum(["OPEN", "CLOSED", "LIQUIDATED"]);
export const fillKind = z.enum([
  "OPEN",
  "INCREASE",
  "DECREASE",
  "CLOSE",
  "LIQUIDATE",
  "TRIGGER",
  "INVERT",
  "DELEVERAGE",
]);
export const marketStatus = z.enum(["OPEN", "REOPENING", "CLOSED", "STALE", "CIRCUIT", "HALTED"]);
export const holdStatus = z.enum(["OPEN", "CAPTURED", "RELEASED"]);
export const moveKind = z.enum([
  "DEPOSIT",
  "WITHDRAW",
  "SWAP_IN",
  "SWAP_OUT",
  "INBOX_ARRIVED",
  "PERPL_DEPOSIT",
  "PERPL_WITHDRAW",
]);
export const activityKind = z.enum([
  "TRADE",
  "DEPOSIT",
  "WITHDRAW",
  "SWAP",
  "INBOX_ARRIVED",
  "CARD_HOLD",
  "CARD_HOLD_INCREASED",
  "CARD_CAPTURE",
  "CARD_RELEASE",
  "CARD_REFUND",
  "CARD_DEBT_REPAID",
  "CARD_ALLOWANCE",
  "CARD_ENVELOPE",
  "TRIGGER_PLACED",
  "TRIGGER_CANCELLED",
  "TRIGGER_EXECUTED",
  "LIQUIDATION",
  "LP_DEPOSIT",
  "LP_REDEEM_REQUESTED",
  "LP_REDEEMED",
  "VOUCHER",
  "STARTER",
  "INTENT_EXECUTED",
  "INTENT_SKIPPED",
  "PERPL_DEPOSIT",
  "PERPL_WITHDRAW",
]);

export type Venue = z.infer<typeof venue>;
export type Side = z.infer<typeof side>;
export type PositionStatus = z.infer<typeof positionStatus>;
export type FillKind = z.infer<typeof fillKind>;
export type MarketStatus = z.infer<typeof marketStatus>;
export type ActivityKind = z.infer<typeof activityKind>;
