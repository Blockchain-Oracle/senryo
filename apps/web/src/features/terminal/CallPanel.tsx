"use client";
/**
 * The call panel (the phone's `CallPanel`; Tradash's UP/DOWN ↔ CLOSE, Owarine's `TradeButtons`, F8): the way to call
 * (Up / Down · Range · Moonshot, S7.4), the stake (the last one remembered; $1 · $5 · $10 · $25 · any amount · Max),
 * then the mode's buttons — label only (↑ UP, ↓ DOWN, ↔ RANGE, MOONSHOT, CRASH) on their direction fills, "Pays 2.14× ·
 * $10.70" under each; where a side wins is shaded on the chart while the button is hovered or focused, and a side with
 * no price turns a recessed plate with "—" while one sentence outside the buttons says why — or, holding a call in this
 * window, CASH OUT with the
 * value it returns now, a part (25 / 50 %) and its exit (take profit, stop, trail — S8.4) with the armed exit's line. Honest
 * states: calls closed for the lockout, a stale price, a call in flight, and a market outside its session ("TSLA is
 * closed · Opens Mon 09:30 ET", D-289). Keys: ↑ Up, ↓ Down, C cash out.
 */
import { CALL_MODES, type CallMode, closedWords, type MarketLine, type Offer, type OfferedBand } from "@senryo/calls";
import type { OfferSlot, PanelState } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { ArrowDown, ArrowDownUp, ArrowUp, Crosshair, Ellipsis, MoveVertical, Rocket, TrendingDown } from "lucide-react";
import { type ComponentType, useEffect, useRef } from "react";
import { LiveText } from "@/components/kit/live-text";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { activeNetwork, setActiveNetwork } from "@/lib/network";
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
  if (state.kind === "stale") return state.text;
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
  /** Why a shown side has no price (one sentence, outside the buttons), or null. */
  quoteNote: LiveValue<string | null>;
  /** Shade where the hovered or focused side wins on the chart (null clears it). */
  onPreview: (side: 0 | 1 | null) => void;
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

/** The pays line reads "—" while its side has no price: the button turns a recessed plate and takes no tap. */
const UNPRICED = "—";

function CallButton(p: {
  offered: OfferedBand;
  odds: LiveValue<string>;
  disabled: boolean;
  onPick: () => void;
  onPreview: (on: boolean) => void;
  shortcut: string;
}) {
  const Icon = ICON[p.offered.band.kind];
  const directional = p.offered.band.kind === "up" || p.offered.band.kind === "down";
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const paint = (line: string) => {
      if (ref.current) ref.current.dataset.priced = line === UNPRICED ? "false" : "true";
    };
    paint(p.odds.get());
    return p.odds.subscribe(paint);
  }, [p.odds]);
  return (
    <div className="terminal-call-slot">
      <button
        ref={ref}
        type="button"
        className={cn("terminal-call", TONE_CLASS[p.offered.tone])}
        disabled={p.disabled}
        onClick={() => ref.current?.dataset.priced !== "false" && p.onPick()}
        onPointerEnter={() => p.onPreview(true)}
        onPointerLeave={() => p.onPreview(false)}
        onFocus={() => p.onPreview(true)}
        onBlur={() => p.onPreview(false)}
        aria-label={`Call ${p.offered.label}${directional ? "" : `, ${p.offered.where}`}`}
        aria-keyshortcuts={p.shortcut}
      >
        <Icon aria-hidden className="size-4.5" strokeWidth={3} />
        {p.offered.label}
      </button>
      <LiveText value={p.odds} className="terminal-call-pays tnum" />
    </div>
  );
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
            fire("tick", { cue: "toggle" });
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
          {/* Max only with a balance to spend (R2.15: no disabled button without a reason; a guest has none). */}
          {p.balance !== undefined ? (
            <button
              type="button"
              aria-pressed={isMax}
              className="terminal-preset"
              onClick={() => p.balance !== undefined && pick(p.balance)}
            >
              Max
            </button>
          ) : null}
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
              onPreview={(on) => p.onPreview(on ? 0 : null)}
              shortcut="ArrowUp"
            />
          ) : null}
          {p.offer[1] ? (
            <CallButton
              offered={p.offer[1]}
              odds={p.secondOdds}
              disabled={blocked}
              onPick={() => p.onPick(1)}
              onPreview={(on) => p.onPreview(on ? 1 : null)}
              shortcut="ArrowDown"
            />
          ) : null}
        </div>
      )}
      {p.holding ? null : <LiveText value={p.quoteNote} format={(v) => v ?? ""} className="terminal-quote-note" />}
    </div>
  );
}
