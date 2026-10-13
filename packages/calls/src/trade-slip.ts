/**
 * The trade slip (R5.11, D-331; Codex direction 12): one paper for a call or a ride — the folio from its id, what it
 * was, the realised figure once it has ended (what it pays, or the margin, while live), the stamp with its verdict in
 * words, at most three facts (D-351), and the proof. The same slip is drawn on screen, saved as a PNG and shared. Amounts are marked so
 * hidden balances can mask them (`maskedSlip`) while prices, timing and the folio stay.
 */
import type { CallTimeline, RideView } from "@senryo/api-client";
import { type ChainId, explorerTxUrl, WEB_ORIGIN } from "@senryo/config";
import { lane, OPEN_STATES, priceText, sideName, signedUsd, usd, whenText } from "@senryo/core";
import { proofLink } from "./links.ts";
import { unitOf } from "./markets.ts";
import { callWhere, receiptFacts } from "./receipt.ts";

export type StampTone = "up" | "down" | "even";

/** The stamp's words, one per line ("Cashed out" / "Gain"), and the tone of the result it seals. */
export interface SlipStamp {
  lines: readonly string[];
  tone: StampTone;
}

export interface SlipFact {
  k: string;
  v: string;
  /** An amount of money: masked while balances are hidden. */
  money: boolean;
}

export interface TradeSlip {
  kind: "call" | "ride";
  symbol: string;
  /** "N° C-10143-001019": the network and the id, never a hash. */
  folio: string;
  /** "BTC · Up · 1m" / "BTC · Up · Ride". */
  title: string;
  /** "Practice · test dollars" / "Real · USDC". */
  mode: string;
  live: boolean;
  /** The realised result once ended; what it pays (a call) or its margin (a ride) while live. */
  figure: { label: string; text: string; tone: "up" | "down" | "ink"; money: boolean };
  /** When it ended (null while live). */
  when: string | null;
  stamp: SlipStamp | null;
  facts: SlipFact[];
  proof: { label: string; href: string } | null;
  /** The slip's own link (the QR on the saved image). */
  url: string;
}

const FOLIO_DIGITS = 6;
const BPS_PER_X = 10_000;
const MONEY_FACTS = new Set(["Stake", "Margin"]);
const LIVE_RIDE = new Set(["committed", "open", "closing"]);
const MS = 1_000;

export const folioOf = (kind: "call" | "ride", chainId: ChainId, id: bigint): string =>
  `N° ${kind === "call" ? "C" : "R"}-${chainId}-${id.toString().padStart(FOLIO_DIGITS, "0")}`;

const modeOf = (practice: boolean) => (practice ? "Practice · test dollars" : "Real · USDC");
const toneOfNet = (net: bigint): StampTone => (net > 0n ? "up" : net < 0n ? "down" : "even");
const signedWord = (net: bigint) => (net > 0n ? "Gain" : net < 0n ? "Loss" : "Even");
const figureTone = (net: bigint) => (net > 0n ? "up" : net < 0n ? "down" : "ink") as "up" | "down" | "ink";

/** A ride's public link: the web shows its slip to anyone at `/ride?id=…&chainId=…`. */
export function rideLink(rideId: bigint, chainId: ChainId): string {
  const query = new URLSearchParams({ id: String(rideId), chainId: String(chainId) });
  return `${WEB_ORIGIN}/ride?${query.toString()}`;
}

function callStamp(c: CallTimeline["call"]): SlipStamp | null {
  const net = c.pnl === null ? 0n : BigInt(c.pnl);
  if (c.status === "refunded" || c.outcome === "refund") return { lines: ["Refunded"], tone: "even" };
  if (c.status === "closed") return { lines: ["Cashed out", signedWord(net)], tone: toneOfNet(net) };
  if (c.status !== "settled") return null;
  return c.outcome === "win" ? { lines: ["Won"], tone: "up" } : { lines: ["Lost"], tone: "down" };
}

export function callSlip(
  t: CallTimeline,
  ctx: { chainId: ChainId; practice: boolean; kE8?: bigint | undefined; url: string },
): TradeSlip {
  const c = t.call;
  const live = OPEN_STATES.has(c.status);
  const filled = t.events.find((e) => e.kind === "filled");
  const net = c.pnl === null ? 0n : BigInt(c.pnl);
  const last = t.events.at(-1);
  return {
    kind: "call",
    symbol: c.symbol,
    folio: folioOf("call", ctx.chainId, c.ticketId),
    title: `${c.symbol} · ${sideName(c.band)} · ${lane(c.cadenceSec)}`,
    mode: modeOf(ctx.practice),
    live,
    figure: live
      ? { label: "Pays if right", text: filled ? usd(filled.amount) : usd(c.stake), tone: "ink", money: true }
      : { label: "Realised", text: c.pnl === null ? "—" : signedUsd(net), tone: figureTone(net), money: true },
    when: live || !last ? null : whenText(last.at),
    stamp: live ? null : callStamp(c),
    facts: receiptFacts(t, callWhere(c, ctx.kE8)).map(([k, v]) => ({ k, v, money: MONEY_FACTS.has(k) })),
    proof: { label: "The window, proved", href: proofLink(c.windowId, ctx.chainId) },
    url: ctx.url,
  };
}

/** A ride's realised result: PnL over every part, less the close fees and the open fee (D-327). */
export const rideNet = (r: RideView): bigint => (r.pnl ?? 0n) - r.fees - r.openFee;

function rideStamp(r: RideView): SlipStamp | null {
  const net = rideNet(r);
  switch (r.state) {
    case "refunded":
      return { lines: ["Refunded"], tone: "even" };
    case "knocked_out":
      return { lines: ["Knocked out"], tone: "down" };
    case "capped":
      return { lines: ["Capped"], tone: "up" };
    case "ended":
      return { lines: ["Ended"], tone: toneOfNet(net) };
    case "closed":
      return { lines: ["Closed", net > 0n ? "Up" : net < 0n ? "Down" : "Even"], tone: toneOfNet(net) };
    default:
      return null;
  }
}

export function rideSlip(r: RideView, ctx: { chainId: ChainId; practice: boolean; url: string }): TradeSlip {
  const live = LIVE_RIDE.has(r.state);
  const unit = unitOf(r.symbol);
  const margin = r.marginOpen ?? (live ? r.margin : null);
  const price = (e8: bigint | null) => (e8 === null ? "—" : priceText(e8, unit));
  const net = rideNet(r);
  // Three facts (D-351): what went in, the multiple, and the price it entered at — to where it left once ended. The
  // knock-out and cap are drawn on the replay, the fees are inside the realised figure.
  const entry = r.entryE8 === null ? "At the next print" : price(r.entryE8);
  const facts: SlipFact[] = [
    { k: "Margin", v: margin === null ? "—" : usd(margin), money: true },
    { k: "Leverage", v: `${r.leverageBps / BPS_PER_X}×`, money: false },
    {
      k: "Entry",
      v: live || r.entryE8 === null || r.exitE8 === null ? entry : `${entry} → ${price(r.exitE8)}`,
      money: false,
    },
  ];
  return {
    kind: "ride",
    symbol: r.symbol,
    folio: folioOf("ride", ctx.chainId, r.rideId),
    title: `${r.symbol} · ${r.isLong ? "Up" : "Down"} · Ride`,
    mode: modeOf(ctx.practice),
    live,
    figure: live
      ? { label: "Margin", text: margin === null ? "—" : usd(margin), tone: "ink", money: true }
      : { label: "Realised", text: signedUsd(net), tone: figureTone(net), money: true },
    when: live ? null : whenText(Math.floor(Date.parse(r.updatedAt) / MS)),
    stamp: live ? null : rideStamp(r),
    facts,
    proof: r.lastTx ? { label: "On the explorer", href: explorerTxUrl(ctx.chainId, r.lastTx) } : null,
    url: ctx.url,
  };
}

/** The slip with its amounts masked (balances hidden, R5.14): the verdict, prices, timing and folio stay. */
export function maskedSlip(s: TradeSlip, mask: string): TradeSlip {
  return {
    ...s,
    figure: s.figure.money ? { ...s.figure, text: mask } : s.figure,
    facts: s.facts.map((f) => (f.money ? { ...f, v: mask } : f)),
  };
}
