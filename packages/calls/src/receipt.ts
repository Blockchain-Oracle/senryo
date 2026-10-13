/**
 * A call's receipt in words, both apps (S5.11 → S6.6): the hero (what it pays while live, the signed result once
 * done), at most three facts (stake, where it wins, entry — D-351), the steps oldest first with their
 * transactions, the share card's words, and the window it lived in proved — the line and close prints with the
 * transactions that posted them, where the close landed, and how the crowd called it. Facts only.
 */
import type { CallTimeline, WindowProof } from "@senryo/api-client";
import { bandMenu, MARKETS } from "@senryo/config";
import { bandWhere, gapText, lane, priceText, SIDE, sideName, stepTitle, usd, whenText } from "@senryo/core";
import { unitOf } from "./markets.ts";

const FAILED_KINDS = new Set(["refused", "close refused", "settled: lose"]);
const PERCENT = 100n;
const MS = 1_000;

export interface Step {
  key: string;
  title: string;
  when: string;
  /** done: happened · failed: refused or lost · running: waiting for the next fact. */
  state: "done" | "failed" | "running";
  tone?: "up" | "down";
  txHash?: string;
}

export function receiptSteps(t: CallTimeline): Step[] {
  const steps: Step[] = t.events.map((e, i) => ({
    key: `${e.txHash}-${i}`,
    title: stepTitle(e.kind, e.amount, e.priceE8),
    when: whenText(e.at),
    state: FAILED_KINDS.has(e.kind) ? "failed" : "done",
    ...(e.kind === "settled: win" ? { tone: "up" as const } : {}),
    ...(e.kind === "settled: lose" ? { tone: "down" as const } : {}),
    txHash: e.txHash,
  }));
  const c = t.call;
  const expiry = c.start + c.cadenceSec;
  if (c.status === "committed")
    steps.push({ key: "waiting", title: "Waiting for the fill", when: "About 2 s", state: "running" });
  else if (c.status === "closing")
    steps.push({ key: "waiting", title: "Cashing out", when: "At the next print", state: "running" });
  else if (c.status === "open")
    steps.push({ key: "waiting", title: "Waiting for the close", when: whenText(expiry), state: "running" });
  return steps;
}

/**
 * Where a Range, Moonshot or Crash call wins ("between $81,700.12 and $81,760.40") — its band from the catalogue's menu
 * (the one on chain), its edges from the window's line once known. Null for Up and Down (the title says it).
 */
export function callWhere(c: CallTimeline["call"], kE8: bigint | undefined): string | null {
  const m = MARKETS.find((x) => x.symbol === c.symbol);
  const cadence = m?.cadences.find((x) => x === c.cadenceSec);
  const band = m && cadence ? bandMenu(m, cadence)[c.band] : undefined;
  if (!band || band.kind === "up" || band.kind === "down") return null;
  return bandWhere(band, kE8, unitOf(c.symbol));
}

/**
 * A call receipt's facts (D-351, the owner's review): what went in, where it wins when that isn't in the title, and
 * the price it entered at — to where it was cashed out, if it was. Three at most; the figure, the stamp and the replay
 * say the rest. ("Pays if right", "Came back" and "Signed with" are gone: a reader doesn't need them.)
 */
export function receiptFacts(t: CallTimeline, where: string | null = null): [label: string, value: string][] {
  const c = t.call;
  const exit = t.events.findLast((e) => e.kind === "cashed out");
  const unit = unitOf(c.symbol);
  const entry = c.entryE8 === null ? "At the next print" : priceText(c.entryE8, unit);
  return [
    ["Stake", usd(c.stake)],
    ...(where ? ([["Wins if", `it closes ${where}`]] as [string, string][]) : []),
    ["Entry", exit?.priceE8 && c.entryE8 !== null ? `${entry} → ${priceText(exit.priceE8, unit)}` : entry],
  ];
}

export const callTitle = (c: CallTimeline["call"]) => `${c.symbol} ${sideName(c.band)} · ${lane(c.cadenceSec)}`;

// ------------------------------------------------------------------------------------------------ the window proved

export interface ProofFact {
  label: string;
  value: string;
  detail?: string;
  tx?: string | null;
}

/**
 * "Up 52% · Down 31% · Range 17%": every band holding stake, in menu order, as whole percents that add to 100 (largest
 * remainder); "No calls" when nobody called.
 */
export function crowdText(p: WindowProof): string {
  const total = p.bandStake.reduce((a, b) => a + b, 0n);
  if (total === 0n) return "No calls";
  const held = p.bandStake.map((stake, band) => ({ band, stake })).filter((b) => b.stake > 0n);
  const shares = held.map((b) => ({ ...b, pct: (b.stake * PERCENT) / total, rest: (b.stake * PERCENT) % total }));
  let left = PERCENT - shares.reduce((a, b) => a + b.pct, 0n);
  for (const s of [...shares].sort((a, b) => (b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : 0))) {
    if (left <= 0n) break;
    s.pct += 1n;
    left -= 1n;
  }
  return shares.map((s) => `${SIDE[s.band] ?? `Band ${s.band}`} ${s.pct}%`).join(" · ");
}

function whereText(gap: bigint, lineE8: bigint, symbol: string): string {
  if (gap === 0n) return "Closed on the line";
  return `Closed ${gapText(gap, lineE8, unitOf(symbol))} ${gap > 0n ? "above" : "below"} the line`;
}

/**
 * Settlement posts the close only while calls ride the window; with none left it never will, so the archived print
 * (the same unique print settlement would have used) stands in, said as such. Ask for it when this is true.
 */
export const closeUnposted = (p: WindowProof, nowMs = Date.now()): boolean =>
  nowMs / MS > p.expiry && !p.close && p.state === "open" && p.liveCalls === 0;

export function proofFacts(
  p: WindowProof,
  archive: { priceE8: number | string; publishTime: number } | undefined,
  nowMs = Date.now(),
): { heading: string; facts: ProofFact[] } {
  const ended = nowMs / MS > p.expiry;
  const unposted = closeUnposted(p, nowMs);
  const open = p.open;
  const closeE8 = p.close ? p.close.priceE8 : unposted && archive ? BigInt(archive.priceE8) : null;
  const gap = open && closeE8 !== null ? closeE8 - open.priceE8 : null;
  const closeDetail = p.close
    ? `Pyth print · ${whenText(p.close.publishTime)}`
    : p.state === "voided"
      ? "No print came · every call refunded"
      : unposted
        ? archive
          ? `Pyth print · ${whenText(archive.publishTime)} · not posted on chain: no call was still open`
          : "Not posted on chain: no call was still open"
        : ended
          ? "Settling…"
          : `Closes at ${whenText(p.expiry)}`;
  const facts: ProofFact[] = [
    {
      label: "Line",
      value: open ? priceText(open.priceE8, unitOf(p.symbol)) : "—",
      detail: open ? `Pyth print · ${whenText(open.publishTime)}` : "Set by the first print",
      tx: open?.txHash ?? null,
    },
    {
      label: "Close",
      value: closeE8 !== null ? priceText(closeE8, unitOf(p.symbol)) : "—",
      detail: closeDetail,
      tx: p.close?.txHash ?? null,
    },
    ...(gap !== null && open ? [{ label: "Result", value: whereText(gap, open.priceE8, p.symbol) }] : []),
    {
      label: "Crowd",
      value: crowdText(p),
      detail: `${p.calls} ${p.calls === 1 ? "call" : "calls"} · ${usd(p.volume)} staked`,
    },
    ...(p.settledTx ? [{ label: "Settled", value: "Paid out", detail: "Every call in it", tx: p.settledTx }] : []),
  ];
  return { heading: `${whenText(p.start)} → ${whenText(p.expiry)}`, facts };
}
