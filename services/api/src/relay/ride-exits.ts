import {
  type Address,
  addressOf,
  describeError,
  EXIT_BOOK,
  fireRideExitCallData,
  fireRideTrailCallData,
  type ReadClient,
  rideChanges,
  SimulationRevertedError,
  sendTx,
} from "@senryo/chain";
import { type ChainId, feedIdOf, isWatchable, rideMarketSpec } from "@senryo/config";
import { bandReserveAbi } from "@senryo/contracts/abis";
import { type RideExitFire, rideExitDecision } from "@senryo/core";
import { applyRideChanges, type Db, type Logger, saveRideExit } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { EXIT_CHAIN_SYNC_MS, EXIT_RELOAD_MS, EXIT_RETRY_MS, EXIT_TICK_MS } from "./constants.ts";
import type { FillBatcher } from "./fills.ts";
import type { Lane } from "./lanes.ts";

/**
 * The ride exit watcher (R4.4, R3.12), beside the one price gateway: every second each armed ride exit against its
 * market's live price — take-profit or stop-loss at or past the level, or the trail's stop crossed on the rider's side
 * of the floor — fires on the sponsor lane (the lane holding the trail's role) and hands the close to the fill batcher.
 * The fill print decides (`_rideExitMet`); a miss leaves the exit standing and it re-arms after a pause. Exits come from
 * the ride book (the relay's own `setRideExit` receipts) and a periodic read of the chain for open rides.
 */
interface Armed {
  rideId: bigint;
  owner: Address;
  marketId: number;
  isLong: boolean;
  takeProfitE8: bigint;
  stopLossE8: bigint;
  floorE8: bigint;
  trailBps: number;
  firedAt: number;
}

interface Row {
  ride_id: bigint;
  owner: string;
  market_id: number;
  is_long: boolean;
  take_profit_e8: bigint;
  stop_loss_e8: bigint;
  floor_e8: bigint;
  trail_bps: number;
  trail_peak_e8: bigint;
  fired_at: Date | null;
}

const CHAIN_SYNC_BATCH = 256;

export class RideExitWatcher {
  private armed = new Map<bigint, Armed>();
  private readonly peaks = new Map<bigint, bigint>();
  private readonly firing = new Set<bigint>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastChainSync = 0;

  constructor(
    private readonly d: {
      chainId: ChainId;
      read: ReadClient;
      lane: Lane;
      gateway: PythGateway;
      fills: FillBatcher;
      db: Db;
      log: Logger;
    },
  ) {}

  start(): void {
    const guard = (what: string, work: () => Promise<void>) => () =>
      void work().catch((error) => this.d.log.warn({ err: describeError(error) }, `ride exit watcher ${what} failed`));
    this.timers = [
      setInterval(
        guard("tick", () => this.tick()),
        EXIT_TICK_MS,
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

  /** A ride change that can arm or disarm an exit reloads at once. */
  onRide(): void {
    void this.reload().catch(() => undefined);
  }

  private async reload(): Promise<void> {
    if (Date.now() - this.lastChainSync >= EXIT_CHAIN_SYNC_MS) await this.syncFromChain();
    const rows = await this.d.db<Row[]>`
      SELECT e.*, r.owner, r.market_id, r.is_long FROM ride_exits e
      JOIN market_rides r ON r.chain_id = e.chain_id AND r.ride_id = e.ride_id
      WHERE e.chain_id = ${this.d.chainId} AND r.state = 'open'`;
    const next = new Map<bigint, Armed>();
    for (const r of rows) {
      next.set(r.ride_id, {
        rideId: r.ride_id,
        owner: r.owner as Address,
        marketId: r.market_id,
        isLong: r.is_long,
        takeProfitE8: r.take_profit_e8,
        stopLossE8: r.stop_loss_e8,
        floorE8: r.floor_e8,
        trailBps: r.trail_bps,
        firedAt: r.fired_at?.getTime() ?? 0,
      });
      const known = this.peaks.get(r.ride_id) ?? 0n;
      if (known === 0n) this.peaks.set(r.ride_id, r.trail_peak_e8);
    }
    this.armed = next;
    for (const id of this.peaks.keys()) if (!next.has(id)) this.peaks.delete(id);
  }

  /** Exits set on chain by anyone: the open rides' `exitOf`, saved where the book differs. */
  private async syncFromChain(): Promise<void> {
    this.lastChainSync = Date.now();
    const open = await this.d.db<{ ride_id: bigint }[]>`
      SELECT ride_id FROM market_rides WHERE chain_id = ${this.d.chainId} AND state IN ('open', 'closing')
      ORDER BY ride_id DESC LIMIT ${CHAIN_SYNC_BATCH}`;
    if (open.length === 0) return;
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const exits = await this.d.read.multicall({
      allowFailure: true,
      contracts: open.map(
        (r) =>
          ({
            address: reserve,
            abi: bandReserveAbi,
            functionName: "exitOf",
            args: [EXIT_BOOK.ride, r.ride_id],
          }) as const,
      ),
    });
    for (const [i, read] of exits.entries()) {
      if (read.status !== "success") continue;
      const rideId = (open[i] as { ride_id: bigint }).ride_id;
      const e = read.result;
      const have = this.armed.get(rideId);
      const same =
        have?.takeProfitE8 === e.takeProfit &&
        have.stopLossE8 === e.stopLoss &&
        have.floorE8 === e.floor &&
        BigInt(have.trailBps) === e.trail;
      const none = e.takeProfit === 0n && e.stopLoss === 0n && e.trail === 0n;
      if (same || (none && !have)) continue;
      await saveRideExit(this.d.db, this.d.chainId, {
        rideId,
        takeProfit: e.takeProfit,
        stopLoss: e.stopLoss,
        floor: e.floor,
        trail: e.trail,
      });
    }
  }

  private async tick(): Promise<void> {
    for (const [id, a] of this.armed) {
      if (this.firing.has(id) || Date.now() - a.firedAt < EXIT_RETRY_MS) continue;
      const market = rideMarketSpec(a.marketId);
      if (!market) continue;
      const feedId = feedIdOf(market);
      const live = this.d.gateway.latestE8(feedId);
      if (!live || !isWatchable(this.d.gateway.feedState(feedId))) continue;
      const peak = this.peaks.get(id) ?? 0n;
      const decision = rideExitDecision(a, a.isLong, live.priceE8, peak);
      if (decision.peakE8 !== peak) {
        this.peaks.set(id, decision.peakE8);
        await this.d.db`UPDATE ride_exits SET trail_peak_e8 = ${decision.peakE8}
          WHERE chain_id = ${this.d.chainId} AND ride_id = ${id}`;
      }
      if (decision.fire) void this.fire(a, feedId, decision.fire);
    }
  }

  private async fire(a: Armed, feedId: `0x${string}`, kind: RideExitFire): Promise<void> {
    this.firing.add(a.rideId);
    a.firedAt = Date.now();
    const reserve = addressOf(this.d.chainId, "BandReserve");
    try {
      const data = kind === "trail" ? fireRideTrailCallData(a.rideId) : fireRideExitCallData(a.rideId);
      const sent = await this.d.lane.run((sender) =>
        sendTx(sender, {
          to: reserve,
          data,
          action: "exitFire",
          meta: { job: "ride-exit", ride: a.rideId.toString() },
        }),
      );
      const changes = rideChanges(sent.receipt.logs, reserve);
      await applyRideChanges(this.d.db, this.d.chainId, changes, sent.hash);
      const fired = changes.find((c) => c.kind === "rideExitFired");
      if (fired?.kind === "rideExitFired")
        this.d.fills.addRide(feedId, fired.target, { rideId: a.rideId, owner: a.owner });
      this.d.log.info(
        { actor: "relay", why: `ride exit ${kind}`, rideId: a.rideId.toString(), tx: sent.hash },
        "ride exit fired",
      );
    } catch (error) {
      // Held too short, a close already pending, the ride ended: the exit stands and is tried again.
      await this.d
        .db`UPDATE ride_exits SET fired_at = now() WHERE chain_id = ${this.d.chainId} AND ride_id = ${a.rideId}`;
      const level = error instanceof SimulationRevertedError ? "debug" : "warn";
      this.d.log[level]({ rideId: a.rideId.toString(), err: describeError(error) }, "ride exit not fired; will retry");
    } finally {
      this.firing.delete(a.rideId);
    }
  }
}
