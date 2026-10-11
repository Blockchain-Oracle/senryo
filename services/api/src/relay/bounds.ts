import {
  addressOf,
  describeError,
  type Hex,
  proofOf,
  rideChanges,
  SimulationRevertedError,
  sendTx,
  settleBoundsCallData,
} from "@senryo/chain";
import { type ChainId, feedIdOf, type MarketSpec, rideMarketSpec } from "@senryo/config";
import { ridePastCap, ridePastKo, toE8 } from "@senryo/core";
import { applyRideChanges, type Db, type Logger, nowSec, type RideRow } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { retryWhileEarly, untilChainReaches } from "./chain-clock.ts";
import { BOUND_RETRY_MS, BOUND_TICK_MS, EXIT_RELOAD_MS, RIDE_BATCH_MAX } from "./constants.ts";
import type { Lane } from "./lanes.ts";

/**
 * The bound watcher (R4.4, D-301), beside the one price gateway: every second, each ride market's prints since its
 * last scan — one per second, from the ring — against every open ride's knock-out and cap. At the first second whose
 * print crosses any, every ride it crossed is settled at that print in one `settleBounds` (knocked out, or capped),
 * the print archived on the way so the keeper's sweep can do the same if this one fails. A crossing is settled before
 * any later close of the ride fills: the fill batcher sweeps a market through its fill's second first (`sweep`).
 */
const SCAN_BACK_SEC = 5;

interface Market {
  spec: MarketSpec;
  feedId: Hex;
  rides: RideRow[];
}

export class BoundWatcher {
  private markets = new Map<number, Market>();
  private readonly scanned = new Map<number, number>();
  private readonly tried = new Map<bigint, number>();
  private readonly busy = new Set<number>();
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(private readonly d: { chainId: ChainId; lane: Lane; gateway: PythGateway; db: Db; log: Logger }) {}

  start(): void {
    const guard = (what: string, work: () => Promise<void>) => () =>
      void work().catch((error) => this.d.log.warn({ err: describeError(error) }, `bound watcher ${what} failed`));
    this.timers = [
      setInterval(
        guard("tick", () => this.tick()),
        BOUND_TICK_MS,
      ),
      setInterval(
        guard("reload", () => this.reload()),
        EXIT_RELOAD_MS,
      ),
    ];
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
  }

  /** Settles any crossing in `feedId`'s prints up to `until` (a ride close at `until + 1` waits for this). */
  async sweep(feedId: Hex, until: number): Promise<void> {
    for (const [id, m] of this.markets) if (m.feedId === feedId) await this.scan(id, m, until);
  }

  private async reload(): Promise<void> {
    const rows = await this.d.db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${this.d.chainId}
      AND state IN ('open', 'closing') AND ko_e8 IS NOT NULL ORDER BY ride_id`;
    const next = new Map<number, Market>();
    for (const r of rows) {
      const spec = rideMarketSpec(r.market_id);
      if (!spec) continue;
      const m = next.get(r.market_id) ?? { spec, feedId: feedIdOf(spec), rides: [] };
      m.rides.push(r);
      next.set(r.market_id, m);
    }
    this.markets = next;
  }

  private async tick(): Promise<void> {
    const now = nowSec();
    for (const [id, m] of this.markets) await this.scan(id, m, now);
  }

  /** Every second in (last scan, until] with a print in the ring; stops at the first crossing it settles. */
  private async scan(id: number, m: Market, until: number): Promise<void> {
    if (this.busy.has(id) || m.rides.length === 0) return;
    this.busy.add(id);
    try {
      const from = this.scanned.get(id) ?? until - SCAN_BACK_SEC;
      for (let t = from + 1; t <= until; t++) {
        const u = this.d.gateway.ringPrintAt(m.feedId, t);
        if (!u) continue;
        const p = toE8(u.price, u.expo);
        const crossed = m.rides.filter((r) => this.crosses(r, p, t));
        this.scanned.set(id, t);
        if (crossed.length > 0) {
          await this.settle(m, t, crossed);
          return;
        }
      }
    } finally {
      this.busy.delete(id);
    }
  }

  private crosses(r: RideRow, p: bigint, t: number): boolean {
    if (r.ko_e8 === null || r.cap_e8 === null || r.filled_at === null || t < Number(r.filled_at)) return false;
    if (r.end_at !== null && t > Number(r.end_at)) return false;
    if (Date.now() - (this.tried.get(r.ride_id) ?? 0) < BOUND_RETRY_MS) return false;
    return ridePastKo(r.is_long, p, r.ko_e8) || ridePastCap(r.is_long, p, r.cap_e8);
  }

  private async settle(m: Market, t: number, crossed: RideRow[]): Promise<void> {
    // Archived on the way (the keeper's sweep reads the archive).
    const print = await this.d.gateway.printAt(m.feedId, t);
    if (!print) return;
    const proof = proofOf(m.spec, print.updates);
    const reserve = addressOf(this.d.chainId, "BandReserve");
    // The crossing is this second's print: usable once a block can carry its second (as a fill's is).
    await untilChainReaches(print.publishTime);
    for (let i = 0; i < crossed.length; i += RIDE_BATCH_MAX) {
      const ids = crossed.slice(i, i + RIDE_BATCH_MAX).map((r) => r.ride_id);
      for (const id of ids) this.tried.set(id, Date.now());
      try {
        const sent = await retryWhileEarly(() =>
          this.d.lane.run((sender) =>
            sendTx(sender, {
              to: reserve,
              data: settleBoundsCallData(t, ids, proof),
              action: "rideBounds",
              meta: { job: "bounds", t: String(t) },
            }),
          ),
        );
        await applyRideChanges(this.d.db, this.d.chainId, rideChanges(sent.receipt.logs, reserve), sent.hash);
        this.d.log.info(
          { actor: "relay", why: "ride bound", market: m.spec.symbol, t, rides: ids.length, tx: sent.hash },
          "ride bounds settled",
        );
      } catch (error) {
        const level = error instanceof SimulationRevertedError ? "debug" : "warn";
        this.d.log[level]({ t, err: describeError(error) }, "ride bounds not settled; the keeper's sweep follows");
      }
    }
    await this.reload();
  }
}
