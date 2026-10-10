"use client";
/**
 * The call panel (the phone's `CallPanel`; Tradash's UP/DOWN ↔ CLOSE, Owarine's web buttons): the way to call (Up /
 * Down · Range · Moonshot, S7.4), the stake (the last one remembered; $1 · $5 · $10 · $25 · any amount · Max), then the
 * mode's buttons — UP and DOWN, RANGE between its edges, MOONSHOT ▲ and CRASH ▼ beyond their strikes — each with
 * where it wins and its live odds ("pays 2.61× · about 37%"), or — holding a call in this window — CASH OUT with the
 * value it returns now, a part (25 / 50 %) and its exit (take profit, stop, trail — S8.4) with the armed exit's line. Honest
 * states: calls closed for the lockout, a stale price, a call in flight, and a market outside its session ("TSLA is
 * closed · Opens Mon 09:30 ET", D-289). Keys: ↑ Up, ↓ Down, C cash out.
 */
import { CALL_MODES, type CallMode, closedWords, type MarketLine, type Offer, type OfferedBand } from "@senryo/calls";
import type { OfferSlot, PanelState } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { ArrowDown, ArrowDownUp, ArrowUp, Crosshair, Ellipsis, MoveVertical, Rocket, TrendingDown } from "lucide-react";
import type { ComponentType } from "react";
import { LiveText } from "@/components/kit/live-text";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  mode: CallMode;
  onMode: (mode: CallMode) => void;
  offer: Offer;
  firstOdds: LiveValue<string>;
  secondOdds: LiveValue<string>;
  holding: boolean;
  cashOut: LiveValue<CashOutFigure>;
  onPick: (slot: OfferSlot) => void;
  onClose: () => void;
  onCustom: () => void;
  onClosePart: () => void;
  /** The armed exit in words ("Take profit $15.00 · Stop $8.00"), or null. */
  exitLine: string | null;
  onExit: () => void;
}

const ICON: Readonly<Record<OfferedBand["band"]["kind"], ComponentType<{ className?: string; strokeWidth?: number }>>> =
  { up: ArrowUp, down: ArrowDown, range: MoveVertical, moonshot: Rocket, crash: TrendingDown };
const TONE_CLASS = { up: "is-up", down: "is-down", neutral: "is-neutral" } as const;

function CallButton(p: {
  offered: OfferedBand;
  odds: LiveValue<string>;
  disabled: boolean;
  onPick: () => void;
  shortcut: string;
}) {
  const Icon = ICON[p.offered.band.kind];
  const directional = p.offered.band.kind === "up" || p.offered.band.kind === "down";
  return (
    <button
      type="button"
      className={cn("terminal-call", TONE_CLASS[p.offered.tone])}
      disabled={p.disabled}
      onClick={p.onPick}
      aria-label={`Call ${p.offered.label}${directional ? "" : `, ${p.offered.where}`}`}
      aria-keyshortcuts={p.shortcut}
    >
      <span className="terminal-call-label">
        <Icon aria-hidden className="size-5" strokeWidth={3} />
        {p.offered.label}
      </span>
      {directional ? null : <span className="terminal-call-where">{p.offered.where}</span>}
      <LiveText value={p.odds} className="terminal-call-odds" />
    </button>
  );
}

function ClosedPanel({ symbol, line }: { symbol: string; line: MarketLine }) {
  const words = closedWords(symbol, line);
  return (
    <div className="terminal-panel" role="status">
      <p className="font-semibold text-section-title">{words.title}</p>
      <p className="text-body text-text-2">{line.text}</p>
      <p className="text-meta text-text-3">{words.note}</p>
    </div>
  );
}

export function CallPanel(p: CallPanelProps) {
  if (!p.session.trading && !p.holding) return <ClosedPanel symbol={p.symbol} line={p.session} />;
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
        <SegmentedControl
          options={CALL_MODES}
          label="Way to call"
          value={p.mode}
          onValueChange={(v) => {
            fire("tick", { cue: "tap" });
            p.onMode(v as CallMode);
          }}
          fill
        />
      )}
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
      {p.holding && p.exitLine ? <p className="terminal-note tnum">{p.exitLine}</p> : null}
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
          <button
            type="button"
            className="terminal-part"
            aria-pressed={p.exitLine !== null}
            aria-label={p.exitLine ? `Exit: ${p.exitLine}. Change` : "Set an exit: take profit, stop or trail"}
            onClick={() => {
              fire("snap", { cue: "tap" });
              p.onExit();
            }}
          >
            <Crosshair aria-hidden className="size-5" />
          </button>
        </div>
      ) : (
        <div className={cn("terminal-calls", !p.offer[1] && "is-one")}>
          {p.offer[0] ? (
            <CallButton
              offered={p.offer[0]}
              odds={p.firstOdds}
              disabled={blocked}
              onPick={() => p.onPick(0)}
              shortcut="ArrowUp"
            />
          ) : null}
          {p.offer[1] ? (
            <CallButton
              offered={p.offer[1]}
              odds={p.secondOdds}
              disabled={blocked}
              onPick={() => p.onPick(1)}
              shortcut="ArrowDown"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
