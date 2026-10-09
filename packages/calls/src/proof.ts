/**
 * The Proof pages, both apps (S7.7, D-288): a feed row's one line, and every band's verdict twice — as the chain
 * recorded it (the window's won / refunded / lost masks) and as recomputed here from its two prints with the
 * contracts' own rule (`bandOutcome`) — so anyone can see they agree.
 */
import type { WindowProof, WindowsPage } from "@senryo/api-client";
import { bandMenu, MARKETS } from "@senryo/config";
import { type BandOutcome, bandName, bandOutcome, bandWhere, gapText, laneLabel } from "@senryo/core";
import { unitOf } from "./markets.ts";

const MS = 1000;
const HHMM = 5;
const TIME_START = 11;

const HHMMSS = 8;

/** "14:05 UTC" for a window start. */
export const utcTime = (sec: number) => `${new Date(sec * MS).toISOString().slice(TIME_START, TIME_START + HHMM)} UTC`;

/** "14:05:00 UTC" for a publish time. */
export const utcClock = (sec: number) =>
  `${new Date(sec * MS).toISOString().slice(TIME_START, TIME_START + HHMMSS)} UTC`;

/** A feed row: "BTC · 1m · 14:05 UTC" and "Closed $12.40 above the line · 8 calls" (or why it has no close). */
export function windowRow(w: WindowsPage["windows"][number]): { title: string; detail: string } {
  const title = `${w.symbol} · ${laneLabel(w.cadenceSec)} · ${utcTime(w.start)}`;
  const calls = `${w.calls} call${w.calls === 1 ? "" : "s"}`;
  if (w.state === "voided") return { title, detail: `Voided · every call refunded · ${calls}` };
  if (w.openE8 === null || w.closeE8 === null) return { title, detail: `Settling · ${calls}` };
  const gap = w.closeE8 - w.openE8;
  const where =
    gap === 0n
      ? "Closed on the line"
      : `Closed ${gapText(gap, w.openE8, unitOf(w.symbol))} ${gap > 0n ? "above" : "below"} the line`;
  return { title, detail: `${where} · ${calls}` };
}

export interface BandVerdict {
  index: number;
  name: string;
  where: string;
  /** What the chain recorded (null while the window isn't resolved). */
  chain: BandOutcome | null;
  /** The same rule applied here to the window's prints. */
  recomputed: BandOutcome | null;
  agrees: boolean;
}

const fromMask = (p: WindowProof, i: number): BandOutcome | null => {
  const bit = 1 << i;
  if (p.wonMask & bit) return "win";
  if (p.refundMask & bit) return "refund";
  if (p.lostMask & bit) return "lose";
  return null;
};

export function bandVerdicts(p: WindowProof): BandVerdict[] {
  const m = MARKETS.find((x) => x.symbol === p.symbol);
  const cadence = m?.cadences.find((c) => c === p.cadenceSec);
  if (!m || !cadence) return [];
  const k = p.open?.priceE8;
  const close = p.close?.priceE8;
  return bandMenu(m, cadence).map((band, index) => {
    const chain = p.state === "resolved" ? fromMask(p, index) : p.state === "voided" ? "refund" : null;
    const recomputed = k !== undefined && close !== undefined ? bandOutcome(band, k, close) : null;
    return {
      index,
      name: bandName(band.kind),
      where: bandWhere(band, k, unitOf(p.symbol)),
      chain,
      recomputed,
      agrees: chain === null || recomputed === null || p.state === "voided" || chain === recomputed,
    };
  });
}

export const OUTCOME_WORD: Readonly<Record<BandOutcome, string>> = { win: "Won", lose: "Lost", refund: "Refunded" };
