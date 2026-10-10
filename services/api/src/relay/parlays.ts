import {
  type Address,
  addressOf,
  aggregateResults,
  commitParlayCallData,
  describeError,
  finalizeParlayCallData,
  type Hex,
  type LegWindow,
  type MarketParlayIntent,
  MULTICALL3,
  openLegsAndCommitParlayData,
  type ParlayChange,
  parlayChanges,
  parlayDigest,
  proofOf,
  type ReadClient,
  revertReason,
  SimulationRevertedError,
  sendTx,
  verifierOf,
} from "@senryo/chain";
import { type ChainId, feedIdOf, PARLAY } from "@senryo/config";
import {
  applyParlayChanges,
  type Db,
  HTTP_STATUS,
  HttpError,
  type Logger,
  nowSec,
  type ParlayLegRef,
  type ParlayNotice,
} from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { retryWhileEarly, untilChainReaches } from "./chain-clock.ts";
import { OPEN_PRINT_WAIT_MS } from "./constants.ts";
import { bad, type CheckedIntent, checkDeadline, checkListed, checkStake, checkWindow, ZERO_ADDRESS } from "./gates.ts";
import type { Lane } from "./lanes.ts";
import type { IntentStatus, MarketRelay } from "./relay.ts";

/**
 * The parlay relay (S8.5, D-293), beside the call relay and sharing its intents: a signed parlay becomes one intent row
 * keyed by its EIP-712 digest, then on the caller's lane: simulate → open any leg window without its line (in the same
 * transaction) → `commitParlay` → the book → its fill at the next print of every leg's feed, from the gateway's ring.
 * The keeper backs the fill up from the archive and settles the legs.
 */
export interface ParlayRequest {
  chainId: ChainId;
  intent: MarketParlayIntent;
  signature: Hex;
  permit: { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex } | null;
  legs: { symbol: string; cadenceSec: number; start: number }[];
}

type CheckedLeg = Omit<CheckedIntent, "digest"> & { windowId: Hex; band: number };

export function checkParlay(req: ParlayRequest, now: number): { digest: Hex; legs: CheckedLeg[] } {
  const { intent } = req;
  const n = intent.windowIds.length;
  if (n < PARLAY.minLegs || n > PARLAY.maxLegs || intent.bands.length !== n || req.legs.length !== n) {
    throw bad(`a parlay has ${PARLAY.minLegs} to ${PARLAY.maxLegs} legs`);
  }
  const legs = req.legs.map((l, i) => {
    const windowId = intent.windowIds[i] as Hex;
    return { ...checkWindow(req.chainId, { ...l, windowId }, now, true), windowId, band: intent.bands[i] ?? 0 };
  });
  for (const [i, leg] of legs.entries()) {
    const before = legs[i - 1];
    if (before && leg.expiry < before.expiry) throw bad("legs go in the order they close");
    if (legs.some((o, j) => j < i && o.market.symbol === leg.market.symbol)) throw bad("one leg per market");
  }
  checkDeadline(intent.deadline, now);
  checkStake(req.chainId, intent.stake);
  if (intent.recipient === ZERO_ADDRESS) throw bad("recipient is required");
  if (req.permit && Number(req.permit.deadline) <= now) throw bad("permit expired");
  return { digest: parlayDigest(req.chainId, intent), legs };
}

export class ParlayRelay {
  constructor(
    private readonly d: {
      chainId: ChainId;
      read: ReadClient;
      lanes: Lane[];
      gateway: PythGateway;
      relay: MarketRelay;
      db: Db;
      log: Logger;
    },
  ) {}

  async submit(req: ParlayRequest): Promise<IntentStatus> {
    const checked = checkParlay(req, nowSec());
    for (const leg of checked.legs) {
      checkListed(this.d.relay.listing, leg);
      const paused = this.d.gateway.pausedReason(leg.market);
      if (paused) throw new HttpError(HTTP_STATUS.conflict, "MARKET_PAUSED", `${leg.market.symbol}: ${paused}`);
    }
    const owner = req.intent.owner.toLowerCase();
    const body = JSON.stringify(req, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    const inserted = await this.d.db`
      INSERT INTO market_intents (digest, chain_id, owner, kind, body)
      VALUES (${checked.digest}, ${req.chainId}, ${owner}, 'parlay', ${body}::jsonb)
      ON CONFLICT (digest) DO NOTHING RETURNING digest`;
    if (inserted.length === 0) return (await this.d.relay.status(checked.digest)) as IntentStatus;
    void this.d.relay
      .laneFor(req.intent.owner)
      .run(() => this.commit(req, checked.digest, checked.legs))
      .catch((error) => this.d.relay.fail(checked.digest, owner, describeError(error)));
    return { digest: checked.digest, state: "received", ticketId: null, txHash: null, target: null, reason: null };
  }

  /** The parlay's intent follows its book: filled once it fills, refused when refunded unfilled. */
  async onParlay(n: ParlayNotice): Promise<void> {
    if (n.change !== "parlayFilled" && n.change !== "parlayRefused") return;
    const [row] = await this.d.db<{ digest: string; owner: string; state: string }[]>`
      SELECT digest, owner, state FROM market_intents WHERE chain_id = ${this.d.chainId} AND kind = 'parlay'
        AND ticket_id = ${BigInt(n.parlayId)} ORDER BY created_at DESC LIMIT 1`;
    if (!row || row.state === "filled" || row.state === "refused") return;
    const refused = n.change === "parlayRefused";
    await this.d.relay.setState(row.digest as Hex, row.owner as Address, {
      state: refused ? "refused" : "filled",
      txHash: n.txHash,
      reason: refused ? "refused" : null,
    });
  }

  private async commit(req: ParlayRequest, digest: Hex, legs: CheckedLeg[]): Promise<void> {
    const owner = req.intent.owner;
    const sender = this.d.relay.laneFor(owner).sender;
    await this.d.relay.setState(digest, owner, { state: "submitted" });
    const commitData = commitParlayCallData(req.intent, req.signature, req.permit);
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const opening = await this.legsToOpen(legs);
    let to: Address = reserve;
    let data = commitData;
    if (opening.length > 0) {
      await untilChainReaches(Math.max(...opening.map((l) => l.start)));
      const simulation = openLegsAndCommitParlayData(this.d.chainId, opening, commitData, true);
      await retryWhileEarly(() => this.simulateInBatch(sender.account.address, simulation));
      to = MULTICALL3;
      data = openLegsAndCommitParlayData(this.d.chainId, opening, commitData);
    }
    const sent = await retryWhileEarly(() => sendTx(sender, { to, data, action: "marketCommit", meta: { digest } }));
    if (sent.stage === "reverted") throw new Error(`parlay commit reverted in ${sent.hash}`);
    const changes = parlayChanges(sent.receipt.logs, reserve);
    await this.apply(changes, legs, sent.hash);
    const committed = changes.find((c) => c.kind === "parlayCommitted");
    if (committed?.kind !== "parlayCommitted") throw new Error("the commit landed without a parlay event");
    await this.d.relay.setState(digest, owner, {
      state: "committed",
      ticketId: committed.parlayId,
      txHash: sent.hash,
      target: committed.target,
    });
    this.d.log.info({ actor: "relay", why: "parlay", parlayId: committed.parlayId.toString() }, "parlay committed");
    void this.fill(committed.parlayId, committed.target, legs).catch((error) =>
      this.d.log.warn({ err: describeError(error) }, "parlay fill failed; the keeper will retry"),
    );
  }

  /** Leg windows not yet open with their line, each with its open print's proof from the gateway. */
  private async legsToOpen(legs: CheckedLeg[]): Promise<LegWindow[]> {
    const out: LegWindow[] = [];
    for (const l of legs) {
      if (await this.d.relay.openPrintRecorded(l.windowId)) continue;
      const open = await this.d.gateway.printAt(feedIdOf(l.market), l.start, OPEN_PRINT_WAIT_MS);
      if (!open) throw new Error(`${l.market.symbol}'s opening price is not available yet`);
      out.push({
        seriesId: l.seriesId,
        windowId: l.windowId,
        start: l.start,
        expiry: l.expiry,
        verifier: verifierOf(this.d.chainId, l.market),
        feedId: feedIdOf(l.market),
        proof: proofOf(l.market, open.updates),
      });
    }
    return out;
  }

  /** The fill: every leg's print of the instant from the ring, one `finalizeParlay`. */
  private async fill(parlayId: bigint, target: number, legs: CheckedLeg[]): Promise<void> {
    const prints = await Promise.all(legs.map((l) => this.d.gateway.printAt(feedIdOf(l.market), target)));
    if (prints.some((p) => !p)) {
      this.d.log.warn({ parlayId: parlayId.toString(), target }, "no print yet for a parlay leg; left to the keeper");
      return;
    }
    const proofs = legs.map((l, i) => proofOf(l.market, prints[i]?.updates ?? []));
    await untilChainReaches(Math.max(...prints.map((p) => p?.publishTime ?? 0)));
    const lane = this.d.lanes[target % this.d.lanes.length] as Lane;
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const sent = await retryWhileEarly(() =>
      lane.run((sender) =>
        sendTx(sender, {
          to: reserve,
          data: finalizeParlayCallData(parlayId, proofs),
          action: "marketFinalize",
          meta: { job: "parlay-fill", parlay: parlayId.toString() },
        }),
      ),
    );
    await this.apply(parlayChanges(sent.receipt.logs, reserve), legs, sent.hash);
  }

  private apply(changes: ParlayChange[], legs: CheckedLeg[], txHash: Hex): Promise<void> {
    const refs: ParlayLegRef[] = legs.map((l) => ({
      windowId: l.windowId,
      seriesId: l.seriesId,
      start: l.start,
      expiry: l.expiry,
      band: l.band,
    }));
    return applyParlayChanges(this.d.db, this.d.chainId, changes, async () => refs, txHash);
  }

  /** A strict Multicall3 batch hides the commit's own revert; simulate with it allowed to fail and read it. */
  private async simulateInBatch(from: Address, data: Hex): Promise<void> {
    const { data: out } = await this.d.read.call({ account: from, to: MULTICALL3, data });
    const commit = aggregateResults(out ?? "0x").at(-1);
    if (commit?.success) return;
    const reason = revertReason(commit?.returnData ?? "0x");
    throw new SimulationRevertedError("marketCommit", { name: reason, args: [], message: reason }, undefined);
  }
}
