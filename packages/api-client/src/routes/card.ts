import { z } from "zod";
import {
  addressSchema,
  chainIdSchema,
  hexSchema,
  isoTimeSchema,
  signatureSchema,
  txHashSchema,
  uintCodec,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * services/card routes the apps call (served under `api.<rpId>/v1/card/*`, session = the api's SIWE token).
 * The Lithic webhooks (`/v1/card/lithic/asa`, `/v1/card/lithic/events`) are issuer-signed and not listed here.
 * Routes that need the issuer answer `ISSUER_UNAVAILABLE` (503 not configured · 502 not answering).
 */

const CARD_TOKEN_MAX = 64;
const TXN_TOKEN_MAX = 64;
const DESCRIPTOR_MAX = 25;
const LABEL_MAX = 32;
const EMBED_TTL_MAX_SEC = 300;
/** Custom simulated amounts stay under $10,000 (the contract caps a hold far lower; this only bounds the input). */
const SIMULATE_MAX_CENTS = 1_000_000;

export const cardTokenSchema = z.string().min(1).max(CARD_TOKEN_MAX);
const mccSchema = z.string().regex(/^\d{4}$/, "expected a 4-digit MCC");

/** `cards.state`: ACTIVE (issuer OPEN) · PAUSED (frozen) · CLOSED. */
export const CARD_STATES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export const cardStateSchema = z.enum(CARD_STATES);

/**
 * Why an authorisation was declined — a stable key the app maps to short copy (E4):
 *  over_limit           daily spend limit (onchain allowance) used up / expired, or above the per-payment maximum
 *  not_enough_spendable Free to spend can't cover the hold
 *  frozen               the card is paused (or closed)
 *  prices_paused        a market the account holds is STALE / CIRCUIT / HALTED, or new risk is paused
 *  issuer_error         anything else: the decision couldn't be completed in time, unsupported currency, issuer fault
 */
export const CARD_DECLINE_REASONS = [
  "over_limit",
  "not_enough_spendable",
  "frozen",
  "prices_paused",
  "issuer_error",
] as const;
export const cardDeclineReasonSchema = z.enum(CARD_DECLINE_REASONS);
export type CardDeclineReason = z.infer<typeof cardDeclineReasonSchema>;

/**
 * Practice-mode merchants for "Simulate a payment" (Lithic sandbox; ISO 18245 MCCs, cents). The app picks one; the
 * service turns it into a real sandbox authorisation. 5814/4121 are tip MCCs (the hold carries the tip buffer);
 * `laptop` is above the per-payment hold maximum, so it shows an `over_limit` decline.
 */
export const CARD_SIMULATE_PRESETS = {
  coffee: { descriptor: "KISSA COFFEE", mcc: "5814", amountCents: 480 },
  groceries: { descriptor: "CORNER MARKET", mcc: "5411", amountCents: 3_265 },
  taxi: { descriptor: "CITY TAXI", mcc: "4121", amountCents: 1_840 },
  books: { descriptor: "PAPER CRANE BOOKS", mcc: "5942", amountCents: 2_499 },
  laptop: { descriptor: "ELECTRONICS HUB", mcc: "5732", amountCents: 129_900 },
} as const satisfies Record<string, { descriptor: string; mcc: string; amountCents: number }>;
export type CardSimulatePreset = keyof typeof CARD_SIMULATE_PRESETS;
export const cardSimulatePresetSchema = z.enum(
  Object.keys(CARD_SIMULATE_PRESETS) as [CardSimulatePreset, ...CardSimulatePreset[]],
);

/** D-042: a real sandbox authorisation (Lithic then calls our ASA responder). A preset, or amount + descriptor. */
export const cardSimulateRequestSchema = z
  .object({
    cardToken: cardTokenSchema,
    preset: cardSimulatePresetSchema.optional(),
    /** Overrides the preset's amount (e.g. a custom amount at the preset merchant). */
    amountCents: z.int().positive().max(SIMULATE_MAX_CENTS).optional(),
    descriptor: z.string().min(1).max(DESCRIPTOR_MAX).optional(),
    mcc: mccSchema.optional(),
  })
  .refine((b) => b.preset !== undefined || (b.amountCents !== undefined && b.descriptor !== undefined), {
    message: "send a preset, or amountCents and descriptor",
  });

const AUTH_OUTCOMES = ["APPROVED", "DECLINED", "PENDING"] as const;

export const cardSimulateResponseSchema = z.object({
  /** Lithic transaction token (= the ASA `token`); pass it to `/v1/card/simulate/step`. */
  transactionToken: z.string(),
  /** Our `card_auth` row once the ASA decision is recorded (null when the issuer decided without asking us). */
  authId: z.uuid().nullable(),
  /** PENDING = no decision seen before the response deadline; the summary will show the final one. */
  status: z.enum(AUTH_OUTCOMES),
  declineReason: cardDeclineReasonSchema.nullable(),
  amountCents: z.int(),
  descriptor: z.string(),
  mcc: z.string().nullable(),
});

/** Sandbox lifecycle after a simulated authorisation: clear (capture), void (reversal), expire, return (refund). */
export const CARD_SIMULATE_STEPS = ["clear", "void", "expire", "return"] as const;
export const cardSimulateStepRequestSchema = z.object({
  cardToken: cardTokenSchema,
  transactionToken: z.string().min(1).max(TXN_TOKEN_MAX),
  step: z.enum(CARD_SIMULATE_STEPS),
  /** Defaults to the authorised amount. Clearing above it is an over-capture (may book card debt). */
  amountCents: z.int().positive().max(SIMULATE_MAX_CENTS).optional(),
});
export const cardSimulateStepResponseSchema = z.object({
  /** The transaction the step created or updated (a return is a new transaction). */
  transactionToken: z.string(),
  step: z.enum(CARD_SIMULATE_STEPS),
  debuggingRequestId: z.string().nullable(),
});

export const cardFreezeRequestSchema = z.object({ cardToken: cardTokenSchema, frozen: z.boolean() });
export const cardFreezeResponseSchema = z.object({ cardToken: cardTokenSchema, state: z.string() });

export const cardUnfreezeRequestSchema = z.object({ cardToken: cardTokenSchema });
export const cardUnfreezeResponseSchema = z.object({
  cardToken: cardTokenSchema,
  state: cardStateSchema,
  /**
   * The card is open at the issuer, but it can only spend once the onchain daily limit is live: true when it was
   * revoked (the freeze) or has expired → the app signs a new `SpendAllowance` (POST /v1/card/allowance).
   * null when the chain couldn't be read.
   */
  allowanceRequired: z.boolean().nullable(),
});

export const cardEmbedQuerySchema = z.object({
  cardToken: cardTokenSchema,
  ttlSec: z.coerce.number().int().positive().max(EMBED_TTL_MAX_SEC).optional(),
});
export const cardEmbedResponseSchema = z.object({ url: z.url(), expiresAt: isoTimeSchema });

/** Relay the user-signed EIP-712 `SpendAllowance` (D-032; anyone may relay, the contract verifies). */
export const cardAllowanceRequestSchema = z.object({
  chainId: chainIdSchema,
  user: addressSchema,
  dailyLimitUsd6: uintCodec,
  expiry: uintCodec,
  signature: signatureSchema,
});
export const cardAllowanceResponseSchema = z.object({ txHash: txHashSchema, stage: z.string() });

export const cardAuthSummarySchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  result: z.string().nullable(),
  /** Set when status is DECLINED (a decision that never landed in time reads DECLINED · issuer_error). */
  declineReason: cardDeclineReasonSchema.nullable(),
  amountCents: uintCodec,
  holdUsd6: uintCodec.nullable(),
  mcc: z.string().nullable(),
  merchantDescriptor: z.string().nullable().optional(),
  receivedAt: isoTimeSchema,
});

export const cardSummaryCardSchema = z.object({
  cardToken: cardTokenSchema,
  state: cardStateSchema,
  label: z.string().nullable(),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  sandbox: z.boolean().optional(),
  capabilities: z.object({ reveal: z.boolean(), walletProvisioning: z.boolean() }).optional(),
  issuedAt: isoTimeSchema.optional(),
});

export const CARD_ISSUER_STATUSES = ["ready", "issuer_unavailable"] as const;

export const cardSummaryResponseSchema = z.object({
  account: addressSchema,
  /** The live (non-closed) card first; closed ones after it. */
  cards: z.array(cardSummaryCardSchema),
  issuer: z.object({ name: z.string(), sandbox: z.boolean(), status: z.enum(CARD_ISSUER_STATUSES) }),
  openHoldsUsd6: uintCodec,
  /** SenryoCore `account(user).cardDebt` (latest block); null when the chain couldn't be read. */
  debtUsd6: uintCodec.nullable(),
  recent: z.array(cardAuthSummarySchema),
});

export const cardIssueRequestSchema = z.object({ label: z.string().trim().min(1).max(LABEL_MAX).optional() });
/** The summary after issuance (the app can drop it straight into its summary cache). */
export const cardIssueResponseSchema = cardSummaryResponseSchema.extend({
  cardToken: cardTokenSchema,
  /** false = the account already had a live card on this network (idempotent). */
  created: z.boolean(),
  /** As for unfreeze: the card can't spend until the onchain daily limit is signed. */
  allowanceRequired: z.boolean().nullable(),
});

/** Omit `amountUsd6` to repay the whole debt (capped by the trading-account balance). */
export const cardRepayQuoteRequestSchema = z.object({ amountUsd6: uintCodec.optional() });
export const cardRepayQuoteResponseSchema = z.object({
  account: addressSchema,
  chainId: chainIdSchema,
  debtUsd6: uintCodec,
  /** Trading-account balance (AUSD + USDC) the contract repays from. */
  balanceUsd6: uintCodec,
  repayUsd6: uintCodec,
  remainingDebtUsd6: uintCodec,
  /** The call the app signs and sends from the account itself (the service never moves user funds). */
  tx: z.object({
    to: addressSchema,
    data: hexSchema,
    value: uintCodec,
    /** Gas budget (`positionGasLimit("repayCardDebt", positions)`); the sender estimates under it. */
    gasCap: uintCodec,
    functionName: z.literal("repayCardDebt"),
  }),
  quotedAt: isoTimeSchema,
});

export const cardSimulateRoute = defineRoute({
  method: "POST",
  path: "/v1/card/simulate",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardSimulateRequestSchema,
  response: cardSimulateResponseSchema,
});

export const cardSimulateStepRoute = defineRoute({
  method: "POST",
  path: "/v1/card/simulate/step",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardSimulateStepRequestSchema,
  response: cardSimulateStepResponseSchema,
});

export const cardIssueRoute = defineRoute({
  method: "POST",
  path: "/v1/card/issue",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardIssueRequestSchema,
  response: cardIssueResponseSchema,
});

export const cardFreezeRoute = defineRoute({
  method: "POST",
  path: "/v1/card/freeze",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardFreezeRequestSchema,
  response: cardFreezeResponseSchema,
});

export const cardUnfreezeRoute = defineRoute({
  method: "POST",
  path: "/v1/card/unfreeze",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardUnfreezeRequestSchema,
  response: cardUnfreezeResponseSchema,
});

export const cardEmbedRoute = defineRoute({
  method: "GET",
  path: "/v1/card/embed",
  auth: "session",
  params: undefined,
  query: cardEmbedQuerySchema,
  body: undefined,
  response: cardEmbedResponseSchema,
});

export const cardAllowanceRoute = defineRoute({
  method: "POST",
  path: "/v1/card/allowance",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardAllowanceRequestSchema,
  response: cardAllowanceResponseSchema,
});

export const cardSummaryRoute = defineRoute({
  method: "GET",
  path: "/v1/card/summary",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: cardSummaryResponseSchema,
});

export const cardRepayQuoteRoute = defineRoute({
  method: "POST",
  path: "/v1/card/repay-quote",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardRepayQuoteRequestSchema,
  response: cardRepayQuoteResponseSchema,
});

export type CardSummary = z.output<typeof cardSummaryResponseSchema>;
export type CardSummaryCard = z.output<typeof cardSummaryCardSchema>;
export type CardAuthSummary = z.output<typeof cardAuthSummarySchema>;
export type CardSimulateResult = z.output<typeof cardSimulateResponseSchema>;
export type CardRepayQuote = z.output<typeof cardRepayQuoteResponseSchema>;
