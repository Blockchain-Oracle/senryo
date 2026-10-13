/**
 * A receipt's replay film, built from its records (Q3, D-350; Codex direction 17 §2): the call timeline or the ride, and
 * the path this device recorded while it was open. Gives the film's input (IN at the fill with what went in, OUT at the
 * exit with how it ended and what came back; the line and the winning zone, or the entry, knock-out and cap; the ROI
 * denominator; the verdict) and the few words around it (the market and its "↑ 10×" tag, the date, Practice, three
 * stats with the exit's value held back until OUT). Null without a recording: "Replay unavailable".
 */
import type { CallTimeline, RideView } from "@senryo/api-client";
import { bandMenu, MARKETS } from "@senryo/config";
import { bandEdgesE8, lane, priceText, sideName, usd } from "@senryo/core";
import type { FilmInput, FilmLevel, FilmMoment, FilmProvenance } from "./film.ts";
import { unitOf } from "./markets.ts";
import { coverage, type Episode, replayable } from "./replay.ts";
import { rideNet } from "./trade-slip.ts";

const MS = 1_000;
const E6 = 1e6;
const E8 = 1e8;
const PERCENT = 100;
const BPS_PER_X = 10_000;
const FULL = 0.98;

export type FilmZone = "up" | "down" | "range" | "beyond-high" | "beyond-low" | null;

export interface FilmCopy {
  market: string;
  /** The side and size beside the market: "↑ 10×", "↓ 5m", "Range 5m". */
  tag: string;
  date: string;
  /** "Practice" for test dollars, empty for real money. */
  mode: string;
  /** Three stats; the last one's value shows only once the film reaches OUT. */
  stats: readonly (readonly [string, string])[];
  zone: FilmZone;
}

export interface ReceiptFilm {
  input: FilmInput;
  copy: FilmCopy;
}

const num8 = (e8: bigint | null | undefined) => (e8 === null || e8 === undefined ? null : Number(e8) / E8);
/**
 * Dollars as a plain number, for the film's geometry and its ROI only: what it shows goes back through the exact bigint
 * formatters, and the landed result is the trade record's own figure (doubles hold 6-decimal amounts exactly).
 */
const drawnDollars = (units: bigint | string): number => Number(units) / E6;
const day = (ms: number) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
const modeOf = (practice: boolean) => (practice ? "Practice" : "");
const marketName = (symbol: string) => MARKETS.find((m) => m.symbol === symbol)?.name ?? symbol;

function provenanceOf(e: Episode): FilmProvenance {
  if (!replayable(e)) return { kind: "partial", coveragePct: Math.round(coverage(e) * PERCENT) };
  const pct = coverage(e);
  return pct >= FULL ? { kind: "recorded" } : { kind: "partial", coveragePct: Math.round(pct * PERCENT) };
}

const CLOSED_BY: Record<string, string> = { "take-profit": "TAKE PROFIT", "stop-loss": "STOP", trail: "TRAIL" };

export function callFilm(
  t: CallTimeline,
  episode: Episode | null,
  ctx: { practice: boolean; kE8?: bigint | undefined },
): ReceiptFilm | null {
  const c = t.call;
  const filled = t.events.find((e) => e.kind === "filled");
  if (!episode || episode.samples.length < 2 || !filled || c.entryE8 === null) return null;
  const unit = unitOf(c.symbol);
  const fillMs = filled.at * MS;
  const entry = Number(c.entryE8) / E8;
  const cashed = t.events.findLast((e) => e.kind === "cashed out");
  const settled = t.events.findLast((e) => e.kind.startsWith("settled") || e.kind === "refunded");
  const end = cashed ?? settled;
  const lastPrice = episode.samples.at(-1)?.[1] ?? entry;
  const exit = end ? { ms: end.at * MS, price: num8(end.priceE8) ?? lastPrice } : null;
  const realised = c.pnl === null ? null : drawnDollars(c.pnl);
  const verdict =
    c.outcome === "refund" || c.status === "refunded"
      ? "refund"
      : cashed
        ? (realised ?? 0) >= 0
          ? "win"
          : "loss"
        : c.outcome === "win"
          ? "win"
          : c.outcome === "lose"
            ? "loss"
            : null;
  const market = MARKETS.find((m) => m.symbol === c.symbol);
  const cadence = market?.cadences.find((x) => x === c.cadenceSec);
  const band = market && cadence ? bandMenu(market, cadence)[c.band] : undefined;
  const levels: FilmLevel[] = [];
  let zone: FilmZone = null;
  const k = ctx.kE8;
  if (k !== undefined) levels.push({ kind: "line", price: Number(k) / E8 });
  if (band && k !== undefined) {
    const edges = bandEdgesE8(band, k);
    if (edges.low !== null) levels.push({ kind: "low", price: Number(edges.low) / E8 });
    if (edges.high !== null) levels.push({ kind: "high", price: Number(edges.high) / E8 });
    zone =
      band.kind === "up"
        ? "up"
        : band.kind === "down"
          ? "down"
          : band.kind === "range"
            ? "range"
            : band.kind === "moonshot"
              ? "beyond-high"
              : "beyond-low";
  }
  const title = verdict === "refund" ? "REFUND" : cashed ? (CLOSED_BY[c.closedBy ?? ""] ?? "CASH OUT") : "SETTLED";
  const moments: FilmMoment[] = [{ kind: "in", ms: fillMs, price: entry, title: "OPEN", amount: String(c.stake) }];
  if (exit) {
    const back = c.pnl === null ? null : String(c.stake + BigInt(c.pnl));
    moments.push({ kind: "out", ms: exit.ms, price: exit.price, title, amount: back });
  }
  const live = !end;
  return {
    input: {
      kind: "call",
      symbol: c.symbol,
      up: band?.kind === "up" ? true : band?.kind === "down" ? false : null,
      samples: episode.samples,
      fillMs,
      exit,
      cost: drawnDollars(c.stake),
      realised: live ? null : realised,
      verdict,
      moments,
      levels,
      provenance: provenanceOf(episode),
    },
    copy: {
      market: marketName(c.symbol),
      tag: `${band?.kind === "up" ? "↑" : band?.kind === "down" ? "↓" : sideName(c.band)} ${lane(c.cadenceSec)}`,
      date: day(fillMs),
      mode: modeOf(ctx.practice),
      stats: [
        ["Stake", usd(c.stake)],
        ["Entry", priceText(c.entryE8, unit)],
        [cashed ? "Exit" : "Close", exit ? priceText(BigInt(Math.round(exit.price * E8)), unit) : "—"],
      ],
      zone,
    },
  };
}

const RIDE_ENDED = new Set(["refunded", "knocked_out", "capped", "ended", "closed"]);
const RIDE_REASON: Record<string, string> = { knocked_out: "KO", capped: "CAP", ended: "END", refunded: "REFUND" };
/** The ride's fired exit kinds (contract order): take profit, stop, trail. */
const FIRED = ["TAKE PROFIT", "STOP", "TRAIL"] as const;

export function rideFilm(r: RideView, episode: Episode | null, ctx: { practice: boolean }): ReceiptFilm | null {
  if (!episode || episode.samples.length < 2 || r.filledAt === null || r.entryE8 === null) return null;
  const unit = unitOf(r.symbol);
  const fillMs = r.filledAt * MS;
  const entry = Number(r.entryE8) / E8;
  const ended = RIDE_ENDED.has(r.state);
  const exitMs = ended ? Date.parse(r.updatedAt) : null;
  const exitPrice = num8(r.exitE8) ?? episode.samples.at(-1)?.[1] ?? entry;
  const exit = exitMs === null ? null : { ms: exitMs, price: exitPrice };
  const net = rideNet(r);
  const realised = ended ? drawnDollars(net) : null;
  const margin = r.marginOpen ?? r.margin;
  const fired = r.exit?.firedKind;
  const title = RIDE_REASON[r.state] ?? (fired !== null && fired !== undefined ? (FIRED[fired] ?? "CLOSE") : "CLOSE");
  const levels: FilmLevel[] = [{ kind: "entry", price: entry }];
  const ko = num8(r.koE8);
  const cap = num8(r.capE8);
  if (ko !== null) levels.push({ kind: "ko", price: ko });
  if (cap !== null) levels.push({ kind: "cap", price: cap });
  const moments: FilmMoment[] = [{ kind: "in", ms: fillMs, price: entry, title: "OPEN", amount: String(margin) }];
  if (exit) {
    const back = String(margin + r.openFee + net);
    moments.push({ kind: "out", ms: exit.ms, price: exit.price, title, amount: back });
  }
  return {
    input: {
      kind: "ride",
      symbol: r.symbol,
      up: r.isLong,
      samples: episode.samples,
      fillMs,
      exit,
      cost: drawnDollars(margin + r.openFee),
      realised,
      verdict: r.state === "refunded" ? "refund" : !ended ? null : net >= 0n ? "win" : "loss",
      moments,
      levels,
      provenance: provenanceOf(episode),
    },
    copy: {
      market: marketName(r.symbol),
      tag: `${r.isLong ? "↑" : "↓"} ${r.leverageBps / BPS_PER_X}×`,
      date: day(fillMs),
      mode: modeOf(ctx.practice),
      stats: [
        ["Margin", usd(margin)],
        ["Entry", priceText(r.entryE8, unit)],
        ["Exit", exit ? priceText(BigInt(Math.round(exit.price * E8)), unit) : "—"],
      ],
      zone: null,
    },
  };
}
