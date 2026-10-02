import { cardFreezeRoute, cardIssueRoute, cardUnfreezeRoute } from "@senryo/api-client";
import { describeError } from "@senryo/chain";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { CARD_MEMO_ADDRESS_CHARS, CARD_MEMO_PREFIX } from "../constants.ts";
import type { CardContext } from "../context.ts";
import type { LithicApi, LithicCard } from "../lithic/api.ts";
import { type AppKit, type CardRow, type CardState, readChainView, viaIssuer } from "./kit.ts";
import { buildSummary } from "./summary.ts";

const LAST4 = /^\d{4}$/;

/** Lithic card state → `cards.state` (a VIRTUAL card is created OPEN; anything not open can't spend). */
function stateOf(card: LithicCard): CardState {
  if (card.state === "OPEN") return "ACTIVE";
  return card.state === "CLOSED" ? "CLOSED" : "PAUSED";
}

/**
 * One live card per account per network (E1). Idempotent: an advisory lock serialises issuance for the account and
 * the live card, if any, is returned as is; the partial unique index `cards_one_live_idx` backs it up. The issuer has
 * no idempotency key, so a card created but not stored (the write failed) is closed again, and its token logged.
 */
async function issueCard(
  ctx: CardContext,
  api: LithicApi,
  account: string,
  label: string | undefined,
): Promise<{ cardToken: string; created: boolean }> {
  const made: { card?: LithicCard } = {};
  try {
    return await ctx.db.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`card-issue:${ctx.chainId}:${account}`}, 0))`;
      const [live] = await tx<{ card_token: string }[]>`
        SELECT card_token FROM cards WHERE chain_id = ${ctx.chainId} AND account = ${account} AND state <> 'CLOSED'`;
      if (live) return { cardToken: live.card_token, created: false };
      const card = await viaIssuer(() =>
        api.createCard({
          memo: `${CARD_MEMO_PREFIX}${account.slice(0, CARD_MEMO_ADDRESS_CHARS)}`,
          cardProgramToken: ctx.env.LITHIC_CARD_PROGRAM_TOKEN,
        }),
      );
      made.card = card;
      const last4 = card.last_four && LAST4.test(card.last_four) ? card.last_four : null;
      await tx`
        INSERT INTO cards (card_token, issuer, chain_id, account, state, label, last4)
        VALUES (${card.token}, ${ctx.env.CARD_ISSUER_LABEL}, ${ctx.chainId}, ${account}, ${stateOf(card)},
                ${label ?? null}, ${last4})`;
      ctx.log.info({ card: card.token, account, chainId: ctx.chainId }, "card issued");
      return { cardToken: card.token, created: true };
    });
  } catch (error) {
    const orphan = made.card?.token;
    if (orphan) {
      ctx.log.error({ card: orphan, account, err: describeError(error) }, "issued card not stored — closing it");
      await api
        .setState(orphan, "CLOSED")
        .catch((closeError: unknown) =>
          ctx.log.error({ card: orphan, err: describeError(closeError) }, "orphan card could not be closed"),
        );
    }
    throw error;
  }
}

function requireOpenable(card: CardRow): void {
  if (card.state === "CLOSED") throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "card is closed");
}

export function registerIssueRoutes(app: HttpServer, ctx: CardContext, kit: AppKit): void {
  app.post(
    cardIssueRoute.path,
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const s = await kit.session(request);
      const { body } = parseRoute(cardIssueRoute, request);
      const api = kit.issuer();
      const issued = await issueCard(ctx, api, s.address.toLowerCase(), body.label);
      const { summary, chain } = await buildSummary(ctx, s.address);
      return sendRoute(reply, cardIssueRoute, {
        ...summary,
        cardToken: issued.cardToken,
        created: issued.created,
        allowanceRequired: chain?.allowanceRequired ?? null,
      });
    },
  );

  /**
   * Freeze (D-039): our responder declines first (the row flips before the issuer call, so a failed issuer call still
   * leaves the card declining here); the onchain allowance revoke is the app's own `revokeSpendAllowance`.
   * `frozen: false` is kept for older clients — `/v1/card/unfreeze` is the mirror.
   */
  app.post(cardFreezeRoute.path, async (request, reply) => {
    const s = await kit.session(request);
    const { body } = parseRoute(cardFreezeRoute, request);
    const card = await kit.ownCard(body.cardToken, s);
    requireOpenable(card);
    const api = kit.issuer();
    if (body.frozen)
      await ctx.db`UPDATE cards SET state = 'PAUSED', updated_at = now() WHERE card_token = ${card.card_token}`;
    const updated = await viaIssuer(() => api.setState(card.card_token, body.frozen ? "PAUSED" : "OPEN"));
    if (!body.frozen)
      await ctx.db`UPDATE cards SET state = 'ACTIVE', updated_at = now()
                    WHERE card_token = ${card.card_token} AND state <> 'CLOSED'`;
    return sendRoute(reply, cardFreezeRoute, { cardToken: card.card_token, state: updated.state });
  });

  /**
   * Unfreeze (E3): the issuer opens the card first, then our responder. The card spends again only once the onchain
   * daily limit is live — `allowanceRequired` tells the app to sign a new `SpendAllowance` (a freeze revoked it).
   */
  app.post(cardUnfreezeRoute.path, async (request, reply) => {
    const s = await kit.session(request);
    const { body } = parseRoute(cardUnfreezeRoute, request);
    const card = await kit.ownCard(body.cardToken, s);
    requireOpenable(card);
    const api = kit.issuer();
    await viaIssuer(() => api.setState(card.card_token, "OPEN"));
    await ctx.db`UPDATE cards SET state = 'ACTIVE', updated_at = now()
                  WHERE card_token = ${card.card_token} AND state <> 'CLOSED'`;
    const chain = await readChainView(ctx, s.address);
    return sendRoute(reply, cardUnfreezeRoute, {
      cardToken: card.card_token,
      state: "ACTIVE",
      allowanceRequired: chain?.allowanceRequired ?? null,
    });
  });
}
