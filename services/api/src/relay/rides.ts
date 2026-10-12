import {
  ACTION_CLOSE,
  ACTION_OPEN,
  type Address,
  addressOf,
  commitRideCallData,
  type Hex,
  type PermitArgs,
  type RideIntent,
  rideChanges,
  rideIntentDigest,
  sendTx,
} from "@senryo/chain";
import {
  type ChainId,
  feedIdOf,
  type MarketSpec,
  RIDE_MARKETS,
  RIDE_MIN_LEVERAGE_BPS,
  RIDE_TERMS,
  rideMarketSpec,
} from "@senryo/config";
import { applyRideChanges, type Db, HTTP_STATUS, HttpError, jsonb, type Logger, nowSec } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { retryWhileEarly } from "./chain-clock.ts";
import { bad, checkDeadline, ZERO_ADDRESS } from "./gates.ts";
import type { IntentStatus, MarketRelay } from "./relay.ts";

/**
 * Rides through the relay (R4.4, D-299, D-301): a signed open or close, gated like a call (the market rides on this
 * network, the margin and leverage are inside its terms, the deadline is near, the price is live), queued by its
 * EIP-712 digest in `market_intents` (book `ride`), committed on the owner's lane and handed to the fill batcher for
 * the next print. The chain re-checks everything; the gates only spare a doomed transaction its gas.
 */
export interface RideRequest {
  chainId: ChainId;
  intent: RideIntent;
  signature: Hex;
  permit: PermitArgs | null;
}

export function checkRide(req: RideRequest, now: number): { digest: Hex; market: MarketSpec } {
  const { intent } = req;
  const terms = RIDE_TERMS[req.chainId];
  const symbol = RIDE_MARKETS[intent.marketId];
  const market = rideMarketSpec(intent.marketId);
  if (!symbol || !market) throw bad(`ride market ${intent.marketId} does not exist`);
  checkDeadline(intent.deadline, now);
  if (intent.recipient === ZERO_ADDRESS) throw bad("recipient is required");
  if (intent.worstPriceE8 <= 0n) throw bad("a ride names the worst price it accepts");
  if (intent.action === ACTION_OPEN) {
    if (intent.rideId !== 0n || intent.size !== 0n) throw bad("an open names no ride and no size");
    if (intent.margin < terms.minMargin || intent.margin > terms.maxMargin) throw bad("margin outside the ride terms");
    const maxLeverage = terms.markets[symbol].maxLeverageBps;
    if (intent.leverageBps < RIDE_MIN_LEVERAGE_BPS || intent.leverageBps > maxLeverage) {
      throw bad(`leverage on ${symbol} is 1× to ${maxLeverage / RIDE_MIN_LEVERAGE_BPS}×`);
    }
  } else if (intent.action === ACTION_CLOSE) {
    if (intent.rideId === 0n) throw bad("a close names its ride");
  } else {
    throw bad("unknown action");
  }
  if (req.permit && Number(req.permit.deadline) <= now) throw bad("permit expired");
  return { digest: rideIntentDigest(req.chainId, intent), market };
}

export class RideRelay {
  constructor(
    private readonly d: {
      chainId: ChainId;
      relay: MarketRelay;
      gateway: PythGateway;
      db: Db;
      log: Logger;
    },
  ) {}

  async submit(req: RideRequest): Promise<IntentStatus> {
    const checked = checkRide(req, nowSec());
    const paused = this.d.gateway.pausedReason(checked.market);
    if (paused) throw new HttpError(HTTP_STATUS.conflict, "MARKET_PAUSED", paused);
    // A halt (D-289) stops new rides, never a close.
    if (req.intent.action === ACTION_OPEN && this.d.gateway.feedState(feedIdOf(checked.market)) === "halted") {
      throw new HttpError(
        HTTP_STATUS.conflict,
        "MARKET_HALTED",
        `${checked.market.symbol} is halted while its price steadies. Rides reopen on their own.`,
      );
    }
    const owner = req.intent.owner.toLowerCase();
    const kind = req.intent.action === ACTION_OPEN ? "open" : "close";
    const inserted = await this.d.db`
      INSERT INTO market_intents (digest, chain_id, owner, kind, book, body, ride_id)
      VALUES (${checked.digest}, ${req.chainId}, ${owner}, ${kind}, 'ride', ${jsonb(this.d.db, req)},
              ${req.intent.action === ACTION_CLOSE ? req.intent.rideId : null})
      ON CONFLICT (digest) DO NOTHING RETURNING digest`;
    if (inserted.length === 0) return (await this.d.relay.status(checked.digest)) as IntentStatus;
    void this.d.relay
      .laneFor(req.intent.owner)
      .run(() => this.commit(req, checked.digest, checked.market))
      .catch((error) => this.d.relay.fail(checked.digest, owner, (error as Error).message));
    return {
      digest: checked.digest,
      state: "received",
      ticketId: null,
      rideId: null,
      txHash: null,
      target: null,
      reason: null,
    };
  }

  private async commit(req: RideRequest, digest: Hex, market: MarketSpec): Promise<void> {
    const owner = req.intent.owner as Address;
    const sender = this.d.relay.laneFor(owner).sender;
    await this.d.relay.setState(digest, owner, { state: "submitted" });
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const sent = await retryWhileEarly(() =>
      sendTx(sender, {
        to: reserve,
        data: commitRideCallData(req.intent, req.signature, req.permit),
        action: "rideCommit",
        meta: { digest },
      }),
    );
    if (sent.stage === "reverted") throw new Error(`ride commit reverted in ${sent.hash}`);
    const changes = rideChanges(sent.receipt.logs, reserve);
    await applyRideChanges(this.d.db, this.d.chainId, changes, sent.hash);
    const pending = changes.find((c) => c.kind === "rideCommitted" || c.kind === "rideClosing");
    if (!pending || (pending.kind !== "rideCommitted" && pending.kind !== "rideClosing")) {
      throw new Error("the ride commit landed without a ride event");
    }
    await this.d.relay.setState(digest, owner, {
      state: "committed",
      rideId: pending.rideId,
      txHash: sent.hash,
      target: pending.target,
    });
    this.d.log.info(
      { actor: "relay", why: "ride commit", rideId: pending.rideId.toString(), target: pending.target, tx: sent.hash },
      "ride committed",
    );
    this.d.relay.fills.addRide(feedIdOf(market), pending.target, { rideId: pending.rideId, owner });
  }
}
