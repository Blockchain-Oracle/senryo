import { type Address, describeError, getAddress, readAccountSnapshot } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { HTTP_STATUS, HttpError, type Session } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { LITHIC_SANDBOX_HOST, MS_PER_SECOND_N } from "../constants.ts";
import type { CardContext } from "../context.ts";
import { type LithicApi, LithicError } from "../lithic/api.ts";

/** Shared pieces of the app-facing card routes (session = the api's SIWE token; D-111). */

export type CardState = "ACTIVE" | "PAUSED" | "CLOSED";

export interface CardRow {
  card_token: string;
  account: string;
  state: CardState;
  label: string | null;
  last4: string | null;
  created_at: Date;
}

export interface AppKit {
  session(request: FastifyRequest): Promise<Session>;
  /** The configured issuer, or a named 503 `ISSUER_UNAVAILABLE`. */
  issuer(): LithicApi;
  /** The issuer, refused (403) unless it is the Lithic sandbox — simulate is practice-only (D-042). */
  sandbox(): LithicApi;
  /** The caller's own card on this network, or 404. */
  ownCard(cardToken: string, session: Session): Promise<CardRow>;
}

export function appKit(ctx: CardContext): AppKit {
  const issuer = () => {
    if (!ctx.lithic) throw new HttpError(HTTP_STATUS.unavailable, "ISSUER_UNAVAILABLE", "card issuer not configured");
    return ctx.lithic;
  };
  return {
    async session(request) {
      if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
      const current = await ctx.sessions.require(request);
      if (current.chainId !== ctx.chainId)
        throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "wrong network for this card service");
      return current;
    },
    issuer,
    sandbox() {
      const api = issuer();
      if (!api.isSandbox) throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "simulate is sandbox-only (D-042)");
      return api;
    },
    async ownCard(cardToken, session) {
      const [card] = await ctx.db<CardRow[]>`
        SELECT card_token, account, state, label, last4, created_at FROM cards
         WHERE card_token = ${cardToken} AND chain_id = ${ctx.chainId}`;
      if (!card || card.account !== session.address.toLowerCase())
        throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such card");
      return card;
    },
  };
}

/** Whether the configured (or default) issuer base is the Lithic sandbox, with or without a key. */
export function sandboxBase(ctx: CardContext): boolean {
  return ctx.lithic?.isSandbox ?? new URL(ctx.env.LITHIC_API_BASE).host === LITHIC_SANDBOX_HOST;
}

/** An issuer call; any failure is a named 502 `ISSUER_UNAVAILABLE` (429 carries a retry hint), never a bare 500. */
export async function viaIssuer<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const lithic = error instanceof LithicError ? error : undefined;
    const retryAfterSec = lithic?.status === HTTP_STATUS.tooMany ? 1 : undefined;
    throw new HttpError(
      HTTP_STATUS.badGateway,
      "ISSUER_UNAVAILABLE",
      `card issuer error: ${describeError(error)}`,
      retryAfterSec,
      lithic ? { issuerStatus: lithic.status, debuggingRequestId: lithic.detail.debugging_request_id } : undefined,
    );
  }
}

export interface ChainView {
  debtUsd6: bigint;
  /** Trading-account token balance (AUSD + USDC): what `repayCardDebt` charges. */
  balanceUsd6: bigint;
  /** The onchain daily limit is off (revoked by a freeze) or expired → the card can't spend until it is signed. */
  allowanceRequired: boolean;
  positions: number;
}

/** The account's card-relevant onchain state at `latest` (display and quotes; decisions read `finalized`). */
export async function readChainView(ctx: CardContext, account: Address | string): Promise<ChainView | null> {
  try {
    const snap = await readAccountSnapshot(ctx.read, ctx.chainId, getAddress(account), "latest");
    const nowSec = BigInt(Date.now()) / MS_PER_SECOND_N;
    return {
      debtUsd6: snap.cardDebt,
      balanceUsd6: snap.ausd + snap.usdc,
      allowanceRequired: snap.allowanceDailyLimit === 0n || snap.allowanceExpiry <= nowSec,
      positions: positionCount(snap.positionBitmap),
    };
  } catch (error) {
    ctx.log.warn({ err: describeError(error) }, "card chain view unavailable");
    return null;
  }
}
