import {
  type Address,
  addressOf,
  finalizeCallData,
  finalizeRidesCallData,
  type Hex,
  proofOf,
  rideChanges,
  type Signer,
  sendTx,
  ticketChanges,
} from "@senryo/chain";
import { type ChainId, MARKET_BATCH_MAX, marketByFeedId } from "@senryo/config";
import { applyRideChanges, applyTicketChanges, type Db, type Logger, type WindowRef } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import type { SigmaDesk } from "../prices/sigma.ts";
import type { StreamBus } from "../stream/bus.ts";
import { retryWhileEarly, untilChainReaches } from "./chain-clock.ts";
import { RIDE_BATCH_MAX } from "./constants.ts";
import type { Lane } from "./lanes.ts";

/**
 * Fills (D-261, D-278): every pending open or close — a call's or a ride's — waits for the unique print of its instant
 * (commit + 1 s). Pending items of one book, feed and instant share one transaction: a call batch is `finalize`, with
 * the σ mark its instant allows (D-313); a ride batch is `finalizeRides` (a ride enters at the print). It goes out the
 * moment the print streams in (≈ 1 s after the commit), from the gateway's ring — so tap → fill stays near the 3 s
 * budget. The keeper is the backup (archive).
 */
interface PendingCall {
  ticketId: bigint;
  owner: Address;
  window: WindowRef;
}

interface PendingRide {
  rideId: bigint;
  owner: Address;
}

type Batch =
  | { book: "call"; feedId: Hex; target: number; items: Map<bigint, PendingCall> }
  | { book: "ride"; feedId: Hex; target: number; items: Map<bigint, PendingRide> };

export class FillBatcher {
  private readonly batches = new Map<string, Batch>();
  /** Settles a market's bound crossings through a second before a ride close there fills (the bound watcher). */
  private sweepBounds: ((feedId: Hex, until: number) => Promise<void>) | undefined;

  constructor(
    private readonly d: {
      chainId: ChainId;
      lanes: Lane[];
      gateway: PythGateway;
      bus: StreamBus;
      sigma: SigmaDesk;
      markSigner: Signer;
      db: Db;
      log: Logger;
    },
  ) {}

  /** A call's open or close waiting for `target`'s print. */
  add(feedId: Hex, target: number, pending: PendingCall): void {
    const key = `call:${feedId}:${target}`;
    const open = this.batches.get(key);
    if (open?.book === "call") {
      open.items.set(pending.ticketId, pending);
      return;
    }
    this.start(key, { book: "call", feedId, target, items: new Map([[pending.ticketId, pending]]) });
  }

  guardRides(sweep: (feedId: Hex, until: number) => Promise<void>): void {
    this.sweepBounds = sweep;
  }

  /** A ride's open or close (an owner's, or a fired exit's) waiting for `target`'s print. */
  addRide(feedId: Hex, target: number, pending: PendingRide): void {
    const key = `ride:${feedId}:${target}`;
    const open = this.batches.get(key);
    if (open?.book === "ride") {
      open.items.set(pending.rideId, pending);
      return;
    }
    this.start(key, { book: "ride", feedId, target, items: new Map([[pending.rideId, pending]]) });
  }

  private start(key: string, batch: Batch): void {
    this.batches.set(key, batch);
    void this.run(key, batch).catch((error) =>
      this.d.log.warn(
        { err: (error as Error).message, book: batch.book, target: batch.target },
        "fill batch failed; the keeper will retry",
      ),
    );
  }

  private async run(key: string, batch: Batch): Promise<void> {
    const asked = Date.now();
    const print = await this.d.gateway.printAt(batch.feedId, batch.target);
    const waitedMs = Date.now() - asked;
    // Anything added from now on starts its own batch (it will find the print in the ring at once).
    this.batches.delete(key);
    if (!print) {
      this.d.log.warn({ feedId: batch.feedId, target: batch.target }, "no print yet for fill; left to the keeper");
      return;
    }
    const market = marketByFeedId(batch.feedId);
    if (!market) return;
    const proof = proofOf(market, print.updates);
    await untilChainReaches(print.publishTime);
    if (batch.book === "ride") {
      await this.sweepBounds?.(batch.feedId, batch.target - 1);
      return this.fillRides(batch.target, [...batch.items.keys()], proof, waitedMs);
    }
    const mark = await this.d.sigma.signed(this.d.markSigner, this.d.chainId, batch.feedId, batch.target);
    const all = [...batch.items.values()];
    const windows = new Map(all.map((p) => [p.window.windowId, p.window]));
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const lane = this.laneAt(batch.target);
    for (let i = 0; i < all.length; i += MARKET_BATCH_MAX) {
      const ids = all.slice(i, i + MARKET_BATCH_MAX).map((p) => p.ticketId);
      const sent = await retryWhileEarly(() =>
        lane.run((sender) =>
          sendTx(sender, {
            to: reserve,
            data: finalizeCallData(batch.target, ids, proof, mark),
            action: "marketFinalize",
            meta: { job: "fill", target: String(batch.target) },
          }),
        ),
      );
      const changes = ticketChanges(sent.receipt.logs, reserve);
      await applyTicketChanges(
        this.d.db,
        this.d.chainId,
        changes,
        async (id) => {
          const w = windows.get(id);
          if (!w) throw new Error(`unknown window ${id}`);
          return w;
        },
        sent.hash,
      );
      this.d.log.info(
        { actor: "relay", why: "fill", target: batch.target, tickets: ids.length, waitedMs, tx: sent.hash },
        "fill sent",
      );
    }
  }

  private async fillRides(target: number, rideIds: bigint[], proof: Hex, waitedMs: number): Promise<void> {
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const lane = this.laneAt(target);
    for (let i = 0; i < rideIds.length; i += RIDE_BATCH_MAX) {
      const ids = rideIds.slice(i, i + RIDE_BATCH_MAX);
      const sent = await retryWhileEarly(() =>
        lane.run((sender) =>
          sendTx(sender, {
            to: reserve,
            data: finalizeRidesCallData(target, ids, proof),
            action: "rideFinalize",
            meta: { job: "ride-fill", target: String(target) },
          }),
        ),
      );
      await applyRideChanges(this.d.db, this.d.chainId, rideChanges(sent.receipt.logs, reserve), sent.hash);
      this.d.log.info(
        { actor: "relay", why: "ride fill", target, rides: ids.length, waitedMs, tx: sent.hash },
        "ride fill sent",
      );
    }
  }

  private laneAt(target: number): Lane {
    return this.d.lanes[target % this.d.lanes.length] as Lane;
  }
}
