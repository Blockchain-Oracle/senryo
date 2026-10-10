import { randomBytes, randomUUID } from "node:crypto";
import {
  type Address,
  type Hex,
  luckyCommitmentOf,
  luckyDigestOf,
  luckyMarketsHashOf,
  seriesIdOf,
  windowIdOf,
} from "@senryo/chain";
import {
  BAND_INDEX,
  type BandKind,
  bandMenu,
  CALENDARS,
  type CadenceSec,
  type ChainId,
  feedIdOf,
  LOCKOUT_SEC,
  type MarketSpec,
  marketsOn,
  POOL_TERMS,
  sigmaE8Of,
} from "@senryo/config";
import {
  chooseLucky,
  LUCKY_CADENCES,
  LUCKY_MIN_HEADROOM_SEC,
  LUCKY_SEAL_TTL_SEC,
  type LuckyQuoted,
  type LuckySide,
  luckyDrawOf,
  quoteOpen,
  scheduleOf,
  sessionCovers,
} from "@senryo/core";
import {
  type Db,
  insertLuckySeal,
  type LuckyDealt,
  luckyDrawById,
  nowSec,
  recentLuckySeals,
  recordLuckyReveal,
} from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { toE8 } from "../prices/ring.ts";
import { bad } from "../relay/gates.ts";

/**
 * Lucky's server half (S8.8, D-295): the seal (a fresh server seed committed, with the markets trading right now as the
 * list a draw indexes into) and the reveal (the player's seed in, the digest out, the draw, and the deal — the running
 * window and band on the drawn side whose price sits nearest 1 / reach). The call itself is an ordinary signed call
 * through the relay; nothing here touches money.
 */
const SEED_BYTES = 32;
/** A player may spin this often an hour (Owarine's limit). */
const SPINS_PER_HOUR = 120;
const HOUR_SEC = 3600;
/** A price older than this leaves its market out of the list. */
const PRICE_FRESH_SEC = 30;
/** How long the reveal waits for a window's opening price. */
const OPEN_PRINT_WAIT_MS = 1_500;
/** Every band is priced for a one-dollar stake: the price per share is what the choice compares. */
const UNIT_STAKE = 1_000_000n;
const MS_PER_SEC = 1000;

const SIDE_BANDS: Readonly<Record<LuckySide, readonly BandKind[]>> = {
  up: ["up", "moonshot"],
  down: ["down", "crash"],
};

export interface LuckySeal {
  drawId: string;
  commitment: Hex;
  markets: string[];
  marketsHash: Hex;
  expiresAt: number;
}

export interface LuckyReveal {
  drawId: string;
  serverSeed: Hex;
  clientSeed: Hex;
  digest: Hex;
  symbol: string;
  side: LuckySide;
  reach: number;
  dealt: LuckyDealt | null;
}

export class LuckyDesk {
  constructor(private readonly d: { chainId: ChainId; gateway: PythGateway; db: Db }) {}

  /** Markets a draw may land on now: in session for a dealable window, with a fresh price. */
  private tradingNow(now: number): MarketSpec[] {
    return marketsOn(this.d.chainId).filter((m) => {
      const latest = this.d.gateway.latestE8(feedIdOf(m));
      if (!latest || now - latest.publishTime > PRICE_FRESH_SEC) return false;
      return LUCKY_CADENCES.some((c) => this.window(m, c, now) !== null);
    });
  }

  /** The running window of a cadence when it has room for a signature and the fill before its lockout. */
  private window(m: MarketSpec, cadence: number, now: number): { start: number; expiry: number } | null {
    if (!m.cadences.includes(cadence as CadenceSec)) return null;
    const start = now - (now % cadence);
    const expiry = start + cadence;
    if (expiry - now < LUCKY_MIN_HEADROOM_SEC + LOCKOUT_SEC) return null;
    return sessionCovers(scheduleOf(CALENDARS[m.calendarId].schedule), start, expiry) ? { start, expiry } : null;
  }

  async seal(owner: Address): Promise<LuckySeal> {
    if ((await recentLuckySeals(this.d.db, owner, HOUR_SEC)) >= SPINS_PER_HOUR) {
      throw bad("that's a lot of spins · try again in a little while");
    }
    const now = nowSec();
    const markets = this.tradingNow(now).map((m) => m.symbol);
    if (markets.length === 0) throw bad("no market has a window to deal right now");
    const serverSeed = `0x${randomBytes(SEED_BYTES).toString("hex")}` as Hex;
    const seal: LuckySeal = {
      drawId: randomUUID(),
      commitment: luckyCommitmentOf(serverSeed),
      markets,
      marketsHash: luckyMarketsHashOf(markets),
      expiresAt: now + LUCKY_SEAL_TTL_SEC,
    };
    await insertLuckySeal(this.d.db, this.d.chainId, { ...seal, owner, serverSeed });
    return seal;
  }

  async reveal(drawId: string, owner: Address, clientSeed: Hex): Promise<LuckyReveal> {
    const row = await luckyDrawById(this.d.db, this.d.chainId, drawId);
    if (!row || row.owner !== owner.toLowerCase()) throw bad("no such draw for this account");
    if (row.revealed_at) throw bad("this draw was already revealed");
    const now = nowSec();
    if (now - Math.floor(row.sealed_at.getTime() / MS_PER_SEC) > LUCKY_SEAL_TTL_SEC)
      throw bad("this draw expired · spin again");
    const serverSeed = row.server_seed as Hex;
    const digest = luckyDigestOf(serverSeed, clientSeed, owner, row.markets_hash as Hex);
    const draw = luckyDrawOf(BigInt(digest), row.markets);
    const dealt = await this.deal(draw.symbol, draw.side, draw.reach, now);
    const recorded = await recordLuckyReveal(this.d.db, this.d.chainId, drawId, { clientSeed, digest, ...draw, dealt });
    if (!recorded) throw bad("this draw was already revealed");
    return { drawId, serverSeed, clientSeed, digest, ...draw, dealt };
  }

  /** The running window and band on the drawn side whose price per share is nearest 1 / reach. */
  private async deal(symbol: string, side: LuckySide, reach: number, now: number): Promise<LuckyDealt | null> {
    const m = marketsOn(this.d.chainId).find((x) => x.symbol === symbol);
    const spot = m && this.d.gateway.latestE8(feedIdOf(m));
    if (!m || !spot) return null;
    const terms = POOL_TERMS[this.d.chainId];
    const quoteTerms = {
      halfSpreadE6: BigInt(terms.halfSpreadE6),
      minProbE6: BigInt(terms.minProbE6),
      maxProbE6: BigInt(terms.maxProbE6),
      surchargeE6: 0n,
    };
    const quotes: (LuckyQuoted & { cadenceSec: number; start: number })[] = [];
    for (const cadence of LUCKY_CADENCES) {
      const w = this.window(m, cadence, now);
      if (!w) continue;
      const open = await this.d.gateway.printAt(feedIdOf(m), w.start, OPEN_PRINT_WAIT_MS);
      if (!open) continue;
      const window = {
        openE8: toE8(open.price, open.expo),
        sigmaE8: BigInt(sigmaE8Of(m)),
        tauSec: BigInt(w.expiry - now),
      };
      const menu = bandMenu(m, cadence as CadenceSec);
      const windowId = windowIdOf(seriesIdOf(m.symbol, cadence), w.start);
      for (const kind of SIDE_BANDS[side]) {
        const band = BAND_INDEX[kind];
        const shape = menu[band];
        if (!shape) continue;
        const q = quoteOpen(shape, window, spot.priceE8, UNIT_STAKE, quoteTerms);
        if (q.refusal) continue;
        quotes.push({ windowId, band, expirySec: w.expiry, priceE6: q.priceE6, cadenceSec: cadence, start: w.start });
      }
    }
    const best = chooseLucky(quotes, reach);
    if (!best) return null;
    return {
      windowId: best.windowId,
      symbol,
      cadenceSec: best.cadenceSec,
      start: best.start,
      expiry: best.expirySec,
      band: best.band,
      priceE6: best.priceE6.toString(),
    };
  }
}
