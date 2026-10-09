import {
  type Address,
  addressOf,
  describeError,
  duelChanges,
  duelPickCallData,
  duelPickSigner,
  type Hex,
  type LegWindow,
  type MarketDuelPick,
  MULTICALL3,
  openCardsAndRevealData,
  openMatchCallData,
  proofOf,
  revealDeckCallData,
  type SignedDuelEntry,
  sendTx,
  ticketChanges,
  verifierOf,
} from "@senryo/chain";
import { BAND_INDEX, type ChainId, feedIdOf, LOCKOUT_SEC, MARKETS } from "@senryo/config";
import {
  announce,
  applyDuelChanges,
  applyTicketChanges,
  type Db,
  type DuelCardRef,
  type DuelWithPicks,
  duelOf,
  duelPickByTicket,
  failMatch,
  type Logger,
  nowSec,
  type TicketNotice,
} from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { retryWhileEarly, untilChainReaches } from "../relay/chain-clock.ts";
import { bad } from "../relay/gates.ts";
import type { Lane } from "../relay/lanes.ts";
import type { MarketRelay } from "../relay/relay.ts";
import type { StreamBus } from "../stream/bus.ts";
import { REVEAL_PRINT_WAIT_MS } from "./constants.ts";

/**
 * The duel's transactions (S8.6, D-294): `openMatch` from the matchmaker's lane (the sponsor holds the arena's DUEL
 * role), then the reveal — every card's window opened with its line in the same batch — and each swipe as `pick` on
 * the player's lane, its reserve ticket handed to the fill batcher like any call. The keeper locks, settles the cards
 * and pays the pot; a deck that never reveals is refunded by the keeper after the arena's window.
 */
export interface DuelPickRequest {
  chainId: ChainId;
  pick: MarketDuelPick;
  signature: Hex;
}

export class DuelRelay {
  private readonly placing = new Set<string>();

  constructor(
    private readonly d: {
      chainId: ChainId;
      lane: Lane;
      relay: MarketRelay;
      gateway: PythGateway;
      bus: StreamBus;
      db: Db;
      log: Logger;
    },
  ) {}

  get arena(): Address {
    return addressOf(this.d.chainId, "DuelArena");
  }

  /** Opens a paired match on chain and reveals it; a refused opening fails the match (the queue re-checks both). */
  async open(matchId: Hex, a: SignedDuelEntry, b: SignedDuelEntry, deckHash: Hex): Promise<boolean> {
    try {
      const sent = await this.d.lane.run((sender) =>
        sendTx(sender, {
          to: this.arena,
          data: openMatchCallData(matchId, a, b, deckHash),
          action: "duelOpen",
          meta: { match: matchId },
        }),
      );
      if (sent.stage === "reverted") throw new Error(`openMatch reverted in ${sent.hash}`);
      await applyDuelChanges(this.d.db, this.d.chainId, duelChanges(sent.receipt.logs, this.arena), sent.hash);
    } catch (error) {
      const reason = describeError(error);
      this.d.log.warn({ match: matchId, reason }, "duel opening refused");
      await failMatch(this.d.db, this.d.chainId, matchId, reason);
      return false;
    }
    void this.reveal(matchId).catch((error) =>
      this.d.log.warn({ match: matchId, err: describeError(error) }, "duel reveal failed; the keeper refunds"),
    );
    return true;
  }

  /** The reveal: the cards' windows opened with their line where they aren't yet, then `revealDeck`. */
  private async reveal(matchId: Hex): Promise<void> {
    const m = await duelOf(this.d.db, this.d.chainId, matchId);
    if (m?.state !== "sealed") return;
    const cards = m.cards.map((c) => c.windowId) as [Hex, Hex, Hex];
    const legs: LegWindow[] = [];
    for (const c of m.cards) {
      if (await this.d.relay.openPrintRecorded(c.windowId)) continue;
      legs.push(await this.cardWindow(c));
    }
    const revealData = revealDeckCallData(matchId, m.server_seed as Hex, cards);
    let to: Address = this.arena;
    let data: Hex = revealData;
    if (legs.length > 0) {
      await untilChainReaches(Math.max(...legs.map((l) => l.start)));
      to = MULTICALL3;
      data = openCardsAndRevealData(this.d.chainId, legs, revealData);
    }
    const sent = await retryWhileEarly(() =>
      this.d.lane.run((sender) => sendTx(sender, { to, data, action: "duelReveal", meta: { match: matchId } })),
    );
    if (sent.stage === "reverted") throw new Error(`reveal reverted in ${sent.hash}`);
    await applyDuelChanges(this.d.db, this.d.chainId, duelChanges(sent.receipt.logs, this.arena), sent.hash);
    this.d.log.info({ actor: "duel", why: "reveal", match: matchId, tx: sent.hash }, "deck revealed");
  }

  private async cardWindow(c: DuelCardRef): Promise<LegWindow> {
    const market = marketOf(c.symbol);
    const open = await this.d.gateway.printAt(feedIdOf(market), c.start, REVEAL_PRINT_WAIT_MS);
    if (!open) throw new Error(`${c.symbol}'s opening price is not available`);
    return {
      seriesId: c.seriesId,
      windowId: c.windowId,
      start: c.start,
      expiry: c.expiry,
      verifier: verifierOf(this.d.chainId, market),
      feedId: feedIdOf(market),
      proof: proofOf(market, open.updates),
    };
  }

  // ------------------------------------------------------------------------------------------------ picks

  /** Checks a swipe against the match and queues it on the player's lane; its progress reaches both streams. */
  async pick(req: DuelPickRequest, seatKeyOf: (m: DuelWithPicks, player: string) => Promise<string | null>) {
    const { pick } = req;
    const player = pick.player.toLowerCase();
    const m = await duelOf(this.d.db, this.d.chainId, pick.matchId);
    if (!m) throw bad("no such duel");
    if (m.state !== "picking" || nowSec() > Number(m.pick_deadline)) throw bad("picks are closed for this duel");
    if (player !== m.player_a && player !== m.player_b) throw bad("not a player in this duel");
    const card = m.cards[pick.card];
    if (!card) throw bad("no such card");
    if (pick.band !== BAND_INDEX.up && pick.band !== BAND_INDEX.down) throw bad("a duel card is Up or Down");
    if (nowSec() + LOCKOUT_SEC >= card.expiry) throw bad("this card's window is closing");
    if (m.picks.some((p) => p.card === pick.card && p.player === player)) throw bad("already picked");
    const signer = (await duelPickSigner(this.d.chainId, pick, req.signature)).toLowerCase();
    if (signer !== player && signer !== (await seatKeyOf(m, player))) throw bad("not signed by the player or the key");
    const key = `${pick.matchId}:${pick.card}:${player}`;
    if (this.placing.has(key)) return { state: "received" as const };
    this.placing.add(key);
    void this.d.relay
      .laneFor(pick.player)
      .run(() => this.place(req, card))
      .catch((error) => {
        const reason = describeError(error);
        this.d.log.warn({ match: pick.matchId, card: pick.card, reason }, "duel pick failed");
        this.d.bus.emit(`user:${player}`, "duelPick", { matchId: pick.matchId, card: pick.card, failed: reason });
      })
      .finally(() => this.placing.delete(key));
    return { state: "received" as const };
  }

  private async place(req: DuelPickRequest, card: DuelCardRef): Promise<void> {
    const sent = await retryWhileEarly(() =>
      this.d.relay.laneFor(req.pick.player).run((sender) =>
        sendTx(sender, {
          to: this.arena,
          data: duelPickCallData(req.pick, req.signature),
          action: "duelPick",
          meta: { match: req.pick.matchId, card: String(req.pick.card) },
        }),
      ),
    );
    if (sent.stage === "reverted") throw new Error(`pick reverted in ${sent.hash}`);
    const reserve = addressOf(this.d.chainId, "BandReserve");
    const window = { windowId: card.windowId, seriesId: card.seriesId, start: card.start, expiry: card.expiry };
    const tickets = ticketChanges(sent.receipt.logs, reserve);
    await applyTicketChanges(this.d.db, this.d.chainId, tickets, async () => window, sent.hash);
    await applyDuelChanges(this.d.db, this.d.chainId, duelChanges(sent.receipt.logs, this.arena), sent.hash);
    const committed = tickets.find((t) => t.kind === "committed");
    if (committed?.kind === "committed") {
      this.d.relay.fills.add(feedIdOf(marketOf(card.symbol)), committed.target, {
        ticketId: committed.ticketId,
        owner: this.arena,
        window,
      });
    }
  }

  /** A pick's call filled or was refused (the ticket is the arena's): both players' streams hear of it. */
  async onTicket(n: TicketNotice): Promise<void> {
    if (n.owner !== this.arena.toLowerCase() || (n.change !== "filled" && n.change !== "refused")) return;
    const pick = await duelPickByTicket(this.d.db, this.d.chainId, BigInt(n.ticketId));
    if (!pick) return;
    await announce(
      this.d.db,
      this.d.chainId,
      pick.match_id,
      n.change === "filled" ? "pickFilled" : "pickRefused",
      null,
    );
  }
}

function marketOf(symbol: string) {
  const market = MARKETS.find((m) => m.symbol === symbol);
  if (!market) throw new Error(`${symbol} is not in the catalogue`);
  return market;
}
