/**
 * `POST /v1/inbox/watch` (S8.24, D-179): the app registers the deposit inbox it is showing, so the keeper's `sweeps`
 * job credits a first deposit to an inbox that isn't deployed yet (the indexer only sees deployed inboxes). Public:
 * a watch costs one row and balance reads, never gas — the keeper only sends once ≥ INBOX_SWEEP_MIN_USD6 has landed,
 * and a sweep can only ever credit `user`. Re-registering extends the window; mainnet keeps the trading geo gate.
 */
import { inboxWatchRoute } from "@senryo/api-client";
import { readContract } from "@senryo/chain";
import { type HttpServer, parseRoute, sendRoute, watchInbox } from "@senryo/service-common";
import { type ApiContext, chainOf } from "../context.ts";
import { checkGeo } from "./starter.ts";

const WATCH_RATE = { max: 10, timeWindow: "1 minute" } as const;

export function registerInboxRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(inboxWatchRoute.path, { config: { rateLimit: WATCH_RATE } }, async (request, reply) => {
    const { body } = parseRoute(inboxWatchRoute, request);
    const chain = chainOf(ctx, body.chainId);
    checkGeo(ctx, body.chainId, request);
    const inbox = await readContract(body.chainId, "InboxFactory", chain.read).read.inboxOf([body.user]);
    const expiresAt = await watchInbox(ctx.db, body.chainId, body.user, inbox);
    return sendRoute(reply, inboxWatchRoute, { inbox, expiresAt: expiresAt.toISOString() });
  });
}
