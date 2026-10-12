"use client";
/**
 * The terminal's action group (Codex direction 11 §1, §5–6, R5.4–R5.5): Call | Ride with one-tap's state beside it,
 * one plain sentence when something holds the buttons (a call or ride in flight, the lockout, a stale price, a window
 * nobody opened, a market that doesn't ride), then the trade buttons — UP / DOWN, or TRAIL / CLOSE while held. A
 * market outside its session says so with its next open; Real before mainnet points to Practice (D-320).
 */
import { closedWords, INSTRUMENTS, type Instrument, type MarketLine } from "@senryo/calls";
import type { PanelState } from "@senryo/calls/react";
import { LiveText } from "@/components/kit/live-text";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { activeNetwork, setActiveNetwork } from "@/lib/network";
import type { LiveValue } from "@/lib/terminal/live-value";
import { OneTapLine } from "./OneTapLine";
import { TradeButtons, type TradeButtonsProps } from "./TradeButtons";

function noticeOf(state: PanelState): string | null {
  if (state.kind === "pending") return state.label;
  if (state.kind === "locked" || state.kind === "stale") return state.text;
  if (state.kind === "no-price") return "Waiting for the opening price";
  return null;
}

function ClosedPanel({ symbol, line }: { symbol: string; line: MarketLine }) {
  // Real before mainnet (D-320): every price is live and browsable; the calls are in Practice, one tap away.
  if (line.unlisted && activeNetwork().key === "mainnet") {
    return (
      <div className="terminal-panel" role="status">
        <p className="font-semibold text-section-title">Trading opens with mainnet</p>
        <p className="text-body text-text-2">{symbol}'s price is live. Make your calls in Practice meanwhile.</p>
        <button
          type="button"
          className="terminal-call is-neutral"
          onClick={() => {
            fire("snap", { cue: "toggle" });
            setActiveNetwork("testnet");
          }}
        >
          Switch to Practice to play
        </button>
      </div>
    );
  }
  const words = closedWords(symbol, line);
  return (
    <div className="terminal-panel" role="status">
      <p className="font-semibold text-section-title">{words.title}</p>
      <p className="text-body text-text-2">{line.text}</p>
      <p className="text-meta text-text-3">{words.note}</p>
    </div>
  );
}

export interface ActionPanelProps {
  symbol: string;
  session: MarketLine;
  instrument: Instrument;
  /** The market rides (D-299 v1: the 24/7 Pyth crypto); else Ride explains itself. */
  rides: boolean;
  onInstrument: (i: Instrument) => void;
  state: PanelState;
  holding: boolean;
  /** Why a shown side has no price now (a call's "Too one-sided to price right now"), when nothing else holds them. */
  quoteNote: LiveValue<string | null> | null;
  buttons: TradeButtonsProps;
}

export function ActionPanel(p: ActionPanelProps) {
  if (!p.session.trading && !p.holding) return <ClosedPanel symbol={p.symbol} line={p.session} />;
  const notice = noticeOf(p.state);
  return (
    <div className="terminal-panel">
      <div className="flex items-center gap-3">
        <SegmentedControl
          options={INSTRUMENTS}
          label="Call or ride"
          value={p.instrument}
          onValueChange={(v) => {
            fire("tick", { cue: "toggle" });
            p.onInstrument(v as Instrument);
          }}
          className="flex-1"
          fill
        />
        <OneTapLine compact />
      </div>
      <p className="terminal-note" role="status" aria-live="polite">
        {notice ??
          (p.instrument === "ride" && !p.rides ? (
            `Rides aren't available on ${p.symbol}`
          ) : p.quoteNote && !p.holding ? (
            <LiveText value={p.quoteNote} format={(v) => v ?? ""} />
          ) : (
            ""
          ))}
      </p>
      <TradeButtons {...p.buttons} />
    </div>
  );
}
