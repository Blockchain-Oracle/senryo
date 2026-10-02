import { z } from "zod";

/**
 * The parts of Lithic payloads we use, from the official Node SDK types (`CardAuthorization` =
 * `card_authorization.approval_request`, `Transaction.Event`; lithic-node main, read 30 Sep). Unknown fields pass
 * through untouched. Amounts are integers in the currency's smallest unit (cents).
 */

const amount = z.object({ amount: z.int(), currency: z.string() });

export const asaRequestSchema = z.looseObject({
  /** Provisional transaction group token (stable across the lifecycle). */
  token: z.string().min(1),
  status: z.enum([
    "AUTHORIZATION",
    "CREDIT_AUTHORIZATION",
    "FINANCIAL_AUTHORIZATION",
    "FINANCIAL_CREDIT_AUTHORIZATION",
    "BALANCE_INQUIRY",
  ]),
  amounts: z.object({
    cardholder: amount.extend({ conversion_rate: z.string().optional() }),
    hold: amount.nullable(),
    merchant: amount,
    settlement: amount.nullable().optional(),
  }),
  card: z.looseObject({ token: z.string().min(1) }),
  merchant: z.looseObject({ mcc: z.string().optional(), descriptor: z.string().optional() }),
  event_token: z.string().optional(),
  created: z.string().optional(),
});

export type AsaRequest = z.infer<typeof asaRequestSchema>;

/** ASA response: `result` is the only required field (docs.lithic.com auth-stream-access-asa). */
export const ASA_RESULTS = [
  "APPROVED",
  "INSUFFICIENT_FUNDS",
  "VELOCITY_EXCEEDED",
  "CARD_PAUSED",
  "UNAUTHORIZED_MERCHANT",
  "SUSPECTED_FRAUD",
] as const;
export type AsaResult = (typeof ASA_RESULTS)[number];

export interface AsaResponse {
  result: AsaResult;
  /** Balance inquiry only (cents): settled and available (settled minus pending). */
  balance?: { amount: number; available: number };
}

export const transactionEventSchema = z.looseObject({
  token: z.string().min(1),
  type: z.string(),
  amounts: z.looseObject({ cardholder: amount, settlement: amount.nullable().optional() }).optional(),
  amount: z.int().optional(),
  result: z.string().optional(),
  created: z.string().optional(),
});

/** Events API envelope for `card_transaction.updated` (the Transaction object + `event_type`). */
export const cardTransactionWebhookSchema = z.looseObject({
  event_type: z.string(),
  token: z.string().min(1),
  card_token: z.string().optional(),
  merchant: z.looseObject({ descriptor: z.string().optional() }).optional(),
  events: z.array(transactionEventSchema).default([]),
});

export type CardTransactionWebhook = z.infer<typeof cardTransactionWebhookSchema>;
export type TransactionEvent = z.infer<typeof transactionEventSchema>;
