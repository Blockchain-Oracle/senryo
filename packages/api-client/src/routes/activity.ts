import { z } from "zod";
import { addressSchema, chainIdSchema, txHashSchema, uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * `GET /v1/activity/wallet` (B12, D8): money that moved in or out of an address's wallet — tokens and MON received from
 * anyone, sent to anyone, and swaps made anywhere — one item per transaction, newest first, from the api's HyperSync
 * scan (the one holdings use). Amounts are netted per token inside a transaction; one or more tokens out and one or
 * more in is a `swap`, only in is `received`, only out is `sent`. Verified = on Monad's token list by address (never by
 * symbol), as in holdings. Public, rate-limited per IP; `before` is the previous page's `next`.
 *
 * Practice (10143) works the same, except that MON paid by an internal call (a contract paying out) isn't seen there:
 * HyperSync has no traces for 10143. `scan.complete = false` means older (or the newest) movements may still appear.
 */

export const WALLET_ACTIVITY_PAGE = 25;
export const WALLET_ACTIVITY_PAGE_MAX = 50;
/** A transaction's place: `<block>:<index in block>`. */
const CURSOR_RE = /^\d{1,20}:\d{1,9}$/;

export const walletActivityQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  address: addressSchema,
  before: z.string().regex(CURSOR_RE, "expected <block>:<index>").optional(),
  limit: z.coerce.number().int().min(1).max(WALLET_ACTIVITY_PAGE_MAX).default(WALLET_ACTIVITY_PAGE),
});

export const WALLET_ACTIVITY_KINDS = ["received", "sent", "swap"] as const;

export const walletTokenSchema = z.object({
  /** `0x000…000` for native MON. */
  address: addressSchema,
  native: z.boolean(),
  symbol: z.string(),
  decimals: z.int().nonnegative(),
  verified: z.boolean(),
  /** Unverified, with the symbol of a verified token (a fake "USDC"). */
  lookalike: z.boolean(),
  /** `@senryo/identity` entity id, as in holdings (`token:143:0x…`, `native:143:MON`). */
  mark: z.string(),
  /** Token-list logo for verified tokens, else null (the client draws a monogram). */
  logoUrl: z.url().nullable(),
});

export const walletLegSchema = z.object({
  direction: z.enum(["in", "out"]),
  token: walletTokenSchema,
  /** Net raw base units moved in this direction (> 0). */
  amount: uintCodec,
  /** The other side when there is exactly one (a person, an exchange, a router); null for a mint/burn or several. */
  counterparty: addressSchema.nullable(),
});

export const walletActivityItemSchema = z.object({
  txHash: txHashSchema,
  blockNumber: uintCodec,
  /** Unix seconds of the block. */
  timestamp: unixSecondsSchema,
  kind: z.enum(WALLET_ACTIVITY_KINDS),
  /** Outgoing legs first; verified tokens before unverified ones. */
  legs: z.array(walletLegSchema).min(1),
  /** Who sent the transaction (null when the scan didn't see it). */
  sender: addressSchema.nullable(),
  /**
   * Every movement was with a Senryo contract (trading account, pool, starter, intent router, Perpl): the indexer's
   * event or this phone's journal tells that story, so Activity doesn't add a second "Sent" row.
   */
  internal: z.boolean(),
  /**
   * Only unverified tokens, arriving — or "leaving" in a transaction someone else sent, which is how fake tokens poison
   * a history (B14): kept out of Activity's All, never celebrated.
   */
  spam: z.boolean(),
});

export const walletActivitySchema = z.object({
  chainId: chainIdSchema,
  address: addressSchema,
  items: z.array(walletActivityItemSchema),
  /** Pass as `before` for older items; null when this page reached the oldest stored movement. */
  next: z.string().regex(CURSOR_RE).nullable(),
  scan: z.object({
    /** Every block up to the newest final one has been read (logs, transactions and, on mainnet, internal calls). */
    complete: z.boolean(),
    /** Logs and transactions are read below this block (null before the first scan). */
    scannedToBlock: uintCodec.nullable(),
    /** Why the history may be partial (rate-limited, scan still running, no HyperSync token), for logs and the ⓘ. */
    note: z.string().nullable(),
  }),
});

export const walletActivityRoute = defineRoute({
  method: "GET",
  path: "/v1/activity/wallet",
  auth: "none",
  params: undefined,
  query: walletActivityQuerySchema,
  body: undefined,
  response: walletActivitySchema,
});

export type WalletToken = z.output<typeof walletTokenSchema>;
export type WalletLeg = z.output<typeof walletLegSchema>;
export type WalletActivityItem = z.output<typeof walletActivityItemSchema>;
export type WalletActivity = z.output<typeof walletActivitySchema>;
