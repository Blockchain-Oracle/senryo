import { type Address, addressOf, finalizeCallData, type Hex, proofOf, sendTx, ticketChanges } from "@senryo/chain";
import { type ChainId, MARKET_BATCH_MAX, marketByFeedId } from "@senryo/config";
import { applyTicketChanges, type Db, type Logger, type WindowRef } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import type { StreamBus } from "../stream/bus.ts";
import { retryWhileEarly, untilChainReaches } from "./chain-clock.ts";
import type { Lane } from "./lanes.ts";

/**
 * Fills (D-261, D-278): every pending open or close waits for the unique print of its instant (commit + 1 s). Calls
 * for the same feed and instant share one `finalize`; it goes out the moment the print streams in (≈ 1 s after the
 * commit), from the gateway's ring — so tap → fill stays near the 3 s budget. The keeper is the backup (archive).
 */
interface Pending {
  ticketId: bigint;
  owner: Address;
  window: WindowRef;
}

interface Batch {
  feedId: Hex;
  target: number;
  tickets: Map<bigint, Pending>;
}

export class FillBatcher {
  private readonly batches = new Map<string, Batch>();

  constructor(
    private readonly d: {
      chainId: ChainId;
      lanes: Lane[];
      gateway: PythGateway;
      bus: StreamBus;
      db: Db;
      log: Logger;
    },
  ) {}

  add(feedId: Hex, target: number, pending: Pending): void {
    const key = `${feedId}:${target}`;
    const open = this.batches.get(key);
    if (open) {
      open.tickets.set(pending.ticketId, pending);
      return;
    }
    const batch: Batch = { feedId, target, tickets: new Map([[pending.ticketId, pending]]) };
    this.batches.set(key, batch);
    void this.run(key, batch).catch((error) =>
      this.d.log.warn({ err: (error as Error).message, target }, "fill batch failed; the keeper will retry"),
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
    const all = [...batch.tickets.values()];
    const windows = new Map(all.map((p) => [p.window.windowId, p.window]));
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const lane = this.d.lanes[batch.target % this.d.lanes.length] as Lane;
    await untilChainReaches(print.publishTime);
    for (let i = 0; i < all.length; i += MARKET_BATCH_MAX) {
      const ids = all.slice(i, i + MARKET_BATCH_MAX).map((p) => p.ticketId);
      const sent = await retryWhileEarly(() =>
        lane.run((sender) =>
          sendTx(sender, {
            to: reserve,
            data: finalizeCallData(batch.target, ids, proof),
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
}
