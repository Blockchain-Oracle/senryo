import { TX_STAGES } from "@senryo/core";
import { z } from "zod";
import { TURNSTILE_TOKEN_MAX_CHARS, VOUCHER_CODE_PATTERN } from "../constants.ts";
import {
  addressSchema,
  chainIdSchema,
  isoTimeSchema,
  signatureSchema,
  txHashSchema,
  uintCodec,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Starter funds relay (D-030, flows.md F05). The user signs EIP-712 typed data with the unlocked Mera session — no gas,
 * no prompt — and the sponsor key submits it to StarterDrip:
 *  - claim   → `claimFor(user, deadline, signature)`       typed data `CLAIM_TYPES` (`@senryo/core`)
 *  - voucher → `redeemVoucher(user, code, deadline, sig)`  typed data `VOUCHER_TYPES`, codeHash = keccak256(utf8(code))
 *  - topup   → `topUp(user, amount)` (RELAYER_ROLE; no onchain signature) authorised off-chain by `TOPUP_TYPES`
 *              (S8.16c): practice after a claim, mainnet only with funded equity; the api clamps the amount
 * Domain: `EIP712_DOMAINS.starterDrip` + `chainId` + `verifyingContract` = StarterDrip from `@senryo/contracts`.
 * `deadline` ≤ now + RELAY_SIGNATURE_MAX_TTL_SECONDS. Practice (10143): mock AUSD + testnet MON; mainnet: gas-only
 * drip, AUSD by voucher. Rate limits per IP /24 and per device (`x-senryo-device`); web also sends a Turnstile token.
 */

const relayCommon = {
  chainId: chainIdSchema,
  user: addressSchema,
  /** uint64 unix seconds exactly as signed (bigint in the app, decimal string on the wire). */
  deadline: uintCodec,
  signature: signatureSchema,
  /** Cloudflare Turnstile (invisible) token — web only; native clients omit it. */
  turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX_CHARS).optional(),
};

export const starterClaimRequestSchema = z.object(relayCommon);

export const starterVoucherRequestSchema = z.object({
  ...relayCommon,
  /**
   * Canonical code text = `input.trim().toUpperCase()` (plain text on the wire). The signed `codeHash` and the
   * `bytes code` sent to `redeemVoucher` are keccak256 / the UTF-8 bytes of exactly this string; vouchers are minted
   * (`addVouchers`) from the same canonical form.
   */
  code: z.string().regex(VOUCHER_CODE_PATTERN, "voucher codes are 6–32 of A–Z, 0–9 and -"),
});

/** Gas top-up request (S8.16c): the app's budget for its next send, signed as `TopUp` with the session. */
export const starterTopUpRequestSchema = z.object({
  chainId: chainIdSchema,
  user: addressSchema,
  /** Wei the next send needs (gas limit × the max fee it will sign); the api clamps what it sends. */
  needWei: uintCodec,
  deadline: uintCodec,
  signature: signatureSchema,
});

export const relayKindSchema = z.enum(["claim", "voucher", "topup"]);

/** A relayed transaction as the server tracks it; poll `starterRelayRoute` until `stage` is terminal. */
export const relayResponseSchema = z.object({
  relayId: z.uuid(),
  kind: relayKindSchema,
  chainId: chainIdSchema,
  user: addressSchema,
  txHash: txHashSchema,
  stage: z.enum(TX_STAGES),
  /** Block the tx landed in (null while only submitted). */
  blockNumber: uintCodec.nullable(),
  /** MON sent to the user (wei) and collateral credited into the core (usd6) — as configured onchain. */
  nativeWei: uintCodec,
  creditUsd6: uintCodec,
  createdAt: isoTimeSchema,
});

export const starterStatusQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  user: addressSchema,
});

export const starterStatusResponseSchema = z.object({
  chainId: chainIdSchema,
  user: addressSchema,
  /** `StarterDrip.claimed(user)` at `finalized`. */
  claimed: z.boolean(),
  /** Practice mode (testnet): the claim also credits mock AUSD. */
  practice: z.boolean(),
  dripWei: uintCodec,
  practiceUsd6: uintCodec,
  voucherUsd6: uintCodec,
  vouchersLeft: z.int().nonnegative(),
  /** Onchain native budget left today (wei). */
  budgetLeftWei: uintCodec,
  /** When this device / network may claim again (rate limit), or null. */
  nextClaimAt: isoTimeSchema.nullable(),
  /** Latest relay for this user on this chain, if any (resume after an app restart). */
  lastRelay: relayResponseSchema.nullable(),
});

export const starterRelayParamsSchema = z.object({ relayId: z.uuid() });

export const starterClaimRoute = defineRoute({
  method: "POST",
  path: "/v1/starter/claim",
  auth: "none",
  params: undefined,
  query: undefined,
  body: starterClaimRequestSchema,
  response: relayResponseSchema,
});

export const starterVoucherRoute = defineRoute({
  method: "POST",
  path: "/v1/starter/voucher",
  auth: "none",
  params: undefined,
  query: undefined,
  body: starterVoucherRequestSchema,
  response: relayResponseSchema,
});

/** 409 NOT_NEEDED when the balance already covers `needWei`; 403 NOT_ELIGIBLE before a claim / without equity. */
export const starterTopUpRoute = defineRoute({
  method: "POST",
  path: "/v1/starter/topup",
  auth: "none",
  params: undefined,
  query: undefined,
  body: starterTopUpRequestSchema,
  response: relayResponseSchema,
});

export const starterStatusRoute = defineRoute({
  method: "GET",
  path: "/v1/starter/status",
  auth: "none",
  params: undefined,
  query: starterStatusQuerySchema,
  body: undefined,
  response: starterStatusResponseSchema,
});

export const starterRelayRoute = defineRoute({
  method: "GET",
  path: "/v1/starter/relays/:relayId",
  auth: "none",
  params: starterRelayParamsSchema,
  query: undefined,
  body: undefined,
  response: relayResponseSchema,
});

export type StarterClaimRequest = z.input<typeof starterClaimRequestSchema>;
export type StarterVoucherRequest = z.input<typeof starterVoucherRequestSchema>;
export type StarterTopUpRequest = z.input<typeof starterTopUpRequestSchema>;
export type RelayResponse = z.output<typeof relayResponseSchema>;
export type StarterStatus = z.output<typeof starterStatusResponseSchema>;
