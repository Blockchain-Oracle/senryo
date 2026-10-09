import {
  ACTION_OPEN,
  type Address,
  addressOf,
  aggregateResults,
  commitCallData,
  describeError,
  type Hex,
  MULTICALL3,
  openAndCommitData,
  proofOf,
  type ReadClient,
  revertReason,
  SimulationRevertedError,
  sendTx,
  ticketChanges,
  verifierOf,
} from "@senryo/chain";
import { type ChainId, feedIdOf } from "@senryo/config";
import { windowsAbi } from "@senryo/contracts/abis";
import { applyTicketChanges, type Db, type Logger, nowSec, type TicketNotice } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import type { StreamBus } from "../stream/bus.ts";
import { retryWhileEarly, untilChainReaches } from "./chain-clock.ts";
import { OPEN_PRINT_WAIT_MS } from "./constants.ts";
import { FillBatcher } from "./fills.ts";
import { type CheckedIntent, checkIntent, type IntentRequest } from "./gates.ts";
import { type Lane, laneIndex } from "./lanes.ts";

/**
 * The relay (D-266, D-278): a signed call becomes one row keyed by its EIP-712 digest (posting it twice is one call),
 * then, on the caller's lane: simulate → (open the window and record its open print if this is its first call) →
 * commit → journal → receipt → the ticket → its fill at the next print. Every step is pushed to the caller's own
 * `user:<address>` topic; the HTTP answer is only "received".
 */
export interface IntentStatus {
  digest: Hex;
  state: "received" | "submitted" | "committed" | "filled" | "refused" | "failed";
  ticketId: bigint | null;
  txHash: Hex | null;
  target: number | null;
  reason: string | null;
}

interface IntentRow {
  digest: string;
  kind: "open" | "close" | "parlay";
  owner: string;
  state: IntentStatus["state"];
  ticket_id: bigint | null;
  tx_hash: string | null;
  target: bigint | null;
  reason: string | null;
}

export class MarketRelay {
  readonly fills: FillBatcher;

  constructor(
    private readonly d: {
      chainId: ChainId;
      read: ReadClient;
      lanes: Lane[];
      gateway: PythGateway;
      bus: StreamBus;
      db: Db;
      log: Logger;
    },
  ) {
    this.fills = new FillBatcher(d);
  }

  laneFor(owner: Address): Lane {
    return this.d.lanes[laneIndex(owner, this.d.lanes.length)] as Lane;
  }

  async submit(req: IntentRequest): Promise<IntentStatus> {
    const checked = checkIntent(req, nowSec());
    const owner = req.intent.owner.toLowerCase();
    const kind = req.intent.action === ACTION_OPEN ? "open" : "close";
    const body = JSON.stringify({ ...req, checked }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    const inserted = await this.d.db<IntentRow[]>`
      INSERT INTO market_intents (digest, chain_id, owner, kind, body)
      VALUES (${checked.digest}, ${req.chainId}, ${owner}, ${kind}, ${body}::jsonb)
      ON CONFLICT (digest) DO NOTHING RETURNING *`;
    if (inserted.length === 0) return (await this.status(checked.digest)) as IntentStatus;
    void this.laneFor(req.intent.owner)
      .run(() => this.commit(req, checked))
      .catch((error) => this.fail(checked.digest, owner, describeError(error)));
    return { digest: checked.digest, state: "received", ticketId: null, txHash: null, target: null, reason: null };
  }

  /**
   * The call's status. While an open's intent row says "committed", the ticket book decides: a fill or refusal made
   * while this process was restarting (its NOTIFY lost) still shows as filled or refused.
   */
  async status(digest: Hex): Promise<IntentStatus | undefined> {
    // A parlay's `ticket_id` is its parlay id (a separate numbering): it is read from the parlay book instead.
    const [row] = await this.d.db<(IntentRow & { ticket_state: string | null; parlay_state: string | null })[]>`
      SELECT i.*, t.state AS ticket_state, p.state AS parlay_state FROM market_intents i
      LEFT JOIN market_tickets t ON t.chain_id = i.chain_id AND t.ticket_id = i.ticket_id AND i.kind <> 'parlay'
      LEFT JOIN market_parlays p ON p.chain_id = i.chain_id AND p.parlay_id = i.ticket_id AND i.kind = 'parlay'
      WHERE i.digest = ${digest}`;
    if (!row) return undefined;
    const status = toStatus(row);
    if (status.state === "committed" && row.kind === "parlay" && row.parlay_state && row.parlay_state !== "committed") {
      return { ...status, state: row.parlay_state === "refunded" ? "refused" : "filled" };
    }
    // Only an open is unambiguous in the book (a refused close and a partial one both leave the ticket open).
    if (status.state !== "committed" || row.kind !== "open" || !row.ticket_state || row.ticket_state === "committed") {
      return status;
    }
    return { ...status, state: row.ticket_state === "refunded" ? "refused" : "filled" };
  }

  private async commit(req: IntentRequest, c: CheckedIntent): Promise<void> {
    const sender = this.laneFor(req.intent.owner).sender;
    await this.setState(c.digest, req.intent.owner, { state: "submitted" });
    const commitData = commitCallData(req.intent, req.signature, req.permit);
    const reserve = addressOf(this.d.chainId, "BandReserve");
    let to: Address = reserve;
    let data: Hex = commitData;
    if (req.intent.action === ACTION_OPEN && !(await this.openPrintRecorded(req.intent.windowId))) {
      const open = await this.d.gateway.printAt(feedIdOf(c.market), c.start, OPEN_PRINT_WAIT_MS);
      if (!open) throw new Error("the window's open print is not available yet");
      const batch = {
        seriesId: c.seriesId,
        start: c.start,
        verifier: verifierOf(this.d.chainId, c.market),
        feedId: feedIdOf(c.market),
        openProof: proofOf(c.market, open.updates),
        commitData,
      };
      await untilChainReaches(open.publishTime);
      await retryWhileEarly(() =>
        this.simulateCommitInBatch(sender.account.address, openAndCommitData(this.d.chainId, batch, true)),
      );
      to = MULTICALL3;
      data = openAndCommitData(this.d.chainId, batch);
    }
    const sent = await retryWhileEarly(() =>
      sendTx(sender, { to, data, action: "marketCommit", meta: { digest: c.digest } }),
    );
    if (sent.stage === "reverted") throw new Error(`commit reverted in ${sent.hash}`);
    const changes = ticketChanges(sent.receipt.logs, reserve);
    const window = { windowId: req.intent.windowId, seriesId: c.seriesId, start: c.start, expiry: c.expiry };
    await applyTicketChanges(this.d.db, this.d.chainId, changes, async () => window, sent.hash);
    const committed = changes.find((x) => x.kind === "committed" || x.kind === "closing");
    if (!committed || (committed.kind !== "committed" && committed.kind !== "closing")) {
      throw new Error("the commit landed without a ticket event");
    }
    await this.setState(c.digest, req.intent.owner, {
      state: "committed",
      ticketId: committed.ticketId,
      txHash: sent.hash,
      target: committed.target,
    });
    this.d.log.info(
      {
        actor: "relay",
        why: "commit",
        ticketId: committed.ticketId.toString(),
        target: committed.target,
        tx: sent.hash,
      },
      "call committed",
    );
    this.fills.add(feedIdOf(c.market), committed.target, {
      ticketId: committed.ticketId,
      owner: req.intent.owner,
      window,
    });
  }

  /** A strict Multicall3 batch hides the commit's own revert; simulate with it allowed to fail and read it. */
  private async simulateCommitInBatch(from: Address, data: Hex): Promise<void> {
    const { data: out } = await this.d.read.call({ account: from, to: MULTICALL3, data });
    const results = aggregateResults(out ?? "0x");
    const commit = results.at(-1);
    if (commit?.success) return;
    const reason = revertReason(commit?.returnData ?? "0x");
    throw new SimulationRevertedError("marketCommit", { name: reason, args: [], message: reason }, undefined);
  }

  /** Whether a window is open on chain with its line recorded (a first call opens it in the same transaction). */
  async openPrintRecorded(windowId: Hex): Promise<boolean> {
    const windows = addressOf(this.d.chainId, "Windows");
    const w = await this.d.read.readContract({
      address: windows,
      abi: windowsAbi,
      functionName: "windowOf",
      args: [windowId],
    });
    if (w.expiry === 0) return false;
    const p = await this.d.read.readContract({
      address: windows,
      abi: windowsAbi,
      functionName: "openPrintOf",
      args: [windowId],
    });
    return p.publishTime !== 0;
  }

  /**
   * Every ticket change, whoever made it (this relay's fill, the keeper's backup, settlement), arrives here from the
   * ticket book's NOTIFY: the call's intent moves to filled or refused, so its status never depends on which service
   * filled it.
   */
  async onTicket(n: TicketNotice): Promise<void> {
    if (n.change !== "filled" && n.change !== "refused" && n.change !== "closed" && n.change !== "closeRefused") return;
    const [row] = await this.d.db<IntentRow[]>`
      SELECT * FROM market_intents WHERE chain_id = ${this.d.chainId} AND ticket_id = ${BigInt(n.ticketId)}
        AND kind <> 'parlay' ORDER BY created_at DESC LIMIT 1`;
    if (!row || row.state === "filled" || row.state === "refused") return;
    const refused = n.change === "refused" || n.change === "closeRefused";
    await this.setState(row.digest as Hex, row.owner as Address, {
      state: refused ? "refused" : "filled",
      txHash: n.txHash,
      reason: refused ? "refused" : null,
    });
  }

  /** Moves an intent (a call's or a parlay's) and tells its owner's stream. */
  async setState(
    digest: Hex,
    owner: Address,
    s: Partial<Pick<IntentStatus, "state" | "ticketId" | "txHash" | "target" | "reason">>,
  ): Promise<void> {
    const [row] = await this.d.db<IntentRow[]>`
      UPDATE market_intents SET
        state = COALESCE(${s.state ?? null}, state),
        ticket_id = COALESCE(${s.ticketId ?? null}, ticket_id),
        tx_hash = COALESCE(${s.txHash ?? null}, tx_hash),
        target = COALESCE(${s.target ?? null}, target),
        reason = COALESCE(${s.reason ?? null}, reason),
        updated_at = now()
      WHERE digest = ${digest} RETURNING *`;
    if (row) this.d.bus.emit(`user:${owner.toLowerCase()}`, "intent", toStatus(row));
  }

  async fail(digest: Hex, owner: string, reason: string): Promise<void> {
    this.d.log.warn({ digest, reason }, "relayed call failed");
    await this.setState(digest, owner as Address, { state: "failed", reason }).catch(() => undefined);
  }
}

function toStatus(row: IntentRow): IntentStatus {
  return {
    digest: row.digest as Hex,
    state: row.state,
    ticketId: row.ticket_id,
    txHash: row.tx_hash as Hex | null,
    target: row.target === null ? null : Number(row.target),
    reason: row.reason,
  };
}
