import { authNonceRoute, authVerifyRoute, SIWE_CHALLENGE_TTL_SECONDS, SIWE_STATEMENT } from "@senryo/api-client";
import { buildSiweMessage, getAddress, newSiweNonce, verifySiweSignature } from "@senryo/chain";
import { isChainId } from "@senryo/config";
import { HTTP_STATUS, HttpError, type HttpServer, MS_PER_SECOND, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";

const NONCE_RATE = { max: 20, timeWindow: "1 minute" } as const;

/** SIWE → session token (D-111). The nonce is single-use and expires with the message. */
export function registerAuthRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(authNonceRoute.path, { config: { rateLimit: NONCE_RATE } }, async (request, reply) => {
    const { body } = parseRoute(authNonceRoute, request);
    const nonce = newSiweNonce();
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + SIWE_CHALLENGE_TTL_SECONDS * MS_PER_SECOND);
    const message = buildSiweMessage({
      address: getAddress(body.address),
      chainId: body.chainId,
      domain: ctx.env.SIWE_DOMAIN,
      uri: ctx.env.SIWE_URI,
      statement: SIWE_STATEMENT,
      nonce,
      issuedAt,
      expirationTime,
    });
    await ctx.db`INSERT INTO siwe_nonces (nonce, address, chain_id, expires_at)
                 VALUES (${nonce}, ${body.address.toLowerCase()}, ${body.chainId}, ${expirationTime})`;
    return sendRoute(reply, authNonceRoute, { nonce, message, expiresAt: expirationTime.toISOString() });
  });

  app.post(authVerifyRoute.path, { config: { rateLimit: NONCE_RATE } }, async (request, reply) => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    const { body } = parseRoute(authVerifyRoute, request);
    const verified = await verifySiweSignature({
      message: body.message,
      signature: body.signature,
      domain: ctx.env.SIWE_DOMAIN,
      statement: SIWE_STATEMENT,
    });
    if (!verified || !isChainId(verified.chainId)) {
      throw new HttpError(HTTP_STATUS.unauthorized, "SIGNATURE_INVALID", "SIWE message or signature rejected");
    }
    // Single use: the nonce must exist for this address, be unexpired and unused — consumed atomically.
    const used = await ctx.db`
      UPDATE siwe_nonces SET used_at = now()
       WHERE nonce = ${verified.nonce} AND address = ${verified.address.toLowerCase()} AND used_at IS NULL
         AND expires_at > now()
      RETURNING nonce`;
    if (used.length === 0)
      throw new HttpError(HTTP_STATUS.unauthorized, "SIGNATURE_EXPIRED", "nonce unknown, used or expired");
    const session = await ctx.sessions.issue(verified.address, verified.chainId);
    return sendRoute(reply, authVerifyRoute, {
      token: session.token,
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt.toISOString(),
    });
  });
}
