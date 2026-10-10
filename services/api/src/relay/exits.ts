import {
  type Address,
  addressOf,
  describeError,
  fireExitCallData,
  fireTrailCallData,
  type Hex,
  type ReadClient,
  SimulationRevertedError,
  sendTx,
  seriesOf,
  ticketChanges,
} from "@senryo/chain";
import {
  bandMenu,
  type ChainId,
  FILL_DELAY_SEC,
  feedIdOf,
  isWatchable,
  LOCKOUT_SEC,
  POOL_TERMS,
  sigmaE8Of,
} from "@senryo/config";
import { bandReserveAbi, windowsAbi } from "@senryo/contracts/abis";
import { type ExitFire, exitDecision, quoteClose } from "@senryo/core";
import {
  applyTicketChanges,
  type Db,
  type ExitRow,
  type Logger,
  nowSec,
  saveExit,
  type TicketNotice,
} from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { EXIT_CHAIN_SYNC_MS, EXIT_RELOAD_MS, EXIT_RETRY_MS, EXIT_TICK_MS } from "./constants.ts";
import type { FillBatcher } from "./fills.ts";
import type { Lane } from "./lanes.ts";

/**
 * The exit watcher (D-292), beside the one price gateway (the only process with live prices): every second each armed
 * exit's bid at the live price — the contract's own close maths with the window's open print, the series' σ and the
 * seconds from the next print to expiry — and when take-profit or stop-loss is met, or the trail's stop is crossed, it
 * fires on the sponsor lane (the lane holding the trail's role) and hands the close to the fill batcher. The fill print
 * decides; a miss leaves the exit standing and it re-arms after a pause. Exits come from the ticket book (the relay's
 * own `setExit` receipts) and a periodic read of the chain for open tickets (anyone may set one directly).
 */
interface Armed {
  exit: ExitRow;
  owner: Address;
  windowId: Hex;
  seriesId: Hex;
  start: number;
  expiry: number;
  band: number;
  shares: bigint;
}

const EVENTS_THAT_REARM = new Set(["exitSet", "exitFired", "closeRefused", "closed", "filled", "claimed"]);

export class ExitWatcher {
  private armed = new Map<bigint, Armed>();
  private readonly peaks = new Map<bigint, number>();
  private readonly openPrints = new Map<Hex, bigint>();
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
      void work().catch((error) => this.d.log.warn({ err: describeError(error) }, `exit watcher ${what} failed`));
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

  /** A ticket change that can arm or disarm an exit reloads at once (otherwise within `EXIT_RELOAD_MS`). */
  onTicket(n: TicketNotice): void {
    if (n.chainId === this.d.chainId && EVENTS_THAT_REARM.has(n.change)) void this.reload().catch(() => undefined);
  }

  private async reload(): Promise<void> {
    if (Date.now() - this.lastChainSync >= EXIT_CHAIN_SYNC_MS) await this.syncFromChain();
    const rows = await this.d.db<(ExitRow & Omit<TicketCols, "ticket_id">)[]>`
      SELECT e.*, t.owner, t.window_id, t.series_id, t.window_start, t.window_expiry, t.band, t.payout
      FROM market_exits e JOIN market_tickets t ON t.chain_id = e.chain_id AND t.ticket_id = e.ticket_id
      WHERE e.chain_id = ${this.d.chainId} AND t.state = 'open' AND t.window_expiry > ${nowSec()}`;
    const next = new Map<bigint, Armed>();
    for (const r of rows) {
      next.set(r.ticket_id, {
        exit: r,
        owner: r.owner as Address,
        windowId: r.window_id as Hex,
        seriesId: r.series_id as Hex,
        start: Number(r.window_start),
        expiry: Number(r.window_expiry),
        band: r.band,
        shares: r.payout,
      });
      this.peaks.set(r.ticket_id, Math.max(this.peaks.get(r.ticket_id) ?? 0, r.trail_peak_e6));
    }
    this.armed = next;
    for (const id of this.peaks.keys()) if (!next.has(id)) this.peaks.delete(id);
  }

  /** Exits set on chain by anyone: the open tickets' `exitOf`, saved where the book differs. */
  private async syncFromChain(): Promise<void> {
    this.lastChainSync = Date.now();
    const open = await this.d.db<{ ticket_id: bigint }[]>`
      SELECT ticket_id FROM market_tickets WHERE chain_id = ${this.d.chainId} AND state = 'open'
        AND window_expiry > ${nowSec()} ORDER BY ticket_id DESC LIMIT 256`;
    if (open.length === 0) return;
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const exits = await this.d.read.multicall({
      // A reserve from before exits (markets v1) has no `exitOf`: those reads fail and are skipped.
      allowFailure: true,
      contracts: open.map(
        (r) => ({ address: reserve, abi: bandReserveAbi, functionName: "exitOf", args: [r.ticket_id] }) as const,
      ),
    });
    const known = new Map(this.armed);
    for (const [i, read] of exits.entries()) {
      if (read.status !== "success") continue;
      const e = read.result;
      const ticketId = (open[i] as { ticket_id: bigint }).ticket_id;
      const have = known.get(ticketId)?.exit;
      const same =
        have?.take_profit_e6 === e.takeProfitE6 &&
        have.stop_loss_e6 === e.stopLossE6 &&
        have.floor_e6 === e.floorE6 &&
        have.trail_e6 === e.trailE6;
      const none = e.takeProfitE6 === 0 && e.stopLossE6 === 0 && e.trailE6 === 0;
      if (same || (none && !have)) continue;
      await saveExit(this.d.db, this.d.chainId, { ticketId, ...e });
    }
  }

  private async tick(): Promise<void> {
    const now = nowSec();
    for (const [id, a] of this.armed) {
      if (this.firing.has(id) || now + FILL_DELAY_SEC + LOCKOUT_SEC >= a.expiry) continue;
      const firedAt = a.exit.fired_at?.getTime() ?? 0;
      if (Date.now() - firedAt < EXIT_RETRY_MS) continue;
      const bid = await this.bidOf(a, now);
      if (bid === null) continue;
      const peak = this.peaks.get(id) ?? 0;
      const decision = exitDecision(
        {
          takeProfitE6: a.exit.take_profit_e6,
          stopLossE6: a.exit.stop_loss_e6,
          floorE6: a.exit.floor_e6,
          trailE6: a.exit.trail_e6,
        },
        bid,
        peak,
      );
      if (decision.peakE6 > peak) {
        this.peaks.set(id, decision.peakE6);
        await this.d.db`UPDATE market_exits SET trail_peak_e6 = ${decision.peakE6}
          WHERE chain_id = ${this.d.chainId} AND ticket_id = ${id} AND trail_peak_e6 < ${decision.peakE6}`;
      }
      if (decision.fire) void this.fire(id, a, decision.fire);
    }
  }

  /** The bid per share now (× 1e6), as the next second's print would price it; null when not priced. */
  private async bidOf(a: Armed, now: number): Promise<number | null> {
    const series = seriesOf(this.d.chainId, a.seriesId);
    const band = series ? bandMenu(series.market, series.cadenceSec)[a.band] : undefined;
    if (!series || !band) return null;
    // Only a settlement price that is live or a little late, by its own source's cadence (FeedStates, 04-pricing R6).
    const live = this.d.gateway.latestE8(feedIdOf(series.market));
    if (!live || !isWatchable(this.d.gateway.feedState(feedIdOf(series.market)))) return null;
    const k = await this.openPrint(a.windowId);
    if (k === 0n) return null;
    const terms = POOL_TERMS[this.d.chainId];
    const q = quoteClose(
      band,
      {
        openE8: k,
        sigmaE8: BigInt(sigmaE8Of(series.market)),
        tauSec: BigInt(a.expiry - (now + FILL_DELAY_SEC)),
      },
      live.priceE8,
      a.shares,
      {
        halfSpreadE6: BigInt(terms.halfSpreadE6),
        minProbE6: BigInt(terms.minProbE6),
        maxProbE6: BigInt(terms.maxProbE6),
        surchargeE6: 0n,
      },
    );
    return q.refusal ? null : Number(q.bidE6);
  }

  private async openPrint(windowId: Hex): Promise<bigint> {
    const hit = this.openPrints.get(windowId);
    if (hit !== undefined) return hit;
    const p = await this.d.read.readContract({
      address: addressOf(this.d.chainId, "Windows"),
      abi: windowsAbi,
      functionName: "openPrintOf",
      args: [windowId],
    });
    if (p.publishTime !== 0) this.openPrints.set(windowId, p.priceE8);
    return p.priceE8;
  }

  private async fire(id: bigint, a: Armed, kind: ExitFire): Promise<void> {
    this.firing.add(id);
    a.exit.fired_at = new Date();
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const series = seriesOf(this.d.chainId, a.seriesId);
    try {
      const data = kind === "trail" ? fireTrailCallData(id) : fireExitCallData(id);
      const sent = await this.d.lane.run((sender) =>
        sendTx(sender, { to: reserve, data, action: "exitFire", meta: { job: "exit", ticket: id.toString() } }),
      );
      const changes = ticketChanges(sent.receipt.logs, reserve);
      const window = { windowId: a.windowId, seriesId: a.seriesId, start: a.start, expiry: a.expiry };
      await applyTicketChanges(this.d.db, this.d.chainId, changes, async () => window, sent.hash);
      const fired = changes.find((c) => c.kind === "exitFired");
      if (fired?.kind === "exitFired" && series) {
        this.d.fills.add(feedIdOf(series.market), fired.target, { ticketId: id, owner: a.owner, window });
      }
      this.d.log.info({ actor: "relay", why: `exit ${kind}`, ticketId: id.toString(), tx: sent.hash }, "exit fired");
    } catch (error) {
      // Held too short, a close already pending, the window locked: the exit stands and is tried again.
      await this.d
        .db`UPDATE market_exits SET fired_at = now() WHERE chain_id = ${this.d.chainId} AND ticket_id = ${id}`;
      const level = error instanceof SimulationRevertedError ? "debug" : "warn";
      this.d.log[level]({ ticketId: id.toString(), err: describeError(error) }, "exit not fired; will retry");
    } finally {
      this.firing.delete(id);
    }
  }
}

interface TicketCols {
  ticket_id: bigint;
  owner: string;
  window_id: string;
  series_id: string;
  window_start: bigint;
  window_expiry: bigint;
  band: number;
  payout: bigint;
}
