import { randomInt } from "node:crypto";
import { ARCADE_TAPE_CUT_SEC, ARCADE_TAPE_MINUTES, ARCADE_TAPE_SYMBOLS, feedIdOf } from "@senryo/config";
import { type Db, nowSec, saveArcadeTape } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";

/**
 * Line Rider's price tapes (R7.2, D-318): a market's last day of 1-minute closes from the archive, as moves in tenths
 * of a basis point — the terrain the sled rides. Cut on a quarter-hour boundary and built once per cut per market; a
 * tape is stored when a seed is issued with it, so the replay reads back exactly the line the run was played on.
 */
export interface ArcadeTape {
  id: string;
  symbol: string;
  /** The first close's minute (unix seconds) and price (× 1e8), for the HUD. */
  from: number;
  openE8: bigint;
  moves: number[];
}

const MINUTE_SEC = 60;
/** Tenths of a basis point per unit. */
const MOVE_UNITS = 100_000n;

export class ArcadeTapes {
  private readonly built = new Map<string, { cut: number; tape: ArcadeTape }>();
  private readonly saved = new Set<string>();

  constructor(
    private readonly gateway: PythGateway,
    private readonly db: Db,
  ) {}

  /** A tape for a run: one of the markets at random, as of the last cut. */
  pick(): Promise<ArcadeTape> {
    return this.of(ARCADE_TAPE_SYMBOLS[randomInt(ARCADE_TAPE_SYMBOLS.length)] as string);
  }

  /** The tape, kept so a seed can name it. */
  async keep(tape: ArcadeTape): Promise<void> {
    if (this.saved.has(tape.id)) return;
    await saveArcadeTape(this.db, { ...tape, fromMinute: tape.from });
    this.saved.add(tape.id);
  }

  private async of(symbol: string): Promise<ArcadeTape> {
    const cut = Math.floor(nowSec() / ARCADE_TAPE_CUT_SEC) * ARCADE_TAPE_CUT_SEC;
    const hit = this.built.get(symbol);
    if (hit?.cut === cut) return hit.tape;
    const feed = this.gateway.feedOf(symbol);
    const rows = feed
      ? await this.gateway.candles(feedIdOf(feed.market), cut - ARCADE_TAPE_MINUTES * MINUTE_SEC, cut)
      : [];
    const moves: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = (rows[i - 1] as { close: bigint }).close;
      const next = (rows[i] as { close: bigint }).close;
      if (prev > 0n) moves.push(Number(((next - prev) * MOVE_UNITS) / prev));
    }
    const from = rows[0] ? Number(rows[0].minute) : cut;
    const tape = { id: `${symbol}:${from}`, symbol, from, openE8: rows[0]?.close ?? 0n, moves };
    this.built.set(symbol, { cut, tape });
    return tape;
  }
}
