/**
 * The terminal's call flow, both apps (S5 → S6): what the panel shows — ready, a call in flight ("Signing…", then
 * "Opening Up…" until the stream says filled), calls closed for the lockout (D-261: opens and cash-outs both stop 20 s
 * before expiry), a stale price, no K yet — and the two actions with their guards: open the mode's first or second
 * band (Up / Down, Range, Moonshot / Crash — S7.4) at the quote the user saw (window full, not priced, not enough
 * dollars said plainly), cash out all or part (proceeds are linear in
 * shares, BandBook `_fillClose`). Each tap draws its trade's toast at once and carries it through the run (R5.11):
 * "Opening Up…" → "Up BTC opened", "Cashing out…" → the result (`useResults`, same id). The platform supplies the
 * effects: feedback, notices, the toast, the sign-in prompt.
 */
import type { IntentStatus } from "@senryo/api-client";
import { clockText, formatUnits, proceedsFor } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useIntentStatus, useRefreshCaller } from "@senryo/query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { endsText } from "./book-words.ts";
import type { Caller } from "./caller.ts";
import { forgetIntent } from "./intent-journal.ts";
import type { Offer } from "./modes.ts";
import type { Quotes } from "./quote.ts";
import { reasonWords } from "./reason-words.ts";
import { clearSelectedPosition } from "./terminal-ready.ts";
import { type TradeNote, tradeHasResult, tradeToastId } from "./toast-run.ts";
import { dropRun, startRun, updateRun } from "./trade-run.ts";
import { useCallActions } from "./use-call.ts";
import type { CallWindowView } from "./use-call-window.ts";
import { usePriceHealth } from "./use-price-health.ts";
import { useWindowDead } from "./use-window-dead.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_MINUTE = 60;
const E8 = 1e8;
const SETTLED = new Set(["filled", "refused", "failed"]);
export const WHOLE = 100n;

export type PanelState =
  | { kind: "ready" }
  | { kind: "pending"; status: IntentStatus | null; label: string }
  | { kind: "locked"; text: string }
  /** Calls held for the price, with the cause in words (`priceHealth`: reconnecting, delayed, halted, no price). */
  | { kind: "stale"; text: string }
  | { kind: "no-price" };

export type FlowCue = "press" | "filled-open" | "filled-close" | "fail";

/** A trade on its way: its toast, and what the toast and the cue say when it fills. */
export interface FlowPending {
  digest: `0x${string}`;
  label: string;
  kind: "open" | "close";
  toast: string;
  /** A full close's note is a placeholder: its realised amount lands from `useResults` on the same toast. */
  filled: TradeNote;
  /** A full close plays nothing at the fill: the result plays win or loss by the realised sign (R5.12). */
  cue: FlowCue | null;
}

const usdText = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface CallFlowEffects {
  /** The tap, a fill (open or cash-out) and a failure: sound and haptic. */
  cue(cue: FlowCue): void;
  notify(notice: { title: string; description: string }): void;
  /** The trade's one toast (R5.11): a note with the same id replaces it in place; null takes it down. */
  toast(id: string, note: TradeNote | null): void;
  /**
   * No account on this device. With the call they picked (`slot`), the app opens that call's own sheet whose passkey
   * signs it (F14: the signature is the sign-up, not a wall before it); without one (a cash-out), ask to sign in.
   */
  needAccount(slot?: OfferSlot): void;
  /** One of this screen's calls filled (first-run setup moves on). */
  onFilled?: () => void;
  /** A check before any call once signed in (the terms): say why and return false to stop. */
  gate?: () => boolean;
  /** Not enough dollars: the app names the gap and offers where dollars come from (R5.7). */
  shortfall?: (short: bigint) => void;
}

export interface CallFlowInput {
  view: CallWindowView;
  caller: Caller;
  stake: bigint;
  latest: RefObject<Quotes>;
  /** The mode's two buttons (`offerOf`). */
  offer: Offer;
  effects: CallFlowEffects;
}

/** Which offered button a tap places: the first (Up, Range, Moonshot) or the second (Down, Crash). */
export type OfferSlot = 0 | 1;

export function useCallFlow({ view: t, caller, stake, latest, offer, effects }: CallFlowInput) {
  const actions = useCallActions(caller);
  // Between the tap and the relay's answer: the signature (one-tap, or the passkey prompt).
  const [signing, setSigning] = useState(false);
  // The price at the tap: the chart draws "Opening…" there until the fill draws the entry (R5.11).
  const [pendingEntry, setPendingEntry] = useState<number | null>(null);
  const live = useLive();
  const [pending, setPending] = useState<FlowPending | null>(null);
  const intent = useIntentStatus(pending?.digest);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  // A call settles into a result: filled (sound and haptic), refused or failed (said plainly), on its toast.
  const status: IntentStatus | null = "value" in intent ? intent.value : null;
  const refresh = useRefreshCaller(t.owner);
  useEffect(() => {
    const p = pendingRef.current;
    if (!status || !SETTLED.has(status.state) || !p) return;
    refresh();
    forgetIntent(p.digest);
    settleRun(effectsRef.current, p, status, {
      symbol: t.symbol,
      refused: p.kind === "close" ? "Cash-out refused" : "Call refused",
      failed: p.kind === "close" ? "Cash-out didn't go through" : "Call didn't go through",
      kept: p.kind === "close" ? "It's still open." : "Your stake was not taken.",
    });
    setPending(null);
    setPendingEntry(null);
  }, [status, refresh, t.symbol]);

  // Quotable only on a live settlement price; otherwise the panel says why (04-pricing R7).
  const health = usePriceHealth(t.symbol);
  const dead = useWindowDead(t);
  const holding = t.position !== undefined && t.position.state !== "committed";
  const lockText = holding
    ? `Cash-out closed · result in ${clockText(t.window.expiry - t.now)}`
    : `Calls closed · next opens in ${clockText(t.window.expiry - t.now)}`;
  const panel: PanelState = pending
    ? { kind: "pending", status, label: pending.label }
    : signing
      ? { kind: "pending", status: null, label: "Signing…" }
      : !t.window.trading
        ? { kind: "locked", text: lockText }
        : dead && !holding
          ? { kind: "locked", text: `No calls in this window · the next opens at ${endsText(t.window.expiry)}` }
          : !health.live
            ? { kind: "stale", text: health.notice ?? "Price paused" }
            : t.k === undefined
              ? { kind: "no-price" }
              : { kind: "ready" };

  const guard = (slot?: OfferSlot): boolean => {
    if (!t.owner) {
      effectsRef.current.needAccount(slot);
      return false;
    }
    if (effectsRef.current.gate && !effectsRef.current.gate()) return false;
    return actions.ready;
  };

  const open = async (slot: OfferSlot) => {
    if (!guard(slot)) return;
    clearSelectedPosition();
    const fx = effectsRef.current;
    const band = offer[slot];
    const quote = slot === 0 ? latest.current?.first : latest.current?.second;
    if (quote?.refusal === "capacity") {
      fx.notify({
        title: "This window is full",
        description: `The pool has no more room on it. The next opens in ${clockText(t.window.expiry - t.now)}.`,
      });
      return;
    }
    if (!band || !quote || quote.refusal) {
      fx.notify({ title: "Not priced right now", description: "Try the next window." });
      return;
    }
    if (t.balance !== undefined && t.balance < stake) {
      if (fx.shortfall) fx.shortfall(stake - t.balance);
      else
        fx.notify({
          title: "Not enough dollars",
          description: `You have $${formatUnits(t.balance, DOLLAR_DECIMALS, CENTS)}.`,
        });
      return;
    }
    const label = band.label;
    fx.cue("press");
    // The pending entry is drawn at the tap (R5.11), before the signature.
    const id = tradeToastId.open();
    const where = `${t.symbol} ${t.window.cadenceSec / SECONDS_PER_MINUTE}m`;
    const opening = `${where} · ${usdText(stake)} in`;
    fx.toast(id, { title: `Opening ${label}…`, description: opening, symbol: t.symbol, tone: "loading" });
    startRun({
      key: id,
      instrument: "call",
      symbol: t.symbol,
      title: `${t.symbol} · ${label} · ${t.window.cadenceSec / SECONDS_PER_MINUTE}m`,
      quoted: [
        { k: "Stake", v: usdText(stake), money: true },
        { k: "Pays if right", v: usdText(quote.payout), money: true },
      ],
    });
    const tapped = live.prices.latest(t.symbol)?.priceE8;
    setPendingEntry(tapped === undefined ? null : tapped / E8);
    let sent = false;
    setSigning(true);
    try {
      const r = await actions.open({
        window: t.window,
        band: band.index,
        bandLabel: label,
        stake,
        payoutQuote: quote.payout,
        payoutLimit: slot === 0 ? latest.current?.limits?.first : latest.current?.limits?.second,
        journal: { what: `${label} ${where}`, kind: "open", instrument: "call", symbol: t.symbol, toast: id },
      });
      if (r.kind === "cancelled") {
        fx.toast(id, null);
        dropRun(id);
      }
      // A lost answer is recovery's to tell, on this same toast (R5.13).
      else if (r.kind === "unknown") updateRun(id, { stage: "pending", digest: r.digest });
      else {
        sent = true;
        updateRun(id, { stage: "pending", digest: r.status.digest });
        setPending({
          digest: r.status.digest,
          label: `Opening ${label}…`,
          kind: "open",
          toast: id,
          filled: {
            title: `${label} ${t.symbol} opened`,
            description: `Pays ${usdText(quote.payout)} if it holds · ${usdText(stake)} in`,
            symbol: t.symbol,
            tone: "info",
          },
          cue: "filled-open",
        });
      }
    } catch (error) {
      fx.cue("fail");
      dropRun(id);
      fx.toast(id, {
        title: "Couldn't place the call",
        description: reasonWords((error as Error).message, "Your stake was not taken."),
        symbol: t.symbol,
        tone: "warning",
      });
    } finally {
      setSigning(false);
      if (!sent) setPendingEntry(null);
    }
  };

  const close = async (percent: bigint = WHOLE) => {
    const position = t.position;
    const quote = latest.current?.close;
    if (!guard() || !position || !quote || quote.refusal) return;
    const fx = effectsRef.current;
    fx.cue("press");
    const shares = (position.payout * percent) / WHOLE;
    const whole = percent === WHOLE;
    const label = whole ? "Cashing out…" : `Cashing out ${percent}%…`;
    const id = tradeToastId.call(position.ticketId);
    fx.toast(id, { title: label, symbol: t.symbol, tone: "loading" });
    setSigning(true);
    try {
      const r = await actions.close({
        window: t.window,
        ticketId: position.ticketId,
        band: position.band,
        shares,
        proceedsQuote: percent === WHOLE ? quote.proceeds : proceedsFor(shares, quote.bidE6),
        // The limit scales with the part: proceeds are linear in shares.
        proceedsLimit: latest.current?.limits?.close == null ? null : (latest.current.limits.close * percent) / WHOLE,
        journal: {
          what: `Your ${t.symbol} ${t.window.cadenceSec / SECONDS_PER_MINUTE}m call`,
          kind: "close",
          instrument: "call",
          symbol: t.symbol,
          toast: id,
        },
      });
      if (r.kind === "cancelled") fx.toast(id, null);
      else if (r.kind === "sent")
        setPending({
          digest: r.status.digest,
          label,
          kind: "close",
          toast: id,
          filled: {
            title: whole ? "Cashed out" : `Cashed out ${percent}%`,
            description: whole ? "Counting it up…" : "The rest rides on.",
            symbol: t.symbol,
            tone: "info",
          },
          cue: whole ? null : "filled-close",
        });
    } catch (error) {
      fx.cue("fail");
      fx.toast(id, {
        title: "Couldn't cash out",
        description: reasonWords((error as Error).message, "It's still open."),
        symbol: t.symbol,
        tone: "warning",
      });
    } finally {
      setSigning(false);
    }
  };

  return { panel, holding, open, close, pendingEntry };
}

/**
 * A trade's intent settled: filled plays its cue and shows its filled note (unless the result already landed on the
 * toast — a late step never overwrites it); refused or failed says why in words on the same toast.
 */
export function settleRun(
  fx: CallFlowEffects,
  p: FlowPending,
  status: IntentStatus,
  words: { symbol: string; refused: string; failed: string; kept: string },
): void {
  if (status.state === "filled") {
    if (p.cue) fx.cue(p.cue);
    if (!tradeHasResult(p.toast)) fx.toast(p.toast, p.filled);
    // The open is booked: its row takes the pending object's place (R5.11).
    if (p.kind === "open") updateRun(p.toast, { stage: "booked", id: status.ticketId ?? status.rideId ?? null });
    fx.onFilled?.();
    return;
  }
  if (p.kind === "open") dropRun(p.toast);
  fx.cue("fail");
  fx.toast(p.toast, {
    title: status.state === "refused" ? words.refused : words.failed,
    description: reasonWords(status.reason, words.kept),
    symbol: words.symbol,
    tone: "warning",
  });
}
