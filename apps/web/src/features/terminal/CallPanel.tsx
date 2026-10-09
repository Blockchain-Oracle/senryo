"use client";
/**
 * The call panel (the phone's `CallPanel`; Tradash's UP/DOWN ↔ CLOSE, Owarine's web buttons): the stake (the last one
 * remembered; $1 · $5 · $10 · $25 · any amount · Max), then UP and DOWN each with its live odds ("pays 1.92× · about
 * 52%"), or — holding a call in this window — CASH OUT with the value it returns now, and a part (25 / 50 %). Honest
 * states: calls closed for the lockout, a stale price, a call in flight, and a market outside its session ("TSLA is
 * closed · Opens Mon 09:30 ET", D-289). Keys: ↑ Up, ↓ Down, C cash out.
 */
import type { MarketLine } from "@senryo/calls";
import type { PanelState } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { ArrowDown, ArrowDownUp, ArrowUp, Ellipsis } from "lucide-react";
import { LiveText } from "@/components/kit/live-text";
import { fire } from "@/lib/feedback";
import type { LiveValue } from "@/lib/terminal/live-value";
import { cn } from "@/lib/utils";
import { STAKE_PRESETS_USD } from "./constants";
import { OneTapLine } from "./OneTapLine";
import type { CashOutFigure } from "./useLiveQuote";

const USD = 1_000_000n;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

function noticeOf(state: PanelState): string | null {
  if (state.kind === "pending") return state.label;
  if (state.kind === "locked") return state.text;
  if (state.kind === "stale") return "Reconnecting · price paused";
  if (state.kind === "no-price") return "Waiting for the opening price";
  return null;
}

export interface CallPanelProps {
  symbol: string;
  /** The market's session line; not trading means no new calls (a call already held can still cash out). */
  session: MarketLine;
  state: PanelState;
  stake: bigint;
  balance: bigint | undefined;
  onStake: (stake: bigint) => void;
  upOdds: LiveValue<string>;
  downOdds: LiveValue<string>;
  holding: boolean;
  cashOut: LiveValue<CashOutFigure>;
  onUp: () => void;
  onDown: () => void;
  onClose: () => void;
  onCustom: () => void;
  onClosePart: () => void;
}

function ClosedPanel({ symbol, when }: { symbol: string; when: string }) {
  return (
    <div className="terminal-panel" role="status">
      <p className="font-semibold text-section-title">{symbol} is closed</p>
      <p className="text-body text-text-2">{when}</p>
      <p className="text-meta text-text-3">The price shown is its last print. Calls open with the market.</p>
    </div>
  );
}

export function CallPanel(p: CallPanelProps) {
  if (!p.session.trading && !p.holding) return <ClosedPanel symbol={p.symbol} when={p.session.text} />;
  const blocked = p.state.kind !== "ready";
  const presets = STAKE_PRESETS_USD.map((usd) => BigInt(usd) * USD);
  const isMax = p.balance !== undefined && p.stake === p.balance;
  const custom = !presets.includes(p.stake) && !isMax;
  const notice = noticeOf(p.state);
  const pick = (value: bigint) => {
    fire("tick", { cue: "tap" });
    p.onStake(value);
  };
  return (
    <div className="terminal-panel">
      {p.holding ? null : (
        <fieldset className="terminal-presets">
          <legend className="sr-only">Stake</legend>
          {STAKE_PRESETS_USD.map((usd, i) => (
            <button
              key={usd}
              type="button"
              aria-pressed={presets[i] === p.stake}
              className="terminal-preset"
              onClick={() => pick(presets[i] ?? USD)}
            >
              ${usd}
            </button>
          ))}
          <button
            type="button"
            className="terminal-preset"
            aria-pressed={custom}
            aria-label={custom ? `Stake ${dollars(p.stake)}. Change` : "Other stake"}
            onClick={() => {
              fire("tick", { cue: "tap" });
              p.onCustom();
            }}
          >
            {custom ? dollars(p.stake) : <Ellipsis aria-hidden className="size-4" />}
          </button>
          <button
            type="button"
            aria-pressed={isMax}
            className="terminal-preset"
            disabled={p.balance === undefined}
            onClick={() => p.balance !== undefined && pick(p.balance)}
          >
            Max
          </button>
        </fieldset>
      )}
      {notice ? (
        <p className="terminal-note" role="status" aria-live="polite">
          {notice}
        </p>
      ) : (
        <OneTapLine />
      )}
      {p.holding ? (
        <div className="terminal-cash">
          <button
            type="button"
            className="terminal-cashout"
            disabled={blocked}
            onClick={p.onClose}
            aria-keyshortcuts="C"
          >
            <ArrowDownUp aria-hidden className="size-5" />
            <span>Cash out</span>
            <LiveText value={p.cashOut} format={(f) => f.text} className="terminal-cashout-value tnum" />
          </button>
          <button
            type="button"
            className="terminal-part"
            disabled={blocked}
            aria-label="Cash out part of the call"
            onClick={() => {
              fire("snap", { cue: "tap" });
              p.onClosePart();
            }}
          >
            <Ellipsis aria-hidden className="size-5" />
          </button>
        </div>
      ) : (
        <div className="terminal-calls">
          <button
            type="button"
            className={cn("terminal-call", "is-up")}
            disabled={blocked}
            onClick={p.onUp}
            aria-label="Call Up"
            aria-keyshortcuts="ArrowUp"
          >
            <span className="terminal-call-label">
              <ArrowUp aria-hidden className="size-5" strokeWidth={3} />
              Up
            </span>
            <LiveText value={p.upOdds} className="terminal-call-odds" />
          </button>
          <button
            type="button"
            className={cn("terminal-call", "is-down")}
            disabled={blocked}
            onClick={p.onDown}
            aria-label="Call Down"
            aria-keyshortcuts="ArrowDown"
          >
            <span className="terminal-call-label">
              <ArrowDown aria-hidden className="size-5" strokeWidth={3} />
              Down
            </span>
            <LiveText value={p.downOdds} className="terminal-call-odds" />
          </button>
        </div>
      )}
    </div>
  );
}
