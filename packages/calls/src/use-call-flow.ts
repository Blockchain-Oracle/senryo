/**
 * The terminal's call flow, both apps (S5 → S6): what the panel shows — ready, a call in flight ("Signing…", then
 * "Opening Up…" until the stream says filled), calls closed for the lockout (D-261: opens and cash-outs both stop 20 s
 * before expiry), a stale price, no K yet — and the two actions with their guards: open the mode's first or second
 * band (Up / Down, Range, Moonshot / Crash — S7.4) at the quote the user saw (window full, not priced, not enough
 * dollars said plainly), cash out all or part (proceeds are linear in
 * shares, BandBook `_fillClose`). The platform supplies the effects: feedback, notices, the sign-in prompt.
 */
import type { IntentStatus } from "@senryo/api-client";
import { clockText, formatUnits, proceedsFor } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import { useIntentStatus, useRefreshCaller } from "@senryo/query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { Caller } from "./caller.ts";
import type { Offer } from "./modes.ts";
import type { Quotes } from "./quote.ts";
import { useCallActions } from "./use-call.ts";
import type { CallWindowView } from "./use-call-window.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SETTLED = new Set(["filled", "refused", "failed"]);
export const WHOLE = 100n;

export type PanelState =
  | { kind: "ready" }
  | { kind: "pending"; status: IntentStatus | null; label: string }
  | { kind: "locked"; text: string }
  | { kind: "stale" }
  | { kind: "no-price" };

export type FlowCue = "press" | "filled-open" | "filled-close" | "fail";

export interface CallFlowEffects {
  /** The tap, a fill (open or cash-out) and a failure: sound and haptic. */
  cue(cue: FlowCue): void;
  notify(notice: { title: string; description: string }): void;
  /** No account on this device: ask to sign in or create one ("make a call"). */
  needAccount(): void;
  /** One of this screen's calls filled (first-run setup moves on). */
  onFilled?: () => void;
  /** A check before any call once signed in (the terms): say why and return false to stop. */
  gate?: () => boolean;
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
  const live = useLive();
  const actions = useCallActions(caller);
  // Between the tap and the relay's answer: the signature (one-tap, or the passkey prompt).
  const [signing, setSigning] = useState(false);
  const [pending, setPending] = useState<{ digest: `0x${string}`; label: string; kind: "open" | "close" } | null>(null);
  const intent = useIntentStatus(pending?.digest);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  // A call settles into a result: filled (sound and haptic), refused or failed (said plainly).
  const status: IntentStatus | null = "value" in intent ? intent.value : null;
  const refresh = useRefreshCaller(t.owner);
  useEffect(() => {
    if (!status || !SETTLED.has(status.state)) return;
    refresh();
    const fx = effectsRef.current;
    if (status.state === "filled") {
      fx.cue(pendingRef.current?.kind === "close" ? "filled-close" : "filled-open");
      fx.onFilled?.();
    } else {
      fx.cue("fail");
      fx.notify({
        title: status.state === "refused" ? "Call refused" : "Call didn't go through",
        description: status.reason ?? "Your stake was not taken.",
      });
    }
    setPending(null);
  }, [status, refresh]);

  const stale = live.prices.isStale(t.symbol, Date.now());
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
        : stale
          ? { kind: "stale" }
          : t.k === undefined
            ? { kind: "no-price" }
            : { kind: "ready" };

  const guard = (): boolean => {
    if (!t.owner) {
      effectsRef.current.needAccount();
      return false;
    }
    if (effectsRef.current.gate && !effectsRef.current.gate()) return false;
    return actions.ready;
  };

  const open = async (slot: OfferSlot) => {
    if (!guard()) return;
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
      fx.notify({
        title: "Not enough dollars",
        description: `You have $${formatUnits(t.balance, DOLLAR_DECIMALS, CENTS)}.`,
      });
      return;
    }
    const label = band.label;
    fx.cue("press");
    setSigning(true);
    try {
      const r = await actions.open({
        window: t.window,
        band: band.index,
        bandLabel: label,
        stake,
        payoutQuote: quote.payout,
      });
      if (r.kind === "sent") setPending({ digest: r.status.digest, label: `Opening ${label}…`, kind: "open" });
    } catch (error) {
      fx.cue("fail");
      fx.notify({ title: "Couldn't place the call", description: (error as Error).message });
    } finally {
      setSigning(false);
    }
  };

  const close = async (percent: bigint = WHOLE) => {
    const position = t.position;
    const quote = latest.current?.close;
    if (!guard() || !position || !quote || quote.refusal) return;
    const fx = effectsRef.current;
    fx.cue("press");
    const shares = (position.payout * percent) / WHOLE;
    setSigning(true);
    try {
      const r = await actions.close({
        window: t.window,
        ticketId: position.ticketId,
        band: position.band,
        shares,
        proceedsQuote: percent === WHOLE ? quote.proceeds : proceedsFor(shares, quote.bidE6),
      });
      const label = percent === WHOLE ? "Cashing out…" : `Cashing out ${percent}%…`;
      if (r.kind === "sent") setPending({ digest: r.status.digest, label, kind: "close" });
    } catch (error) {
      fx.cue("fail");
      fx.notify({ title: "Couldn't cash out", description: (error as Error).message });
    } finally {
      setSigning(false);
    }
  };

  return { panel, holding, open, close };
}
